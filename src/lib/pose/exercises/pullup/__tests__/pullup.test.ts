import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import {
  keyframes,
  squatSequence,
  standingArmCurlSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { PULLUP_DEFAULTS } from "../config";
import { pullupSequence, pullupTimeline, type PullupSequenceOptions } from "../synthetic";

function expectClean(options: PullupSequenceOptions, reps = 5) {
  const result = runFrames("pullup", pullupSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  expect(rejectionReasons(result)).toEqual([]);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(PULLUP_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(90);
    expect(rep.maxAngleDeg).toBeGreaterThan(150);
  }
  return result;
}

describe("pull-up engine: clean sets", () => {
  it.each<[string, PullupSequenceOptions]>([
    ["30 fps landscape", {}],
    ["15 fps", { fps: 15 }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["portrait at 15 fps", { width: 480, height: 640, fps: 15 }],
    ["mirrored (selfie preview)", { mirror: true }],
    ["slow 3.5 s reps", { repMs: 3500 }],
    ["brisk 1.2 s reps, short hang", { repMs: 1200, holdMs: 150 }],
    ["wide grip", { gripHalfWidth: 0.3, bottomAngle: 70 }],
    ["closer grip, deeper pull", { gripHalfWidth: 0.2, bottomAngle: 45 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    expectClean(options);
  });

  it("goes searching -> ready -> down/up, reads both arms (side: both)", () => {
    const result = expectClean({}, 3);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up", "down", "up"]);
    expect(result.final.side).toBe("both");
    expect(result.final.formIssues).toEqual([]);
    expect(result.final.primaryAngleDeg).toBeGreaterThan(160);
    expect(result.final.bodyLineDeg).toBeNull();
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
    }
  });

  it("stays exact with positional landmark noise", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = withJitter(pullupSequence({ reps: 5, jitterDeg: 3, seed }), { amplitude: 0.003, seed });
      const result = runFrames("pullup", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
    }
  });

  it("uses the nose when the mouth is not visible", () => {
    const frames = pullupSequence({ reps: 3, visibility: { [LM.MOUTH_LEFT]: 0.1, [LM.MOUTH_RIGHT]: 0.1 } });
    expect(runFrames("pullup", frames).final.reps).toBe(3);
  });
});

describe("pull-up engine: rejections", () => {
  it("rejects half reps (chin never over the bar) with chin_over_bar", () => {
    const result = runFrames("pullup", pullupSequence({ reps: 3, bottomAngle: 90 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["chin_over_bar", "chin_over_bar", "chin_over_bar"]);
    expect(result.issuesSeen.has("chin_over_bar")).toBe(true);
  });

  it("rejects kipping-fast reps with too_fast", () => {
    const result = runFrames("pullup", pullupSequence({ reps: 3, repMs: 450, bottomHoldMs: 80, holdMs: 300 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast"]);
  });

  it("rejects reps that do not return to a dead hang (extend_fully)", () => {
    const angleAt = keyframes([
      [0, 172],
      [1000, 172],
      [2000, 55],
      [3000, 140],
      [4000, 55],
      [5000, 172],
      [6000, 172],
    ]);
    const result = runFrames("pullup", pullupSequence({ profile: { durationMs: 6000, angleAt } }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(1);
  });

  it("does not start from a bent-arm hang", () => {
    const result = runFrames("pullup", pullupSequence({ reps: 4, topAngle: 135 }));
    expect(result.final.reps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("extend_fully")).toBe(true);
  });
});

describe("pull-up engine: cheats count 0", () => {
  it("pulling the arms down through the air (no bar) never counts", () => {
    for (const fps of [30, 15]) {
      const result = runFrames("pullup", pullupSequence({ reps: 5, mode: "air", fps }));
      expect(result.final.reps).toBe(0);
    }
    for (let seed = 1; seed <= 4; seed++) {
      expect(runFrames("pullup", pullupSequence({ reps: 4, mode: "air", jitterDeg: 4, seed })).final.reps).toBe(0);
    }
  });

  it("side-on to the camera never counts and asks to face the camera", () => {
    const result = runFrames("pullup", pullupSequence({ reps: 4, turnDeg: 80 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("face_camera")).toBe(true);
  });

  it("side-view squats and arm curls never count", () => {
    expect(runFrames("pullup", squatSequence({ reps: 4 })).final.reps).toBe(0);
    expect(runFrames("pullup", standingArmCurlSequence({ reps: 4 })).final.reps).toBe(0);
  });

  it("turning side-on mid-set abandons the set", () => {
    const tl = pullupTimeline({ reps: 3 });
    const w = tl.reps[1];
    const good = pullupSequence({ reps: 3 });
    const turned = pullupSequence({ reps: 3, turnDeg: 85 });
    const frames = good.map((f, i) =>
      f.timestampMs >= w.startMs + 300 && f.timestampMs < w.bottomEndMs + 200 ? turned[i] : f,
    );
    const result = runFrames("pullup", frames);
    expect(result.final.reps).toBe(2);
    expect(result.issuesSeen.has("face_camera")).toBe(true);
  });
});

describe("pull-up engine: tracking", () => {
  it("a dropout mid-rep abandons that rep, goes searching, then recovers without phantom reps", () => {
    const w = pullupTimeline({ reps: 5 }).reps[2];
    const frames = withDropout(pullupSequence({ reps: 5 }), w.bottomStartMs - 300, w.bottomStartMs + 300);
    const result = runFrames("pullup", frames);
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases.filter((p) => p === "searching").length).toBe(2);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("one arm dropping out of view abandons the rep (face_camera), then recovers", () => {
    const w = pullupTimeline({ reps: 4 }).reps[1];
    const hidden = pullupSequence({
      reps: 4,
      visibility: { [LM.RIGHT_ELBOW]: 0.1, [LM.RIGHT_WRIST]: 0.1, [LM.RIGHT_SHOULDER]: 0.1 },
    });
    const frames = pullupSequence({ reps: 4 }).map((f, i) =>
      f.timestampMs >= w.bottomStartMs - 300 && f.timestampMs < w.bottomStartMs + 300 ? hidden[i] : f,
    );
    const result = runFrames("pullup", frames);
    expect(result.final.reps).toBe(3);
    expect(result.issuesSeen.has("face_camera")).toBe(true);
  });

  it("a frame gap mid-rep abandons the rep", () => {
    const w = pullupTimeline({ reps: 4 }).reps[1];
    const frames = withGap(pullupSequence({ reps: 4 }), w.bottomStartMs - 300, w.bottomStartMs + 400);
    expect(runFrames("pullup", frames).final.reps).toBe(3);
  });

  it("a teleport glitch never adds reps", () => {
    const w = pullupTimeline({ reps: 4 }).reps[1];
    const result = runFrames("pullup", withTeleport(pullupSequence({ reps: 4 }), w.bottomStartMs, { durationMs: 60 }));
    expect(result.final.reps).toBeLessThanOrEqual(4);
    expect(result.final.reps).toBeGreaterThanOrEqual(3);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });
});

describe("pull-up engine: determinism and robustness", () => {
  it("same frames give deep-equal outputs, and reset() replays identically", () => {
    const frames = withJitter(pullupSequence({ reps: 4, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 3 });
    const a = runFrames("pullup", frames);
    expect(runFrames("pullup", frames).updates).toEqual(a.updates);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const firstSummary = engine.summary();
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("pullup").getState());
    expect(engine.getState().side).toBeNull();
    expect(frames.map((f) => engine.update(f))).toEqual(first);
    expect(engine.summary()).toEqual(firstSummary);
  });

  it("malformed frames never throw", () => {
    const good = pullupSequence({ reps: 1 })[30];
    const garbage: unknown[] = [
      null,
      undefined,
      {},
      { timestampMs: 1, landmarks: null, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 2, landmarks: good.landmarks.slice(0, 5), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 3, landmarks: new Array(LANDMARK_COUNT).fill(null), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 4, landmarks: good.landmarks.map((l) => ({ ...l, y: Number.NaN })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 5, landmarks: good.landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 6, landmarks: good.landmarks.map((l, i) => (i === LM.NOSE ? { ...l, x: Number.NaN } : l)), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 7, landmarks: good.landmarks, imageWidth: 0, imageHeight: 0 },
    ];
    const engine = createEngine();
    for (const g of garbage) expect(() => engine.update(g as PoseFrame)).not.toThrow();
    expect(engine.getState().reps).toBe(0);
    for (const f of pullupSequence({ reps: 2, startMs: 1000 })) engine.update(f);
    expect(engine.getState().reps).toBe(2);
  });
});

describe("pull-up demo", () => {
  it("is one clean rep counted by the engine, with the judged elbow reaching the top", () => {
    const frames = demo.frames();
    const durationS = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    expect(durationS).toBeGreaterThan(2);
    expect(durationS).toBeLessThan(4);
    const result = runFrames("pullup", frames);
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
    expect(demo.judged?.good(55)).toBe(true);
    expect(demo.judged?.good(170)).toBe(false);
  });
});
