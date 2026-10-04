import { describe, expect, it } from "vitest";
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import type { EngineState, Landmark, PoseFrame } from "@/lib/pose/types";
import {
  OVERLAY_COLORS,
  computeMapping,
  drawSkeleton,
  isPointInView,
  mapPoint,
  primaryJointIndex,
} from "../overlay";

describe("computeMapping", () => {
  it("cover: landscape 640x480 source into a 390x844 portrait view crops the sides", () => {
    const m = computeMapping(640, 480, 390, 844, "cover");
    expect(m).not.toBeNull();
    if (!m) return;
    // s = max(390/640, 844/480) = 844/480
    expect(m.scale).toBeCloseTo(844 / 480, 10);
    expect(m.contentHeight).toBeCloseTo(844, 10);
    expect(m.contentWidth).toBeCloseTo(640 * (844 / 480), 10);
    expect(m.offsetY).toBeCloseTo(0, 10);
    expect(m.offsetX).toBeCloseTo((390 - 640 * (844 / 480)) / 2, 10);
    expect(m.offsetX).toBeLessThan(0);
    // The image centre maps to the view centre.
    const c = mapPoint(m, 0.5, 0.5);
    expect(c.x).toBeCloseTo(195, 10);
    expect(c.y).toBeCloseTo(422, 10);
    // The far left edge of the source is cropped out of view.
    expect(isPointInView(m, 0, 0.5)).toBe(false);
    expect(isPointInView(m, 0.5, 0.5)).toBe(true);
  });

  it("contain: landscape source into a portrait view letterboxes top and bottom", () => {
    const m = computeMapping(640, 480, 390, 844, "contain");
    if (!m) throw new Error("expected mapping");
    // s = min(390/640, 844/480) = 390/640
    expect(m.scale).toBeCloseTo(390 / 640, 10);
    expect(m.contentWidth).toBeCloseTo(390, 10);
    expect(m.contentHeight).toBeCloseTo(292.5, 10);
    expect(m.offsetX).toBeCloseTo(0, 10);
    expect(m.offsetY).toBeCloseTo((844 - 292.5) / 2, 10);
    expect(mapPoint(m, 0, 0)).toEqual({ x: 0, y: m.offsetY });
    const br = mapPoint(m, 1, 1);
    expect(br.x).toBeCloseTo(390, 10);
    expect(br.y).toBeCloseTo(m.offsetY + 292.5, 10);
    // Everything in the source is visible.
    expect(isPointInView(m, 0, 0)).toBe(true);
    expect(isPointInView(m, 1, 1)).toBe(true);
  });

  it("cover: portrait source into a wider view crops top and bottom", () => {
    const m = computeMapping(480, 640, 400, 400, "cover");
    if (!m) throw new Error("expected mapping");
    expect(m.scale).toBeCloseTo(400 / 480, 10);
    expect(m.offsetX).toBeCloseTo(0, 10);
    expect(m.offsetY).toBeCloseTo((400 - 640 * (400 / 480)) / 2, 10);
    expect(isPointInView(m, 0.5, 0.02)).toBe(false);
  });

  it("is the identity scale when aspect ratios match (cover == contain)", () => {
    const cover = computeMapping(1280, 720, 640, 360, "cover");
    const contain = computeMapping(1280, 720, 640, 360, "contain");
    expect(cover).toEqual(contain);
    expect(cover?.scale).toBe(0.5);
    expect(cover?.offsetX).toBe(0);
    expect(cover?.offsetY).toBe(0);
    expect(mapPoint(cover!, 0.25, 0.75)).toEqual({ x: 160, y: 270 });
  });

  it("returns null for missing or invalid sizes", () => {
    expect(computeMapping(0, 480, 390, 844, "cover")).toBeNull();
    expect(computeMapping(640, 480, 0, 844, "contain")).toBeNull();
    expect(computeMapping(Number.NaN, 480, 390, 844, "cover")).toBeNull();
    expect(computeMapping(640, -1, 390, 844, "cover")).toBeNull();
  });
});

