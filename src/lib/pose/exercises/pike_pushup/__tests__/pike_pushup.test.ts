import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT } from "@/lib/pose/landmarks";
import {
  keyframes,
  pushupSequence,
  standingArmCurlSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { PIKE_PUSHUP_DEFAULTS } from "../config";
import { pikeSequence, pikeTimeline, type PikeSequenceOptions } from "../synthetic";

function expectClean(options: PikeSequenceOptions, reps = 5) {
  const result = runFrames("pike_pushup", pikeSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  expect(rejectionReasons(result)).toEqual([]);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(PIKE_PUSHUP_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(100);
    expect(rep.maxAngleDeg).toBeGreaterThan(155);
  }
  return result;
}

describe("pike push-up engine: clean sets", () => {
  it.each<[string, PikeSequenceOptions]>([
    ["30 fps landscape", {}],
    ["15 fps", { fps: 15 }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["portrait at 15 fps", { width: 480, height: 640, fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["slow 3 s reps", { repMs: 3000 }],
    ["fast-but-honest 0.9 s reps, no pause", { repMs: 900, holdMs: 0 }],
    ["higher pike (legs at 60 deg)", { legDeg: 60, bottomAngle: 80 }],
    ["feet further back", { ankleX: -0.5, legDeg: 50 }],
  ])("counts exactly 5 reps (%s)", (_label, options) => {
    expectClean(options);
  });

  it("goes searching -> ready -> down/up and reports the elbow and hip angles", () => {
    const result = expectClean({}, 3);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up", "down", "up"]);
    expect(result.final.side).toBe("left");
    expect(result.final.formIssues).toEqual([]);
    expect(result.final.primaryAngleDeg).toBeGreaterThan(160);
    expect(result.final.bodyLineDeg).toBeLessThan(PIKE_PUSHUP_DEFAULTS.maxHipAngleDeg);
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
    }
  });

  it("stays exact with positional landmark noise", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const frames = withJitter(pikeSequence({ reps: 5, jitterDeg: 3, seed }), { amplitude: 0.003, seed });
      const result = runFrames("pike_pushup", frames);
      expect(result.final.reps).toBe(5);
      expect(result.final.rejectedReps).toBe(0);
    }
  });
});

describe("pike push-up engine: rejections", () => {
  it("rejects partial range with go_lower", () => {
    const result = runFrames("pike_pushup", pikeSequence({ reps: 3, bottomAngle: 118 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower"]);
    expect(result.issuesSeen.has("go_lower")).toBe(true);
  });

  it("rejects too-fast reps", () => {
    const result = runFrames("pike_pushup", pikeSequence({ reps: 3, repMs: 300, bottomHoldMs: 80, holdMs: 250 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast"]);
  });

  it("rejects bouncing at the bottom without locking out (extend_fully)", () => {
    const angleAt = keyframes([
      [0, 172],
      [1000, 172],
      [1800, 70],
      [2600, 145],
      [3400, 70],
      [4200, 172],
      [5000, 172],
    ]);
    const result = runFrames("pike_pushup", pikeSequence({ profile: { durationMs: 5000, angleAt } }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(1);
  });

  it("rejects a rep where the hips dropped out of the V", () => {
    const tl = pikeTimeline({ reps: 3 });
    const w = tl.reps[1];
    // Hips sink during the press-up of rep 2 and are back up before rep 3.
    const legDeg = (t: number) => (t > w.bottomEndMs && t < w.endMs + 250 ? 30 : 52);
    const result = runFrames("pike_pushup", pikeSequence({ reps: 3, legDeg }));
    expect(result.final.reps).toBe(2);
    expect(rejectionReasons(result)).toEqual(["keep_hips_high"]);
  });
});

describe("pike push-up engine: cheats count 0", () => {
  it("regular push-ups (flat body) never count and ask for high hips", () => {
    const result = runFrames("pike_pushup", pushupSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
    expect(result.issuesSeen.has("keep_hips_high")).toBe(true);
  });

  it("standing arm curls never count", () => {
    const result = runFrames("pike_pushup", standingArmCurlSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(result.phases).toEqual(["searching"]);
  });

  it("dropping into a regular push-up mid-set cancels the set", () => {
    const pike = pikeSequence({ reps: 2 });
    const t1 = pike[pike.length - 1].timestampMs + 33;
    const flat = pushupSequence({ reps: 3, startMs: t1 });
    const result = runFrames("pike_pushup", [...pike, ...flat]);
    expect(result.final.reps).toBe(2);
    expect(result.final.phase).toBe("searching");
  });

  it("hips too low throughout (legs at 32 deg) never starts", () => {
    const result = runFrames("pike_pushup", pikeSequence({ reps: 4, legDeg: 32 }));
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("keep_hips_high")).toBe(true);
  });
});

describe("pike push-up engine: tracking", () => {
  it("a dropout mid-rep abandons that rep, goes searching, then recovers without phantom reps", () => {
    const tl = pikeTimeline({ reps: 5 });
    const w = tl.reps[2];
    const frames = withDropout(pikeSequence({ reps: 5 }), w.bottomStartMs - 200, w.bottomStartMs + 400);
    const result = runFrames("pike_pushup", frames);
    expect(result.final.reps).toBe(4);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.phases.filter((p) => p === "searching").length).toBe(2);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("a low-visibility dropout behaves the same", () => {
    const tl = pikeTimeline({ reps: 5 });
    const w = tl.reps[1];
    const frames = withDropout(pikeSequence({ reps: 5 }), w.bottomStartMs - 100, w.bottomStartMs + 500, "lowVisibility");
    expect(runFrames("pike_pushup", frames).final.reps).toBe(4);
  });

  it("a frame gap mid-rep abandons the rep", () => {
    const tl = pikeTimeline({ reps: 4 });
    const w = tl.reps[1];
    const frames = withGap(pikeSequence({ reps: 4 }), w.bottomStartMs - 300, w.bottomStartMs + 400);
    expect(runFrames("pike_pushup", frames).final.reps).toBe(3);
  });

  it("a teleport glitch never adds reps", () => {
    const tl = pikeTimeline({ reps: 4 });
    const frames = withTeleport(pikeSequence({ reps: 4 }), tl.reps[1].bottomStartMs, { durationMs: 60 });
    const result = runFrames("pike_pushup", frames);
    expect(result.final.reps).toBeLessThanOrEqual(4);
    expect(result.final.reps).toBeGreaterThanOrEqual(3);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });
});

describe("pike push-up engine: determinism and robustness", () => {
  it("same frames give deep-equal outputs, and reset() replays identically", () => {
    const frames = withJitter(pikeSequence({ reps: 4, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 3 });
    const a = runFrames("pike_pushup", frames);
    const b = runFrames("pike_pushup", frames);
    expect(b.updates).toEqual(a.updates);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const firstSummary = engine.summary();
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("pike_pushup").getState());
    expect(frames.map((f) => engine.update(f))).toEqual(first);
    expect(engine.summary()).toEqual(firstSummary);
  });

  it("malformed frames never throw", () => {
    const good = pikeSequence({ reps: 1 })[30];
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
    // Still counts afterwards.
    for (const f of pikeSequence({ reps: 2, startMs: 1000 })) engine.update(f);
    expect(engine.getState().reps).toBe(2);
  });
});

describe("pike push-up demo", () => {
  it("is one clean rep counted by the engine, with the judged elbow reaching depth", () => {
    const frames = demo.frames();
    const durationS = (frames[frames.length - 1].timestampMs - frames[0].timestampMs) / 1000;
    expect(durationS).toBeGreaterThan(2);
    expect(durationS).toBeLessThan(4);
    const result = runFrames("pike_pushup", frames);
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
    expect(demo.judged?.good(70)).toBe(true);
    expect(demo.judged?.good(170)).toBe(false);
    expect(demo.layout).toBe("floor");
  });
});
