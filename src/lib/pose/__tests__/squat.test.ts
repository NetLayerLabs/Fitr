import { describe, expect, it } from "vitest";
import { LM } from "@/lib/pose/landmarks";
import {
  keyframes,
  pushupSequence,
  seatedKneeExtensionSequence,
  squatSequence,
  squatTimeline,
  withDropout,
  withJitter,
  withTeleport,
  type SquatSequenceOptions,
} from "@/lib/pose/testing/synthetic";
import { rejectionReasons, repEvents, runFrames } from "./helpers";

function expectCleanSet(options: SquatSequenceOptions, reps = 5) {
  const result = runFrames("squat", squatSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  const repsSeen = repEvents(result);
  expect(repsSeen.map((e) => e.repIndex)).toEqual(Array.from({ length: reps }, (_, i) => i + 1));
  for (const rep of repsSeen) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(500);
    expect(rep.minAngleDeg).toBeLessThan(95);
    expect(rep.maxAngleDeg).toBeGreaterThan(160);
  }
  return result;
}

describe("squat engine: clean sets", () => {
  it.each<[string, SquatSequenceOptions]>([
    ["30 fps landscape", {}],
    ["15 fps", { fps: 15 }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["portrait at 15 fps", { width: 480, height: 640, fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["1 s reps", { repMs: 1000, holdMs: 200 }],
    ["slow 3 s reps with a pause at the bottom", { repMs: 3000, bottomHoldMs: 800 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    expectCleanSet(options);
  });

  it("goes searching -> ready -> down/up", () => {
    const result = expectCleanSet({}, 2);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up"]);
    expect(result.final.formIssues).toEqual([]);
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps and in portrait", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectCleanSet({ jitterDeg: 4, seed });
      expectCleanSet({ jitterDeg: 4, seed, fps: 15 });
      expectCleanSet({ jitterDeg: 4, seed, width: 480, height: 640 });
    }
  });

  it("stays exact with positional landmark noise", () => {
    const frames = withJitter(squatSequence({ reps: 5, jitterDeg: 3, seed: 5 }), { amplitude: 0.004, seed: 5 });
    const result = runFrames("squat", frames);
    expect(result.final.reps).toBe(5);
  });

  it("requires standing up first: a set started from the bottom skips the first rise", () => {
    const profile = keyframes([
      [0, 75],
      [800, 75],
      [1600, 175],
      [2200, 175],
      [3000, 70],
      [3800, 175],
      [4600, 175],
    ]);
    const result = runFrames("squat", squatSequence({ profile: { durationMs: 4600, angleAt: profile } }));
    expect(result.final.reps).toBe(1);
    expect(result.issuesSeen.has("extend_fully")).toBe(true);
  });
});

describe("squat engine: rejected reps and form", () => {
  it("rejects partial squats with go_lower", () => {
    const result = runFrames("squat", squatSequence({ reps: 3, bottomAngle: 115 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower"]);
  });

  it("ignores tiny knee bends entirely", () => {
    const result = runFrames("squat", squatSequence({ reps: 3, bottomAngle: 150 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
  });

  it("rejects too-fast squats", () => {
    const result = runFrames("squat", squatSequence({ reps: 3, repMs: 340, bottomHoldMs: 40, holdMs: 300 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast"]);
  });

  it("re-dipping without standing up is rejected with extend_fully", () => {
    const profile = keyframes([
      [0, 175],
      [1000, 175],
      [1800, 70],
      [2400, 145],
      [3000, 70],
      [3800, 175],
      [4600, 175],
    ]);
    const result = runFrames("squat", squatSequence({ profile: { durationMs: 4600, angleAt: profile } }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(1);
  });

  it("warns chest_up on excessive forward lean but still counts by default", () => {
    const result = runFrames("squat", squatSequence({ reps: 3, torsoLeanAt: (k) => (180 - k) * 0.62 }));
    expect(result.final.reps).toBe(3);
    expect(result.issuesSeen.has("chest_up")).toBe(true);
    // Normal lean does not warn.
    const normal = runFrames("squat", squatSequence({ reps: 3 }));
    expect(normal.issuesSeen.has("chest_up")).toBe(false);
  });

  it("rejects chest_up reps when rejectOnChestUp is set", () => {
    const frames = squatSequence({ reps: 3, torsoLeanAt: (k) => (180 - k) * 0.62 });
    const result = runFrames("squat", frames, { rejectOnChestUp: true });
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["chest_up", "chest_up", "chest_up"]);
  });

  it("does not start a set while bent over (torso not upright)", () => {
    const result = runFrames("squat", squatSequence({ reps: 3, torsoLeanAt: () => 45 }));
    expect(result.final.reps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("chest_up")).toBe(true);
  });

  it("seated knee extensions do not count as squats (the hip never drops)", () => {
    for (const options of [{}, { jitterDeg: 4, seed: 2 }, { width: 480, height: 640 }]) {
      const result = runFrames("squat", seatedKneeExtensionSequence({ reps: 4, ...options }));
      expect(result.final.reps).toBe(0);
      expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower", "go_lower"]);
    }
  });

  it("the hip-drop requirement is what blocks seated knee extensions", () => {
    const result = runFrames("squat", seatedKneeExtensionSequence({ reps: 4 }), { minHipDropShinRatio: 0 });
    expect(result.final.reps).toBe(4);
  });

  it("push-ups do not count as squats", () => {
    const result = runFrames("squat", pushupSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
  });
});

describe("squat engine: tracking loss and glitches", () => {
  it("a dropout at the bottom loses that rep, goes searching, and recovers", () => {
    const timeline = squatTimeline({ reps: 5 });
    const bottom = timeline.reps[2].bottomStartMs;
    const result = runFrames("squat", withDropout(squatSequence({ reps: 5 }), bottom - 200, bottom + 500));
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toContain("searching");
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("a teleport glitch of the knees does not create a rep", () => {
    const timeline = squatTimeline({ reps: 5 });
    for (const at of [timeline.reps[1].endMs + 100, timeline.reps[3].startMs + 300]) {
      const frames = withTeleport(squatSequence({ reps: 5 }), at, {
        durationMs: 100,
        joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE],
        dx: 0.35,
        dy: -0.1,
      });
      const result = runFrames("squat", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
      expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    }
  });
});
