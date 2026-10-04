import { describe, expect, it } from "vitest";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { keyframes, withDropout, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createEngine, demo } from "..";
import { SITUP_DEFAULTS } from "../config";
import { situpSequence, standingToeTouchSequence, type SitupSequenceOptions } from "../synthetic";

function expectClean(options: SitupSequenceOptions, reps = 5) {
  const result = runFrames("situp", situpSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(SITUP_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(SITUP_DEFAULTS.lyingMaxDeg);
    expect(rep.maxAngleDeg).toBeGreaterThan(SITUP_DEFAULTS.sitUpMinDeg);
  }
  return result;
}

describe("sit-up engine: clean sets", () => {
  it.each<[string, SitupSequenceOptions]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["portrait", { width: 480, height: 640 }],
    ["right side near", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["fast 1 s reps", { repMs: 1000, holdMs: 150 }],
    ["slow 3 s reps, knees at 95", { repMs: 3000, kneeDeg: 95 }],
  ])("counts exactly 5 (%s)", (_l, o) => {
    expectClean(o);
  });

  it("phases: searching -> ready -> down/up", () => {
    const result = expectClean({}, 2);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up"]);
    expect(result.final.side).toBe("left");
  });

  it("stays exact with +/-4 deg seeded jitter at 30 and 15 fps, plus positional noise", () => {
    for (let seed = 1; seed <= 10; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
    }
    const noisy = withJitter(situpSequence({ reps: 5, jitterDeg: 3, seed: 4 }), { amplitude: 0.003, seed: 4 });
    expect(runFrames("situp", noisy).final.reps).toBe(5);
  });

  it("the demo loop is counted as one rep", () => {
    const result = runFrames("situp", demo.frames());
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
    expect(demo.frames().some((f) => f.landmarks.length === LANDMARK_COUNT)).toBe(true);
  });
});

describe("sit-up engine: rejections and cheats", () => {
  it("half sit-ups (to 50 deg) are rejected with go_higher", () => {
    const result = runFrames("situp", situpSequence({ reps: 4, bottomAngle: 50 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_higher", "go_higher", "go_higher", "go_higher"]);
    expect(result.issuesSeen.has("go_higher")).toBe(true);
  });

  it("tiny crunches (to 20 deg) count nothing", () => {
    const result = runFrames("situp", situpSequence({ reps: 5, bottomAngle: 20 }));
    expect(result.final.reps).toBe(0);
  });

  it("too-fast reps are rejected with too_fast", () => {
    const result = runFrames("situp", situpSequence({ reps: 4, repMs: 450, holdMs: 200 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).length).toBeGreaterThan(0);
    expect(new Set(rejectionReasons(result))).toEqual(new Set(["too_fast"]));
  });

  it("not lying back down between reps: rejected go_lower, only the full ones count", () => {
    const profile = keyframes([
      [0, 5], [1000, 5], [1800, 95], [2100, 95], [2700, 30], [3300, 95], [3600, 95], [4400, 5], [5400, 5],
    ]);
    const result = runFrames("situp", situpSequence({ profile: { durationMs: 5400, angleAt: profile } }));
    expect(rejectionReasons(result)).toEqual(["go_lower"]);
    expect(result.final.reps).toBe(1);
  });

  it("standing toe-touches count 0 (posture gate)", () => {
    const result = runFrames("situp", standingToeTouchSequence({}));
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("searching");
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });

  it("rocking while sat up (never lying back) counts 0", () => {
    const result = runFrames("situp", situpSequence({ reps: 5, topAngle: 50, bottomAngle: 100 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("searching");
  });

  it("straight-leg lying 'sit-ups' never start a set", () => {
    const result = runFrames("situp", situpSequence({ reps: 3, kneeDeg: 175 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });
});

describe("sit-up engine: tracking", () => {
  it("dropout mid-rep -> searching, recovers without a phantom rep", () => {
    const frames = situpSequence({ reps: 5 });
    // Rep 2 runs from 1000 + 1900 = 2900 ms; drop out across its top.
    const result = runFrames("situp", withDropout(frames, 3300, 3900));
    expect(result.phases).toContain("searching");
    expect(result.final.reps).toBe(4);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("teleport glitch freezes counting without phantom reps", () => {
    const frames = withTeleport(situpSequence({ reps: 5 }), 5000, { durationMs: 60, joints: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_SHOULDER] });
    const result = runFrames("situp", frames);
    expect(result.final.reps).toBeLessThanOrEqual(5);
    expect(result.final.reps).toBeGreaterThanOrEqual(4);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(situpSequence({ reps: 3, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("situp").getState());
    const b = frames.map((f) => engine.update(f));
    expect(b).toEqual(a);
    expect(runFrames("situp", frames).updates).toEqual(a);
  });

  it("malformed frames never throw", () => {
    const engine = createEngine();
    const good = situpSequence({ reps: 1 })[20];
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
