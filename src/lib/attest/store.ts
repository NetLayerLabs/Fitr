/**
 * In-memory attestor state. Fitr runs as ONE long-lived `next start` process on the VPS, so a
 * process-local Map is the source of truth for live sessions (a restart drops in-flight sessions;
 * users simply start again). Everything is bounded: session count, bytes per session, total
 * bytes, fingerprint count, and every entry has a TTL.
 */
import "server-only";
import type { ExerciseKind } from "@/lib/pose/types";
import type { PlannedChallenge } from "./challenges";
import type { FinishOnchainStatus, FinishResponse } from "./protocol";
import type { ChunkReceipt } from "./verify";

export interface StoredChunk {
  seq: number;
  bytes: Uint8Array;
  /** sha256 hex of `bytes`, to make retries of the same chunk idempotent. */
  digest: string;
  receipt: ChunkReceipt;
}

export interface SessionChallenge extends PlannedChallenge {
  revealedAtTraceMs: number | null;
  revealedAtElapsedMs: number | null;
}

export type OnchainOutcome = FinishOnchainStatus;
export type FinishResult = FinishResponse;

export interface AttestSession {
  id: string;
  wallet: string;
  dayIndex: number;
  /** The pool attested for: 0n = the global pool, else a crew. Absent means 0n. */
  crewId?: bigint;
  exercise: ExerciseKind;
  goalTarget: number;
  /** Server epoch ms when the session started. */
  startedAtServer: number;
  /** Chain unix seconds of the commitment (session_started_at may not precede it). */
  committedAt: number;
  /** Server epoch ms of the last request touching this session. */
  lastActivity: number;
  /** Hard deadline (ms after start) for chunks. */
  maxDurationMs: number;
  chunks: StoredChunk[];
  bytes: number;
  lastFrameMs: number | null;
  challenges: SessionChallenge[];
  state: "active" | "finishing" | "finished";
  result: FinishResult | null;
  /** In-flight finish, so concurrent /finish calls share one verification + submission. */
  finishing: Promise<FinishResult> | null;
  /** Hash of the session's content, computed at finish. */
  contentHash: string | null;
}

export interface AttestStoreOptions {
  maxSessions: number;
  /** Active sessions idle longer than this are dropped. */
  idleTtlMs: number;
  /** Finished sessions are kept this long (so /finish can be retried). */
  finishedTtlMs: number;
  maxSessionBytes: number;
  maxTotalBytes: number;
  maxFingerprints: number;
  fingerprintTtlMs: number;
  /** Starts per wallet per hour. */
  walletStartsPerHour: number;
}

export const STORE_DEFAULTS: AttestStoreOptions = Object.freeze({
  maxSessions: 64,
  idleTtlMs: 2 * 60_000,
  finishedTtlMs: 30 * 60_000,
  maxSessionBytes: 6 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxFingerprints: 50_000,
  fingerprintTtlMs: 3 * 86_400_000,
  walletStartsPerHour: 20,
});

/** `${wallet}:${day}` for the global pool (unchanged), `${wallet}:${day}:${crew}` for a crew. */
function attestedKey(wallet: string, dayIndex: number, crewId: bigint): string {
  return crewId === 0n ? `${wallet}:${dayIndex}` : `${wallet}:${dayIndex}:${crewId}`;
}

export class StoreFullError extends Error {
  constructor(message = "Too many active sessions, try again shortly") {
    super(message);
    this.name = "StoreFullError";
  }
}

export class AttestStore {
  readonly options: AttestStoreOptions;
  private readonly sessions = new Map<string, AttestSession>();
  private readonly byWallet = new Map<string, string>();
  /** content fingerprint hex -> expiry (insertion-ordered for LRU-style eviction). */
  private readonly fingerprints = new Map<string, number>();
  /** `${wallet}:${day}` -> expiry: days already attested by this process. */
  private readonly attested = new Map<string, number>();
  private readonly walletStarts = new Map<string, { windowStart: number; count: number }>();
  private totalBytes = 0;

  constructor(options: Partial<AttestStoreOptions> = {}) {
    this.options = { ...STORE_DEFAULTS, ...options };
  }

  get size(): number {
    return this.sessions.size;
  }

  get bytesInUse(): number {
    return this.totalBytes;
  }

