import { describe, expect, it } from "vitest";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { keyframes, squatSequence, withDropout, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createEngine, demo } from "..";
import { GLUTE_BRIDGE_DEFAULTS } from "../config";
import { bridgeSequence, heelSlideSequence, type BridgeSequenceOptions } from "../synthetic";

function expectClean(options: BridgeSequenceOptions, reps = 5) {
  const result = runFrames("glute_bridge", bridgeSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(GLUTE_BRIDGE_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(GLUTE_BRIDGE_DEFAULTS.hipsDownMaxDeg);
    expect(rep.maxAngleDeg).toBeGreaterThan(GLUTE_BRIDGE_DEFAULTS.topMinDeg);
  }
  return result;
}

describe("glute-bridge engine: clean sets", () => {
  it.each<[string, BridgeSequenceOptions]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["portrait", { width: 480, height: 640 }],
    ["right side near", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["brisk 0.9 s reps", { repMs: 900, holdMs: 150, bottomHoldMs: 0 }],
    ["slow 3 s reps with a 1 s squeeze", { repMs: 3000, bottomHoldMs: 1000 }],
    ["over-arched top (188)", { bottomAngle: 188 }],
  ])("counts exactly 5 (%s)", (_l, o) => {
    expectClean(o);
  });

  it("phases: searching -> ready -> down/up", () => {
    const result = expectClean({}, 2);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up"]);
  });

  it("stays exact with +/-4 deg seeded jitter at 30 and 15 fps, plus positional noise", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
    }
    const noisy = withJitter(bridgeSequence({ reps: 5, jitterDeg: 3, seed: 4 }), { amplitude: 0.003, seed: 4 });
    expect(runFrames("glute_bridge", noisy).final.reps).toBe(5);
  });

  it("the demo loop is counted as one rep", () => {
    const result = runFrames("glute_bridge", demo.frames());
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
  });
});

describe("glute-bridge engine: rejections and cheats", () => {
  it("half bridges (to 159) are rejected with go_higher", () => {
    const result = runFrames("glute_bridge", bridgeSequence({ reps: 4, bottomAngle: 159 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_higher", "go_higher", "go_higher", "go_higher"]);
  });

  it("too-fast reps are rejected with too_fast", () => {
    const result = runFrames("glute_bridge", bridgeSequence({ reps: 4, repMs: 380, holdMs: 250, bottomHoldMs: 0 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).length).toBeGreaterThan(0);
    expect(new Set(rejectionReasons(result))).toEqual(new Set(["too_fast"]));
  });

  it("hip pulses at the top without touching down: rejected go_lower", () => {
    const profile = keyframes([
      [0, 131], [1000, 131], [1800, 178], [2100, 178], [2500, 150], [2900, 178], [3200, 178], [4000, 131], [5000, 131],
    ]);
    const result = runFrames("glute_bridge", bridgeSequence({ profile: { durationMs: 5000, angleAt: profile } }));
    expect(rejectionReasons(result)).toEqual(["go_lower"]);
    expect(result.final.reps).toBe(1);
  });

  it("heel slides with the hips on the floor count 0", () => {
    const result = runFrames("glute_bridge", heelSlideSequence({}));
    expect(result.final.reps).toBe(0);
  });

  it("heel slides still count 0 with the knee gate disabled (hip-lift check)", () => {
    const result = runFrames("glute_bridge", heelSlideSequence({}), { maxKneeAngleDeg: 180 });
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).every((r) => r === "go_higher")).toBe(true);
    expect(rejectionReasons(result).length).toBeGreaterThan(0);
  });

  it("standing squats count 0 (shoulders must stay on the floor)", () => {
    const result = runFrames("glute_bridge", squatSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("searching");
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });
});

describe("glute-bridge engine: tracking", () => {
  it("dropout mid-rep -> searching, recovers without a phantom rep", () => {
    const frames = bridgeSequence({ reps: 5 });
    // Rep 2 runs 3100..4900 ms; drop out across its top.
    const result = runFrames("glute_bridge", withDropout(frames, 3700, 4300));
    expect(result.phases).toContain("searching");
    expect(result.final.reps).toBe(4);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("teleport glitch freezes counting without phantom reps", () => {
    const frames = withTeleport(bridgeSequence({ reps: 5 }), 5000, { durationMs: 60, joints: [LM.LEFT_HIP, LM.LEFT_KNEE] });
    const result = runFrames("glute_bridge", frames);
    expect(result.final.reps).toBeLessThanOrEqual(5);
    expect(result.final.reps).toBeGreaterThanOrEqual(4);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(bridgeSequence({ reps: 3, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("glute_bridge").getState());
    expect(frames.map((f) => engine.update(f))).toEqual(a);
  });

  it("malformed frames never throw", () => {
    const engine = createEngine();
    const good = bridgeSequence({ reps: 1 })[20];
    const junk: unknown[] = [
      null,
      {},
      { ...good, timestampMs: Number.NaN },
      { ...good, timestampMs: 1, landmarks: good.landmarks.map((l) => ({ ...l, y: Number.NaN })) },
      { ...good, timestampMs: 2, landmarks: good.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })) },
      { ...good, timestampMs: 3, imageWidth: 0 },
      { ...good, timestampMs: 4, landmarks: new Array(LANDMARK_COUNT).fill(null) },
    ];
    for (const f of junk) expect(() => engine.update(f as PoseFrame)).not.toThrow();
    expect(engine.getState().reps).toBe(0);
  });
});
