/**
 * Pool-day arithmetic. Mirrors `anchor/programs/fitr-vault/src/math.rs` and the window rules in
 * anchor/SPEC.md §3 exactly, so the UI never offers an action the program would reject.
 *
 * Pure: no network, no React. All times are unix SECONDS (numbers; safe far beyond year 9999).
 */
import type { DayState, Pool } from "./generated";

/** The pool's pause accounting (SPEC §3): time spent paused extends live days' attest windows. */
export interface PauseState {
  paused: boolean;
  /** Unix seconds the current pause started (0 while not paused). */
  pausedSince: number;
  /** Seconds of all completed pauses. */
  totalPausedSecs: number;
}

export interface DayConfig {
  /** Day d starts at d * dayLengthSecs + dayOffsetSecs. Immutable onchain. */
  dayOffsetSecs: number;
  /** 300..=86_400. Immutable onchain. */
  dayLengthSecs: number;
  /** Commits for day d are accepted while now < dayStart(d) + commitCutoffSecs. */
  commitCutoffSecs: number;
  /** Attest for day d while now <= dayEnd(d) + attestGraceSecs (snapshotted per day onchain). */
  attestGraceSecs: number;
  /**
   * Review window between the attest deadline and finalize (snapshotted per day onchain as
   * DayState.finalizeDelaySecs). 0 when unknown.
   */
  finalizeDelaySecs?: number;
  /** Pool pause accounting; absent means "never paused". */
  pause?: PauseState;
  /**
   * Crew pools only: the GLOBAL pool's pause accounting. A global pause blocks every crew and
   * extends crew days' attest windows too (SPEC §2.7, §3). Absent for the global pool itself.
   */
  globalPause?: PauseState;
}

export class DayMathError extends Error {}

export function dayConfigFromPool(
  p: Pick<Pool, "dayOffsetSecs" | "dayLengthSecs" | "commitCutoffSecs" | "attestGraceSecs"> &
    Partial<Pick<Pool, "finalizeDelaySecs" | "paused" | "pausedSince" | "totalPausedSecs">>,
): DayConfig {
  const cfg: DayConfig = {
    dayOffsetSecs: Number(p.dayOffsetSecs),
    dayLengthSecs: Number(p.dayLengthSecs),
    commitCutoffSecs: Number(p.commitCutoffSecs),
    attestGraceSecs: Number(p.attestGraceSecs),
  };
  if (p.finalizeDelaySecs !== undefined) cfg.finalizeDelaySecs = Number(p.finalizeDelaySecs);
  if (p.paused !== undefined) {
    cfg.pause = {
      paused: p.paused,
      pausedSince: Number(p.pausedSince ?? 0),
      totalPausedSecs: Number(p.totalPausedSecs ?? 0),
    };
  }
  return cfg;
}

/** Adds the global pool's pause state to a crew pool's DayConfig (no-op for the global pool). */
export function withGlobalPause(
  c: DayConfig,
  global: Pick<Pool, "paused" | "pausedSince" | "totalPausedSecs">,
  isCrew: boolean,
): DayConfig {
  if (!isCrew) return c;
  return {
    ...c,
    globalPause: {
      paused: global.paused,
      pausedSince: Number(global.pausedSince),
      totalPausedSecs: Number(global.totalPausedSecs),
    },
  };
}

/** True while commit / attest / finalize are blocked: the pool's own pause or a global pause. */
export function isBlockedByPause(c: DayConfig): boolean {
  return Boolean(c.pause?.paused || c.globalPause?.paused);
}

/** floor((ts - offset) / len). Throws (like ClockBeforeOffset) when ts < offset. */
export function dayIndexAt(unixSecs: number, c: DayConfig): number {
  if (!(c.dayLengthSecs > 0)) throw new DayMathError("dayLengthSecs must be positive");
  const t = Math.floor(unixSecs) - c.dayOffsetSecs;
  if (t < 0) throw new DayMathError("time is before the pool day offset");
  const d = Math.floor(t / c.dayLengthSecs);
  if (d > 0xffff_ffff) throw new DayMathError("day index overflows u32");
  return d;
}

/** Inclusive start of day `d`. */
export function dayStart(d: number, c: DayConfig): number {
  return d * c.dayLengthSecs + c.dayOffsetSecs;
}

