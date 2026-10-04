import { describe, expect, it } from "vitest";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { LM } from "@/lib/pose/landmarks";
import { squatSequence, withDropout, withGap, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "../index";
import { frontSquatSequence, highKneesSequence } from "../synthetic";

const run = (frames: readonly PoseFrame[]) => runFrames("high_knees", frames);

describe("high knees: clean reps", () => {
  for (const fps of [30, 15]) {
    it(`counts 10 alternating knee lifts exactly at ${fps} fps`, () => {
      const r = run(highKneesSequence({ lifts: 10, fps }));
      expect(r.final.reps).toBe(10);
      expect(r.final.rejectedReps).toBe(0);
      expect(r.final.side).toBe("both");
      for (const d of r.summary.repDurationsMs) {
        expect(d).toBeGreaterThan(400);
        expect(d).toBeLessThan(900);
      }
    });

    it(`stays exact with +-4 deg jitter and positional noise at ${fps} fps`, () => {
      for (const seed of [2, 13, 31]) {
        const frames = withJitter(highKneesSequence({ lifts: 12, fps, jitterDeg: 4, seed }), {
          amplitude: 0.003,
          seed: seed + 1,
        });
        const r = run(frames);
        expect(r.final.reps).toBe(12);
        expect(r.final.rejectedReps).toBe(0);
      }
    });
  }

  it("counts a fast pace (each knee 380 ms, no pause)", () => {
    const r = run(highKneesSequence({ lifts: 16, liftMs: 380, gapMs: 0, fps: 30 }));
    expect(r.final.reps).toBe(16);
  });

  it("counts knees lifted to ~70 deg (just under hip height)", () => {
    expect(run(highKneesSequence({ lifts: 6, topDeg: 72 })).final.reps).toBe(6);
  });

  it("tracks a change of distance to the camera (thigh reference adapts)", () => {
    const near = highKneesSequence({ lifts: 4, height: 480, width: 640 });
    const far = highKneesSequence({ lifts: 4, startMs: near[near.length - 1].timestampMs + 33 }).map((f) => ({
      ...f,
      // Shrink the body to 80% around the frame centre (stepped back).
      landmarks: f.landmarks.map((l) => ({ ...l, x: 0.5 + (l.x - 0.5) * 0.8, y: 0.5 + (l.y - 0.5) * 0.8 })),
    }));
    // The step back is a relocation: allow the jump detector to accept it.
    const r = run([...near, ...far]);
    expect(r.final.reps).toBe(8);
  });
});

describe("high knees: partial range and speed", () => {
  it("rejects marching with low knees (go_higher)", () => {
    const r = run(highKneesSequence({ lifts: 6, topDeg: 52 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toEqual(Array(6).fill("go_higher"));
  });

  it("counts only the full lifts in a mixed set", () => {
    const r = run(highKneesSequence({ lifts: 6, topDeg: [88, 85, 50, 50, 88, 85] }));
    expect(r.final.reps).toBe(4);
    expect(rejectionReasons(r)).toEqual(["go_higher", "go_higher"]);
  });

  it("rejects knee flicks faster than a human lift (too_fast)", () => {
    const r = run(highKneesSequence({ lifts: 6, liftMs: 150, gapMs: 150, topDeg: 115, fps: 30 }));
    expect(r.final.reps).toBe(0);
    expect(rejectionReasons(r)).toContain("too_fast");
  });
});

describe("high knees: cheats count 0", () => {
  it("front-view squats (both knees up together)", () => {
    const r = run(frontSquatSequence({ reps: 5 }));
    expect(r.final.reps).toBe(0);
    expect(r.final.rejectedReps).toBe(0);
  });

  it("pumping one knee only counts once", () => {
    const r = run(highKneesSequence({ lifts: 8, side: "left" }));
    expect(r.final.reps).toBe(1);
  });

  it("swinging the knee out sideways", () => {
    expect(run(highKneesSequence({ lifts: 6, lateral: true })).final.reps).toBe(0);
  });

  it("side-on to the camera (face_camera)", () => {
    const r = run(highKneesSequence({ lifts: 6, turnDeg: 80 }));
    expect(r.final.reps).toBe(0);
    expect(r.issuesSeen.has("face_camera")).toBe(true);
  });

  it("lying on the floor kicking (chest_up)", () => {
    const r = run(highKneesSequence({ lifts: 6, rollDeg: 90 }));
    expect(r.final.reps).toBe(0);
    expect(r.issuesSeen.has("chest_up")).toBe(true);
  });

  it("side-view squats", () => {
    expect(run(squatSequence({ reps: 5 })).final.reps).toBe(0);
  });
});

describe("high knees: tracking", () => {
  it("dropout mid-lift -> searching, then recovers without a phantom rep", () => {
    const frames = highKneesSequence({ lifts: 8 });
    // Lift 4 (index 3) peaks at 1000 + 3*620 + ~280 ms.
    const t0 = 1000 + 3 * 620 + 200;
    const r = run(withDropout(frames, t0, t0 + 500));
    expect(r.phases.lastIndexOf("searching")).toBeGreaterThan(1);
    expect(r.issuesSeen.has("body_not_visible")).toBe(true);
    expect(r.final.reps).toBeLessThanOrEqual(7);
    expect(r.final.reps).toBeGreaterThanOrEqual(6);
    expect(r.final.rejectedReps).toBe(0);
  });

  it("a frame gap mid-lift abandons it", () => {
    const frames = highKneesSequence({ lifts: 6 });
    const t0 = 1000 + 2 * 620 + 200;
    const r = run(withGap(frames, t0, t0 + 600));
    expect(r.final.reps).toBeLessThan(6);
    expect(r.final.reps).toBeGreaterThanOrEqual(4);
  });

  it("a knee teleport glitch is flagged and adds no reps", () => {
    const frames = highKneesSequence({ lifts: 6 });
    const r = run(withTeleport(frames, 1100, { joints: [LM.LEFT_KNEE], dx: 0, dy: -0.3, durationMs: 40 }));
    expect(r.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(r.final.reps).toBeLessThanOrEqual(6);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(highKneesSequence({ lifts: 8, jitterDeg: 4, seed: 4 }), { amplitude: 0.003 });
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
    const good = highKneesSequence({ lifts: 2 });
    const engine = createEngine();
    const lms = good[20].landmarks;
    const junk: unknown[] = [
      null,
      42,
      { timestampMs: Number.NaN, landmarks: lms, imageWidth: 640, imageHeight: 480 },
      { timestampMs: 5, landmarks: "x", imageWidth: 640, imageHeight: 480 },
      { timestampMs: 6, landmarks: lms.map(() => null), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 7, landmarks: lms.map((l) => ({ ...l, visibility: Number.NaN })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 8, landmarks: lms.map(() => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 })), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 9, landmarks: lms, imageWidth: 640, imageHeight: Number.NaN },
    ];
    for (const f of junk) expect(() => engine.update(f as PoseFrame)).not.toThrow();
    for (const f of good) expect(() => engine.update({ ...f, timestampMs: f.timestampMs + 100 })).not.toThrow();
  });
});

describe("high knees: demo", () => {
  it("the demo loop (left + right) is counted as 2 reps", () => {
    const r = run(demo.frames());
    expect(repEvents(r)).toHaveLength(2);
    expect(r.final.rejectedReps).toBe(0);
  });
});