describe("primaryJointIndex", () => {
  const lms = (overrides: Record<number, number> = {}): Landmark[] =>
    Array.from({ length: LANDMARK_COUNT }, (_, i) => ({ x: 0.5, y: 0.5, z: 0, visibility: overrides[i] ?? 0.9 }));

  it("uses the engine side and the exercise's primary joint", () => {
    expect(primaryJointIndex("pushup", "left", lms())).toBe(LM.LEFT_ELBOW);
    expect(primaryJointIndex("squat", "right", lms())).toBe(LM.RIGHT_KNEE);
    expect(primaryJointIndex("plank", "left", lms())).toBe(LM.LEFT_HIP);
  });

  it("picks the more visible side for 'both' and nothing while searching", () => {
    expect(primaryJointIndex("pushup", "both", lms({ [LM.LEFT_ELBOW]: 0.3, [LM.RIGHT_ELBOW]: 0.8 }))).toBe(
      LM.RIGHT_ELBOW,
    );
    expect(primaryJointIndex("pushup", null, lms())).toBeNull();
    expect(primaryJointIndex("pushup", "left", [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// drawSkeleton against a recording fake context
// ---------------------------------------------------------------------------

interface Call {
  name: string;
  args: unknown[];
  strokeStyle: unknown;
  fillStyle: unknown;
  globalAlpha: unknown;
}

function fakeContext(width = 780, height = 1688) {
  const calls: Call[] = [];
  const props: Record<string, unknown> = { strokeStyle: "#000", fillStyle: "#000", globalAlpha: 1 };
  const target = { canvas: { width, height } } as Record<string, unknown>;
  const ctx = new Proxy(target, {
    get(t, key: string) {
      if (key in t) return t[key];
      if (key in props) return props[key];
      if (key === "measureText") return (text: string) => ({ width: text.length * 10 });
      return (...args: unknown[]) => {
        calls.push({
          name: key,
          args,
          strokeStyle: props.strokeStyle,
          fillStyle: props.fillStyle,
          globalAlpha: props.globalAlpha,
        });
      };
    },
    set(_t, key: string, value) {
      props[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

function frameWith(visibility: number | ((i: number) => number)): PoseFrame {
  return {
    timestampMs: 1000,
    imageWidth: 640,
    imageHeight: 480,
    landmarks: Array.from({ length: LANDMARK_COUNT }, (_, i) => ({
      x: 0.3 + (i % 5) * 0.1,
      y: 0.2 + (i % 7) * 0.08,
      z: 0,
      visibility: typeof visibility === "function" ? visibility(i) : visibility,
    })),
  };
}

function engineState(overrides: Partial<EngineState> = {}): EngineState {
  return {
    exercise: "pushup",
    phase: "up",
    reps: 3,
    rejectedReps: 0,
    holdMs: 0,
    primaryAngleDeg: 87.4,
    bodyLineDeg: 176,
    formIssues: [],
    trackingConfidence: 0.9,
    side: "left",
    ...overrides,
  };
}

const mapping = computeMapping(640, 480, 390, 844, "cover");

describe("drawSkeleton", () => {
  it("only clears when there is no pose", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, { ...frameWith(0.9), landmarks: [] }, engineState(), mapping, { dpr: 2, mirrored: false });
    expect(calls.map((c) => c.name)).toEqual(["setTransform", "clearRect"]);
    expect(calls[1].args).toEqual([0, 0, 780, 1688]);
  });

  it("draws in accent green, scaled by dpr, with an angle label", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, frameWith(0.9), engineState(), mapping, { dpr: 2, mirrored: false });
    expect(calls.find((c) => c.name === "setTransform" && c.args[0] === 2)).toBeDefined();
    const strokes = calls.filter((c) => c.name === "stroke");
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes.every((c) => c.strokeStyle === OVERLAY_COLORS.accent)).toBe(true);
    const label = calls.find((c) => c.name === "fillText");
    expect(label?.args[0]).toBe("87°");
  });

  it("turns amber when the engine reports form issues", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, frameWith(0.9), engineState({ formIssues: ["hips_sagging"] }), mapping, {
      dpr: 1,
      mirrored: false,
    });
    const strokes = calls.filter((c) => c.name === "stroke");
    expect(strokes.every((c) => c.strokeStyle === OVERLAY_COLORS.warning)).toBe(true);
  });

  it("hides invisible landmarks entirely", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, frameWith(0.05), engineState(), mapping, { dpr: 1, mirrored: false });
    expect(calls.some((c) => c.name === "lineTo" || c.name === "arc" || c.name === "fillText")).toBe(false);
  });

  it("dims low-visibility landmarks instead of drawing them at full strength", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, frameWith(0.35), engineState({ primaryAngleDeg: null }), mapping, {
      dpr: 1,
      mirrored: false,
    });
    const drawn = calls.filter((c) => c.name === "stroke" || c.name === "fill");
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.every((c) => c.globalAlpha !== 1)).toBe(true);
  });

  it("counter-flips the label when the display is mirrored", () => {
    const { ctx, calls } = fakeContext();
    drawSkeleton(ctx, frameWith(0.9), engineState(), mapping, { dpr: 1, mirrored: true });
    expect(calls.some((c) => c.name === "scale" && c.args[0] === -1 && c.args[1] === 1)).toBe(true);
  });
});
