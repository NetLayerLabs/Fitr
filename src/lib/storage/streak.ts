/**
 * Pure, date-based derivations over workout history: local calendar days, daily totals,
 * streaks and today's progress. All "day" math uses the runtime's local time zone and is
 * DST-safe (days are identified by their local calendar date, not by 24h buckets).
 *
 * A session belongs to the local day on which it ENDED (the day the work was completed).
 *
 * A day "counts" toward the streak when either
 *   - any session that day has goalMet, or
 *   - the day's combined total for an exercise reaches that exercise's default goal
 *     (e.g. 12 + 10 push-ups on the same day hit a 20-rep goal), which keeps the streak
 *     consistent with the Today card's progress rings.
 */
import { EXERCISES, type GoalUnit } from "@/lib/exercises";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";
import type { WorkoutSession } from "./history";

const MS_PER_DAY = 86_400_000;

export interface StreakInfo {
  /** Consecutive counted days ending today (or yesterday, if today is not done yet). */
  current: number;
  /** Longest run of consecutive counted days ever. */
  best: number;
  /** Whether today already counts. */
  todayDone: boolean;
}

export interface ExerciseProgress {
  /** Reps summed, or seconds held (holdMs / 1000, not rounded). */
  value: number;
  goal: number;
  unit: GoalUnit;
}

export type ExerciseTotals = Record<ExerciseKind, number>;

export interface DayGroup {
  /** Local day index (see localDayIndex). */
  day: number;
  /** Local midnight at the start of the day, in ms. */
  dayStartMs: number;
  /** Sessions of the day, newest first. */
  sessions: WorkoutSession[];
  /** Per-exercise totals in the exercise's unit (reps, or seconds for plank). */
  totals: ExerciseTotals;
  /** Whether the day counts toward the streak. */
  goalMet: boolean;
}

/**
 * Integer index of the local calendar day containing `ms`. Consecutive calendar days differ by
 * exactly 1, including across DST changes (the local Y/M/D is re-encoded as a UTC midnight).
 */
export function localDayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY);
}

/** Local midnight (ms) at the start of a day index. */
export function dayIndexToLocalMidnight(day: number): number {
  const utc = new Date(day * MS_PER_DAY);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate()).getTime();
}

/** The local day a session is attributed to. */
export function sessionDay(session: WorkoutSession): number {
  return localDayIndex(session.endedAt);
}

/** A session's contribution in its exercise's unit (reps, or seconds held). */
export function sessionValue(session: WorkoutSession): number {
  return EXERCISES[session.exercise].unit === "seconds"
    ? session.summary.holdMs / 1000
    : session.summary.reps;
}

interface DayAccumulator {
  sessions: WorkoutSession[];
  reps: ExerciseTotals;
  holdMs: ExerciseTotals;
  anyGoalMet: boolean;
}

function zeroTotals(): ExerciseTotals {
  return Object.fromEntries(EXERCISE_KINDS.map((kind) => [kind, 0])) as ExerciseTotals;
}

function accumulateByDay(sessions: readonly WorkoutSession[]): Map<number, DayAccumulator> {
  const days = new Map<number, DayAccumulator>();
  for (const s of sessions) {
    const day = sessionDay(s);
    let acc = days.get(day);
    if (!acc) {
      acc = { sessions: [], reps: zeroTotals(), holdMs: zeroTotals(), anyGoalMet: false };
      days.set(day, acc);
    }
    acc.sessions.push(s);
    acc.reps[s.exercise] += s.summary.reps;
    acc.holdMs[s.exercise] += s.summary.holdMs;
    if (s.goalMet) acc.anyGoalMet = true;
  }
  return days;
}

function totalsOf(acc: DayAccumulator): ExerciseTotals {
  const totals = zeroTotals();
  for (const kind of EXERCISE_KINDS) {
    totals[kind] = EXERCISES[kind].unit === "seconds" ? acc.holdMs[kind] / 1000 : acc.reps[kind];
  }
  return totals;
}

function dayCounts(acc: DayAccumulator): boolean {
  if (acc.anyGoalMet) return true;
  return EXERCISE_KINDS.some((kind) => {
    const info = EXERCISES[kind];
    if (info.defaultGoal <= 0) return false;
    // Compare in integer units (reps / ms) to avoid float drift for plank seconds.
    return info.unit === "seconds"
      ? acc.holdMs[kind] >= info.defaultGoal * 1000
      : acc.reps[kind] >= info.defaultGoal;
  });
}

/** Day indices that count toward the streak. */
export function countedDays(sessions: readonly WorkoutSession[]): Set<number> {
  const result = new Set<number>();
  for (const [day, acc] of accumulateByDay(sessions)) {
    if (dayCounts(acc)) result.add(day);
  }
  return result;
}

export function computeStreak(sessions: readonly WorkoutSession[], nowMs: number): StreakInfo {
  const today = localDayIndex(nowMs);
  // Ignore days in the future (clock changes) for every stat.
  const days = [...countedDays(sessions)].filter((d) => d <= today).sort((a, b) => a - b);
  const counted = new Set(days);

  const todayDone = counted.has(today);
  let current = 0;
  // The streak stays alive through today until the day is over.
  for (let d = todayDone ? today : today - 1; counted.has(d); d--) current++;

  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }

  return { current, best: Math.max(best, current), todayDone };
}

/** Today's per-exercise progress toward each exercise's default goal. */
export function todayProgress(
  sessions: readonly WorkoutSession[],
  nowMs: number,
): Record<ExerciseKind, ExerciseProgress> {
  const today = localDayIndex(nowMs);
  const acc = accumulateByDay(sessions.filter((s) => sessionDay(s) === today)).get(today);
  const totals = acc ? totalsOf(acc) : zeroTotals();
  const result = {} as Record<ExerciseKind, ExerciseProgress>;
  for (const kind of EXERCISE_KINDS) {
    const info = EXERCISES[kind];
    result[kind] = { value: totals[kind], goal: info.defaultGoal, unit: info.unit };
  }
  return result;
}

/** Sessions grouped by local day, newest day first; sessions inside a day newest first. */
export function groupSessionsByDay(sessions: readonly WorkoutSession[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const [day, acc] of accumulateByDay(sessions)) {
    groups.push({
      day,
      dayStartMs: dayIndexToLocalMidnight(day),
      sessions: [...acc.sessions].sort((a, b) => b.endedAt - a.endedAt),
      totals: totalsOf(acc),
      goalMet: dayCounts(acc),
    });
  }
  return groups.sort((a, b) => b.day - a.day);
}
