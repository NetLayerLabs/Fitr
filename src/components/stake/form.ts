/**
 * Stake form rules: per-exercise goal bounds and stake bounds come from the on-chain Pool, never
 * from client constants (the program re-checks both). Pure.
 */
import { EXERCISE_LIST, EXERCISES, type ExerciseInfo } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { formatTokenAmount, parseTokenAmount } from "@/lib/solana/format";
import type { Pool } from "@/lib/solana/vault/generated";

/** Hard ceilings in the program (anchor/SPEC.md §2.6) — only a fallback when a limit reads 0. */
export function goalCeiling(info: Pick<ExerciseInfo, "unit" | "kind">): number {
  if (info.unit === "seconds") return 3_600;
  if (info.kind === "mountain_climber" || info.kind === "jumping_jack" || info.kind === "high_knees") return 3_000;
  return 1_000;
}

export interface Bounds<T> {
  min: T;
  max: T;
}

/** Inclusive goal bounds for `kind` from pool.goalLimits[code]. */
export function goalBounds(pool: Pick<Pool, "goalLimits">, kind: ExerciseKind): Bounds<number> {
  const info = EXERCISES[kind];
  const lim = pool.goalLimits[info.code];
  const min = lim && lim.min > 0 ? lim.min : info.minGoal;
  const max = lim && lim.max >= min ? lim.max : Math.max(min, goalCeiling(info));
  return { min, max };
}

export function clampInt(value: number, b: Bounds<number>): number {
  if (!Number.isFinite(value)) return b.min;
  return Math.min(b.max, Math.max(b.min, Math.round(value)));
}

/** Stepper increment: 1 rep below 20, then 5; holds move in 5 s below 60 s, then 15 s. */
export function goalStep(unit: ExerciseInfo["unit"], value: number, direction: 1 | -1): number {
  if (unit === "seconds") return (direction > 0 ? value >= 60 : value > 60) ? 15 : 5;
  return (direction > 0 ? value >= 20 : value > 20) ? 5 : 1;
}

export function stepGoal(unit: ExerciseInfo["unit"], value: number, direction: 1 | -1, b: Bounds<number>): number {
  return clampInt(value + direction * goalStep(unit, value, direction), b);
}

/** A sensible starting goal: the exercise default, clamped to the pool's bounds. */
export function defaultGoal(pool: Pick<Pool, "goalLimits">, kind: ExerciseKind): number {
  return clampInt(EXERCISES[kind].defaultGoal, goalBounds(pool, kind));
}

export function goalUnitLabel(unit: ExerciseInfo["unit"], value: number): string {
  if (unit === "seconds") return value === 1 ? "second" : "seconds";
  return value === 1 ? "rep" : "reps";
}

/** "1:30" for 90 s; whole minutes as "2 min". */
export function formatHold(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatGoal(kind: ExerciseKind, goal: number): string {
  const info = EXERCISES[kind];
  if (info.unit === "seconds") return `${formatHold(goal)} ${info.name.toLowerCase()}`;
  return `${goal} ${info.name.toLowerCase()}`;
}

/* ------------------------------------------------------------------------------------------ */
/* Stake amount                                                                                */
/* ------------------------------------------------------------------------------------------ */

/** Whole-token quick picks considered for the chips (filtered by the pool rails). */
export const QUICK_PICK_TOKENS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000] as const;

export interface QuickPick {
  amount: bigint;
  /** Above the wallet balance: shown but not selectable. */
  disabled: boolean;
}

/**
 * Up to `count` round amounts within [pool.minStake, pool.maxStake]: the largest ones the wallet
 * can afford (or the smallest ones while the balance is unknown).
 */
export function quickPicks(
  pool: Pick<Pool, "minStake" | "maxStake">,
  balance: bigint | null,
  decimals: number,
  count = 4,
): QuickPick[] {
  const unit = 10n ** BigInt(decimals);
  const inRails = QUICK_PICK_TOKENS.map((t) => BigInt(t) * unit).filter((a) => a >= pool.minStake && a <= pool.maxStake);
  const candidates = inRails.length > 0 ? inRails : [pool.minStake];
  const affordable = balance === null ? [] : candidates.filter((a) => a <= balance);
  let picks: bigint[];
  // Unknown balance (still loading) or nothing affordable: the smallest round amounts.
  if (affordable.length === 0) picks = candidates.slice(0, count);
  else {
    const lastAffordable = candidates.indexOf(affordable[affordable.length - 1]);
    const end = Math.min(candidates.length, lastAffordable + 1);
    picks = candidates.slice(Math.max(0, end - count), end);
  }
  return picks.map((amount) => ({ amount, disabled: balance !== null && amount > balance }));
}

export type AmountError = "empty" | "invalid" | "below_min" | "above_max" | "above_balance";

export type AmountCheck = { ok: true; amount: bigint } | { ok: false; error: AmountError; amount: bigint | null };

export function checkAmount(
  text: string,
  pool: Pick<Pool, "minStake" | "maxStake">,
  balance: bigint | null,
  decimals: number,
): AmountCheck {
  if (text.trim() === "") return { ok: false, error: "empty", amount: null };
  const amount = parseTokenAmount(text, decimals);
  if (amount === null) return { ok: false, error: "invalid", amount: null };
  if (amount < pool.minStake) return { ok: false, error: "below_min", amount };
  if (amount > pool.maxStake) return { ok: false, error: "above_max", amount };
  if (balance !== null && amount > balance) return { ok: false, error: "above_balance", amount };
  return { ok: true, amount };
}

export function amountErrorMessage(
  error: AmountError,
  pool: Pick<Pool, "minStake" | "maxStake">,
  decimals: number,
  label: string,
): string {
  const fmt = (a: bigint) => `${formatTokenAmount(a, decimals)} ${label}`;
  switch (error) {
    case "empty":
      return `Choose how much ${label} to stake.`;
    case "invalid":
      return `Enter an amount like 25 or 12.5 (up to ${decimals} decimals).`;
    case "below_min":
      return `The minimum stake is ${fmt(pool.minStake)}.`;
    case "above_max":
      return `The maximum stake is ${fmt(pool.maxStake)}.`;
    case "above_balance":
      return `That is more ${label} than your wallet holds.`;
  }
}

/** Plain input text for an amount ("25", "12.5"), no grouping. */
export function amountToInput(amount: bigint, decimals: number): string {
  return formatTokenAmount(amount, decimals, { grouping: false });
}

export const EXERCISE_OPTIONS = EXERCISE_LIST;