/** Exclusive end of day `d` (== start of d + 1). */
export function dayEnd(d: number, c: DayConfig): number {
  return dayStart(d + 1, c);
}

/** Commits for `d` must land strictly before this time (exclusive). */
export function commitDeadline(d: number, c: DayConfig): number {
  return dayStart(d, c) + c.commitCutoffSecs;
}

/**
 * Last second (inclusive) the attestor can mark day `d` complete. A live DayState carries its own
 * snapshot (`attestDeadline`), which wins over this when present.
 */
export function attestDeadline(d: number, c: DayConfig): number {
  return dayEnd(d, c) + c.attestGraceSecs;
}

/** Seconds the pool has been paused in total at `nowSecs` (including an ongoing pause). */
export function pausedSecsTotal(c: DayConfig, nowSecs: number): number {
  return pauseTotal(c.pause, nowSecs);
}

function pauseTotal(p: PauseState | undefined, nowSecs: number): number {
  if (!p) return 0;
  return p.totalPausedSecs + (p.paused ? Math.max(0, nowSecs - p.pausedSince) : 0);
}

/** The DayState fields that fix a live day's windows (SPEC §3). */
export type DayWindowSnapshot = Pick<DayState, "attestDeadline"> &
  Partial<Pick<DayState, "finalizeDelaySecs" | "pausedSecsBase" | "globalPausedSecsBase">>;

/**
 * Last second (inclusive) attest/revoke are accepted for a live day: its snapshotted deadline
 * pushed back by the time the pool (and, for a crew day, the global pool) spent paused since the
 * day was created. Mirrors DayState::effective_attest_deadline.
 */
export function effectiveDeadlineOf(ds: DayWindowSnapshot, c: DayConfig, nowSecs: number): number {
  const base = Number(ds.pausedSecsBase ?? 0);
  const own = Math.max(0, pausedSecsTotal(c, nowSecs) - base);
  const global = c.globalPause
    ? Math.max(0, pauseTotal(c.globalPause, nowSecs) - Number(ds.globalPausedSecsBase ?? 0))
    : 0;
  return Number(ds.attestDeadline) + own + global;
}

/** finalize_day is accepted once now > this (and the pool is not paused). */
export function finalizeAfterOf(ds: DayWindowSnapshot, c: DayConfig, nowSecs: number): number {
  return effectiveDeadlineOf(ds, c, nowSecs) + Number(ds.finalizeDelaySecs ?? 0);
}

/** The rules a day created now would snapshot (no DayState yet). */
function currentRules(c: DayConfig): Pick<DayState, "finalizeDelaySecs" | "pausedSecsBase" | "globalPausedSecsBase"> {
  return {
    finalizeDelaySecs: BigInt(c.finalizeDelaySecs ?? 0),
    pausedSecsBase: BigInt(c.pause?.totalPausedSecs ?? 0),
    globalPausedSecsBase: BigInt(c.globalPause?.totalPausedSecs ?? 0),
  };
}

/**
 * finalize_day(d) is allowed once now > attest deadline (+ pause extension) + finalize delay, and
 * never while the pool is paused. Pass the live DayState when there is one; a bare number/bigint is
 * treated as its attest deadline snapshot.
 */
export function canFinalizeAt(
  d: number,
  c: DayConfig,
  nowSecs: number,
  snapshot?: number | bigint | DayWindowSnapshot,
): boolean {
  if (isBlockedByPause(c)) return false;
  const ds: DayWindowSnapshot =
    snapshot === undefined
      ? { attestDeadline: BigInt(attestDeadline(d, c)), ...currentRules(c) }
      : typeof snapshot === "object"
        ? snapshot
        : { attestDeadline: BigInt(snapshot), ...currentRules(c) };
  return nowSecs > finalizeAfterOf(ds, c, nowSecs);
}

/** The program accepts commit(d) only for d ∈ {today, today + 1} and before the cutoff. */
export function canCommitAt(d: number, c: DayConfig, nowSecs: number): boolean {
  let today: number;
  try {
    today = dayIndexAt(nowSecs, c);
  } catch {
    return false;
  }
  if (d !== today && d !== today + 1) return false;
  return nowSecs < commitDeadline(d, c);
}

/** Current unix seconds from a millisecond clock (Date.now()). */
export function toUnixSecs(ms: number): number {
  return Math.floor(ms / 1000);
}
