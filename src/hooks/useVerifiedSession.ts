"use client";

/**
 * Verified (staked) workouts.
 *
 * When the connected wallet has a commitment for TODAY's pool day for THIS exercise, the workout
 * screen runs an attestor session alongside the on-device engine:
 *
 *   begin()   POST /api/attest/start -> TraceRecorder starts on the response
 *   record()  every processed frame goes into the recorder
 *   (loop)    a chunk is POSTed every ~3 s (every 1 s around live checks); a chunk response may
 *             reveal a live check, shown as a big HUD prompt with a countdown and a haptic buzz
 *   finish()  flush the remaining chunks, POST /api/attest/finish -> verified on-chain (with the
 *             signature) or an honest failure reason
 *
 * Unstaked workouts never touch the network: with no wallet or no matching commitment the
 * controller stays "off" and every method is a no-op.
 *
 * The session machinery lives in VerifiedSessionController (plain TypeScript, injectable fetch
 * and clocks); useVerifiedSession() binds it to React with useSyncExternalStore.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Address, GetAccountInfoApi, Rpc } from "@solana/kit";
import type { ChallengeType } from "@/lib/attest/challenges";
import type { ChunkResponse, DueChallenge, FinishResponse, StartResponse } from "@/lib/attest/protocol";
import { TraceRecorder } from "@/lib/attest/recorder";
import type { EncodedChunk } from "@/lib/attest/trace";
import { EXERCISE_KINDS, type EngineUpdate, type ExerciseKind, type PoseFrame } from "@/lib/pose/types";
import { solanaConfig } from "@/lib/solana/config";
import { getPoolAddresses, getUserDayAddresses, vaultProgramAddress } from "@/lib/solana/vault/addresses";
import { dayConfigFromPool, dayIndexAt } from "@/lib/solana/vault/day";
import { CommitmentStatus, fetchMaybeCommitment, fetchMaybePool } from "@/lib/solana/vault/generated";

// ---------------------------------------------------------------------------------------------
// Commitment lookup (vault client, read-only)
// ---------------------------------------------------------------------------------------------

export interface StakedCommitment {
  dayIndex: number;
  exercise: ExerciseKind;
  /** Reps, or seconds for the timed holds. */
  goalTarget: number;
  /** Stake in base units. */
  amount: bigint;
  status: "committed" | "completed" | "revoked";
}

/**
 * Today's commitment of `owner` (any exercise), or null when there is no pool, no commitment or
 * the pool day cannot be computed. Uses the generated decoders through the given RPC
 * (the browser's /api/rpc proxy in the app).
 */
export async function loadTodayCommitment(
  rpc: Rpc<GetAccountInfoApi>,
  owner: Address,
  opts: { mint: Address | null; nowSecs: number; programAddress?: Address },
): Promise<StakedCommitment | null> {
  if (!opts.mint) return null;
  const programAddress = opts.programAddress ?? vaultProgramAddress();
  const { pool } = await getPoolAddresses(opts.mint, programAddress);
  const poolAcc = await fetchMaybePool(rpc, pool);
  if (!poolAcc.exists) return null;
  let today: number;
  try {
    today = dayIndexAt(opts.nowSecs, dayConfigFromPool(poolAcc.data));
  } catch {
    return null;
  }
  const { commitment } = await getUserDayAddresses({ pool, user: owner, dayIndex: today, programAddress });
  const acc = await fetchMaybeCommitment(rpc, commitment);
  if (!acc.exists) return null;
  const exercise = EXERCISE_KINDS[acc.data.exercise];
  if (!exercise) return null;
  return {
    dayIndex: today,
    exercise,
    goalTarget: acc.data.goalTarget,
    amount: acc.data.amount,
    status:
      acc.data.status === CommitmentStatus.Completed
        ? "completed"
        : acc.data.status === CommitmentStatus.Revoked
          ? "revoked"
          : "committed",
  };
}

// ---------------------------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------------------------

