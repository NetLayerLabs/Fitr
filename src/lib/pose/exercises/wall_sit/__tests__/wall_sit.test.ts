import { describe, expect, it } from "vitest";
import { eventsOfType, runFrames } from "@/lib/pose/__tests__/helpers";
import { keyframes, squatSequence, withDropout, withGap, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import { LM } from "@/lib/pose/landmarks";
import type { PoseFrame } from "@/lib/pose/types";
import { createEngine, demo } from "..";
import { lyingLegs9090Skeleton, wallSitSequence, type WallSitSequenceOptions } from "../synthetic";

const hold = (options: Partial<WallSitSequenceOptions> = {}) => wallSitSequence({ durationMs: 10_000, ...options });

describe("wall sit engine: clean holds", () => {
  it.each<[string, Partial<WallSitSequenceOptions>]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["right side towards the camera", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["portrait 480x640", { width: 480, height: 640 }],
    ["knees at 100 deg", { kneeDeg: 100 }],
    ["knees at 80 deg", { kneeDeg: 80 }],
  ])("credits a 10 s hold within 0.5 s (%s)", (_label, options) => {
    const result = runFrames("wall_sit", hold(options));
    expect(result.final.holdMs).toBeGreaterThan(9500);
    expect(result.final.holdMs).toBeLessThanOrEqual(10_000);
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("holding");
    expect(result.final.formIssues).toEqual([]);
    expect(eventsOfType(result, "hold_start")).toHaveLength(1);
    expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
  });

  it("stays within 0.5 s with seeded +/-4 degree jitter at 30 and 15 fps", () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (const fps of [30, 15]) {
        const result = runFrames("wall_sit", hold({ jitterDeg: 4, seed, fps }));
        expect(result.final.holdMs).toBeGreaterThan(9500);
        expect(eventsOfType(result, "hold_pause")).toHaveLength(0);
      }
    }
    const noisy = withJitter(hold({ jitterDeg: 3, seed: 4 }), { amplitude: 0.003, seed: 4 });
    expect(runFrames("wall_sit", noisy).final.holdMs).toBeGreaterThan(9500);
  });

  it("credits the form-guide demo (3 s hold)", () => {
    const result = runFrames("wall_sit", demo.frames());
    expect(result.final.holdMs).toBeGreaterThan(2500);
    expect(result.final.phase).toBe("holding");
  });
});

