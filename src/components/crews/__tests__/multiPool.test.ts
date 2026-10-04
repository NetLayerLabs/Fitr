import { describe, expect, it } from "vitest";
import type { TodayCommitment } from "@/components/stake/plan";
import {
  commitmentsToday,
  crewFromSearch,
  mostUrgentToday,
  pickWorkoutPool,
  workoutHrefFor,
  type PoolStake,
  type PoolTodayCommitment,
} from "../multiPool";

const crew = (crewId: bigint, t: TodayCommitment, crewName = `Crew ${crewId}`): PoolTodayCommitment => ({ ...t, crewId, crewName });

describe("mostUrgentToday", () => {
  it("keeps the global pool unless a crew is strictly more urgent", () => {
    const global: TodayCommitment = { state: "verified", exercise: "pushup", goalTarget: 20, forDay: "today" };
    const open = crew(5n, { state: "committed", exercise: "squat", goalTarget: 30, deadlineMs: 2_000, forDay: "today" });
    expect(mostUrgentToday(global, [open])).toMatchObject({ crewId: 5n, state: "committed", exercise: "squat" });
    expect(mostUrgentToday({ state: "committed", exercise: "pushup", forDay: "today" }, [open])).toMatchObject({ crewId: 0n });
    expect(mostUrgentToday({ state: "can_commit" }, [crew(5n, { state: "can_commit" })])).toMatchObject({ crewId: 0n });
  });

  it("gate states always come from the global pool", () => {
    for (const state of ["loading", "no_wallet", "not_seeker", "vault_unavailable"] as const) {
      expect(mostUrgentToday({ state }, [crew(5n, { state: "committed" })])).toMatchObject({ crewId: 0n, state });
    }
    // A crew stuck loading never beats a real state.
    expect(mostUrgentToday({ state: "can_commit" }, [crew(5n, { state: "loading" })]).crewId).toBe(0n);
  });

  it("among crews: most urgent, then earliest deadline, then lowest id", () => {
    const g: TodayCommitment = { state: "can_commit" };
    const a = crew(9n, { state: "claimable", claimableLabel: "5 SKR" });
    const b = crew(7n, { state: "committed", deadlineMs: 5_000 });
    const c = crew(3n, { state: "committed", deadlineMs: 4_000 });
    const d = crew(2n, { state: "committed", deadlineMs: 4_000 });
    expect(mostUrgentToday(g, [a, b]).crewId).toBe(7n);
    expect(mostUrgentToday(g, [a, b, c]).crewId).toBe(3n);
    expect(mostUrgentToday(g, [a, b, c, d]).crewId).toBe(2n);
  });

  it("strips crew fields from the global summary", () => {
    const out = mostUrgentToday({ state: "can_commit", crewId: "0", crewName: "" }, []);
    expect(out).toEqual({ state: "can_commit", crewId: 0n, crewName: "" });
  });
});

describe("commitmentsToday", () => {
  it("lists today's (and tomorrow's) commitments across pools, most urgent first", () => {
    const rows = commitmentsToday([
      crew(0n, { state: "verified", exercise: "pushup", forDay: "today" }, ""),
      crew(4n, { state: "committed", exercise: "squat", forDay: "today" }),
      crew(6n, { state: "missed", exercise: "plank", forDay: "yesterday" }),
      crew(8n, { state: "can_commit" }),
      crew(9n, { state: "committed", exercise: "lunge", forDay: "tomorrow" }),
    ]);
    expect(rows.map((r) => r.crewId)).toEqual([4n, 9n, 0n]);
  });
});

describe("pickWorkoutPool", () => {
  const s = (crewId: bigint, exercise: PoolStake["exercise"], status: PoolStake["status"] = "committed"): PoolStake => ({
    crewId,
    crewName: crewId === 0n ? "" : `Crew ${crewId}`,
    exercise,
    status,
  });

  it("prefers the requested crew when it matches the exercise", () => {
    const stakes = [s(0n, "pushup"), s(5n, "pushup"), s(6n, "squat")];
    const pick = pickWorkoutPool(stakes, "pushup", 5n);
    expect(pick.chosen?.crewId).toBe(5n);
    expect(pick.alternatives.map((a) => a.crewId)).toEqual([0n]);
    // A preferred crew for another exercise is ignored.
    expect(pickWorkoutPool(stakes, "pushup", 6n).chosen?.crewId).toBe(0n);
  });

  it("otherwise the first open stake, global first; then an already verified one", () => {
    expect(pickWorkoutPool([s(5n, "pushup"), s(0n, "pushup")], "pushup").chosen?.crewId).toBe(0n);
    expect(pickWorkoutPool([s(0n, "pushup", "completed"), s(5n, "pushup")], "pushup").chosen?.crewId).toBe(5n);
    const done = pickWorkoutPool([s(0n, "pushup", "completed")], "pushup");
    expect(done.chosen?.status).toBe("completed");
    expect(done.alternatives).toEqual([]);
  });

  it("skips revoked stakes and points at another exercise when nothing matches", () => {
    const pick = pickWorkoutPool([s(0n, "pushup", "revoked"), s(7n, "squat")], "pushup");
    expect(pick).toEqual({ chosen: null, alternatives: [], otherExercise: "squat" });
    expect(pickWorkoutPool([], "pushup")).toEqual({ chosen: null, alternatives: [], otherExercise: null });
  });

  it("works with the global pool alone (crew_id 0 only)", () => {
    const pick = pickWorkoutPool([s(0n, "plank")], "plank");
    expect(pick.chosen?.crewId).toBe(0n);
    expect(pick.alternatives).toEqual([]);
  });
});

describe("workout links", () => {
  it("round-trips ?crew=", () => {
    expect(workoutHrefFor("pushup", 42n)).toBe("/workout/pushup?crew=42");
    expect(workoutHrefFor("pushup", 0n)).toBe("/workout/pushup");
    expect(workoutHrefFor("pushup", null)).toBe("/workout/pushup");
    expect(crewFromSearch("?crew=42")).toBe(42n);
    expect(crewFromSearch("a=1&crew=7")).toBe(7n);
    expect(crewFromSearch("?crew=0")).toBe(0n);
    for (const bad of ["", null, "?crew=", "?crew=-1", "?crew=01", "?crew=18446744073709551616", "?x=1"]) {
      expect(crewFromSearch(bad)).toBeNull();
    }
  });
});