/** Plain-language reasons for a failed verification (VerifyReason codes from the server). */
export const VERIFY_REASON_COPY: Record<string, string> = {
  no_frames: "No workout data reached the verifier.",
  below_goal: "The verifier counted fewer than your goal.",
  session_too_short: "The session was shorter than your goal physically takes.",
  trace_ahead_of_clock: "The workout data didn't match real time. Keep Fitr open and on screen for the whole workout.",
  frame_rate_implausible: "The camera frame rate looked wrong. Keep Fitr open and on screen for the whole workout.",
  teleporting_joints: "Tracking jumped around too much. Use good light and keep your whole body in frame.",
  bone_length_inconsistent: "Tracking was inconsistent. Keep your whole body in frame and the phone still.",
  cadence_implausible: "Reps came faster than a person can do them.",
  low_tracking_confidence: "Tracking was too weak. Use better light and keep your whole body in frame.",
  challenge_not_issued: "You ended before every live check appeared. Keep going until the live checks are done.",
  challenge_missed: "A live check was missed. Do exactly what the prompt asks while it is on screen.",
  duplicate_session: "This workout data was already used for another verification.",
};

export function verifyReasonCopy(reason: string): string {
  return VERIFY_REASON_COPY[reason] ?? "The workout could not be verified.";
}

// ---------------------------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------------------------

export type VerifiedStatus =
  /** No wallet, no stake today, or the stake is for another exercise: a normal workout. */
  | "off"
  | "checking"
  /** Staked for this exercise today and not verified yet. */
  | "ready"
  /** Already verified on-chain today. */
  | "already"
  | "starting"
  | "recording"
  | "finishing"
  | "verified"
  | "failed"
  | "error";

export interface LiveChallenge {
  id: string;
  type: ChallengeType;
  prompt: string;
  windowMs: number;
  /** Local epoch ms when the window closes. */
  deadline: number;
}

export type VerifyOutcome =
  | { kind: "verified"; count: number; goalTarget: number; signature: string | null; explorerUrl: string | null }
  | { kind: "failed"; count: number; goalTarget: number; reasons: string[] }
  | { kind: "error"; message: string; retryable: boolean };

export interface VerifiedSnapshot {
  status: VerifiedStatus;
  /** Today's stake for this exercise (committed or completed), else null. */
  commitment: StakedCommitment | null;
  /** Today's stake is for this other exercise. */
  otherExercise: ExerciseKind | null;
  /** Start / connection problem while a session is (or should be) running. */
  error: string | null;
  challenge: LiveChallenge | null;
  /** Live checks not revealed yet. */
  challengesPending: number;
  outcome: VerifyOutcome | null;
}

export interface VerifiedControllerDeps {
  fetchImpl?: typeof fetch;
  /** Epoch ms clock (challenge deadlines). */
  now?: () => number;
  /** performance.now()-style clock that matches PoseFrame.timestampMs. */
  perfNow?: () => number;
  /** Normal chunk cadence. Default 3000 ms. */
  chunkIntervalMs?: number;
  /** Cadence around live checks so they are revealed on time. Default 1000 ms. */
  fastChunkIntervalMs?: number;
  vibrate?: (pattern: number | number[]) => void;
  explorerTxUrl?: (signature: string) => string;
  /** Attempts per request before giving up. Default 3. */
  maxAttempts?: number;
  retryDelayMs?: number;
}

const OFF: VerifiedSnapshot = Object.freeze({
  status: "off",
  commitment: null,
  otherExercise: null,
  error: null,
  challenge: null,
  challengesPending: 0,
  outcome: null,
}) as VerifiedSnapshot;

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
  }
}

function defaultVibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // Haptics are optional.
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class VerifiedSessionController {
  private snap: VerifiedSnapshot = OFF;
  private readonly listeners = new Set<() => void>();
  private readonly d: Required<VerifiedControllerDeps>;

  private wallet: string | null = null;
  private generation = 0;
  private sessionId: string | null = null;
  private recorder: TraceRecorder | null = null;
  private startedAtLocal = 0;
  private plan: StartResponse["challengePlan"] = [];
  private queue: EncodedChunk[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sending: Promise<void> | null = null;
  private seenChallenges = new Set<string>();

  constructor(
    readonly exercise: ExerciseKind,
    deps: VerifiedControllerDeps = {},
  ) {
    this.d = {
      fetchImpl: deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a)),
      now: deps.now ?? Date.now,
      perfNow: deps.perfNow ?? (() => performance.now()),
      chunkIntervalMs: deps.chunkIntervalMs ?? 3000,
      fastChunkIntervalMs: deps.fastChunkIntervalMs ?? 1000,
      vibrate: deps.vibrate ?? defaultVibrate,
      explorerTxUrl: deps.explorerTxUrl ?? ((sig) => solanaConfig.explorerTxUrl(sig)),
      maxAttempts: deps.maxAttempts ?? 3,
      retryDelayMs: deps.retryDelayMs ?? 800,
    };
  }

  // ----- store -----

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): VerifiedSnapshot => this.snap;

  private set(patch: Partial<VerifiedSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  /** True while a server session is open (between begin and finish/cancel). */
  get active(): boolean {
    return this.snap.status === "starting" || this.snap.status === "recording";
  }

  // ----- commitment -----

  /** Wallet changed: forget everything, then look up today's commitment (no-op for null). */
  async lookup(owner: Address | null, load: (owner: Address) => Promise<StakedCommitment | null>): Promise<void> {
    this.stopSession();
    const gen = ++this.generation;
    this.wallet = owner;
    if (!owner) {
      this.snap = OFF;
      this.set({});
      return;
    }
    this.set({ ...OFF, status: "checking" });
    let c: StakedCommitment | null = null;
    try {
      c = await load(owner);
    } catch {
      c = null; // Unreachable chain: behave like an unstaked workout.
    }
    if (gen !== this.generation) return;
    this.applyCommitment(c);
  }

  /** Sets the looked-up commitment directly (tests, or a caller that already has it). */
  applyCommitment(c: StakedCommitment | null): void {
    if (!c) return this.set({ ...OFF });
    // A revoked day can never be re-verified: train it as an unstaked workout.
    if (c.status === "revoked") return this.set({ ...OFF });
    if (c.exercise !== this.exercise) return this.set({ ...OFF, otherExercise: c.exercise });
    this.set({ ...OFF, commitment: c, status: c.status === "completed" ? "already" : "ready" });
  }

  // ----- session -----

  /** Opens an attestor session. No-op unless staked for this exercise and not yet started. */
  async begin(): Promise<void> {
    const c = this.snap.commitment;
    if (!c || !this.wallet) return;
    // From "ready", or to retry after a start that failed (no session was opened).
    if (this.snap.status !== "ready" && !(this.snap.status === "error" && this.sessionId === null)) return;
    this.stopSession();
    const gen = this.generation;
    this.set({ status: "starting", error: null, challenge: null, challengesPending: 0, outcome: null });
    let res: StartResponse;
    try {
      res = await this.post<StartResponse>("/api/attest/start", {
        wallet: this.wallet,
        dayIndex: c.dayIndex,
        exercise: c.exercise,
        goalTarget: c.goalTarget,
      });
    } catch (e) {
      if (gen !== this.generation) return;
      this.set({ status: "error", error: startErrorCopy(e) });
      return;
    }
    if (gen !== this.generation || (this.snap.status as VerifiedStatus) !== "starting") return;
    this.sessionId = res.sessionId;
    // The trace clock starts now: the server only accepts frames recorded after its own start.
    this.recorder = new TraceRecorder({ originMs: this.d.perfNow() });
    this.startedAtLocal = this.d.now();
    this.plan = res.challengePlan;
    this.queue = [];
    this.seenChallenges = new Set();
    this.set({ status: "recording", challengesPending: res.challengePlan.length });
    this.schedule();
  }

  record(frame: PoseFrame, update?: EngineUpdate): void {
    if (this.snap.status !== "recording" || !this.recorder) return;
    this.recorder.push(frame, update);
  }

  /** Ends the session and asks the server for its verdict. Idempotent; retries a failed finish. */
  async finish(): Promise<void> {
    const status = this.snap.status;
    const retry = status === "error" && this.sessionId !== null && this.snap.outcome?.kind === "error" && this.snap.outcome.retryable;
    if (status !== "recording" && !retry) {
      if (status === "starting") this.cancel();
      return;
    }
    const gen = this.generation;
    this.clearTimer();
    this.set({ status: "finishing", challenge: null, error: null });
    try {
      if (this.sending) await this.sending;
      this.drainRecorder();
      while (this.queue.length > 0) {
        await this.sendChunk(this.queue[0]);
        this.queue.shift();
      }
      const res = await this.post<FinishResponse>("/api/attest/finish", { sessionId: this.sessionId });
      if (gen !== this.generation) return;
      const outcome = mapFinish(res, this.d.explorerTxUrl);
      this.set({ status: outcome.kind === "verified" ? "verified" : outcome.kind === "failed" ? "failed" : "error", outcome });
    } catch (e) {
      if (gen !== this.generation) return;
      const message = e instanceof HttpError ? e.message : "Couldn't reach the verifier. Check your connection and try again.";
      const retryable = !(e instanceof HttpError && e.status === 404);
      this.set({ status: "error", outcome: { kind: "error", message, retryable } });
    }
  }

  /** Abandons the session without a verdict (back to setup / nothing to verify). */
  cancel(): void {
    this.stopSession();
    this.generation++;
    const c = this.snap.commitment;
    if (!c) return;
    this.set({ status: c.status === "completed" ? "already" : "ready", error: null, challenge: null, challengesPending: 0, outcome: null });
  }

  /** Ready for another workout after a verdict ("Go again"). */
  reset(): void {
    const verified = this.snap.outcome?.kind === "verified" || this.snap.status === "already";
    this.stopSession();
    this.generation++;
    const c = this.snap.commitment;
    if (!c) return;
    const next = verified ? { ...c, status: "completed" as const } : c;
    this.set({ commitment: next, status: verified ? "already" : "ready", error: null, challenge: null, challengesPending: 0, outcome: null });
  }

  /** Unmount: stop timers and drop the session (listeners are React's to remove). */
  dispose(): void {
    this.stopSession();
    this.generation++;
  }

  // ----- internals -----

  private stopSession(): void {
    this.clearTimer();
    this.sessionId = null;
    this.recorder = null;
    this.queue = [];
    this.sending = null;
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private nextDelay(): number {
    const elapsed = this.d.now() - this.startedAtLocal;
    const soon = this.plan.some(
      (p) => !this.seenChallenges.has(p.id) && p.atMsFromStart - elapsed < this.d.chunkIntervalMs + 2000,
    );
    return soon || this.snap.challenge ? this.d.fastChunkIntervalMs : this.d.chunkIntervalMs;
  }

  private schedule(): void {
    this.clearTimer();
    if (this.snap.status !== "recording") return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.sending = this.tick().finally(() => {
        this.sending = null;
        this.schedule();
      });
    }, this.nextDelay());
  }

  private drainRecorder(): void {
    if (!this.recorder) return;
    for (let c = this.recorder.drainChunk(); c; c = this.recorder.drainChunk()) this.queue.push(c);
  }

  private async tick(): Promise<void> {
    if (this.snap.status !== "recording") return;
    this.drainRecorder();
    // Send the backlog in order; a failure keeps the chunk for the next tick.
    while (this.queue.length > 0 && this.snap.status === "recording") {
      try {
        await this.sendChunk(this.queue[0], 1);
        this.queue.shift();
        if (this.snap.error) this.set({ error: null });
      } catch (e) {
        if (e instanceof HttpError && (e.status === 404 || e.status === 409)) {
          this.clearTimer();
          this.set({ status: "error", error: e.message, challenge: null, outcome: { kind: "error", message: e.message, retryable: false } });
        } else {
          this.set({ error: "Connection to the verifier is unstable. Keep going; data will be sent when it's back." });
        }
        return;
      }
    }
    this.expireChallenge();
  }

  private expireChallenge(): void {
    const ch = this.snap.challenge;
    if (ch && this.d.now() > ch.deadline + 1000) this.set({ challenge: null });
  }

  private async sendChunk(chunk: EncodedChunk, attempts = this.d.maxAttempts): Promise<void> {
    const res = await this.post<ChunkResponse>("/api/attest/chunk", { sessionId: this.sessionId, chunk }, attempts);
    this.onChunkResponse(res);
  }

  private onChunkResponse(res: ChunkResponse): void {
    const due: DueChallenge | null = res.dueChallenge;
    const patch: Partial<VerifiedSnapshot> = { challengesPending: res.challengesPending };
    if (due && this.snap.status === "recording") {
      if (!this.seenChallenges.has(due.id)) {
        this.seenChallenges.add(due.id);
        this.d.vibrate([250, 120, 250, 120, 250]);
      }
      patch.challenge = { id: due.id, type: due.type, prompt: due.prompt, windowMs: due.windowMs, deadline: this.d.now() + due.remainingMs };
    } else if (!due) {
      patch.challenge = null;
    }
    this.set(patch);
  }

  private async post<T>(path: string, body: unknown, attempts = this.d.maxAttempts): Promise<T> {
    let last: unknown = null;
    for (let i = 0; i < attempts; i++) {
      if (i > 0) await sleep(this.d.retryDelayMs * i);
      let res: Response;
      try {
        res = await this.d.fetchImpl(path, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(body),
        });
      } catch (e) {
        last = e;
        continue; // network error: retry
      }
      let json: unknown = null;
      try {
        json = await res.json();
      } catch {
        // handled below
      }
      if (res.ok) return json as T;
      const err = json as { error?: unknown; code?: unknown } | null;
      const message = typeof err?.error === "string" ? err.error : `Verifier error (${res.status})`;
      const httpErr = new HttpError(message, res.status, typeof err?.code === "string" ? err.code : null);
      // Only overload / upstream trouble is worth retrying.
      if (res.status !== 429 && res.status !== 503 && res.status < 500) throw httpErr;
      if (httpErr.code === "not_configured") throw httpErr;
      last = httpErr;
    }
    throw last instanceof Error ? last : new Error("Request failed");
  }
}