describe("wall sit engine: bad form and cheats credit nothing", () => {
  it.each<[string, PoseFrame[], string]>([
    ["a half sit (knees at 135 deg)", hold({ kneeDeg: 135 }), "go_lower"],
    ["standing", hold({ kneeDeg: 175 }), "go_lower"],
    ["leaning forward off the wall (free squat hold)", hold({ torsoLeanDeg: 40 }), "keep_back_on_wall"],
    ["a deep squat (shared squat generator, thighs below level)", squatSequence({ profile: { durationMs: 10_000, angleAt: () => 70 } }), "keep_back_on_wall"],
    ["too deep, hips below the knees", hold({ kneeDeg: 55 }), "go_higher"],
    ["lying on the back, legs at 90/90", hold({ skeletonAt: () => lyingLegs9090Skeleton(), layout: "floor" }), "keep_back_on_wall"],
  ])("%s", (_label, frames, issue) => {
    const result = runFrames("wall_sit", frames);
    expect(result.final.holdMs).toBe(0);
    expect(result.final.phase).toBe("searching");
    expect(result.issuesSeen.has(issue as never)).toBe(true);
  });

  it("pauses when the hips rise out of the sit, and resumes", () => {
    const knee = keyframes([
      [0, 90],
      [4000, 90],
      [4300, 140],
      [6000, 140],
      [6300, 90],
      [10_000, 90],
    ]);
    const result = runFrames("wall_sit", hold({ kneeDeg: knee }));
    const pauses = eventsOfType(result, "hold_pause");
    expect(pauses).toHaveLength(1);
    expect(pauses[0].reason).toBe("go_lower");
    expect(eventsOfType(result, "hold_start")).toHaveLength(2);
    expect(result.phases).toEqual(["searching", "holding", "paused", "holding"]);
    // ~4.1 s + ~3.8 s of good form.
    expect(result.final.holdMs).toBeGreaterThan(7000);
    expect(result.final.holdMs).toBeLessThan(8400);
  });

  it("forgives a single short wobble but not rhythmic bobbing out of the sit", () => {
    const wobble = keyframes([
      [0, 90],
      [5000, 90],
      [5120, 130],
      [5240, 90],
      [10_000, 90],
    ]);
    const one = runFrames("wall_sit", hold({ kneeDeg: wobble }));
    expect(eventsOfType(one, "hold_pause")).toHaveLength(0);
    expect(one.final.holdMs).toBeGreaterThan(9500);

    // Out of form for ~300 ms of every 700 ms.
    const bob = (t: number) => (t < 1000 ? 90 : t % 700 < 300 ? 135 : 90);
    const bobbing = runFrames("wall_sit", hold({ kneeDeg: bob }));
    expect(bobbing.final.holdMs).toBeLessThan(7000);
  });

  it("pauses on tracking loss and resumes without phantom time", () => {
    const frames = withDropout(hold(), 4000, 6000);
    const result = runFrames("wall_sit", frames);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
    expect(eventsOfType(result, "hold_pause")[0]?.reason).toBe("body_not_visible");
    expect(result.final.phase).toBe("holding");
    expect(result.final.holdMs).toBeGreaterThan(7400);
    expect(result.final.holdMs).toBeLessThan(8100);
  });

  it("caps credit across a camera stall", () => {
    const result = runFrames("wall_sit", withGap(hold(), 3000, 7000));
    expect(result.final.holdMs).toBeLessThan(6300);
  });

  it("flags a glitch without crediting through it", () => {
    const frames = withTeleport(hold(), 5000, { joints: [LM.LEFT_HIP, LM.LEFT_KNEE], durationMs: 0 });
    const result = runFrames("wall_sit", frames);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
    expect(result.final.holdMs).toBeLessThanOrEqual(10_000);
    expect(result.final.holdMs).toBeGreaterThan(9000);
  });
});

describe("wall sit engine: determinism and robustness", () => {
  it("gives deep-equal output for the same frames, and reset() replays identically", () => {
    const frames = withJitter(hold({ jitterDeg: 4, seed: 3 }), { amplitude: 0.003, seed: 3 });
    expect(runFrames("wall_sit", frames).updates).toEqual(runFrames("wall_sit", frames).updates);
    const engine = createEngine();
    const first = frames.map((f) => engine.update(f));
    const s1 = engine.summary();
    engine.reset();
    expect(frames.map((f) => engine.update(f))).toEqual(first);
    expect(engine.summary()).toEqual(s1);
  });

  it("never throws on malformed frames", () => {
    const good = hold({ durationMs: 3000 });
    const junk = [
      null,
      {},
      { timestampMs: 1, landmarks: "x", imageWidth: 640, imageHeight: 480 },
      { timestampMs: 2, landmarks: new Array(40).fill(0), imageWidth: 640, imageHeight: 480 },
      { timestampMs: 3, landmarks: good[0].landmarks, imageWidth: -1, imageHeight: 480 },
      { timestampMs: 4, landmarks: good[0].landmarks.map((l) => ({ ...l, visibility: Number.NaN })), imageWidth: 640, imageHeight: 480 },
    ] as unknown as PoseFrame[];
    const engine = createEngine();
    for (const f of junk) expect(() => engine.update(f)).not.toThrow();
    for (const f of good) engine.update({ ...f, timestampMs: f.timestampMs + 100 });
    expect(engine.getState().holdMs).toBeGreaterThan(2500);
    expect(engine.getState().reps).toBe(0);
  });
});
