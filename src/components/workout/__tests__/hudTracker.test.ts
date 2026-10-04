import { describe, expect, it } from "vitest";
import type { EngineEvent, EngineState } from "@/lib/pose/types";
import { FORM_ISSUE_COPY } from "../formIssueCopy";
import { confidenceLevel, createHudTracker } from "../hudTracker";

function state(overrides: Partial<EngineState> = {}): EngineState {
  return {
    exercise: "pushup",
    phase: "up",
    reps: 0,
    rejectedReps: 0,
    holdMs: 0,
    primaryAngleDeg: 160,
    bodyLineDeg: 178,
    formIssues: [],
    trackingConfidence: 0.9,
    side: "left",
    ...overrides,
  };
}

const rep = (repIndex: number, tMs: number): EngineEvent => ({
  type: "rep",
  repIndex,
  durationMs: 1500,
  minAngleDeg: 80,
  maxAngleDeg: 165,
  tMs,
});

describe("confidenceLevel", () => {
  it("buckets tracking confidence", () => {
    expect(confidenceLevel(0.9, false)).toBe("none");
    expect(confidenceLevel(0.3, true)).toBe("low");
    expect(confidenceLevel(0.6, true)).toBe("fair");
    expect(confidenceLevel(0.8, true)).toBe("good");
  });
});

describe("createHudTracker", () => {
  it("publishes only when displayed values change, throttled to the interval", () => {
    const t = createHudTracker({ exercise: "pushup", unit: "reps", goal: 20 });
    expect(t.update(state(), [], 0, true).hud).not.toBeNull();
    // Same values -> nothing to publish.
    expect(t.update(state(), [], 33, true).hud).toBeNull();
    // Phase change inside the throttle window waits...
    expect(t.update(state({ phase: "down" }), [], 66, true).hud).toBeNull();
    // ...and goes out once the window has passed.
    expect(t.update(state({ phase: "down" }), [], 120, true).hud?.phase).toBe("down");
  });

  it("publishes rep changes immediately, vibrates and announces", () => {
    const t = createHudTracker({ exercise: "pushup", unit: "reps", goal: 20 });
    t.update(state(), [], 0, true);
    const out = t.update(state({ reps: 1 }), [rep(1, 10)], 10, true);
    expect(out.hud?.reps).toBe(1);
    expect(out.vibrate).toBe(30);
    expect(out.announce).toBe("1 rep");
  });

  it("throttles announcements and coalesces fast reps to the latest count", () => {
    const t = createHudTracker({ exercise: "squat", unit: "reps", goal: 20 });
    expect(t.update(state({ reps: 1 }), [rep(1, 0)], 0, true).announce).toBe("1 rep");
    expect(t.update(state({ reps: 2 }), [rep(2, 500)], 500, true).announce).toBeNull();
    expect(t.update(state({ reps: 3 }), [rep(3, 1000)], 1000, true).announce).toBeNull();
    expect(t.update(state({ reps: 3 }), [], 1600, true).announce).toBe("3 reps");
  });

  it("debounces form issues before showing and announcing them", () => {
    const t = createHudTracker({ exercise: "pushup", unit: "reps", goal: 20 });
    t.update(state(), [], 0, true);
    const flicker = t.update(state({ formIssues: ["go_lower"] }), [], 1000, true);
    expect(flicker.hud).toBeNull();
    t.update(state(), [], 1100, true); // gone again: never shown
    t.update(state({ formIssues: ["hips_sagging"] }), [], 1200, true);
    const shown = t.update(state({ formIssues: ["hips_sagging"] }), [], 1550, true);
    expect(shown.hud?.issue).toBe("hips_sagging");
    expect(shown.announce).toBe(FORM_ISSUE_COPY.hips_sagging);
  });

  it("shows a rejected rep notice and then expires it", () => {
    const t = createHudTracker({ exercise: "pushup", unit: "reps", goal: 20 });
    t.update(state(), [], 0, true);
    const out = t.update(
      state({ rejectedReps: 1 }),
      [{ type: "rep_rejected", reason: "go_lower", tMs: 5000 }],
      5000,
      true,
    );
    expect(out.hud?.rejection).toBe("go_lower");
    expect(out.announce).toContain("Rep not counted");
    expect(t.update(state({ rejectedReps: 1 }), [], 8000, true).hud?.rejection).toBeNull();
  });

  it("celebrates the goal once and keeps going", () => {
    const t = createHudTracker({ exercise: "pushup", unit: "reps", goal: 2 });
    t.update(state({ reps: 1 }), [rep(1, 0)], 0, true);
    const hit = t.update(state({ reps: 2 }), [rep(2, 2000)], 2000, true);
    expect(hit.hud?.goalReached).toBe(true);
    expect(hit.hud?.celebrating).toBe(true);
    expect(hit.vibrate).toEqual([60, 50, 60]);
    expect(hit.announce).toMatch(/Goal reached/);
    const later = t.update(state({ reps: 3 }), [rep(3, 9000)], 9000, true);
    expect(later.hud?.goalReached).toBe(true);
    expect(later.hud?.celebrating).toBe(false);
    expect(later.vibrate).toBe(30);
  });

  it("uses hold time for plank goals and announces 10 s milestones", () => {
    const t = createHudTracker({ exercise: "plank", unit: "seconds", goal: 60 });
    const s = (holdMs: number) => state({ exercise: "plank", phase: "holding", holdMs });
    t.update(s(0), [], 0, true);
    const ten = t.update(s(10_050), [], 10_050, true);
    expect(ten.hud?.holdTenths).toBe(100);
    expect(ten.announce).toBe("10 seconds");
    const goal = t.update(s(60_000), [], 60_000, true);
    expect(goal.hud?.goalReached).toBe(true);
    expect(goal.announce).toMatch(/Goal reached/);
  });
});
