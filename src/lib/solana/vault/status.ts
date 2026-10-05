/**
 * What a user's (pool, day) slot means right now, derived only from onchain state + time.
 * Mirrors the program's rules (anchor/SPEC.md §3–§5) so the UI never offers an action the
 * program would reject. Pure.
 */
import {
  attestDeadline,
  canCommitAt,
  canFinalizeAt,
  dayEnd,
  effectiveDeadlineOf,
  finalizeAfterOf,
  type DayConfig,
  type DayWindowSnapshot,
} from "./day";
import { CommitmentStatus, type Commitment, type DayState, type Pool } from "./generated";

export type UserDayStatus =
  /** No commitment, and commit(d) would be accepted now. */
  | "can_commit"
  /** No commitment, the commit window is closed and the day is not over. */
  | "commit_closed"
  /** Committed, not attested, attest window still open. */
  | "committed"
  /** Attested complete; waiting for the day to be finalized before claim. */
  | "completed_pending"
  /**
   * The attestation was revoked: the stake is NOT forfeited, but there is no bonus. Becomes
   * "claimable" (principal only) once the day can be finalized.
   */
  | "revoked"
  /** claim(d) pays now (or after a permissionless finalize the client can bundle). */
  | "claimable"
  /** Not attested by the deadline: the stake is forfeited. Only rent is left to recover. */
  | "missed"
  /** Nothing left for this user on this day (never committed, or claimed/closed). */
  | "resolved";

export interface StatusEntry {
  day: number;
  commitment: Pick<Commitment, "status"> | null;
  dayState: (Pick<DayState, "finalized" | "voided"> & DayWindowSnapshot) | null;
}

/**
 * The day's attest deadline: the DayState snapshot (pushed back by any pool pause since the day
 * was created) when present, else the pool's current rule. Pass `nowSecs` to include a pause that
 * is still in progress.
 */
export function effectiveAttestDeadline(
  entry: Pick<StatusEntry, "day" | "dayState">,
  cfg: DayConfig,
  nowSecs?: number,
): number {
  if (!entry.dayState) return attestDeadline(entry.day, cfg);
  return effectiveDeadlineOf(entry.dayState, cfg, nowSecs ?? 0);
}

/**
 * When claim / close_missed for this day become possible (finalize_day is permissionless after
 * this): attest deadline + pause extension + the day's finalize review window.
 */
export function claimOpensAt(entry: Pick<StatusEntry, "day" | "dayState">, cfg: DayConfig, nowSecs?: number): number {
  if (!entry.dayState) return attestDeadline(entry.day, cfg) + (cfg.finalizeDelaySecs ?? 0);
  return finalizeAfterOf(entry.dayState, cfg, nowSecs ?? 0);
}

/** finalize_day(d) would be accepted now (or the day is already final). */
function settledOrFinalizable(entry: Pick<StatusEntry, "day" | "dayState">, cfg: DayConfig, nowSecs: number): boolean {
  const ds = entry.dayState;
  if (ds?.finalized || ds?.voided) return true;
  return canFinalizeAt(entry.day, cfg, nowSecs, ds ?? undefined);
}

export function deriveUserDayStatus(entry: StatusEntry, cfg: DayConfig, nowSecs: number): UserDayStatus {
  const { commitment, dayState } = entry;
  if (!commitment) {
    if (canCommitAt(entry.day, cfg, nowSecs)) return "can_commit";
    return nowSecs < dayEnd(entry.day, cfg) ? "commit_closed" : "resolved";
  }
  // A commitment always has its DayState (commit creates it; sweep needs every commitment closed).
  if (dayState?.voided) return "claimable";
  const final = settledOrFinalizable(entry, cfg, nowSecs);
  if (commitment.status === CommitmentStatus.Completed) return final ? "claimable" : "completed_pending";
  if (commitment.status === CommitmentStatus.Revoked) return final ? "claimable" : "revoked";
  // Past the (pause-extended) attest deadline nothing can verify it any more: it is missed, even
  // while the finalize review window still runs (settlementFor waits for that).
  const pastDeadline = nowSecs > effectiveAttestDeadline(entry, cfg, nowSecs);
  return dayState?.finalized || pastDeadline ? "missed" : "committed";
}

