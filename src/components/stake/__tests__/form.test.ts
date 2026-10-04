import { describe, expect, it } from "vitest";
import { EXERCISE_LIST } from "@/lib/exercises";
import { makePool } from "@/lib/solana/vault/__tests__/fixtures";
import {
  amountErrorMessage,
  checkAmount,
  clampInt,
  defaultGoal,
  formatGoal,
  formatHold,
  goalBounds,
  goalCeiling,
  quickPicks,
  stepGoal,
} from "../form";

const pool = makePool();
const SKR = 1_000_000n;

describe("goal bounds come from the on-chain pool", () => {
  it("per exercise, with seconds for plank / wall sit", () => {
    expect(goalBounds(pool, "pushup")).toEqual({ min: 10, max: 1000 });
    expect(goalBounds(pool, "plank")).toEqual({ min: 30, max: 3600 });
    expect(goalBounds(pool, "wall_sit")).toEqual({ min: 30, max: 3600 });
    expect(goalBounds(pool, "pullup")).toEqual({ min: 3, max: 1000 });
    expect(goalBounds(pool, "high_knees")).toEqual({ min: 20, max: 3000 });
  });

  it("follows a pool that tightened its rails", () => {
    const tight = makePool({ goalLimits: pool.goalLimits.map((l, i) => (i === 0 ? { min: 25, max: 50 } : l)) });
    expect(goalBounds(tight, "pushup")).toEqual({ min: 25, max: 50 });
    expect(defaultGoal(tight, "pushup")).toBe(25);
  });

  it("falls back to client minimums / hard ceilings only for zeroed limits", () => {
    const zero = makePool({ goalLimits: pool.goalLimits.map(() => ({ min: 0, max: 0 })) });
    for (const info of EXERCISE_LIST) {
      expect(goalBounds(zero, info.kind)).toEqual({ min: info.minGoal, max: goalCeiling(info) });
    }
  });

  it("clamps and steps", () => {
    const b = { min: 10, max: 1000 };
    expect(clampInt(5, b)).toBe(10);
    expect(clampInt(2000, b)).toBe(1000);
    expect(clampInt(Number.NaN, b)).toBe(10);
    expect(stepGoal("reps", 10, 1, b)).toBe(11);
    expect(stepGoal("reps", 20, 1, b)).toBe(25);
    expect(stepGoal("reps", 25, -1, b)).toBe(20);
    expect(stepGoal("reps", 20, -1, b)).toBe(19);
    expect(stepGoal("reps", 10, -1, b)).toBe(10);
    expect(stepGoal("seconds", 60, 1, { min: 30, max: 3600 })).toBe(75);
    expect(stepGoal("seconds", 60, -1, { min: 30, max: 3600 })).toBe(55);
    expect(stepGoal("seconds", 3600, 1, { min: 30, max: 3600 })).toBe(3600);
  });

  it("formats goals", () => {
    expect(formatHold(45)).toBe("45 s");
    expect(formatHold(90)).toBe("1:30");
    expect(formatHold(120)).toBe("2 min");
    expect(formatGoal("pushup", 20)).toBe("20 push-ups");
    expect(formatGoal("plank", 90)).toBe("1:30 plank");
  });
});

describe("stake amount bounds", () => {
  it("min/max from the pool and the wallet balance", () => {
    expect(checkAmount("", pool, null, 6)).toMatchObject({ ok: false, error: "empty" });
    expect(checkAmount("abc", pool, null, 6)).toMatchObject({ ok: false, error: "invalid" });
    expect(checkAmount("1.0000001", pool, null, 6)).toMatchObject({ ok: false, error: "invalid" });
    expect(checkAmount("0.5", pool, null, 6)).toMatchObject({ ok: false, error: "below_min" });
    expect(checkAmount("10001", pool, null, 6)).toMatchObject({ ok: false, error: "above_max" });
    expect(checkAmount("30", pool, 25n * SKR, 6)).toMatchObject({ ok: false, error: "above_balance" });
    expect(checkAmount("1", pool, 25n * SKR, 6)).toEqual({ ok: true, amount: SKR });
    expect(checkAmount("10,000", pool, null, 6)).toEqual({ ok: true, amount: 10_000n * SKR });
    expect(checkAmount("12.5", pool, null, 6)).toEqual({ ok: true, amount: 12_500_000n });
  });

  it("friendly messages name the rails", () => {
    expect(amountErrorMessage("below_min", pool, 6, "SKR")).toBe("The minimum stake is 1 SKR.");
    expect(amountErrorMessage("above_max", pool, 6, "SKR")).toBe("The maximum stake is 10,000 SKR.");
    expect(amountErrorMessage("above_balance", pool, 6, "SKR")).toMatch(/more SKR than your wallet/);
  });

  it("quick picks stay within the rails and centre on what the wallet affords", () => {
    const amounts = (b: bigint | null) => quickPicks(pool, b, 6).map((p) => Number(p.amount / SKR));
    expect(amounts(null)).toEqual([5, 10, 25, 50]);
    expect(amounts(60n * SKR)).toEqual([5, 10, 25, 50]);
    expect(amounts(300n * SKR)).toEqual([25, 50, 100, 250]);
    const poor = quickPicks(pool, 2n * SKR, 6);
    expect(poor.every((p) => p.disabled)).toBe(true);
    expect(poor.map((p) => Number(p.amount / SKR))).toEqual([5, 10, 25, 50]);
    const narrow = makePool({ minStake: 7n * SKR, maxStake: 8n * SKR });
    expect(quickPicks(narrow, null, 6).map((p) => p.amount)).toEqual([7n * SKR]);
  });
});
