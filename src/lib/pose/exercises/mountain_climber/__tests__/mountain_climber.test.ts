import { describe, expect, it } from "vitest";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { plankSequence, withDropout, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createEngine, demo } from "..";
import { MOUNTAIN_CLIMBER_DEFAULTS } from "../config";
import { climberSequence, type ClimberSequenceOptions } from "../synthetic";

function expectClean(options: ClimberSequenceOptions, drives = 10) {
  const result = runFrames("mountain_climber", climberSequence({ drives, ...options }));
  expect(result.final.reps).toBe(drives);
  expect(result.final.rejectedReps).toBe(0);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(MOUNTAIN_CLIMBER_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(MOUNTAIN_CLIMBER_DEFAULTS.downAngleDeg);
    expect(rep.maxAngleDeg).toBeGreaterThan(MOUNTAIN_CLIMBER_DEFAULTS.upAngleDeg);
  }
  return result;
}

describe("mountain-climber engine: clean sets", () => {
  it.each<[string, ClimberSequenceOptions]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["portrait", { width: 480, height: 640 }],
    ["right side near", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["slow 1 s drives", { driveMs: 1000 }],
    ["brisk, overlapping legs (0.5 s drives every 0.35 s)", { driveMs: 500, spacingMs: 350 }],
    ["forearm plank", { body: "forearm" }],
    ["far leg barely visible (0.35)", { farLegVisibility: 0.35 }],
  ])("counts exactly 10 drives (%s)", (_l, o) => {
    expectClean(o);
  });

  it("15 fps with brisk 0.5 s drives", () => {
    expectClean({ fps: 15, driveMs: 500 });
  });

  it("each knee counts: drives alternate legs, near leg first", () => {
    const result = expectClean({}, 4);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up", "down", "up", "down", "up"]);
  });

  it("stays exact with +/-4 deg seeded jitter at 30 and 15 fps, plus positional noise", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15, driveMs: 700 });
    }
    const noisy = withJitter(climberSequence({ drives: 10, jitterDeg: 3, seed: 4 }), { amplitude: 0.003, seed: 4 });
    expect(runFrames("mountain_climber", noisy).final.reps).toBe(10);
  });

  it("the demo loop is counted as two drives (one per leg)", () => {
    const result = runFrames("mountain_climber", demo.frames());
    expect(result.final.reps).toBe(2);
    expect(result.final.rejectedReps).toBe(0);
  });
});

describe("mountain-climber engine: rejections and cheats", () => {
  it("short shuffles (hip angle ~125) are rejected with go_higher", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 6, peakDeg: 55 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(Array(6).fill("go_higher"));
  });

  it("tiny foot taps count nothing", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 10, peakDeg: 25 }));
    expect(result.final.reps).toBe(0);
  });

  it("too-fast drives are rejected with too_fast", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 6, driveMs: 250, spacingMs: 400, peakDeg: 130 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).length).toBeGreaterThan(0);
    expect(new Set(rejectionReasons(result))).toEqual(new Set(["too_fast"]));
  });

  it("standing high knees count 0 (not in a plank)", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 10, body: "standing" }));
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("searching");
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });

  it("knee drives with the hips piked up (downward-dog knee taps) count 0, flagged hips_piked", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 6, hipBendDeg: -40 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("hips_piked")).toBe(true);
  });

  it("piking up mid-set: those drives count nothing, the clean ones count", () => {
    const frames = climberSequence({ drives: 6 });
    const piked = climberSequence({ drives: 6, hipBendDeg: -40, startMs: frames[frames.length - 1].timestampMs + 33 });
    const result = runFrames("mountain_climber", [...frames, ...piked]);
    expect(result.final.reps).toBe(6);
    expect(result.issuesSeen.has("hips_piked")).toBe(true);
  });

  it("drives with sagging hips count 0, flagged hips_sagging", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 6, hipBendDeg: 30 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("hips_sagging")).toBe(true);
  });

  it("lying on the back pulling the knees in (dead bug) counts 0", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 10, body: "supine" }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("body_on_floor")).toBe(true);
  });

  it("knees on the floor never start a set", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 10, kneeBendDeg: 70 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("body_on_floor")).toBe(true);
  });

  it("a held plank counts 0", () => {
    const result = runFrames("mountain_climber", plankSequence({ durationMs: 6000, style: "straight", jitterDeg: 4 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.final.phase).toBe("ready");
  });

  it("far leg not tracked: nothing counts", () => {
    const result = runFrames("mountain_climber", climberSequence({ drives: 10, farLegVisibility: 0.1 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });
});

describe("mountain-climber engine: tracking", () => {
  it("dropout mid-drive -> searching, recovers without a phantom rep", () => {
    const frames = climberSequence({ drives: 10 });
    // Drive 3 runs 2100..2700 ms; drop out across its peak.
    const result = runFrames("mountain_climber", withDropout(frames, 2250, 2700));
    expect(result.phases).toContain("searching");
    expect(result.final.reps).toBeLessThanOrEqual(9);
    expect(result.final.reps).toBeGreaterThanOrEqual(7);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("teleport glitch freezes counting without phantom reps", () => {
    const frames = withTeleport(climberSequence({ drives: 10 }), 3000, { durationMs: 60, joints: [LM.LEFT_KNEE, LM.LEFT_HIP] });
    const result = runFrames("mountain_climber", frames);
    expect(result.final.reps).toBeLessThanOrEqual(10);
    expect(result.final.reps).toBeGreaterThanOrEqual(8);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(climberSequence({ drives: 6, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("mountain_climber").getState());
    expect(frames.map((f) => engine.update(f))).toEqual(a);
  });

  it("malformed frames never throw", () => {
    const engine = createEngine();
    const good = climberSequence({ drives: 1 })[20];
    const junk: unknown[] = [
      null,
      {},
      { ...good, timestampMs: Number.NaN },
      { ...good, timestampMs: 1, landmarks: good.landmarks.map((l) => ({ ...l, y: Number.NaN })) },
      { ...good, timestampMs: 2, landmarks: good.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })) },
      { ...good, timestampMs: 3, imageWidth: 0 },
      { ...good, timestampMs: 4, landmarks: new Array(LANDMARK_COUNT).fill(null) },
      { ...good, timestampMs: 5, landmarks: good.landmarks.map((l, i) => (i === LM.RIGHT_KNEE ? null : l)) },
    ];
    for (const f of junk) expect(() => engine.update(f as PoseFrame)).not.toThrow();
    expect(engine.getState().reps).toBe(0);
  });
});