export type SettlementKind = "claim" | "close_missed";

export interface Settlement {
  day: number;
  kind: SettlementKind;
  /** finalize_day(d) must run first (permissionless; the user can sign it as the cranker). */
  needsFinalize: boolean;
}

/**
 * The instruction(s) that settle a past day for this user, or null. `close_missed` only returns
 * rent (the stake was forfeited at finalize) but it also keeps the user's streak bookkeeping right.
 */
export function settlementFor(entry: StatusEntry, cfg: DayConfig, nowSecs: number): Settlement | null {
  const status = deriveUserDayStatus(entry, cfg, nowSecs);
  const needsFinalize = !entry.dayState?.finalized && !entry.dayState?.voided;
  if (status === "claimable") return { day: entry.day, kind: "claim", needsFinalize };
  // close_missed needs a finalized day: wait out the review window (and any pause).
  if (status === "missed" && settledOrFinalizable(entry, cfg, nowSecs)) {
    return { day: entry.day, kind: "close_missed", needsFinalize };
  }
  return null;
}

export interface PayoutEstimate {
  principal: bigint;
  bonus: bigint;
  /** False when the day is not finalized yet: the bonus is a projection from current totals. */
  exact: boolean;
}

/**
 * Mirrors math.rs finalize_math: what the day's completers will share. Revoked stake is refunded,
 * never forfeited; the sponsor draw is capped by the day's `sponsorCap` snapshot (falls back to the
 * pool's current daily_sponsor_amount for a DayState without it). In a crew, the crew's rollover
 * (forfeits of earlier days nobody completed) joins the first finalized day with a completer.
 */
export function projectedDistributable(
  d: Pick<DayState, "totalStaked" | "completedStake" | "completedCount" | "feeBps"> &
    Partial<Pick<DayState, "revokedStake" | "sponsorCap">>,
  pool?: (Pick<Pool, "dailySponsorAmount" | "reserve"> & Partial<Pick<Pool, "rollover">>) | null,
): bigint {
  const slashed = d.totalStaked - d.completedStake - (d.revokedStake ?? 0n);
  const fee = (slashed * BigInt(d.feeBps)) / 10_000n;
  if (d.completedCount === 0) return 0n;
  const cap = d.sponsorCap ?? pool?.dailySponsorAmount ?? 0n;
  const sponsor = pool ? (cap < pool.reserve ? cap : pool.reserve) : 0n;
  return slashed - fee + sponsor + (pool?.rollover ?? 0n);
}

/** What claim(d) pays (principal + bonus), or null when nothing is claimable. */
export function estimatePayout(
  entry: {
    commitment: Pick<Commitment, "status" | "amount" | "weight"> | null;
    dayState:
      | (Pick<
          DayState,
          | "finalized"
          | "voided"
          | "distributable"
          | "completedWeight"
          | "totalStaked"
          | "completedStake"
          | "completedCount"
          | "feeBps"
        > &
          Partial<Pick<DayState, "revokedStake" | "sponsorCap">>)
      | null;
  },
  pool?: Pick<Pool, "dailySponsorAmount" | "reserve"> | null,
): PayoutEstimate | null {
  const { commitment, dayState } = entry;
  if (!commitment || !dayState) return null;
  if (dayState.voided) return { principal: commitment.amount, bonus: 0n, exact: true };
  // Revoked: principal back, never a bonus (exact even before finalize).
  if (commitment.status === CommitmentStatus.Revoked) return { principal: commitment.amount, bonus: 0n, exact: true };
  if (commitment.status !== CommitmentStatus.Completed) return null;
  if (dayState.completedWeight === 0n)
    return {
      principal: commitment.amount,
      bonus: 0n,
      exact: dayState.finalized,
    };
  const distributable = dayState.finalized ? dayState.distributable : projectedDistributable(dayState, pool);
  const bonus = (distributable * commitment.weight) / dayState.completedWeight;
  return { principal: commitment.amount, bonus, exact: dayState.finalized };
}
