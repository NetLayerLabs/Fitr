/**
 * Progress stats, personal records and awards, all derived (pure) from local workout history.
 * Nothing here is stored: awards are recomputed from the sessions every render, so clearing
 * history also clears them and they can never drift from the data.
 *
 * Day math reuses streak.ts (local calendar days, DST-safe; a session belongs to the day it ended).
 */
import { EXERCISES } from "@/lib/exercises";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";
import type { WorkoutSession } from "./history";
import { computeStreak, countedDays, dayIndexToLocalMidnight, localDayIndex, sessionDay } from "./streak";

/* ------------------------------------------------------------------------------------------ */
/* Summary stats                                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface ProgressStats {
  currentStreak: number;
  bestStreak: number;
  todayDone: boolean;
  /** Sessions that ended in the current local week (Monday to Sunday). */
  workoutsThisWeek: number;
  /** Counted reps across every rep-based exercise (timed holds are not reps). */
  totalReps: number;
  /** Seconds held across every timed exercise. */
  totalHoldSeconds: number;
  totalWorkouts: number;
}

/** Local day index of the Monday that starts the week containing `day`. */
export function weekStartDay(day: number): number {
  // Day index 0 (1970-01-01) was a Thursday; Monday-based weekday is (day + 3) mod 7.
  const weekday = (((day + 3) % 7) + 7) % 7;
  return day - weekday;
}

export function isRepExercise(kind: ExerciseKind): boolean {
  return EXERCISES[kind].unit === "reps";
}

export function totalReps(sessions: readonly WorkoutSession[]): number {
  let sum = 0;
  for (const s of sessions) if (isRepExercise(s.exercise)) sum += s.summary.reps;
  return sum;
}

