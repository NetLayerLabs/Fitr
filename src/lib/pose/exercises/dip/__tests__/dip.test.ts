import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT } from "@/lib/pose/landmarks";
import {
  keyframes,
  pushupSequence,
  squatSequence,
  standingArmCurlSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { DIP_DEFAULTS } from "../config";
import { dipSequence, dipTimeline, type DipSequenceOptions } from "../synthetic";

function expectClean(options: DipSequenceOptions, reps = 5) {
  const result = runFrames("dip", dipSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  expect(rejectionReasons(result)).toEqual([]);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(DIP_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThanOrEqual(90);
    expect(rep.maxAngleDeg).toBeGreaterThan(155);
  }
  return result;
}

describe("dip engine: clean sets", () => {
  it.each<[string, DipSequenceOptions]>([
    ["bench, 30 fps", {}],
    ["bench, 15 fps", { fps: 15 }],
    ["bars, 30 fps", { style: "bars" }],
    ["bars, 15 fps", { style: "bars", fps: 15 }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["slow 3 s reps", { repMs: 3000 }],
    ["fast-but-honest 0.8 s reps, no pause", { repMs: 800, holdMs: 0 }],
    ["just past 90 degrees", { bottomAngle: 84 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    expectClean(options);
  });

  it("goes searching -> ready -> down/up", () => {
    const result = expectClean({}, 3);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up", "down", "up"]);
    expect(result.final.side).toBe("left");
    expect(result.final.formIssues).toEqual([]);
    expect(result.final.primaryAngleDeg).toBeGreaterThan(160);
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
      expectClean({ jitterDeg: 4, seed, style: "bars" });
    }
  });

  it("stays exact with positional landmark noise", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = withJitter(dipSequence({ reps: 5, jitterDeg: 3, seed }), { amplitude: 0.003, seed });
      const result = runFrames("dip", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
    }
  });
});

describe("dip engine: rejections", () => {
  it("rejects partial range with go_lower", () => {
    const result = runFrames("dip", dipSequence({ reps: 3, bottomAngle: 115 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower"]);
  });

  it("rejects too-fast reps", () => {
    const result = runFrames("dip", dipSequence({ reps: 3, repMs: 300, bottomHoldMs: 80, holdMs: 250 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast"]);
  });

  it("rejects re-dipping without locking out (extend_fully)", () => {
    const angleAt = keyframes([
      [0, 172],
      [1000, 172],
      [1700, 75],
      [2400, 140],
      [3100, 75],
      [3800, 172],
      [4600, 172],
    ]);
    const result = runFrames("dip", dipSequence({ profile: { durationMs: 4600, angleAt } }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(1);
  });

  it("rejects a rep that leaned too far forward (chest_up)", () => {
    const tl = dipTimeline({ reps: 3 });
    const w = tl.reps[1];
    const leanDeg = (t: number) => (t > w.startMs + 200 && t < w.endMs - 200 ? 55 : undefined as unknown as number);
    const result = runFrames("dip", dipSequence({ reps: 3, leanDeg }));
    expect(result.final.reps).toBe(2);
    expect(rejectionReasons(result)).toEqual(["chest_up"]);
  });
});

describe("dip engine: cheats count 0", () => {
  it("standing arm curls (hands lifting, not pressing) never count", () => {
    for (const fps of [30, 15]) {
      const result = runFrames("dip", standingArmCurlSequence({ reps: 6, fps }));
      expect(result.final.reps).toBe(0);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("standing arm curls with jitter never count", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = withJitter(standingArmCurlSequence({ reps: 5, jitterDeg: 4, seed }), { amplitude: 0.003, seed });
      expect(runFrames("dip", frames).final.reps).toBe(0);
    }
  });

  it("push-ups (horizontal torso) never count", () => {
    const result = runFrames("dip", pushupSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("chest_up")).toBe(true);
  });

  it("squats never count", () => {
    expect(runFrames("dip", squatSequence({ reps: 5 })).final.reps).toBe(0);
  });

  it("leaning far forward the whole time never starts", () => {
    const result = runFrames("dip", dipSequence({ reps: 3, leanDeg: 55 }));
    expect(result.final.reps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
  });
});

describe("dip engine: tracking", () => {
  it("a dropout mid-rep abandons that rep, goes searching, then recovers without phantom reps", () => {
    const w = dipTimeline({ reps: 5 }).reps[2];
    const frames = withDropout(dipSequence({ reps: 5 }), w.bottomStartMs - 200, w.bottomStartMs + 400);
    const result = runFrames("dip", frames);
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases.filter((p) => p === "searching").length).toBe(2);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("a frame gap mid-rep abandons the rep", () => {
    const w = dipTimeline({ reps: 4 }).reps[1];
    const frames = withGap(dipSequence({ reps: 4 }), w.bottomStartMs - 300, w.bottomStartMs + 400);
    expect(runFrames("dip", frames).final.reps).toBe(3);
  });

  it("a teleport glitch never adds reps", () => {
    const w = dipTimeline({ reps: 4 }).reps[1];
    const result = runFrames("dip", withTeleport(dipSequence({ reps: 4 }), w.bottomStartMs, { durationMs: 60 }));
    expect(result.final.reps).toBeLessThanOrEqual(4);
    expect(result.final.reps).toBeGreaterThanOrEqual(3);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });
});

describe("dip engine: determinism and robustness", () => {
  it("same frames give deep-equal outputs, and reset() replays identically", () => {
    const frames = withJitter(dipSequence({ reps: 4, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 3 });
    const a = runFrames("dip", frames);
    expect(runFrames("dip", frames).updates).toEqual(a.updates);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const firstSummary = engine.summary();
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("dip").getState());
    expect(frames.map((f) => engine.update(f))).toEqual(first);
    expect(engine.summary()).toEqual(firstSummary);
  });

  it("malformed frames never throw", () => {
    const good = dipSequence({ reps: 1 })[30];
    const garbage: unknown[] = [
      null,
      undefined,
      {},
      { timestampMs: 1, landmarks: null, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 2, landmarks: good.landmarks.slice(0, 5), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 3, landmarks: new Array(LANDMARK_COUNT).fill(null), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 4, landmarks: good.landmarks.map((l) => ({ ...l, y: Number.NaN })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 5, landmarks: good.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 6, landmarks: good.landmarks, imageWidth: 0, imageHeight: 0 },
    ];
    const engine = createEngine();
    for (const g of garbage) expect(() => engine.update(g as PoseFrame)).not.toThrow();
    expect(engine.getState().reps).toBe(0);
    for (const f of dipSequence({ reps: 2, startMs: 1000 })) engine.update(f);
    expect(engine.getState().reps).toBe(2);
  });
});

describe("dip demo", () => {
  it("is one clean rep counted by the engine, with the judged elbow reaching depth", () => {
    const frames = demo.frames();
    const durationS = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    expect(durationS).toBeGreaterThan(2);
    expect(durationS).toBeLessThan(4);
    const result = runFrames("dip", frames);
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
    expect(demo.judged?.good(80)).toBe(true);
    expect(demo.judged?.good(170)).toBe(false);
  });
});
