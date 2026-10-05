// Deterministic local-time math: pin the zone before any Date is constructed.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import type { ExerciseKind } from "@/lib/pose/types";
import type { WorkoutSession } from "../history";
import {
  AWARD_DEFINITIONS,
  computeAwards,
  computeProgressStats,
  personalRecords,
  monthCalendar,
  CALENDAR_FIRST_MONTH,
  totalReps,
  weekStartDay,
} from "../awards";
import { localDayIndex } from "../streak";

function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime();
}

let seq = 0;
function session(
  endedAt: number,
  opts: { exercise?: ExerciseKind; reps?: number; holdMs?: number; goalMet?: boolean } = {},
): WorkoutSession {
  const exercise = opts.exercise ?? "pushup";
  return {
    id: `a${++seq}`,
    exercise,
    startedAt: endedAt - 60_000,
    endedAt,
    goal: 20,
    goalMet: opts.goalMet ?? false,
    summary: {
      exercise,
      reps: opts.reps ?? 0,
      rejectedReps: 0,
      holdMs: opts.holdMs ?? 0,
      repDurationsMs: [],
      activeMs: 60_000,
      framesProcessed: 0,
      framesWithPose: 0,
      avgTrackingConfidence: 0.9,
    },
  };
}

function award(list: ReturnType<typeof computeAwards>, id: string) {
  const found = list.find((a) => a.id === id);
  if (!found) throw new Error(`missing award ${id}`);
  return found;
}

describe("weekStartDay", () => {
  it("returns the Monday of the week", () => {
    // Wed 2026-10-07 -> Mon 2026-10-05; Sun 2026-10-11 -> Mon 2026-10-05; Mon stays.
    const monday = localDayIndex(at(2026, 10, 5));
    expect(weekStartDay(localDayIndex(at(2026, 10, 7)))).toBe(monday);
    expect(weekStartDay(localDayIndex(at(2026, 10, 11)))).toBe(monday);
    expect(weekStartDay(monday)).toBe(monday);
  });
});

describe("computeProgressStats", () => {
  it("counts this week's workouts, reps and holds", () => {
    const now = at(2026, 10, 7, 18); // Wednesday
    const sessions = [
      session(at(2026, 10, 7, 9), { reps: 20, goalMet: true }),
      session(at(2026, 10, 5, 9), { reps: 10 }), // Monday, same week
      session(at(2026, 10, 4, 9), { exercise: "plank", holdMs: 65_500 }), // Sunday, last week
    ];
    const stats = computeProgressStats(sessions, now);
    expect(stats.workoutsThisWeek).toBe(2);
    expect(stats.totalReps).toBe(30);
    expect(stats.totalHoldSeconds).toBe(65);
    expect(stats.totalWorkouts).toBe(3);
    expect(stats.currentStreak).toBe(1);
    expect(stats.todayDone).toBe(true);
  });

  it("is all zeros with no history", () => {
    const stats = computeProgressStats([], at(2026, 10, 7));
    expect(stats).toMatchObject({ currentStreak: 0, bestStreak: 0, workoutsThisWeek: 0, totalReps: 0 });
  });

  it("does not count timed holds as reps", () => {
    expect(totalReps([session(at(2026, 1, 1), { exercise: "wall_sit", reps: 3, holdMs: 30_000 })])).toBe(0);
  });
});

