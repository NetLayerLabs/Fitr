import { describe, expect, it } from "vitest";
import { eventsOfType, rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { LM } from "@/lib/pose/landmarks";
import { squatSequence, withDropout, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { LUNGE_DEFAULTS } from "../config";
import { lungeSequence, standingLegCurlSequence, type LungeSequenceOptions } from "../synthetic";

function expectClean(options: LungeSequenceOptions, reps = 4) {
  const result = runFrames("lunge", lungeSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  const seen = repEvents(result);
  expect(seen.map((e) => e.repIndex)).toEqual(Array.from({ length: reps }, (_, i) => i + 1));
  for (const rep of seen) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(LUNGE_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(LUNGE_DEFAULTS.downAngleDeg);
  }
  return result;
}

describe("lunge engine: clean sets", () => {
  it.each<[string, LungeSequenceOptions]>([
    ["30 fps, alternating legs", {}],
    ["15 fps, alternating legs", { fps: 15 }],
    ["near leg always in front", { frontLeg: "near" }],
    ["far leg always in front", { frontLeg: "far" }],
    ["far leg in front at 15 fps", { frontLeg: "far", fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["slow 3 s lunges with a long pause at the bottom", { repMs: 3000, bottomHoldMs: 800 }],
  ])("counts every lunge exactly (%s)", (_label, options) => {
    expectClean(options);
  });

  it("goes searching -> ready -> down/up", () => {
    const result = expectClean({}, 2);
    expect(result.phases).toEqual(["searching", "ready", "down", "up", "down", "up"]);
    expect(result.final.formIssues).toEqual([]);
  });

  it("follows the front leg: the primary angle at depth is the front knee on both legs", () => {
    for (const frontLeg of ["near", "far"] as const) {
      const result = runFrames("lunge", lungeSequence({ reps: 1, frontLeg, bottomHoldMs: 600 }));
      const deepest = Math.min(...result.updates.map((u) => u.state.primaryAngleDeg ?? 999));
      expect(deepest).toBeLessThan(96);
      expect(result.final.reps).toBe(1);
    }
  });

  it("stays exact with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 12; seed++) {
      expectClean({ jitterDeg: 4, seed });
      expectClean({ jitterDeg: 4, seed, fps: 15 });
      expectClean({ jitterDeg: 4, seed, frontLeg: "far" });
    }
  });

  it("stays exact with positional landmark noise", () => {
    const frames = withJitter(lungeSequence({ reps: 4, jitterDeg: 3, seed: 5 }), { amplitude: 0.003, seed: 5 });
    expect(runFrames("lunge", frames).final.reps).toBe(4);
  });

  it("counts the form-guide demo loop as exactly one lunge", () => {
    const result = runFrames("lunge", demo.frames());
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
    // The judged angle is "good" somewhere in the loop.
    expect(demo.judged).not.toBeNull();
  });
});

describe("lunge engine: rejected reps and cheats", () => {
  it("rejects partial lunges with go_lower", () => {
    const result = runFrames("lunge", lungeSequence({ reps: 4, depth: 0.6 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_lower", "go_lower", "go_lower", "go_lower"]);
    expect(result.issuesSeen.has("go_lower")).toBe(true);
  });

  it("rejects too-fast lunges", () => {
    const result = runFrames("lunge", lungeSequence({ reps: 3, repMs: 380, bottomHoldMs: 0, holdMs: 500 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["too_fast", "too_fast", "too_fast"]);
  });

  it("does not count squats (both knees bend, but the back knee never drops)", () => {
    const result = runFrames("lunge", squatSequence({ reps: 5 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).every((r) => r === "go_lower")).toBe(true);
  });

  it("does not count standing leg curls (one knee bends, the other stays straight)", () => {
    const result = runFrames("lunge", standingLegCurlSequence({ reps: 4 }));
    expect(result.final.reps).toBe(0);
  });

  it("rejects a lunge that bounces back to depth without standing up (extend_fully)", () => {
    const profile = {
      durationMs: 6000,
      angleAt: (t: number) => {
        // 0..1 depth * 100: stand, down, half up, down, stand, then a clean lunge.
        const pts: [number, number][] = [
          [0, 0], [900, 0], [1800, 100], [2300, 8], [2800, 100], [3700, 0], [4100, 0], [5000, 100], [5900, 0],
        ];
        for (let i = 1; i < pts.length; i++) {
          if (t <= pts[i][0]) {
            const [t0, v0] = pts[i - 1];
            const [t1, v1] = pts[i];
            return v0 + ((v1 - v0) * (1 - Math.cos((Math.PI * (t - t0)) / (t1 - t0)))) / 2;
          }
        }
        return 0;
      },
    };
    const result = runFrames("lunge", lungeSequence({ profile, frontLeg: "near" }));
    expect(rejectionReasons(result)).toEqual(["extend_fully"]);
    expect(result.final.reps).toBe(2);
  });
});

describe("lunge engine: tracking", () => {
  it("abandons a lunge when tracking drops mid-rep, then recovers without phantom reps", () => {
    // Rep 2 (of 4) reaches the bottom around 4.15 s.
    const frames = withDropout(lungeSequence({ reps: 4 }), 3900, 4500);
    const result = runFrames("lunge", frames);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
    const iSearch = result.phases.lastIndexOf("searching");
    expect(iSearch).toBeGreaterThan(1);
    expect(result.phases.slice(iSearch)).toContain("ready");
    expect(result.final.reps).toBe(3);
  });

  it("needs the other leg visible too", () => {
    const frames = lungeSequence({ reps: 4, visibility: { [LM.RIGHT_KNEE]: 0.1, [LM.RIGHT_ANKLE]: 0.1 } });
    const result = runFrames("lunge", frames);
    expect(result.final.reps).toBe(0);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("flags a single-frame glitch and does not invent reps", () => {
    const frames = withTeleport(lungeSequence({ reps: 4 }), 4150, { joints: [LM.LEFT_KNEE, LM.RIGHT_KNEE, LM.LEFT_HIP] });
    const result = runFrames("lunge", frames);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(result.final.reps).toBeLessThanOrEqual(4);
    expect(result.final.reps).toBeGreaterThanOrEqual(3);
  });
});

describe("lunge engine: determinism and robustness", () => {
  it("gives deep-equal output for the same frames, and reset() replays identically", () => {
    const frames = withJitter(lungeSequence({ reps: 3, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const a = runFrames("lunge", frames);
    const b = runFrames("lunge", frames);
    expect(b.updates).toEqual(a.updates);
    expect(b.summary).toEqual(a.summary);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const s1 = engine.summary();
    engine.reset();
    const second = frames.map((f) => engine.update(f));
    expect(second).toEqual(first);
    expect(engine.summary()).toEqual(s1);
  });

  it("never throws on malformed frames and still counts the good ones", () => {
    const good = lungeSequence({ reps: 2 });
    const junk = [
      null,
      undefined,
      {},
      { timestampMs: Number.NaN, landmarks: [], imageWidth: 640, imageHeight: 480 },
      { timestampMs: 1, landmarks: null, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 2, landmarks: new Array(33).fill(null), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 3, landmarks: good[0].landmarks, imageWidth: 0, imageHeight: 0 },
      {
        timestampMs: 4,
        landmarks: good[0].landmarks.map((l) => ({ ...l, x: Number.NaN })),
        imageWidth: 640,
        imageHeight: 480,
      },
      { timestampMs: 5, landmarks: good[0].landmarks.slice(0, 20), imageWidth: 640, imageHeight: 480 },
    ] as unknown as PoseFrame[];
    const engine = createEngine();
    for (const f of junk) expect(() => engine.update(f)).not.toThrow();
    for (const f of good) engine.update({ ...f, timestampMs: f.timestampMs + 100 });
    expect(engine.getState().reps).toBe(2);
    expect(eventsOfType(runFrames("lunge", good), "rep")).toHaveLength(2);
  });
});