export function computeProgressStats(sessions: readonly WorkoutSession[], nowMs: number): ProgressStats {
  const streak = computeStreak(sessions, nowMs);
  const today = localDayIndex(nowMs);
  const weekStart = weekStartDay(today);
  let workoutsThisWeek = 0;
  let holdMs = 0;
  for (const s of sessions) {
    const day = sessionDay(s);
    if (day >= weekStart && day <= today) workoutsThisWeek++;
    if (!isRepExercise(s.exercise)) holdMs += s.summary.holdMs;
  }
  return {
    currentStreak: streak.current,
    bestStreak: streak.best,
    todayDone: streak.todayDone,
    workoutsThisWeek,
    totalReps: totalReps(sessions),
    totalHoldSeconds: Math.floor(holdMs / 1000),
    totalWorkouts: sessions.length,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Streak calendar                                                                             */
/* ------------------------------------------------------------------------------------------ */

export interface CalendarDay {
  day: number;
  dayStartMs: number;
  /** The day counts toward the streak (goal met). */
  goalMet: boolean;
  /** Something was recorded that day, goal met or not. */
  active: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/** The first month the calendar shows: October 2026, when Fitr launched (month is 0-based). */
export const CALENDAR_FIRST_MONTH = { year: 2026, month: 9 } as const;

export interface CalendarMonth {
  year: number;
  /** 0-based, like Date#getMonth. */
  month: number;
  /** Rows of 7 (Monday first); null for the cells before the 1st and after the last day. */
  weeks: (CalendarDay | null)[][];
  /** Days in this month with the goal met. */
  goalDays: number;
}

/** One calendar month as Monday-first weeks. */
export function monthCalendar(sessions: readonly WorkoutSession[], nowMs: number, year: number, month: number): CalendarMonth {
  const today = localDayIndex(nowMs);
  const counted = countedDays(sessions);
  const active = new Set(sessions.map(sessionDay));
  const firstDate = new Date(year, month, 1);
  const first = localDayIndex(firstDate.getTime());
  const length = new Date(year, month + 1, 0).getDate();
  const lead = (firstDate.getDay() + 6) % 7;
  const cells: (CalendarDay | null)[] = Array.from({ length: lead }, () => null);
  let goalDays = 0;
  for (let i = 0; i < length; i++) {
    const day = first + i;
    const isFuture = day > today;
    const goalMet = !isFuture && counted.has(day);
    if (goalMet) goalDays++;
    cells.push({
      day,
      dayStartMs: dayIndexToLocalMidnight(day),
      goalMet,
      active: !isFuture && active.has(day),
      isToday: day === today,
      isFuture,
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks, goalDays };
}

/* ------------------------------------------------------------------------------------------ */
/* Personal records                                                                            */
/* ------------------------------------------------------------------------------------------ */

export interface PersonalRecord {
  exercise: ExerciseKind;
  /** Best single session in the exercise's unit: reps, or whole seconds held. */
  value: number;
  unit: "reps" | "seconds";
  /** Raw hold time for timed exercises (0 for rep exercises). */
  holdMs: number;
  /** When the record session ended. */
  achievedAt: number;
  sessionId: string;
}

/**
 * Best single session per exercise (ties go to the earlier session, the one that set it),
 * in EXERCISE_KINDS order. Exercises never done, or with only zero-value sessions, are omitted.
 */
export function personalRecords(sessions: readonly WorkoutSession[]): PersonalRecord[] {
  const best = new Map<ExerciseKind, { raw: number; session: WorkoutSession }>();
  for (const s of sessions) {
    const raw = isRepExercise(s.exercise) ? s.summary.reps : s.summary.holdMs;
    if (raw <= 0) continue;
    const prev = best.get(s.exercise);
    if (!prev || raw > prev.raw || (raw === prev.raw && s.endedAt < prev.session.endedAt)) {
      best.set(s.exercise, { raw, session: s });
    }
  }
  const out: PersonalRecord[] = [];
  for (const kind of EXERCISE_KINDS) {
    const entry = best.get(kind);
    if (!entry) continue;
    const reps = isRepExercise(kind);
    out.push({
      exercise: kind,
      value: reps ? entry.raw : Math.floor(entry.raw / 1000),
      unit: reps ? "reps" : "seconds",
      holdMs: reps ? 0 : entry.raw,
      achievedAt: entry.session.endedAt,
      sessionId: entry.session.id,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------------------------ */
/* Awards                                                                                      */
/* ------------------------------------------------------------------------------------------ */

export type AwardId =
  | "first-workout"
  | "first-goal"
  | "streak-3"
  | "streak-7"
  | "streak-30"
  | "reps-100"
  | "reps-1000"
  | "plank-minute"
  | "variety-5"
  | "verified-day";

export interface AwardDefinition {
  id: AwardId;
  title: string;
  /** How to earn it, phrased as the goal. */
  description: string;
  /** Target for the progress meter. */
  target: number;
}

export const AWARD_DEFINITIONS: readonly AwardDefinition[] = Object.freeze([
  { id: "first-workout", title: "First workout", description: "Finish your first workout.", target: 1 },
  { id: "first-goal", title: "Goal getter", description: "Hit a daily goal for the first time.", target: 1 },
  { id: "streak-3", title: "3-day streak", description: "Meet your goal 3 days in a row.", target: 3 },
  { id: "streak-7", title: "7-day streak", description: "Meet your goal 7 days in a row.", target: 7 },
  { id: "streak-30", title: "30-day streak", description: "Meet your goal 30 days in a row.", target: 30 },
  { id: "reps-100", title: "100 reps", description: "Log 100 counted reps in total.", target: 100 },
  { id: "reps-1000", title: "1,000 reps", description: "Log 1,000 counted reps in total.", target: 1000 },
  { id: "plank-minute", title: "Plank minute", description: "Hold a plank for a full minute in one go.", target: 60 },
  { id: "variety-5", title: "Mix it up", description: "Try 5 different exercises.", target: 5 },
  {
    id: "verified-day",
    title: "Verified onchain",
    description: "Complete a staked day that is verified onchain.",
    target: 1,
  },
]);

export interface AwardStatus extends AwardDefinition {
  unlocked: boolean;
  /** Progress toward `target`, clamped to it. */
  progress: number;
  /** When it was unlocked, when known from local history (null for onchain or locked awards). */
  unlockedAt: number | null;
}

export interface AwardOptions {
  /** Days verified complete onchain, when the caller knows it. Unknown means 0. */
  verifiedOnChainDays?: number;
}

/**
 * Every award with its progress and the moment it was earned. Pure: a function of the sessions.
 * The streak awards use the best streak ever (an award is never taken away when a streak breaks).
 */
export function computeAwards(sessions: readonly WorkoutSession[], options: AwardOptions = {}): AwardStatus[] {
  const chronological = [...sessions].sort((a, b) => a.endedAt - b.endedAt);

  // Running totals over time give each award the moment it was earned.
  const reached = new Map<AwardId, number>();
  const values = new Map<AwardId, number>();
  const mark = (id: AwardId, value: number, at: number) => {
    const def = AWARD_DEFINITIONS.find((d) => d.id === id)!;
    values.set(id, Math.max(values.get(id) ?? 0, value));
    const prevAt = reached.get(id);
    if (value >= def.target && (prevAt === undefined || at < prevAt)) reached.set(id, at);
  };

  let workouts = 0;
  let reps = 0;
  const kinds = new Set<ExerciseKind>();
  for (const s of chronological) {
    workouts++;
    mark("first-workout", workouts, s.endedAt);
    if (s.goalMet) mark("first-goal", 1, s.endedAt);
    if (isRepExercise(s.exercise)) {
      reps += s.summary.reps;
      mark("reps-100", reps, s.endedAt);
      mark("reps-1000", reps, s.endedAt);
    }
    if (s.exercise === "plank") mark("plank-minute", Math.floor(s.summary.holdMs / 1000), s.endedAt);
    kinds.add(s.exercise);
    mark("variety-5", kinds.size, s.endedAt);
  }

  // Streak awards: walk the counted days in order. A day-based award is dated at that day's
  // last session (when the run reached the target), falling back to local midnight.
  const lastEndByDay = new Map<number, number>();
  for (const s of chronological) lastEndByDay.set(sessionDay(s), s.endedAt);
  const days = [...countedDays(sessions)].sort((a, b) => a - b);
  let run = 0;
  let prev: number | null = null;
  for (const day of days) {
    run = prev !== null && day === prev + 1 ? run + 1 : 1;
    prev = day;
    const at = lastEndByDay.get(day) ?? dayIndexToLocalMidnight(day);
    mark("first-goal", 1, at);
    mark("streak-3", run, at);
    mark("streak-7", run, at);
    mark("streak-30", run, at);
  }

  const verified = Math.max(0, Math.floor(options.verifiedOnChainDays ?? 0));
  if (verified > 0) values.set("verified-day", verified);

  return AWARD_DEFINITIONS.map((def) => {
    const value = values.get(def.id) ?? 0;
    const unlocked = def.id === "verified-day" ? verified >= def.target : reached.has(def.id);
    return {
      ...def,
      unlocked,
      progress: Math.min(def.target, value),
      unlockedAt: def.id === "verified-day" ? null : (reached.get(def.id) ?? null),
    };
  });
}
