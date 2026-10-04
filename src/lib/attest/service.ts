/**
 * Attestor session logic behind /api/attest/{start,chunk,finish}. Transport-agnostic: the route
 * handlers parse HTTP and call this; tests drive it directly with a fake clock and RNG.
 */
import "server-only";
import { isAddress } from "@solana/kit";
import { EXERCISE_LIST } from "@/lib/exercises";
import { isExerciseKind, type ExerciseKind, type PoseFrame } from "@/lib/pose/types";
import type { ApiErrorCode } from "@/lib/solana/types";
import { CHALLENGE_SPECS, minSessionMs, planChallenges, type PlannedChallenge } from "./challenges";
import defaultOnchain, { AttestNotConfiguredError, type AttestOnchain } from "./onchain";
import type {
  ChunkResponse,
  DueChallenge,
  FinishResponse,
  StartResponse,
} from "./protocol";
import { AttestStore, StoreFullError, type AttestSession, type FinishResult } from "./store";
import {
  decodeChunk,
  decodeChunkBytes,
  poseFrameFromTrace,
  sessionHash,
  sha256,
  toHex,
  traceContentHash,
  TraceFormatError,
  type EncodedChunk,
} from "./trace";
import { verifySession, type VerifyConfig } from "./verify";

export class AttestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "AttestError";
  }
}

export interface AttestServiceConfig {
  /** Reveal a challenge this long before it is due. */
  revealLeadMs: number;
  /** Only reveal on a chunk whose last frame is at most this old (server clock). */
  maxRevealLagMs: number;
  chunkIntervalMs: number;
  /** Max base64 chars of one chunk's data. */
  maxChunkChars: number;
  /** Max session length: min(cap, base + factor x honest minimum). */
  maxDurationBaseMs: number;
  maxDurationFactor: number;
  maxDurationCapMs: number;
  /** Sanity bounds on goals (the vault enforces the real per-exercise limits). */
  maxGoal: Record<ExerciseKind, number>;
  verify?: Partial<VerifyConfig>;
}

export const SERVICE_DEFAULTS: AttestServiceConfig = Object.freeze({
  revealLeadMs: 1000,
  maxRevealLagMs: 4000,
  chunkIntervalMs: 1000,
  maxChunkChars: 128 * 1024,
  maxDurationBaseMs: 10 * 60_000,
  maxDurationFactor: 3,
  maxDurationCapMs: 60 * 60_000,
  maxGoal: Object.fromEntries(
    EXERCISE_LIST.map((info) => [info.kind, info.unit === "seconds" ? 3600 : 1000]),
  ) as Record<ExerciseKind, number>,
}) as AttestServiceConfig;

export interface AttestServiceDeps {
  store?: AttestStore;
  /** The on-chain adapter, or a getter (resolved per call so it can be swapped at runtime). */
  onchain?: AttestOnchain | (() => AttestOnchain);
  now?: () => number;
  random?: () => number;
  newId?: () => string;
  planner?: (exercise: ExerciseKind, goalTarget: number, random: () => number) => PlannedChallenge[];
  config?: Partial<AttestServiceConfig>;
}

const SESSION_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function cryptoRandom(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 0x1_0000_0000;
}