describe("monthCalendar", () => {
  it("lays out a month Monday first, blank before the 1st and after the last day", () => {
    const now = at(2026, 10, 7, 18);
    const cal = monthCalendar([session(at(2026, 10, 6), { reps: 20, goalMet: true }), session(at(2026, 10, 5), { reps: 3 })], now, 2026, 9);
    expect(cal.weeks).toHaveLength(5);
    expect(cal.weeks.every((r) => r.length === 7)).toBe(true);
    // 1 October 2026 is a Thursday.
    expect(cal.weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(cal.weeks[0][3]?.day).toBe(localDayIndex(at(2026, 10, 1)));
    const days = cal.weeks.flat().filter((d) => d !== null);
    expect(days).toHaveLength(31);
    expect(days[4]).toMatchObject({ active: true, goalMet: false });
    expect(days[5]).toMatchObject({ active: true, goalMet: true });
    expect(days[6]).toMatchObject({ isToday: true, isFuture: false });
    expect(days[7].isFuture).toBe(true);
    expect(cal.goalDays).toBe(1);
  });

  it("never marks future days, even with clock-skewed sessions", () => {
    const now = at(2026, 10, 7);
    const days = monthCalendar([session(at(2026, 10, 9), { goalMet: true })], now, 2026, 9).weeks.flat();
    expect(days.find((d) => d?.day === localDayIndex(at(2026, 10, 9)))).toMatchObject({ isFuture: true, goalMet: false });
  });

  it("starts the calendar at October 2026", () => {
    expect(CALENDAR_FIRST_MONTH).toEqual({ year: 2026, month: 9 });
  });
});

describe("personalRecords", () => {
  it("keeps the best single session per exercise in exercise order", () => {
    const first = session(at(2026, 10, 1), { reps: 30 });
    const tie = session(at(2026, 10, 2), { reps: 30 });
    const plank = session(at(2026, 10, 3), { exercise: "plank", holdMs: 91_900 });
    const records = personalRecords([
      tie,
      session(at(2026, 10, 3), { reps: 12 }),
      first,
      plank,
      session(at(2026, 10, 4), { exercise: "squat", reps: 0 }),
    ]);
    expect(records.map((r) => r.exercise)).toEqual(["pushup", "plank"]);
    expect(records[0]).toMatchObject({ value: 30, unit: "reps", sessionId: first.id });
    expect(records[1]).toMatchObject({ value: 91, unit: "seconds", holdMs: 91_900, achievedAt: plank.endedAt });
  });
});

describe("computeAwards", () => {
  it("returns every award locked with no history", () => {
    const awards = computeAwards([]);
    expect(awards).toHaveLength(AWARD_DEFINITIONS.length);
    expect(awards.every((a) => !a.unlocked && a.progress === 0 && a.unlockedAt === null)).toBe(true);
  });

  it("unlocks first workout, reps and variety with the time they were earned", () => {
    const s1 = session(at(2026, 10, 1), { reps: 60 });
    const s2 = session(at(2026, 10, 2), { exercise: "squat", reps: 50 });
    const awards = computeAwards([s2, s1]);
    expect(award(awards, "first-workout")).toMatchObject({ unlocked: true, unlockedAt: s1.endedAt });
    expect(award(awards, "reps-100")).toMatchObject({ unlocked: true, unlockedAt: s2.endedAt, progress: 100 });
    expect(award(awards, "reps-1000")).toMatchObject({ unlocked: false, progress: 110 });
    expect(award(awards, "variety-5")).toMatchObject({ unlocked: false, progress: 2 });
  });

  it("needs a single plank of 60 s for the plank minute", () => {
    const split = computeAwards([
      session(at(2026, 10, 1, 9), { exercise: "plank", holdMs: 40_000 }),
      session(at(2026, 10, 1, 10), { exercise: "plank", holdMs: 40_000 }),
    ]);
    expect(award(split, "plank-minute")).toMatchObject({ unlocked: false, progress: 40 });
    const wallSit = computeAwards([session(at(2026, 10, 1), { exercise: "wall_sit", holdMs: 90_000 })]);
    expect(award(wallSit, "plank-minute").unlocked).toBe(false);
    const full = computeAwards([session(at(2026, 10, 1), { exercise: "plank", holdMs: 60_000 })]);
    expect(award(full, "plank-minute")).toMatchObject({ unlocked: true, progress: 60 });
  });

  it("keeps streak awards after the streak breaks and dates them", () => {
    const days = [1, 2, 3, 5].map((d) => session(at(2026, 10, d), { reps: 20, goalMet: true }));
    const awards = computeAwards(days);
    expect(award(awards, "streak-3")).toMatchObject({ unlocked: true, unlockedAt: days[2].endedAt });
    expect(award(awards, "streak-7")).toMatchObject({ unlocked: false, progress: 3 });
    expect(award(awards, "first-goal")).toMatchObject({ unlocked: true, unlockedAt: days[0].endedAt });
  });

  it("counts a day reached by combined sessions toward goals", () => {
    const awards = computeAwards([
      session(at(2026, 10, 1, 9), { reps: 12 }),
      session(at(2026, 10, 1, 10), { reps: 10 }),
    ]);
    expect(award(awards, "first-goal").unlocked).toBe(true);
  });

  it("unlocks the verified award only from the onchain count", () => {
    expect(award(computeAwards([session(at(2026, 10, 1), { goalMet: true })]), "verified-day").unlocked).toBe(false);
    expect(award(computeAwards([], { verifiedOnChainDays: 2 }), "verified-day")).toMatchObject({
      unlocked: true,
      progress: 1,
      unlockedAt: null,
    });
  });
});
