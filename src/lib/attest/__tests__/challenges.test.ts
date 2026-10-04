import { describe, expect, it } from "vitest";
import { mulberry32, pushupSequence, squatSequence } from "@/lib/pose/testing/synthetic";
import {
  challengeTypesFor,
  detectChallenge,
  detectHoldStill,
  detectRaisedHand,
  planChallenges,
} from "../challenges";
import { pushupSessionFrames, squatSessionFrames, withRaisedHand } from "./helpers";

describe("detectRaisedHand", () => {
  const base = pushupSessionFrames();
  const raised = withRaisedHand(base, "right", 8500, 10500);

  it("detects the requested anatomical hand inside the window", () => {
    const r = detectRaisedHand(raised, "right", 7000, 14000);
    expect(r.passed).toBe(true);
    expect(r.atMs).toBeGreaterThanOrEqual(8800);
    expect(detectChallenge("raise_right_hand", raised, 7000, 14000).passed).toBe(true);
  });

  it("does not accept the other hand, a plain workout, or a raise outside the window", () => {
    expect(detectRaisedHand(raised, "left", 7000, 14000).passed).toBe(false);
    expect(detectRaisedHand(base, "right", 0, 30000).passed).toBe(false);
    expect(detectRaisedHand(raised, "right", 11000, 20000).passed).toBe(false);
    expect(detectRaisedHand(raised, "right", 0, 8600).passed).toBe(false);
  });

  it("rejects raising both hands at once", () => {
    const both = withRaisedHand(raised, "left", 8500, 10500);
    expect(detectRaisedHand(both, "right", 7000, 14000).passed).toBe(false);
    expect(detectRaisedHand(both, "left", 7000, 14000).passed).toBe(false);
  });

  it("is mirror-safe: uses landmark labels, not screen side", () => {
    const mirrored = pushupSequence({ reps: 2, startMs: 0, mirror: true, nearSide: "right" });
    const r = withRaisedHand(mirrored, "left", 1000, 2500);
    expect(detectRaisedHand(r, "left", 0, 5000).passed).toBe(true);
    expect(detectRaisedHand(r, "right", 0, 5000).passed).toBe(false);
  });

  it("needs the raise held >= 300 ms", () => {
    const flick = withRaisedHand(base, "right", 9000, 9200, 50);
    expect(detectRaisedHand(flick, "right", 7000, 14000).passed).toBe(false);
  });

  it("works for squats (standing)", () => {
    const s = withRaisedHand(squatSessionFrames(), "left", 9000, 11000);
    expect(detectRaisedHand(s, "left", 8000, 15000).passed).toBe(true);
    expect(detectRaisedHand(s, "right", 8000, 15000).passed).toBe(false);
  });
});

describe("detectHoldStill", () => {
  it("passes during a 3.6 s standing pause", () => {
    const s = squatSessionFrames();
    expect(detectHoldStill(s, 8000, 16000).passed).toBe(true);
  });

  it("fails while squatting continuously", () => {
    const s = squatSequence({ reps: 8, startMs: 0, holdMs: 300, leadInMs: 300 });
    expect(detectHoldStill(s, 500, 12000).passed).toBe(false);
  });
});

describe("planChallenges", () => {
  it("plans 1 challenge for short goals and 2 for long ones, never revealing order by rule", () => {
    const rng = mulberry32(9);
    const short = planChallenges("pushup", 10, rng);
    expect(short).toHaveLength(1);
    expect(["raise_right_hand", "raise_left_hand"]).toContain(short[0].type);
    expect(short[0].atMsFromStart).toBeGreaterThanOrEqual(6000);
    expect(short[0].atMsFromStart).toBeLessThan(14000);
    const long = planChallenges("squat", 50, rng);
    expect(long).toHaveLength(2);
    expect(long[1].atMsFromStart - long[0].atMsFromStart).toBeGreaterThanOrEqual(12_000);
    for (const c of long) expect(challengeTypesFor("squat")).toContain(c.type);
    expect(challengeTypesFor("plank")).not.toContain("hold_still_top");
  });

  it("varies the asked hand across seeds", () => {
    const types = new Set<string>();
    for (let s = 1; s < 40; s++) types.add(planChallenges("pushup", 10, mulberry32(s))[0].type);
    expect(types).toEqual(new Set(["raise_right_hand", "raise_left_hand"]));
  });
});
