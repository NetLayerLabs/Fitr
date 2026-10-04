/**
 * Pure planning on top of a VaultSnapshot: which day a new commitment targets, which past day to
 * settle in the same transaction, what the Today screen should say, and how to retry when a
 * bundled finalize_day races the crank or the chain clock. No network, no React.
 */
import { exerciseFromCode } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { canCommitAt, commitDeadline, dayEnd, type DayConfig } from "@/lib/solana/vault/day";
import { CommitmentStatus } from "@/lib/solana/vault/generated";
import type { VaultEntry, VaultSnapshot } from "@/lib/solana/vault/read";
import {
  deriveUserDayStatus,
  effectiveAttestDeadline,
  estimatePayout,
  settlementFor,
  type PayoutEstimate,
  type Settlement,
  type UserDayStatus,
} from "@/lib/solana/vault/status";

export interface EntryView extends VaultEntry {
  status: UserDayStatus;
}

export function viewEntries(s: Pick<VaultSnapshot, "entries" | "cfg">, nowSecs: number): EntryView[] {
  return s.entries.map((e) => ({ ...e, status: deriveUserDayStatus(e, s.cfg, nowSecs) }));
}

/** today = floor((now − offset) / len), recomputed from the live clock (the snapshot may be stale). */
export function liveToday(cfg: DayConfig, nowSecs: number, fallback: number): number {
  const t = nowSecs - cfg.dayOffsetSecs;
  return t >= 0 ? Math.floor(t / cfg.dayLengthSecs) : fallback;
}

function entry(s: Pick<VaultSnapshot, "entries">, day: number): VaultEntry {
  return s.entries.find((e) => e.day === day) ?? { day, commitment: null, dayState: null };
}

/**
 * The day a new commitment would land on: today while its window is open, else tomorrow
 * (the program accepts d ∈ {today, today+1}). null when the user already holds both.
 */
export function commitTargetDay(s: Pick<VaultSnapshot, "entries" | "cfg" | "today">, nowSecs: number): number | null {
  const today = liveToday(s.cfg, nowSecs, s.today);
  for (const d of [today, today + 1]) {
    if (entry(s, d).commitment) {
      if (d === today) continue;
      return null;
    }
    if (canCommitAt(d, s.cfg, nowSecs)) return d;
  }
  return null;
}

/**
 * The past day to settle in the next transaction: the newest claimable day first (money back),
 * else the newest missed day (rent back). One per transaction keeps it small and simple.
 */
export function pickSettlement(s: Pick<VaultSnapshot, "entries" | "cfg">, nowSecs: number): Settlement | null {
  const settlements = s.entries
    .map((e) => settlementFor(e, s.cfg, nowSecs))
    .filter((x): x is Settlement => x !== null)
    .sort((a, b) => b.day - a.day);
  return settlements.find((x) => x.kind === "claim") ?? settlements[0] ?? null;
}

/** Everything claimable now, with payout estimates (newest first). */
export function claimables(
  s: Pick<VaultSnapshot, "entries" | "cfg" | "pool">,
  nowSecs: number,
): Array<{ day: number; payout: PayoutEstimate }> {
  const out: Array<{ day: number; payout: PayoutEstimate }> = [];
  for (const e of s.entries) {
    if (deriveUserDayStatus(e, s.cfg, nowSecs) !== "claimable") continue;
    const payout = estimatePayout(e, s.pool);
    if (payout) out.push({ day: e.day, payout });
  }
  return out.sort((a, b) => b.day - a.day);
}

/* ------------------------------------------------------------------------------------------ */
/* Retry after a failed simulation                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface TxPlan {
  settle: Settlement | null;
  commit: boolean;
}

/**
 * A smaller plan to try after simulation failed with `code`, or null to give up.
 * - 6010 AlreadyFinalized: the crank beat us to finalize_day → drop it, keep the claim.
 * - 6009 DayNotOver / 6011 NotFinalized: the chain clock is behind wall time → drop the
 *   settlement entirely and just commit (if there is a commit).
 */
export function fallbackPlan(plan: TxPlan, code: number | null): TxPlan | null {
  if (!plan.settle) return null;
  if (code === 6010 && plan.settle.needsFinalize) return { ...plan, settle: { ...plan.settle, needsFinalize: false } };
  if ((code === 6009 || code === 6011 || code === 6010) && plan.commit) return { settle: null, commit: true };
  return null;
}

/* ------------------------------------------------------------------------------------------ */
/* Today screen contract                                                                       */
/* ------------------------------------------------------------------------------------------ */

export type TodayCommitmentState =
  | "loading"
  | "no_wallet"
  | "not_seeker"
  | "vault_unavailable"
  | "can_commit"
  | "committed"
  | "verifying"
  | "verified"
  | "claimable"
  | "missed"
  /** Today's verification was withdrawn after review: principal refundable, no bonus. */
  | "revoked";

