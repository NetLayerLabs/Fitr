import { describe, expect, it } from "vitest";
import {
  angleDeg,
  angleFromDownDeg,
  distance,
  frameAspect,
  landmarkVisibility,
  meanVisibility,
  minVisibility,
  offsetBelowLine,
  segmentAngleFromHorizontalDeg,
  segmentAngleFromVerticalDeg,
  signedDistanceFromLine,
  toImagePoint,
  toImagePoints,
} from "@/lib/pose/geometry";
import type { Landmark } from "@/lib/pose/types";

const lm = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility });

describe("angleDeg", () => {
  it("measures the interior angle at the middle point", () => {
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 10);
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 10);
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(0, 10);
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 })).toBeCloseTo(45, 10);
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: -1 })).toBeCloseTo(135, 10);
  });

  it("is symmetric and always within [0, 180]", () => {
    const a = { x: 0.3, y: -0.7 };
    const b = { x: 0.1, y: 0.2 };
    const c = { x: -0.5, y: 0.9 };
    const abc = angleDeg(a, b, c);
    expect(abc).toBeCloseTo(angleDeg(c, b, a), 10);
    expect(abc).toBeGreaterThanOrEqual(0);
    expect(abc).toBeLessThanOrEqual(180);
  });

  it("is precise near straight lines (no acos rounding)", () => {
    expect(angleDeg({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1e-9 })).toBeGreaterThan(179.99);
  });

  it("returns NaN for degenerate or non-finite input", () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN();
    expect(angleDeg({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: Number.NaN, y: 0 })).toBeNaN();
    expect(angleDeg({ x: Infinity, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN();
  });
});

describe("aspect correction", () => {
  it("frameAspect is width / height and null for unusable sizes", () => {
    expect(frameAspect(640, 480)).toBeCloseTo(4 / 3, 10);
    expect(frameAspect(480, 640)).toBeCloseTo(3 / 4, 10);
    expect(frameAspect(0, 480)).toBeNull();
    expect(frameAspect(640, -1)).toBeNull();
    expect(frameAspect(Number.NaN, 480)).toBeNull();
  });

  it.each([
    [640, 480],
    [480, 640],
    [1920, 1080],
  ])("recovers true pixel-space angles on a %ix%i frame", (w, h) => {
    // A 45 degree angle drawn in pixels.
    const px = [
      { x: 0.5 * w + 100, y: 0.5 * h },
      { x: 0.5 * w, y: 0.5 * h },
      { x: 0.5 * w + 100, y: 0.5 * h - 100 },
    ];
    const normalized = px.map((p) => lm(p.x / w, p.y / h));
    const aspect = frameAspect(w, h)!;
    const [a, b, c] = normalized.map((l) => toImagePoint(l, aspect));
    expect(angleDeg(a, b, c)).toBeCloseTo(45, 8);
    if (w !== h) {
      // Without correction the same landmarks read a different angle.
      const [ra, rb, rc] = normalized.map((l) => toImagePoint(l, 1));
      expect(Math.abs(angleDeg(ra, rb, rc) - 45)).toBeGreaterThan(5);
    }
  });

  it("toImagePoint scales x by the aspect ratio and keeps y", () => {
    expect(toImagePoint(lm(0.5, 0.25), 2)).toEqual({ x: 1, y: 0.25 });
  });

  it("missing or non-finite landmarks become NaN points", () => {
    const bad = toImagePoint(undefined, 1);
    expect(bad.x).toBeNaN();
    expect(toImagePoint(lm(Number.NaN, 0.2), 1).x).toBeNaN();
    const pts = toImagePoints([lm(0.1, 0.2), null as unknown as Landmark], 2);
    expect(pts[0]).toEqual({ x: 0.2, y: 0.2 });
    expect(pts[1].y).toBeNaN();
  });
});