function startErrorCopy(e: unknown): string {
  if (e instanceof HttpError) {
    if (e.code === "not_configured") return "Verification isn't available right now. This workout won't count toward your stake.";
    if (e.code === "rate_limited") return "Too many attempts. Wait a minute, then try again.";
    return e.message;
  }
  return "Couldn't reach the verifier. Check your connection, then try again.";
}

function mapFinish(res: FinishResponse, explorer: (sig: string) => string): VerifyOutcome {
  if (res.verdict === "fail") return { kind: "failed", count: res.count, goalTarget: res.goalTarget, reasons: res.reasons };
  const on = res.onchain;
  if (on?.status === "submitted") {
    return { kind: "verified", count: res.count, goalTarget: res.goalTarget, signature: on.signature, explorerUrl: explorer(on.signature) };
  }
  if (on?.status === "skipped") {
    return { kind: "verified", count: res.count, goalTarget: res.goalTarget, signature: null, explorerUrl: null };
  }
  if (on?.status === "not_configured") {
    return { kind: "error", message: "Your workout passed, but on-chain verification isn't available right now.", retryable: false };
  }
  return {
    kind: "error",
    message: on?.status === "error" ? `Your workout passed, but recording it on-chain failed: ${on.message}` : "Verification failed.",
    retryable: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------------------------

export interface UseVerifiedSessionOptions {
  exercise: ExerciseKind;
  /** Connected wallet, or null for an unstaked workout. */
  owner: Address | null;
  /** Injection for tests; defaults read the vault through /api/rpc. */
  loadCommitment?: (owner: Address) => Promise<StakedCommitment | null>;
  deps?: VerifiedControllerDeps;
}

export interface VerifiedSessionApi extends VerifiedSnapshot {
  begin(): void;
  record(frame: PoseFrame, update?: EngineUpdate): void;
  finish(): void;
  cancel(): void;
  reset(): void;
}

async function defaultLoad(owner: Address): Promise<StakedCommitment | null> {
  const { getBrowserRpc } = await import("@/lib/solana/rpc");
  return loadTodayCommitment(getBrowserRpc(), owner, {
    mint: solanaConfig.skrMint,
    nowSecs: Math.floor(Date.now() / 1000),
  });
}

const serverSnapshot = () => OFF;

export function useVerifiedSession({ exercise, owner, loadCommitment, deps }: UseVerifiedSessionOptions): VerifiedSessionApi {
  // One controller per mounted screen + exercise; deps are read once (tests inject them).
  const [controller] = useState(() => new VerifiedSessionController(exercise, deps));
  const snap = useSyncExternalStore(controller.subscribe, controller.getSnapshot, serverSnapshot);

  const load = loadCommitment ?? defaultLoad;
  useEffect(() => {
    void controller.lookup(owner, load);
    // `load` is stable in the app (defaultLoad) and tests pass it once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller, owner]);

  useEffect(() => () => controller.dispose(), [controller]);

  // Stable callbacks: safe in effect dependency lists.
  const actions = useMemo(
    () => ({
      begin: () => void controller.begin(),
      record: (frame: PoseFrame, update?: EngineUpdate) => controller.record(frame, update),
      finish: () => void controller.finish(),
      cancel: () => controller.cancel(),
      reset: () => controller.reset(),
    }),
    [controller],
  );
  return { ...snap, ...actions };
}
