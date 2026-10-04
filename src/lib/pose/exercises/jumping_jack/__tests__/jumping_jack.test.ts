import { describe, expect, it } from "vitest";
import { eventsOfType, rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { LM } from "@/lib/pose/landmarks";
import { squatSequence, withDropout, withGap, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { frontSkeleton, renderFrontLandmarks } from "../../front/skeleton";
import { createEngine, demo } from "../index";
import { jumpingJackSequence } from "../synthetic";

const run = (frames: readonly PoseFrame[]) => runFrames("jumping_jack", frames);

describe("front skeleton renderer", () => {
  it("puts the anatomical left on the right of an unmirrored image, both sides visible", () => {
    const lms = renderFrontLandmarks(frontSkeleton());
    expect(lms).toHaveLength(33);
    expect(lms[LM.LEFT_SHOULDER].x).toBeGreaterThan(lms[LM.RIGHT_SHOULDER].x);
    expect(lms[LM.LEFT_HIP].x).toBeGreaterThan(lms[LM.RIGHT_HIP].x);
    expect(lms[LM.NOSE].y).toBeLessThan(lms[LM.LEFT_SHOULDER].y);
    expect(lms[LM.LEFT_ANKLE].y).toBeGreaterThan(lms[LM.LEFT_KNEE].y);
    for (const lm of lms) {
      expect(lm.visibility).toBeCloseTo(0.95);
      expect(lm.x).toBeGreaterThan(0);
      expect(lm.x).toBeLessThan(1);
      expect(lm.y).toBeGreaterThan(0);
      expect(lm.y).toBeLessThan(1);
    }
  });

  it("keeps raised hands and a jump in frame", () => {
    const lms = renderFrontLandmarks(
      frontSkeleton({ left: { upperArmDeg: 178 }, right: { upperArmDeg: 178 }, lift: 0.06 }),
    );
    expect(lms[LM.LEFT_INDEX].y).toBeGreaterThan(0);
    expect(lms[LM.LEFT_WRIST].y).toBeLessThan(lms[LM.NOSE].y);
  });

  it("mirrors x only", () => {
    const a = renderFrontLandmarks(frontSkeleton());
    const b = renderFrontLandmarks(frontSkeleton(), { mirror: true });
    expect(b[LM.LEFT_WRIST].x).toBeCloseTo(1 - a[LM.LEFT_WRIST].x);
    expect(b[LM.LEFT_WRIST].y).toBeCloseTo(a[LM.LEFT_WRIST].y);
  });
});

describe("jumping jacks: clean reps", () => {
  for (const fps of [30, 15]) {
    it(`counts 6 clean reps exactly at ${fps} fps`, () => {
      const r = run(jumpingJackSequence({ reps: 6, fps }));
      expect(r.final.reps).toBe(6);
      expect(r.final.rejectedReps).toBe(0);
      expect(r.final.side).toBe("both");
      expect(r.summary.repDurationsMs).toHaveLength(6);
      for (const d of r.summary.repDurationsMs) {
        expect(d).toBeGreaterThan(700);
        expect(d).toBeLessThan(1400);
      }
    });

    it(`stays exact with +-4 deg jitter and positional noise at ${fps} fps`, () => {
      for (const seed of [3, 11, 29]) {
        const frames = withJitter(jumpingJackSequence({ reps: 8, fps, jitterDeg: 4, seed }), {
          amplitude: 0.003,
          seed: seed + 1,
        });
        const r = run(frames);
        expect(r.final.reps).toBe(8);
        expect(r.final.rejectedReps).toBe(0);
      }
    });
  }

  it("counts mirrored (selfie) input the same", () => {
    expect(run(jumpingJackSequence({ reps: 4, mirror: true })).final.reps).toBe(4);
  });

  it("counts fast but honest jacks (700 ms per rep, no pause)", () => {
    const r = run(jumpingJackSequence({ reps: 10, repMs: 650, holdMs: 50, bottomHoldMs: 0, fps: 30 }));
    expect(r.final.reps).toBe(10);
  });

  it("goes searching -> ready -> down -> up", () => {
    const r = run(jumpingJackSequence({ reps: 1 }));
    expect(r.phases).toEqual(["searching", "ready", "down", "up"]);
  });
});

describe("jumping jacks: partial range and speed", () => {
  it("rejects arms that only reach shoulder height (arms_overhead)", () => {
    const r = run(jumpingJackSequence({ reps: 4, armTopDeg: 100 }));
    expect(r.final.reps).toBe(0);
    expect(r.final.rejectedReps).toBe(4);
    expect(rejectionReasons(r)).toEqual(Array(4).fill("arms_overhead"));
  });

  it("rejects one-armed jacks (arms_overhead)", () => {
    const r = run(jumpingJackSequence({ reps: 3, oneArm: true }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(3).fill("arms_overhead"));
  });

  it("rejects a half movement of both arms and legs", () => {
    const r = run(jumpingJackSequence({ reps: 3, peak: 0.55 }));
    expect(r.final.reps).toBe(0);
    expect(r.final.rejectedReps).toBe(3);
  });

  it("rejects too-fast reps (too_fast)", () => {
    const r = run(jumpingJackSequence({ reps: 4, repMs: 260, holdMs: 120, bottomHoldMs: 0, fps: 30 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toContain("too_fast");
  });
});

describe("jumping jacks: cheats count 0", () => {
  it("arms only, feet staying together (jump_higher)", () => {
    const r = run(jumpingJackSequence({ reps: 5, legTopDeg: 2 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(5).fill("jump_higher"));
  });

  it("feet only, arms by the sides (arms_overhead)", () => {
    const r = run(jumpingJackSequence({ reps: 5, armTopDeg: 15 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(5).fill("arms_overhead"));
  });

  it("side-on to the camera (face_camera)", () => {
    const r = run(jumpingJackSequence({ reps: 5, turnDeg: 80 }));
    expect(r.final.reps).toBe(0);
    expect(r.issuesSeen.has("face_camera")).toBe(true);
  });

  it("lying on the floor doing snow angels (chest_up)", () => {
    const r = run(jumpingJackSequence({ reps: 5, rollDeg: 90 }));
    expect(r.final.reps).toBe(0);
    expect(r.issuesSeen.has("chest_up")).toBe(true);
  });

  it("side-view squats", () => {
    expect(run(squatSequence({ reps: 5 })).final.reps).toBe(0);
  });
});

describe("jumping jacks: tracking", () => {
  it("dropout mid-rep -> searching, then recovers without a phantom rep", () => {
    const frames = jumpingJackSequence({ reps: 6, leadInMs: 1000 });
    // Rep 3 open phase is around 1000 + 2*(900+150+80) + ~450 ms.
    const t0 = 1000 + 2 * 1130 + 300;
    const r = run(withDropout(frames, t0, t0 + 600));
    expect(r.phases).toContain("searching");
    expect(r.phases.lastIndexOf("searching")).toBeGreaterThan(1);
    expect(r.issuesSeen.has("body_not_visible")).toBe(true);
    expect(r.final.reps).toBe(5);
    expect(r.final.rejectedReps).toBe(0);
  });

  it("a frame gap mid-rep abandons it", () => {
    const frames = jumpingJackSequence({ reps: 4 });
    const t0 = 1000 + 1130 + 350;
    expect(run(withGap(frames, t0, t0 + 700)).final.reps).toBe(3);
  });

  it("a teleport glitch freezes counting briefly and never adds reps", () => {
    const frames = jumpingJackSequence({ reps: 5 });
    const r = run(withTeleport(frames, 1500, { joints: [LM.LEFT_WRIST, LM.RIGHT_WRIST], durationMs: 40 }));
    expect(r.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(r.final.reps).toBeLessThanOrEqual(5);
    expect(r.final.reps).toBeGreaterThanOrEqual(4);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(jumpingJackSequence({ reps: 5, jitterDeg: 4, seed: 9 }), { amplitude: 0.003 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    const sa = engine.summary();
    engine.reset();
    expect(engine.getState()).toEqual(createEngine().getState());
    const b = frames.map((f) => engine.update(f));
    expect(b).toEqual(a);
    expect(engine.summary()).toEqual(sa);
    expect(run(frames).updates).toEqual(a);
  });

  it("never throws on malformed frames", () => {
    const good = jumpingJackSequence({ reps: 1 });
    const engine = createEngine();
    const junk: unknown[] = [
      null,
      undefined,
      {},
      { timestampMs: 5, landmarks: null, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 6, landmarks: good[10].landmarks.map(() => ({})), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 7, landmarks: good[10].landmarks.map((l) => ({ ...l, x: Number.NaN })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 8, landmarks: good[10].landmarks.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 9, landmarks: good[10].landmarks, imageWidth: 0, imageHeight: 480 },
      { timestampMs: 10, landmarks: good[10].landmarks.slice(0, 20), imageWidth: 640, imageHeight: 480 },
    ];
    for (const f of junk) expect(() => engine.update(f as PoseFrame)).not.toThrow();
    for (const f of good) expect(() => engine.update({ ...f, timestampMs: f.timestampMs + 100 })).not.toThrow();
    expect(engine.getState().reps).toBeLessThanOrEqual(1);
  });
});

describe("jumping jacks: demo", () => {
  it("the demo loop is one rep counted by the engine", () => {
    const r = run(demo.frames());
    expect(r.final.reps).toBe(1);
    expect(r.final.rejectedReps).toBe(0);
    expect(eventsOfType(r, "rep")).toHaveLength(1);
  });

  it("the judged arm angle is 'good' only around the open position", () => {
    const frames = demo.frames();
    const good = frames.filter((f) => {
      const [a, b, c] = demo.judged!.joints.map((i) => f.landmarks[i]);
      const ang = (Math.atan2(c.y - b.y, (c.x - b.x) * 640 / 480) - Math.atan2(a.y - b.y, (a.x - b.x) * 640 / 480)) * 180 / Math.PI;
      const d = Math.abs(((ang + 540) % 360) - 180);
      return demo.judged!.good(d);
    });
    expect(good.length).toBeGreaterThan(3);
    expect(good.length).toBeLessThan(frames.length / 2);
    expect(repEvents(run(frames))).toHaveLength(1);
  });
});
