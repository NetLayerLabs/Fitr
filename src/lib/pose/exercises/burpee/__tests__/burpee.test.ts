import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { LM } from "@/lib/pose/landmarks";
import {
  plankSequence,
  pushupSequence,
  squatSequence,
  standingArmCurlSequence,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "../index";
import { burpeeSequence } from "../synthetic";

const run = (frames: readonly PoseFrame[]) => runFrames("burpee", frames);

/** Rep i (0-based) of a default sequence starts at this time. */
const repStart = (i: number, repMs = 3000, holdMs = 500, leadInMs = 1000) => leadInMs + i * (repMs + holdMs);

describe("burpees: clean reps", () => {
  for (const fps of [30, 15]) {
    it(`counts 5 clean burpees exactly at ${fps} fps`, () => {
      const r = run(burpeeSequence({ reps: 5, fps }));
      expect(r.final.reps).toBe(5);
      expect(r.final.rejectedReps).toBe(0);
      for (const d of r.summary.repDurationsMs) {
        // Last straight-legged frame of the descent -> first confirmed stand (~0.85x the rep).
        expect(d).toBeGreaterThan(2300);
        expect(d).toBeLessThan(3200);
      }
    });

    it(`counts burpees with a push-up and without a jump at ${fps} fps`, () => {
      expect(run(burpeeSequence({ reps: 3, fps, pushup: true })).final.reps).toBe(3);
      expect(run(burpeeSequence({ reps: 3, fps, jump: false })).final.reps).toBe(3);
    });

    it(`stays exact with +-4 deg jitter and positional noise at ${fps} fps`, () => {
      for (const seed of [5, 17, 41]) {
        const frames = withJitter(burpeeSequence({ reps: 5, fps, jitterDeg: 4, seed, pushup: seed === 17 }), {
          amplitude: 0.003,
          seed: seed + 1,
        });
        const r = run(frames);
        expect(r.final.reps).toBe(5);
        expect(r.final.rejectedReps).toBe(0);
      }
    });
  }

  it("counts with the body facing the other way / the right side nearest", () => {
    expect(run(burpeeSequence({ reps: 3, mirror: true })).final.reps).toBe(3);
    expect(run(burpeeSequence({ reps: 3, nearSide: "right" })).final.reps).toBe(3);
  });

  it("counts fast honest burpees (1.6 s) and slow ones (5 s)", () => {
    expect(run(burpeeSequence({ reps: 4, repMs: 1600, holdMs: 200 })).final.reps).toBe(4);
    expect(run(burpeeSequence({ reps: 3, repMs: 5000 })).final.reps).toBe(3);
  });

  it("goes searching -> ready -> down -> up", () => {
    expect(run(burpeeSequence({ reps: 1 })).phases).toEqual(["searching", "ready", "down", "up"]);
  });
});

describe("burpees: partial sequences and speed", () => {
  it("rejects squat thrusts that never reach the plank (body_not_horizontal)", () => {
    const r = run(burpeeSequence({ reps: 4, skipPlank: true }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(4).fill("body_not_horizontal"));
  });

  it("rejects a sagging plank (hips_sagging)", () => {
    const r = run(burpeeSequence({ reps: 3, plankHipBendDeg: 40 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(3).fill("hips_sagging"));
  });

  it("rejects too-fast sequences (too_fast)", () => {
    const r = run(burpeeSequence({ reps: 3, repMs: 500, holdMs: 400 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(3).fill("too_fast"));
  });

  it("abandons a sequence that takes longer than maxRepMs", () => {
    const r = run(burpeeSequence({ reps: 2, plankHoldMs: 5000 }));
    expect(r.final.reps).toBe(0);
    expect(r.phases).toContain("searching");
    expect(run(burpeeSequence({ reps: 2, plankHoldMs: 1500 })).final.reps).toBe(2);
  });
});

describe("burpees: cheats count 0", () => {
  it("knee planks instead of a plank (body_on_floor)", () => {
    const r = run(burpeeSequence({ reps: 3, plankKneeBendDeg: 50 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(3).fill("body_on_floor"));
  });

  it("plain squats (arms forward) and standing arm curls", () => {
    for (const frames of [squatSequence({ reps: 6 }), standingArmCurlSequence({ reps: 6 })]) {
      const r = run(frames);
      expect(r.final.reps).toBe(0);
      expect(r.final.rejectedReps).toBe(0);
    }
  });

  it("push-ups or a plank alone", () => {
    expect(run(pushupSequence({ reps: 6 })).final.reps).toBe(0);
    expect(run(plankSequence({ durationMs: 8000 })).final.reps).toBe(0);
  });
});

describe("burpees: tracking", () => {
  it("dropout mid-burpee -> searching, then recovers without a phantom rep", () => {
    const frames = burpeeSequence({ reps: 5 });
    const t0 = repStart(2) + 1200; // in the plank of rep 3
    const r = run(withDropout(frames, t0, t0 + 600));
    expect(r.phases.lastIndexOf("searching")).toBeGreaterThan(1);
    expect(r.issuesSeen.has("body_not_visible")).toBe(true);
    expect(r.final.reps).toBe(4);
    expect(r.final.rejectedReps).toBe(0);
  });

  it("a frame gap mid-burpee abandons it", () => {
    const frames = burpeeSequence({ reps: 3 });
    const t0 = repStart(1) + 1300;
    expect(run(withGap(frames, t0, t0 + 800)).final.reps).toBe(2);
  });

  it("a teleport glitch is flagged and adds no reps", () => {
    const frames = burpeeSequence({ reps: 3 });
    const r = run(withTeleport(frames, repStart(1) + 1000, { joints: [LM.LEFT_ELBOW, LM.LEFT_WRIST], durationMs: 40 }));
    expect(r.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(r.final.reps).toBeLessThanOrEqual(3);
    expect(r.final.reps).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(burpeeSequence({ reps: 3, jitterDeg: 4, seed: 8 }), { amplitude: 0.003 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    const sa = engine.summary();
    engine.reset();
    expect(engine.getState()).toEqual(createEngine().getState());
    const b = frames.map((f) => engine.update(f));
    expect(b).toEqual(a);
    expect(engine.summary()).toEqual(sa);
  });

  it("never throws on malformed frames", () => {
    const good = burpeeSequence({ reps: 1 });
    const engine = createEngine();
    const lms = good[30].landmarks;
    const junk: unknown[] = [
      undefined,
      "frame",
      { timestampMs: Infinity, landmarks: lms, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 5, landmarks: lms.slice(0, 5), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 6, landmarks: lms.map(() => undefined), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 7, landmarks: lms.map((l) => ({ ...l, y: Number.NaN })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 8, landmarks: lms.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 9, landmarks: lms, imageWidth: -1, imageHeight: 480 },
    ];
    for (const f of junk) expect(() => engine.update(f as PoseFrame)).not.toThrow();
    for (const f of good) expect(() => engine.update({ ...f, timestampMs: f.timestampMs + 100 })).not.toThrow();
  });
});

describe("burpees: demo", () => {
  it("the demo loop is one burpee counted by the engine", () => {
    const r = run(demo.frames());
    expect(repEvents(r)).toHaveLength(1);
    expect(r.final.rejectedReps).toBe(0);
  });

  it("keeps the whole body in frame throughout", () => {
    for (const f of demo.frames()) {
      for (const i of [LM.LEFT_SHOULDER, LM.LEFT_WRIST, LM.LEFT_ANKLE, LM.LEFT_FOOT_INDEX, LM.NOSE]) {
        expect(f.landmarks[i].x).toBeGreaterThan(0);
        expect(f.landmarks[i].x).toBeLessThan(1);
        expect(f.landmarks[i].y).toBeGreaterThan(0);
        expect(f.landmarks[i].y).toBeLessThan(1);
      }
    }
  });
});