  /** Counts a start for the wallet; false when the hourly limit is exceeded. */
  allowWalletStart(wallet: string, now: number): boolean {
    const e = this.walletStarts.get(wallet);
    if (!e || now - e.windowStart >= 3_600_000) {
      this.walletStarts.set(wallet, { windowStart: now, count: 1 });
      if (this.walletStarts.size > 10_000) this.pruneWalletStarts(now);
      return true;
    }
    e.count++;
    return e.count <= this.options.walletStartsPerHour;
  }

  /** Adds a session, replacing the wallet's previous active session. Throws StoreFullError. */
  create(session: AttestSession, now: number): AttestSession | null {
    this.sweep(now);
    const prevId = this.byWallet.get(session.wallet);
    const prev = prevId ? (this.sessions.get(prevId) ?? null) : null;
    if (prev) this.delete(prev.id);
    if (this.sessions.size >= this.options.maxSessions) throw new StoreFullError();
    this.sessions.set(session.id, session);
    this.byWallet.set(session.wallet, session.id);
    this.addBytes(session, session.bytes);
    return prev;
  }

  get(id: string, now: number): AttestSession | null {
    const s = this.sessions.get(id);
    if (!s) return null;
    if (this.isExpired(s, now)) {
      this.delete(id);
      return null;
    }
    return s;
  }

  activeForWallet(wallet: string, now: number): AttestSession | null {
    const id = this.byWallet.get(wallet);
    return id ? this.get(id, now) : null;
  }

  delete(id: string): void {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id);
    if (this.byWallet.get(s.wallet) === id) this.byWallet.delete(s.wallet);
    this.totalBytes -= s.bytes;
  }

  /** True when `extra` more bytes fit in this session and in the global budget. */
  fits(session: AttestSession, extra: number): { session: boolean; total: boolean } {
    return {
      session: session.bytes + extra <= this.options.maxSessionBytes,
      total: this.totalBytes + extra <= this.options.maxTotalBytes,
    };
  }

  addBytes(session: AttestSession, extra: number): void {
    if (session !== this.sessions.get(session.id)) return;
    this.totalBytes += extra;
  }

  /** Drops a finished session's trace bytes (the result stays cached). */
  releaseBytes(session: AttestSession): void {
    if (session === this.sessions.get(session.id)) this.totalBytes -= session.bytes;
    session.bytes = 0;
    for (const c of session.chunks) c.bytes = new Uint8Array(0);
  }

  hasFingerprint(hex: string, now: number): boolean {
    const exp = this.fingerprints.get(hex);
    if (exp === undefined) return false;
    if (exp <= now) {
      this.fingerprints.delete(hex);
      return false;
    }
    return true;
  }

  addFingerprint(hex: string, now: number): void {
    this.fingerprints.delete(hex);
    this.fingerprints.set(hex, now + this.options.fingerprintTtlMs);
    while (this.fingerprints.size > this.options.maxFingerprints) {
      const oldest = this.fingerprints.keys().next().value as string;
      this.fingerprints.delete(oldest);
    }
  }

  /** `crewId` (default 0n = the global pool) keeps each pool's day separate. */
  isAttested(wallet: string, dayIndex: number, now: number, crewId: bigint = 0n): boolean {
    const key = attestedKey(wallet, dayIndex, crewId);
    const exp = this.attested.get(key);
    if (exp === undefined) return false;
    if (exp <= now) {
      this.attested.delete(key);
      return false;
    }
    return true;
  }

  markAttested(wallet: string, dayIndex: number, now: number, crewId: bigint = 0n): void {
    this.attested.set(attestedKey(wallet, dayIndex, crewId), now + 2 * 86_400_000);
    if (this.attested.size > 100_000) {
      for (const [k, exp] of this.attested) if (exp <= now) this.attested.delete(k);
    }
  }

  /** Removes expired sessions. Called on create; cheap enough to call on every request. */
  sweep(now: number): void {
    for (const s of this.sessions.values()) if (this.isExpired(s, now)) this.delete(s.id);
  }

  private isExpired(s: AttestSession, now: number): boolean {
    if (s.state === "finished") return now - s.lastActivity > this.options.finishedTtlMs;
    if (s.state === "finishing") return false;
    return now - s.lastActivity > this.options.idleTtlMs || now - s.startedAtServer > s.maxDurationMs + this.options.idleTtlMs;
  }

  private pruneWalletStarts(now: number): void {
    for (const [k, e] of this.walletStarts) if (now - e.windowStart >= 3_600_000) this.walletStarts.delete(k);
  }
}