function cryptoId(): string {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  return toHex(b);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

const bad = (msg: string) => new AttestError(400, "bad_request", msg);

const U64_MAX = (1n << 64n) - 1n;

/**
 * StartRequest.crewId: absent / null / "0" / 0 → 0n (the global pool); a canonical decimal string
 * (or a safe integer) → that crew; anything else → null (rejected).
 */
export function parseCrewIdField(v: unknown): bigint | null {
  if (v === undefined || v === null) return 0n;
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? BigInt(v) : null;
  if (typeof v !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(v)) return null;
  const id = BigInt(v);
  return id <= U64_MAX ? id : null;
}

export class AttestService {
  readonly store: AttestStore;
  readonly config: AttestServiceConfig;
  private readonly onchainRef: AttestOnchain | (() => AttestOnchain);
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly newId: () => string;
  private readonly planner: NonNullable<AttestServiceDeps["planner"]>;

  constructor(deps: AttestServiceDeps = {}) {
    this.store = deps.store ?? new AttestStore();
    this.config = { ...SERVICE_DEFAULTS, ...deps.config };
    this.onchainRef = deps.onchain ?? defaultOnchain;
    this.now = deps.now ?? Date.now;
    this.random = deps.random ?? cryptoRandom;
    this.newId = deps.newId ?? cryptoId;
    this.planner = deps.planner ?? ((e, g, r) => planChallenges(e, g, r));
  }

  private get onchain(): AttestOnchain {
    return typeof this.onchainRef === "function" ? this.onchainRef() : this.onchainRef;
  }

  // -------------------------------------------------------------------------------------
  // start
  // -------------------------------------------------------------------------------------

  async start(body: unknown): Promise<StartResponse> {
    if (!isObject(body)) throw bad("Body must be a JSON object");
    const { wallet, dayIndex, exercise, goalTarget } = body;
    const crewId = parseCrewIdField(body.crewId);
    if (crewId === null) throw bad("Invalid crewId");
    if (typeof wallet !== "string" || wallet.length > 64 || !isAddress(wallet)) throw bad("Invalid wallet");
    if (typeof dayIndex !== "number" || !Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 0xffffffff)
      throw bad("Invalid dayIndex");
    if (typeof exercise !== "string" || !isExerciseKind(exercise)) throw bad("Invalid exercise");
    if (
      typeof goalTarget !== "number" ||
      !Number.isInteger(goalTarget) ||
      goalTarget < 1 ||
      goalTarget > this.config.maxGoal[exercise]
    )
      throw bad("Invalid goalTarget");

    const now = this.now();
    if (this.store.isAttested(wallet, dayIndex, now, crewId)) {
      throw new AttestError(409, "conflict", "This day is already verified");
    }
    if (!this.store.allowWalletStart(wallet, now)) {
      throw new AttestError(429, "rate_limited", "Too many sessions for this wallet, try later", 600);
    }

    const onchain = this.onchain;
    if (onchain.currentDayIndex) {
      const today = onchain.currentDayIndex(now);
      if (today !== dayIndex) throw new AttestError(409, "conflict", "dayIndex is not the current day");
    }
    let commitment;
    try {
      commitment = crewId === 0n ? await onchain.getCommitment(wallet, dayIndex) : await onchain.getCommitment(wallet, dayIndex, crewId);
    } catch (e) {
      throw this.onchainError(e);
    }
    if (!commitment) throw new AttestError(404, "not_found", "No commitment for this wallet and day");
    if (commitment.status === "revoked") {
      throw new AttestError(409, "conflict", "This day's verification was withdrawn after review; it cannot be verified again");
    }
    if (commitment.status !== "committed") throw new AttestError(409, "conflict", "This day is already verified");
    if (commitment.exercise !== exercise || commitment.goalTarget !== goalTarget) {
      throw new AttestError(409, "conflict", "Exercise or goal differs from the on-chain commitment");
    }

    const id = this.newId();
    const plan = this.planner(exercise, goalTarget, this.random);
    const honest = minSessionMs(exercise, goalTarget);
    const maxDurationMs = Math.min(
      this.config.maxDurationCapMs,
      this.config.maxDurationBaseMs + this.config.maxDurationFactor * honest,
    );
    const session: AttestSession = {
      id,
      wallet,
      dayIndex,
      crewId,
      exercise,
      goalTarget,
      startedAtServer: now,
      committedAt: commitment.committedAt,
      lastActivity: now,
      maxDurationMs,
      chunks: [],
      bytes: 0,
      lastFrameMs: null,
      challenges: plan.map((c) => ({ ...c, revealedAtTraceMs: null, revealedAtElapsedMs: null })),
      state: "active",
      result: null,
      finishing: null,
      contentHash: null,
    };
    try {
      this.store.create(session, now);
    } catch (e) {
      if (e instanceof StoreFullError) throw new AttestError(503, "rate_limited", e.message, 30);
      throw e;
    }
    return {
      sessionId: id,
      ...(crewId === 0n ? {} : { crewId: crewId.toString() }),
      serverTime: now,
      exercise,
      goalTarget,
      challengePlan: plan.map((c) => ({ id: c.id, atMsFromStart: c.atMsFromStart, windowMs: c.windowMs, type: null })),
      chunkIntervalMs: this.config.chunkIntervalMs,
      maxChunkChars: this.config.maxChunkChars,
      maxDurationMs,
    };
  }

  // -------------------------------------------------------------------------------------
  // chunk
  // -------------------------------------------------------------------------------------

  async chunk(body: unknown): Promise<ChunkResponse> {
    if (!isObject(body)) throw bad("Body must be a JSON object");
    const session = this.requireSession(body.sessionId);
    const now = this.now();
    if (session.state !== "active") throw new AttestError(409, "conflict", "Session already finished");
    const elapsed = now - session.startedAtServer;
    if (elapsed > session.maxDurationMs) throw new AttestError(409, "conflict", "Session time limit reached");

    const encoded = body.chunk;
    if (!isObject(encoded) || typeof encoded.data !== "string" || typeof encoded.seq !== "number")
      throw bad("Invalid chunk");
    if (encoded.data.length > this.config.maxChunkChars)
      throw new AttestError(413, "payload_too_large", "Chunk too large");

    let decoded;
    try {
      decoded = decodeChunk(encoded as unknown as EncodedChunk);
    } catch (e) {
      if (e instanceof TraceFormatError) throw bad(`Malformed chunk: ${e.message}`);
      throw e;
    }
    const { chunk, bytes } = decoded;
    const digest = toHex(await sha256(bytes));
    session.lastActivity = now;

    const expected = session.chunks.length;
    if (chunk.seq < expected) {
      // A retry of a chunk we already have is fine; anything else under an old seq is a replay.
      if (session.chunks[chunk.seq].digest !== digest) {
        throw new AttestError(409, "conflict", "Chunk seq already used with different content");
      }
      return this.chunkResponse(session, now, { seq: chunk.seq, frames: chunk.frames.length, duplicate: true });
    }
    if (chunk.seq > expected) throw new AttestError(409, "conflict", `Expected chunk seq ${expected}`);

    // Frame timestamps must strictly increase within and across chunks.
    let prev = session.lastFrameMs;
    for (const f of chunk.frames) {
      if (prev !== null && f.tMs <= prev) {
        throw new AttestError(409, "conflict", "Frame timestamps must strictly increase (replayed chunk?)");
      }
      prev = f.tMs;
    }

    const fits = this.store.fits(session, bytes.length);
    if (!fits.session) throw new AttestError(413, "payload_too_large", "Session trace too large");
    if (!fits.total) throw new AttestError(503, "rate_limited", "Server busy, try again shortly", 30);

    const firstMs = chunk.frames.length ? chunk.frames[0].tMs : null;
    const lastMs = chunk.frames.length ? chunk.frames[chunk.frames.length - 1].tMs : null;
    session.chunks.push({
      seq: chunk.seq,
      bytes,
      digest,
      receipt: { seq: chunk.seq, firstMs, lastMs, receivedAtElapsedMs: elapsed },
    });
    session.bytes += bytes.length;
    this.store.addBytes(session, bytes.length);
    if (lastMs !== null) session.lastFrameMs = lastMs;

    this.maybeReveal(session, elapsed, lastMs);
    return this.chunkResponse(session, now, { seq: chunk.seq, frames: chunk.frames.length, duplicate: false });
  }

  private maybeReveal(session: AttestSession, elapsed: number, lastMs: number | null): void {
    if (lastMs === null) return;
    // A stale chunk (trace far behind the server clock) never triggers a reveal.
    if (elapsed - lastMs > this.config.maxRevealLagMs) return;
    for (const c of session.challenges) {
      if (c.revealedAtElapsedMs !== null) {
        // One open challenge at a time.
        if (elapsed < c.revealedAtElapsedMs + c.windowMs) return;
        continue;
      }
      if (elapsed >= c.atMsFromStart - this.config.revealLeadMs) {
        c.revealedAtElapsedMs = elapsed;
        c.revealedAtTraceMs = lastMs;
      }
      return;
    }
  }

  private chunkResponse(session: AttestSession, now: number, ack: ChunkResponse["ack"]): ChunkResponse {
    const elapsed = now - session.startedAtServer;
    let due: DueChallenge | null = null;
    for (const c of session.challenges) {
      if (c.revealedAtElapsedMs === null) continue;
      const remaining = c.revealedAtElapsedMs + c.windowMs - elapsed;
      if (remaining > 0) {
        due = {
          id: c.id,
          type: c.type,
          prompt: CHALLENGE_SPECS[c.type].prompt,
          windowMs: c.windowMs,
          remainingMs: remaining,
        };
      }
    }
    return {
      ack,
      serverElapsedMs: elapsed,
      dueChallenge: due,
      challengesPending: session.challenges.filter((c) => c.revealedAtElapsedMs === null).length,
    };
  }

  // -------------------------------------------------------------------------------------
  // finish
  // -------------------------------------------------------------------------------------

  async finish(body: unknown): Promise<FinishResponse> {
    if (!isObject(body)) throw bad("Body must be a JSON object");
    const session = this.requireSession(body.sessionId);
    session.lastActivity = this.now();
    if (session.finishing) return session.finishing;
    if (session.result) {
      if (session.result.verdict === "pass" && session.result.onchain?.status === "error") {
        // Retry a failed submission without re-verifying.
        return this.runExclusive(session, () => this.submit(session, session.result!));
      }
      return session.result;
    }
    if (session.chunks.length === 0) throw new AttestError(409, "conflict", "No workout data received");
    return this.runExclusive(session, () => this.verifyAndSubmit(session));
  }

  private async runExclusive(session: AttestSession, fn: () => Promise<FinishResult>): Promise<FinishResult> {
    session.state = "finishing";
    session.finishing = fn();
    try {
      const result = await session.finishing;
      session.result = result;
      return result;
    } finally {
      session.finishing = null;
      session.state = session.result ? "finished" : "active";
      session.lastActivity = this.now();
    }
  }

  private async verifyAndSubmit(session: AttestSession): Promise<FinishResult> {
    const now = this.now();
    const chunkBytes = session.chunks.map((c) => c.bytes);
    const frames: PoseFrame[] = [];
    for (const b of chunkBytes) for (const f of decodeChunkBytes(b).frames) frames.push(poseFrameFromTrace(f));
    const content = await traceContentHash(chunkBytes);
    const contentHex = toHex(content);
    session.contentHash = contentHex;
    const duplicate = this.store.hasFingerprint(contentHex, now);

    const verdict = verifySession({
      exercise: session.exercise,
      goalTarget: session.goalTarget,
      frames,
      chunks: session.chunks.map((c) => c.receipt),
      challenges: session.challenges.map((c) => ({
        id: c.id,
        type: c.type,
        atMsFromStart: c.atMsFromStart,
        windowMs: c.windowMs,
        revealedAtTraceMs: c.revealedAtTraceMs,
      })),
      duplicateContent: duplicate,
      config: this.config.verify,
    });

    const startedAt = this.sessionStartedAtSec(session);
    const hash = await sessionHash({
      wallet: session.wallet,
      dayIndex: session.dayIndex,
      exercise: session.exercise,
      goalTarget: session.goalTarget,
      sessionStartedAt: startedAt,
      contentHash: content,
    });
    // The trace is no longer needed once judged; free the memory.
    this.store.releaseBytes(session);

    const result: FinishResult = {
      verdict: verdict.ok ? "pass" : "fail",
      count: verdict.count,
      goalTarget: session.goalTarget,
      reasons: verdict.reasons,
      sessionHash: toHex(hash),
      onchain: null,
    };
    if (!verdict.ok) return result;
    // A passing trace can never be reused by another session.
    this.store.addFingerprint(contentHex, now);
    return this.submit(session, result);
  }

  private async submit(session: AttestSession, result: FinishResult): Promise<FinishResult> {
    const now = this.now();
    const crewId = session.crewId ?? 0n;
    if (this.store.isAttested(session.wallet, session.dayIndex, now, crewId)) {
      return { ...result, onchain: { status: "skipped", message: "Day already verified" } };
    }
    const hashBytes = new Uint8Array(result.sessionHash.match(/../g)!.map((h) => parseInt(h, 16)));
    try {
      const { signature } = await this.onchain.submitAttestation({
        wallet: session.wallet,
        dayIndex: session.dayIndex,
        reps: result.count,
        sessionHash: hashBytes,
        sessionStartedAt: this.sessionStartedAtSec(session),
        ...(crewId === 0n ? {} : { crewId }),
      });
      this.store.markAttested(session.wallet, session.dayIndex, this.now(), crewId);
      return { ...result, onchain: { status: "submitted", signature } };
    } catch (e) {
      if (e instanceof AttestNotConfiguredError) return { ...result, onchain: { status: "not_configured" } };
      const message = e instanceof Error ? e.message.slice(0, 200) : "Submission failed";
      return { ...result, onchain: { status: "error", message } };
    }
  }

  /** On-chain session_started_at: server start time, never before the commit (clock skew). */
  private sessionStartedAtSec(session: AttestSession): number {
    return Math.max(Math.floor(session.startedAtServer / 1000), Math.ceil(session.committedAt));
  }

  // -------------------------------------------------------------------------------------

  private requireSession(id: unknown): AttestSession {
    if (typeof id !== "string" || !SESSION_ID_RE.test(id)) throw bad("Invalid sessionId");
    const s = this.store.get(id, this.now());
    if (!s) throw new AttestError(404, "not_found", "Session not found or expired");
    return s;
  }

  private onchainError(e: unknown): AttestError {
    if (e instanceof AttestNotConfiguredError) {
      return new AttestError(503, "not_configured", "Verification is not available yet");
    }
    return new AttestError(503, "upstream_unavailable", "Could not reach Solana, try again", 5);
  }
}

// ---------------------------------------------------------------------------------------
// Process-wide singleton (kept on globalThis so dev-mode module reloads share one store).
// ---------------------------------------------------------------------------------------

interface AttestGlobals {
  service?: AttestService;
  onchain?: AttestOnchain | null;
}

const G = globalThis as typeof globalThis & { __fitrAttest?: AttestGlobals };
const globals = (G.__fitrAttest ??= {});

/** Overrides the on-chain adapter (B2 wiring, tests). Pass null to restore the default. */
export function setAttestOnchain(impl: AttestOnchain | null): void {
  globals.onchain = impl;
}

export function getAttestOnchain(): AttestOnchain {
  return globals.onchain ?? defaultOnchain;
}

export function getAttestService(): AttestService {
  return (globals.service ??= new AttestService({ onchain: getAttestOnchain }));
}

/** Tests only: drop the singleton (and its store). */
export function resetAttestService(deps?: AttestServiceDeps): AttestService {
  globals.service = new AttestService({ onchain: getAttestOnchain, ...deps });
  return globals.service;
}