export interface TodayCommitment {
  state: TodayCommitmentState;
  exercise?: ExerciseKind;
  /** Reps, or seconds for plank / wall sit. */
  goalTarget?: number;
  /** Today's stake, e.g. "25 SKR". */
  amountLabel?: string;
  /**
   * can_commit: when the commit window for the target day closes. committed / verifying: when the
   * day ends (finish the workout before this). claimable / missed / verified: undefined.
   */
  deadlineMs?: number;
  /** Total claimable now, e.g. "≈ 52.3 SKR". */
  claimableLabel?: string;
}

export interface TodayInputs {
  hasWallet: boolean;
  /** null while unknown. */
  requireSgt: boolean | null;
  /** null while the Seeker check is loading (or failed). */
  isSeeker: boolean | null;
  vault: "loading" | "ready" | "unavailable" | "error";
  snapshot: VaultSnapshot | null;
  nowSecs: number;
  /** A local session today for the committed exercise met the goal (attestor is on it). */
  hasLocalGoalMet: (exercise: ExerciseKind, goal: number, dayStartMs: number, dayEndMs: number) => boolean;
  formatAmount: (amount: bigint) => string;
}

export function deriveTodayCommitment(i: TodayInputs): TodayCommitment {
  if (!i.hasWallet) return { state: "no_wallet" };
  if (i.requireSgt === true && i.isSeeker === false) return { state: "not_seeker" };
  if (i.vault === "unavailable") return { state: "vault_unavailable" };
  if (i.vault === "loading" || !i.snapshot || i.nowSecs <= 0) {
    return { state: i.vault === "error" ? "vault_unavailable" : "loading" };
  }
  if (i.requireSgt === true && i.isSeeker === null) return { state: "loading" };

  const s = i.snapshot;
  const today = liveToday(s.cfg, i.nowSecs, s.today);
  const claim = claimables(s, i.nowSecs);
  const claimableTotal = claim.reduce((sum, c) => sum + c.payout.principal + c.payout.bonus, 0n);
  const claimableLabel =
    claim.length > 0 ? `${claim.some((c) => !c.payout.exact) ? "≈ " : ""}${i.formatAmount(claimableTotal)}` : undefined;

  const t = entry(s, today);
  if (t.commitment) {
    const exercise = exerciseFromCode(t.commitment.exercise) ?? undefined;
    const base = {
      exercise,
      goalTarget: t.commitment.goalTarget,
      amountLabel: i.formatAmount(t.commitment.amount),
      claimableLabel,
    };
    const status = deriveUserDayStatus(t, s.cfg, i.nowSecs);
    if (t.commitment.status === CommitmentStatus.Revoked) return { state: "revoked", ...base };
    if (status === "completed_pending" || status === "claimable") return { state: "verified", ...base };
    if (status === "missed") return { state: "missed", ...base };
    const endMs = dayEnd(today, s.cfg) * 1000;
    const startMs = endMs - s.cfg.dayLengthSecs * 1000;
    const verifying = exercise ? i.hasLocalGoalMet(exercise, t.commitment.goalTarget, startMs, endMs) : false;
    return { state: verifying ? "verifying" : "committed", ...base, deadlineMs: endMs };
  }

  if (claim.length > 0) return { state: "claimable", claimableLabel };

  const y = entry(s, today - 1);
  if (y.commitment && deriveUserDayStatus(y, s.cfg, i.nowSecs) === "missed") {
    return {
      state: "missed",
      exercise: exerciseFromCode(y.commitment.exercise) ?? undefined,
      goalTarget: y.commitment.goalTarget,
      amountLabel: i.formatAmount(y.commitment.amount),
    };
  }

  const target = commitTargetDay(s, i.nowSecs);
  const tomorrow = entry(s, today + 1);
  if (target === null && tomorrow.commitment) {
    // Already committed for tomorrow (today's window closed): nothing due today.
    return {
      state: "committed",
      exercise: exerciseFromCode(tomorrow.commitment.exercise) ?? undefined,
      goalTarget: tomorrow.commitment.goalTarget,
      amountLabel: i.formatAmount(tomorrow.commitment.amount),
      deadlineMs: dayEnd(today + 1, s.cfg) * 1000,
    };
  }
  return {
    state: "can_commit",
    deadlineMs: target === null ? undefined : commitDeadline(target, s.cfg) * 1000,
  };
}

/** True while day `d`'s attestation window is still open (a commitment can still be verified). */
export function attestOpen(e: VaultEntry, cfg: DayConfig, nowSecs: number): boolean {
  return nowSecs <= effectiveAttestDeadline(e, cfg);
}