describe("segment angles", () => {
  it("measures against horizontal and vertical, folded into [0, 90]", () => {
    const o = { x: 0, y: 0 };
    expect(segmentAngleFromHorizontalDeg(o, { x: 1, y: 0 })).toBeCloseTo(0, 10);
    expect(segmentAngleFromHorizontalDeg(o, { x: -1, y: 0 })).toBeCloseTo(0, 10);
    expect(segmentAngleFromHorizontalDeg(o, { x: 1, y: 1 })).toBeCloseTo(45, 10);
    expect(segmentAngleFromHorizontalDeg(o, { x: -1, y: -1 })).toBeCloseTo(45, 10);
    expect(segmentAngleFromHorizontalDeg(o, { x: 0, y: -2 })).toBeCloseTo(90, 10);
    expect(segmentAngleFromVerticalDeg(o, { x: 0, y: 2 })).toBeCloseTo(0, 10);
    expect(segmentAngleFromVerticalDeg(o, { x: 3, y: 0 })).toBeCloseTo(90, 10);
    expect(segmentAngleFromHorizontalDeg(o, o)).toBeNaN();
  });

  it("angleFromDownDeg is 0 straight down, 90 level, 180 straight up (y down)", () => {
    const o = { x: 0, y: 0 };
    expect(angleFromDownDeg(o, { x: 0, y: 1 })).toBeCloseTo(0, 10);
    expect(angleFromDownDeg(o, { x: 1, y: 0 })).toBeCloseTo(90, 10);
    expect(angleFromDownDeg(o, { x: -1, y: 0 })).toBeCloseTo(90, 10);
    expect(angleFromDownDeg(o, { x: 0, y: -1 })).toBeCloseTo(180, 10);
    expect(angleFromDownDeg(o, { x: 1, y: 1 })).toBeCloseTo(45, 10);
    expect(angleFromDownDeg(o, o)).toBeNaN();
  });

  it("distance is Euclidean", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("distance from a line", () => {
  it("signedDistanceFromLine flips sign across the line", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    expect(signedDistanceFromLine({ x: 0.5, y: 0.2 }, a, b)).toBeCloseTo(0.2, 10);
    expect(signedDistanceFromLine({ x: 0.5, y: -0.2 }, a, b)).toBeCloseTo(-0.2, 10);
    expect(signedDistanceFromLine({ x: 0.5, y: 0.2 }, a, a)).toBeNaN();
  });

  it("offsetBelowLine is positive below the line (y down) regardless of line direction", () => {
    const shoulder = { x: 1, y: 0.4 };
    const ankle = { x: 0, y: 0.6 };
    const sagHip = { x: 0.5, y: 0.65 };
    const pikeHip = { x: 0.5, y: 0.3 };
    for (const [a, b] of [
      [shoulder, ankle],
      [ankle, shoulder],
    ]) {
      expect(offsetBelowLine(sagHip, a, b)).toBeGreaterThan(0);
      expect(offsetBelowLine(pikeHip, a, b)).toBeLessThan(0);
    }
    // Mirrored scene (facing the other way) gives the same classification.
    const m = (p: { x: number; y: number }) => ({ x: 1 - p.x, y: p.y });
    expect(offsetBelowLine(m(sagHip), m(shoulder), m(ankle))).toBeGreaterThan(0);
    expect(offsetBelowLine(m(pikeHip), m(shoulder), m(ankle))).toBeLessThan(0);
    // Magnitude is the perpendicular distance.
    expect(offsetBelowLine({ x: 0.5, y: 0.3 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0.3, 10);
    expect(offsetBelowLine(sagHip, shoulder, shoulder)).toBeNaN();
  });
});

describe("visibility helpers", () => {
  it("clamps and zeroes invalid values", () => {
    expect(landmarkVisibility(lm(0, 0, 0.7))).toBe(0.7);
    expect(landmarkVisibility(lm(0, 0, 1.4))).toBe(1);
    expect(landmarkVisibility(lm(0, 0, -1))).toBe(0);
    expect(landmarkVisibility(lm(0, 0, Number.NaN))).toBe(0);
    expect(landmarkVisibility(lm(Number.NaN, 0, 0.9))).toBe(0);
    expect(landmarkVisibility(undefined)).toBe(0);
  });

  it("mean / min over indices, missing entries count as 0", () => {
    const lms = [lm(0, 0, 0.2), lm(0, 0, 0.8), lm(0, 0, 1)];
    expect(meanVisibility(lms, [0, 1])).toBeCloseTo(0.5, 10);
    expect(meanVisibility(lms, [1, 2, 7])).toBeCloseTo(0.6, 10);
    expect(minVisibility(lms, [1, 2])).toBe(0.8);
    expect(minVisibility(lms, [1, 9])).toBe(0);
    expect(meanVisibility(lms, [])).toBe(0);
    expect(minVisibility(lms, [])).toBe(0);
  });
});
