// Deterministic local-time math: pin the zone before any Date is constructed.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";
import type { WorkoutSession } from "../history";
import {
  computeStreak,
  dayIndexToLocalMidnight,
  groupSessionsByDay,
  localDayIndex,
  todayProgress,
} from "../streak";

/** Local-time constructor: month is 1-based here for readability. */
function at(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
}

let seq = 0;
function session(
  endedAt: number,
  opts: { exercise?: ExerciseKind; reps?: number; holdMs?: number; goalMet?: boolean } = {},
): WorkoutSession {
  const exercise = opts.exercise ?? "pushup";
  return {
    id: `s${++seq}`,
    exercise,
    startedAt: endedAt - 60_000,
    endedAt,
    goal: exercise === "plank" ? 60 : 20,
    goalMet: opts.goalMet ?? false,
    summary: {
      exercise,
      reps: opts.reps ?? 0,
      rejectedReps: 0,
      holdMs: opts.holdMs ?? 0,
      repDurationsMs: [],
      activeMs: 60_000,
      framesProcessed: 100,
      framesWithPose: 100,
      avgTrackingConfidence: 0.9,
    },
  };
}

const NOW = at(2026, 9, 25, 18);

describe("localDayIndex", () => {
  it("is the same for any time within a local day and +1 for the next day", () => {
    expect(localDayIndex(at(2026, 9, 25, 0, 0))).toBe(localDayIndex(at(2026, 9, 25, 23, 59)));
    expect(localDayIndex(at(2026, 9, 26, 0, 0)) - localDayIndex(at(2026, 9, 25, 23, 59))).toBe(1);
  });

  it("stays consecutive across DST changes (US fall back on 2026-11-01)", () => {
    const a = localDayIndex(at(2026, 10, 31, 23));
    const b = localDayIndex(at(2026, 11, 1, 23));
    const c = localDayIndex(at(2026, 11, 2, 0, 30));
    expect([b - a, c - b]).toEqual([1, 1]);
  });

  it("round-trips to local midnight", () => {
    const day = localDayIndex(at(2026, 3, 8, 15));
    expect(dayIndexToLocalMidnight(day)).toBe(at(2026, 3, 8, 0));
  });
});

describe("computeStreak", () => {
  it("is zero with no sessions", () => {
    expect(computeStreak([], NOW)).toEqual({ current: 0, best: 0, todayDone: false });
  });

  it("counts today only", () => {
    const s = [session(at(2026, 9, 25, 8), { reps: 20, goalMet: true })];
    expect(computeStreak(s, NOW)).toEqual({ current: 1, best: 1, todayDone: true });
  });

  it("counts yesterday + today", () => {
    const s = [
      session(at(2026, 9, 24, 8), { reps: 20, goalMet: true }),
      session(at(2026, 9, 25, 8), { reps: 25, goalMet: true }),
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 2, best: 2, todayDone: true });
  });

  it("keeps the streak alive when yesterday counted and today is not done yet", () => {
    const s = [
      session(at(2026, 9, 23, 8), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 24, 21), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 25, 9), { reps: 5 }), // today, goal not met
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 2, best: 2, todayDone: false });
  });

  it("breaks the streak on a gap day", () => {
    const s = [
      session(at(2026, 9, 20, 8), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 21, 8), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 22, 8), { goalMet: true, reps: 20 }),
      // 23rd missed; 24th missed
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 0, best: 3, todayDone: false });
  });

  it("does not count a day where no goal was met", () => {
    const s = [
      session(at(2026, 9, 24, 8), { reps: 5 }),
      session(at(2026, 9, 25, 8), { reps: 3 }),
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 0, best: 0, todayDone: false });
  });

  it("counts a day once regardless of how many sessions it has", () => {
    const s = [
      session(at(2026, 9, 24, 7), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 24, 12), { goalMet: true, reps: 22 }),
      session(at(2026, 9, 24, 20), { exercise: "plank", holdMs: 61_000, goalMet: true }),
      session(at(2026, 9, 25, 8), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 25, 9), { exercise: "squat", reps: 30, goalMet: true }),
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 2, best: 2, todayDone: true });
  });

  it("counts a day whose combined total reaches the default goal", () => {
    // 12 + 10 push-ups (goal 20), neither session met the goal alone.
    const s = [session(at(2026, 9, 25, 8), { reps: 12 }), session(at(2026, 9, 25, 9), { reps: 10 })];
    expect(computeStreak(s, NOW).todayDone).toBe(true);
    // 30 s + 29.9 s of plank (goal 60 s) is not enough.
    const p = [
      session(at(2026, 9, 25, 8), { exercise: "plank", holdMs: 30_000 }),
      session(at(2026, 9, 25, 9), { exercise: "plank", holdMs: 29_900 }),
    ];
    expect(computeStreak(p, NOW).todayDone).toBe(false);
  });

  it("tracks the best streak separately from the current one", () => {
    const s = [
      // 4-day run
      session(at(2026, 9, 1), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 2), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 3), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 4), { goalMet: true, reps: 20 }),
      // 2-day run ending today
      session(at(2026, 9, 24), { goalMet: true, reps: 20 }),
      session(at(2026, 9, 25, 7), { goalMet: true, reps: 20 }),
    ];
    expect(computeStreak(s, NOW)).toEqual({ current: 2, best: 4, todayDone: true });
  });

  it("attributes a session to the local day it ended in", () => {
    // Ended 00:10 today => counts for today, not yesterday.
    const s = [session(at(2026, 9, 25, 0, 10), { goalMet: true, reps: 20 })];
    expect(computeStreak(s, NOW).todayDone).toBe(true);
  });

  it("ignores sessions dated in the future", () => {
    const s = [session(at(2026, 9, 27), { goalMet: true, reps: 20 })];
    expect(computeStreak(s, NOW)).toEqual({ current: 0, best: 0, todayDone: false });
  });
});

