/** Sanity checks for the synthetic skeleton generator the engine tests rely on. */
import { describe, expect, it } from "vitest";
import { angleDeg, frameAspect, offsetBelowLine, toImagePoints } from "@/lib/pose/geometry";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import {
  keyframes,
  mulberry32,
  plankSkeleton,
  pushupSequence,
  pushupSkeleton,
  renderLandmarks,
  repTimeline,
  squatSequence,
  standingSkeleton,
  withDropout,
  withGap,
  withJitter,
  withTeleport,
} from "@/lib/pose/testing/synthetic";
import type { Landmark } from "@/lib/pose/types";

function points(lms: Landmark[], w: number, h: number) {
  return toImagePoints(lms, frameAspect(w, h)!);
}

describe("mulberry32", () => {
  it("is reproducible and within [0, 1)", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe("skeleton projection", () => {
  it.each([
    [640, 480],
    [480, 640],
  ])("push-up landmarks are complete, in frame, and carry the requested angles (%ix%i)", (w, h) => {
    for (const elbowDeg of [170, 120, 70]) {
      for (const hipBendDeg of [0, 20, -20]) {
        const lms = renderLandmarks(pushupSkeleton({ elbowDeg, hipBendDeg }), "floor", { width: w, height: h });
        expect(lms).toHaveLength(LANDMARK_COUNT);
        for (const l of lms) {
          expect(l.x).toBeGreaterThanOrEqual(0);
          expect(l.x).toBeLessThanOrEqual(1);
          expect(l.y).toBeGreaterThanOrEqual(0);
          expect(l.y).toBeLessThanOrEqual(1);
        }
        const p = points(lms, w, h);
        expect(angleDeg(p[LM.LEFT_SHOULDER], p[LM.LEFT_ELBOW], p[LM.LEFT_WRIST])).toBeCloseTo(elbowDeg, 6);
        expect(angleDeg(p[LM.LEFT_SHOULDER], p[LM.LEFT_HIP], p[LM.LEFT_ANKLE])).toBeCloseTo(
          180 - Math.abs(hipBendDeg),
          6,
        );
        const offset = offsetBelowLine(p[LM.LEFT_HIP], p[LM.LEFT_SHOULDER], p[LM.LEFT_ANKLE]);
        if (hipBendDeg > 0) expect(offset).toBeGreaterThan(0);
        if (hipBendDeg < 0) expect(offset).toBeLessThan(0);
      }
    }
  });

  it("squat landmarks carry the requested knee angle in both orientations", () => {
    for (const [w, h] of [
      [640, 480],
      [480, 640],
    ]) {
      for (const kneeDeg of [178, 120, 70]) {
        const lms = renderLandmarks(standingSkeleton({ kneeDeg }), "standing", { width: w, height: h });
        const p = points(lms, w, h);
        expect(angleDeg(p[LM.LEFT_HIP], p[LM.LEFT_KNEE], p[LM.LEFT_ANKLE])).toBeCloseTo(kneeDeg, 6);
        for (const l of lms) {
          expect(l.y).toBeGreaterThanOrEqual(0);
          expect(l.y).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("plank styles: forearm and straight-arm are propped up, prone is not", () => {
    for (const style of ["forearm", "straight", "prone"] as const) {
      const lms = renderLandmarks(plankSkeleton({ style }), "floor");
      const p = points(lms, 640, 480);
      const shoulder = p[LM.LEFT_SHOULDER];
      const elbow = p[LM.LEFT_ELBOW];
      const drop = elbow.y - shoulder.y;
      if (style === "prone") expect(drop).toBeLessThan(0.05);
      else expect(drop).toBeGreaterThan(0.1);
    }
  });

  it("applies near / far visibility and overrides", () => {
    const lms = renderLandmarks(pushupSkeleton({ elbowDeg: 170 }), "floor", {
      nearSide: "right",
      nearVisibility: 0.9,
      farVisibility: 0.4,
      visibility: { [LM.RIGHT_KNEE]: 0.2 },
    });
    expect(lms[LM.RIGHT_ELBOW].visibility).toBe(0.9);
    expect(lms[LM.LEFT_ELBOW].visibility).toBe(0.4);
    expect(lms[LM.RIGHT_KNEE].visibility).toBe(0.2);
  });
});

describe("timelines and sequences", () => {
  it("repTimeline lays out reps with cosine easing", () => {
    const tl = repTimeline({ reps: 2, topAngle: 170, bottomAngle: 70, repMs: 1000, holdMs: 500, leadInMs: 1000, leadOutMs: 500 });
    expect(tl.durationMs).toBe(1000 + 2 * (1000 + 500) + 500);
    expect(tl.reps[0]).toEqual({ startMs: 1000, bottomStartMs: 1500, bottomEndMs: 1500, endMs: 2000 });
    expect(tl.angleAt(0)).toBe(170);
    expect(tl.angleAt(1250)).toBeCloseTo(120, 6);
    expect(tl.angleAt(1500)).toBeCloseTo(70, 6);
    expect(tl.angleAt(99999)).toBe(170);
  });

  it("keyframes interpolate and clamp", () => {
    const f = keyframes([
      [0, 10],
      [100, 20],
    ]);
    expect(f(-5)).toBe(10);
    expect(f(50)).toBeCloseTo(15, 10);
    expect(f(500)).toBe(20);
    expect(keyframes([])(10)).toBe(0);
  });

  it("frames are spaced at the requested fps with whole-ms timestamps", () => {
    const frames = squatSequence({ reps: 1, fps: 15, startMs: 500 });
    expect(frames[0].timestampMs).toBe(500);
    expect(frames[1].timestampMs).toBe(567);
    expect(frames.every((f) => Number.isInteger(f.timestampMs))).toBe(true);
    expect(frames.every((f) => f.imageWidth === 640 && f.imageHeight === 480)).toBe(true);
  });

  it("modifiers return new arrays and leave the input untouched", () => {
    const frames = pushupSequence({ reps: 1 });
    const copy = structuredClone(frames);
    const dropped = withDropout(frames, 100, 300);
    const gapped = withGap(frames, 100, 300);
    const glitched = withTeleport(frames, 150);
    const noisy = withJitter(frames, { amplitude: 0.01, seed: 1 });
    expect(frames).toEqual(copy);

    expect(dropped.filter((f) => f.landmarks.length === 0).map((f) => f.timestampMs)).toEqual(
      frames.filter((f) => f.timestampMs >= 100 && f.timestampMs < 300).map((f) => f.timestampMs),
    );
    expect(gapped.length).toBe(frames.length - 6);

    const changed = glitched.filter((f, i) => f !== frames[i]);
    expect(changed).toHaveLength(1);
    const i = glitched.indexOf(changed[0]);
    expect(changed[0].landmarks[LM.LEFT_ELBOW].x).toBeCloseTo(frames[i].landmarks[LM.LEFT_ELBOW].x + 0.3, 10);
    expect(changed[0].landmarks[LM.LEFT_WRIST]).toEqual(frames[i].landmarks[LM.LEFT_WRIST]);

    expect(noisy).not.toEqual(frames);
    expect(withJitter(frames, { amplitude: 0.01, seed: 1 })).toEqual(noisy);
  });
});
