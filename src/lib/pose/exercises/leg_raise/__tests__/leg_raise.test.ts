import { describe, expect, it } from "vitest";
import { createRepEngine } from "@/lib/pose/engine";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { keyframes, repTimeline, withDropout, withJitter, withTeleport } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { rejectionReasons, repEvents, runFrames } from "@/lib/pose/__tests__/helpers";
import { renderSkeletonSequence } from "../../situp/supine";
import { situpSequence } from "../../situp/synthetic";
import { createEngine, demo } from "..";
import { LEG_RAISE_DEFAULTS } from "../config";
import { legRaiseSequence, legRaiseSkeleton, standingLegKickSequence, type LegRaiseSequenceOptions } from "../synthetic";

function expectClean(options: LegRaiseSequenceOptions, reps = 5) {
  const result = runFrames("leg_raise", legRaiseSequence({ reps, ...options }));
  expect(result.final.reps).toBe(reps);
  expect(result.final.rejectedReps).toBe(0);
  for (const rep of repEvents(result)) {
    expect(rep.durationMs).toBeGreaterThanOrEqual(LEG_RAISE_DEFAULTS.minRepMs);
    expect(rep.minAngleDeg).toBeLessThan(LEG_RAISE_DEFAULTS.downAngleDeg);
    expect(rep.maxAngleDeg).toBeGreaterThan(LEG_RAISE_DEFAULTS.upAngleDeg);
  }
  return result;
}

describe("leg-raise engine: clean sets", () => {
  it.each<[string, LegRaiseSequenceOptions]>([
    ["30 fps", {}],
    ["15 fps", { fps: 15 }],
    ["portrait", { width: 480, height: 640 }],
    ["right side near", { nearSide: "right" }],
    ["mirrored", { mirror: true }],
    ["brisk 1.2 s reps", { repMs: 1200, holdMs: 150 }],
    ["slow 4 s reps, slight knee bend", { repMs: 4000, kneeBendDeg: 15 }],
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
    const noisy = withJitter(legRaiseSequence({ reps: 5, jitterDeg: 3, seed: 4 }), { amplitude: 0.003, seed: 4 });
    expect(runFrames("leg_raise", noisy).final.reps).toBe(5);
  });

  it("the demo loop is counted as one rep", () => {
    const result = runFrames("leg_raise", demo.frames());
    expect(result.final.reps).toBe(1);
    expect(result.final.rejectedReps).toBe(0);
  });
});

describe("leg-raise engine: rejections and cheats", () => {
  it("half raises (to 50 deg) are rejected with go_higher", () => {
    const result = runFrames("leg_raise", legRaiseSequence({ reps: 4, bottomAngle: 50 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["go_higher", "go_higher", "go_higher", "go_higher"]);
  });

  it("too-fast reps are rejected with too_fast", () => {
    const result = runFrames("leg_raise", legRaiseSequence({ reps: 4, repMs: 500, holdMs: 200 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result).length).toBeGreaterThan(0);
    expect(new Set(rejectionReasons(result))).toEqual(new Set(["too_fast"]));
  });

  it("not lowering the legs between reps: rejected go_lower", () => {
    const profile = keyframes([
      [0, 6], [1000, 6], [2000, 88], [2300, 88], [2900, 35], [3500, 88], [3800, 88], [4800, 6], [5800, 6],
    ]);
    const result = runFrames("leg_raise", legRaiseSequence({ profile: { durationMs: 5800, angleAt: profile } }));
    expect(rejectionReasons(result)).toEqual(["go_lower"]);
    expect(result.final.reps).toBe(1);
  });

  it("bent-knee tucks are rejected with extend_fully", () => {
    const result = runFrames("leg_raise", legRaiseSequence({ reps: 4, kneeBendDeg: 70, topAngle: 6, bottomAngle: 115 }));
    expect(result.final.reps).toBe(0);
    expect(rejectionReasons(result)).toEqual(["extend_fully", "extend_fully", "extend_fully", "extend_fully"]);
  });

  it("flat-leg sit-ups (torso rising, legs on the floor) count 0", () => {
    const torso = repTimeline({ reps: 4, topAngle: 2, bottomAngle: 90, repMs: 1600 });
    const frames = renderSkeletonSequence(torso.durationMs, "floor", {}, (t) =>
      legRaiseSkeleton({ legDeg: 6, torsoDeg: torso.angleAt(t) }),
    );
    const result = runFrames("leg_raise", frames);
    expect(result.final.reps).toBe(0);
    expect(result.final.rejectedReps).toBe(0);
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
    expect(runFrames("leg_raise", situpSequence({ reps: 4 })).final.reps).toBe(0);
  });

  it("standing knee raises / kicks count 0", () => {
    const result = runFrames("leg_raise", standingLegKickSequence({}));
    expect(result.final.reps).toBe(0);
    expect(result.final.phase).toBe("searching");
    expect(result.issuesSeen.has("body_not_horizontal")).toBe(true);
  });
});

describe("leg-raise engine: tracking", () => {
  it("dropout mid-rep -> searching, recovers without a phantom rep", () => {
    const frames = legRaiseSequence({ reps: 5 });
    // Rep 2 runs 3300..5300 ms; drop out across its top.
    const result = runFrames("leg_raise", withDropout(frames, 4000, 4600));
    expect(result.phases).toContain("searching");
    expect(result.final.reps).toBe(4);
    expect(result.issuesSeen.has("body_not_visible")).toBe(true);
  });

  it("teleport glitch freezes counting without phantom reps", () => {
    const frames = withTeleport(legRaiseSequence({ reps: 5 }), 6000, {
      durationMs: 60,
      joints: [LM.LEFT_ANKLE, LM.LEFT_KNEE],
    });
    const result = runFrames("leg_raise", frames);
    expect(result.final.reps).toBeLessThanOrEqual(5);
    expect(result.final.reps).toBeGreaterThanOrEqual(4);
    expect(result.issuesSeen.has("unstable_tracking")).toBe(true);
  });

  it("is deterministic and reset() replays identically", () => {
    const frames = withJitter(legRaiseSequence({ reps: 3, jitterDeg: 4, seed: 9 }), { amplitude: 0.003, seed: 2 });
    const engine = createEngine();
    const a = frames.map((f) => engine.update(f));
    engine.reset();
    expect(engine.getState()).toEqual(createRepEngine("leg_raise").getState());
    expect(frames.map((f) => engine.update(f))).toEqual(a);
  });

  it("malformed frames never throw", () => {
    const engine = createEngine();
    const good = legRaiseSequence({ reps: 1 })[20];
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
