/**
 * Shared, pure helpers for the public surfaces (Blinks, share cards, dashboard): exercise/goal
 * parsing and labels, crew names, SKR amount parsing. No network.
 */
import { EXERCISES, EXERCISE_CODE, exerciseFromCode } from "@/lib/exercises";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";
import { SKR_DECIMALS } from "@/lib/solana/config";
import { formatTokenAmount, parseTokenAmount } from "@/lib/solana/format";
import type { Exercise, Pool } from "@/lib/solana/vault/generated";

export function parseExerciseKind(v: string | null | undefined): ExerciseKind | null {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  return (EXERCISE_KINDS as readonly string[]).includes(k) ? (k as ExerciseKind) : null;
}

/** A positive integer goal, or null. */
export function parseGoal(v: string | null | undefined): number | null {
  if (!v || !/^\d{1,6}$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return n > 0 ? n : null;
}

export function exerciseKindOf(code: Exercise | number): ExerciseKind | null {
  return exerciseFromCode(Number(code));
}

export function exerciseCodeOf(kind: ExerciseKind): Exercise {
  return EXERCISE_CODE[kind] as Exercise;
}

/** "30 push-ups", "60 s plank". */
export function challengeLabel(kind: ExerciseKind, goal: number): string {
  const info = EXERCISES[kind];
  const name = info.name.toLowerCase();
  return info.unit === "seconds" ? `${goal} s ${name}` : `${goal} ${name}`;
}

/** The crew's display name (zero-padded UTF-8), or null for the global pool / an empty name. */
export function crewName(pool: Pick<Pool, "crewId" | "name">): string | null {
  if (pool.crewId === 0n) return null;
  const bytes = Uint8Array.from(pool.name);
  let end = bytes.indexOf(0);
  if (end < 0) end = bytes.length;
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end)).trim();
    return s || null;
  } catch {
    return null;
  }
}

export interface ResolvedChallenge {
  kind: ExerciseKind;
  goal: number;
  /** The pool fixes the exercise (and maybe the goal); query values were overridden. */
  fixedByCrew: boolean;
}

/**
 * The challenge a commit in `pool` will use: the crew's fixed exercise/goal when it has one, else
 * the requested exercise (default push-ups) and goal (default the exercise default), clamped to
 * the pool's onchain goal limits so the transaction never fails GoalOutOfBounds.
 */
export function resolveChallenge(
  pool: Pick<Pool, "hasFixedExercise" | "fixedExercise" | "fixedGoalTarget" | "goalLimits">,
  requested: { kind: ExerciseKind | null; goal: number | null },
): ResolvedChallenge | null {
  const kind = pool.hasFixedExercise ? exerciseKindOf(pool.fixedExercise) : (requested.kind ?? "pushup");
  if (!kind) return null;
  const limits = pool.goalLimits[EXERCISE_CODE[kind]];
  if (!limits) return null;
  let goal =
    pool.hasFixedExercise && pool.fixedGoalTarget > 0
      ? pool.fixedGoalTarget
      : (requested.goal ?? Math.max(EXERCISES[kind].defaultGoal, limits.min));
  goal = Math.min(Math.max(goal, limits.min), limits.max);
  return { kind, goal, fixedByCrew: pool.hasFixedExercise };
}

/** "25" / "12.5" (no grouping, no label) for URLs and inputs. */
export function skrPlain(amount: bigint): string {
  return formatTokenAmount(amount, SKR_DECIMALS, { grouping: false });
}

/** "1,250.5" for copy (truncated to 2 decimals). */
export function skrPretty(amount: bigint): string {
  return formatTokenAmount(amount, SKR_DECIMALS, { maxFractionDigits: 2 });
}

/** Whole-number SKR text → base units; null when not a valid positive amount. */
export function parseSkrAmount(text: string | null | undefined): bigint | null {
  if (!text) return null;
  const v = parseTokenAmount(text, SKR_DECIMALS);
  return v !== null && v > 0n ? v : null;
}