describe("todayProgress", () => {
  it("returns zeros with default goals when nothing happened today", () => {
    const p = todayProgress([session(at(2026, 9, 24), { reps: 30, goalMet: true })], NOW);
    expect(p).toMatchObject({
      pushup: { value: 0, goal: 20, unit: "reps" },
      squat: { value: 0, goal: 25, unit: "reps" },
      plank: { value: 0, goal: 60, unit: "seconds" },
      wall_sit: { value: 0, goal: 60, unit: "seconds" },
    });
    expect(Object.keys(p).sort()).toEqual([...EXERCISE_KINDS].sort());
    for (const kind of EXERCISE_KINDS) expect(p[kind].value).toBe(0);
  });

  it("sums reps and plank seconds for today only", () => {
    const s = [
      session(at(2026, 9, 25, 8), { reps: 12 }),
      session(at(2026, 9, 25, 9), { reps: 10 }),
      session(at(2026, 9, 25, 10), { exercise: "squat", reps: 7 }),
      session(at(2026, 9, 25, 11), { exercise: "plank", holdMs: 45_500 }),
      session(at(2026, 9, 24, 23, 59), { reps: 100 }),
    ];
    const p = todayProgress(s, NOW);
    expect(p.pushup.value).toBe(22);
    expect(p.squat.value).toBe(7);
    expect(p.plank.value).toBeCloseTo(45.5, 5);
  });
});

describe("groupSessionsByDay", () => {
  it("groups newest day first with per-day totals and goal status", () => {
    const s = [
      session(at(2026, 9, 24, 8), { reps: 10 }),
      session(at(2026, 9, 25, 8), { reps: 12 }),
      session(at(2026, 9, 25, 9), { exercise: "plank", holdMs: 20_000 }),
      session(at(2026, 9, 25, 10), { reps: 9 }),
    ];
    const groups = groupSessionsByDay(s);
    expect(groups).toHaveLength(2);
    expect(groups[0].dayStartMs).toBe(at(2026, 9, 25, 0));
    expect(groups[0].sessions.map((x) => x.endedAt)).toEqual([
      at(2026, 9, 25, 10),
      at(2026, 9, 25, 9),
      at(2026, 9, 25, 8),
    ]);
    expect(groups[0].totals).toMatchObject({ pushup: 21, squat: 0, plank: 20, lunge: 0 });
    expect(groups[0].goalMet).toBe(true);
    expect(groups[1].totals.pushup).toBe(10);
    expect(groups[1].goalMet).toBe(false);
  });
});
