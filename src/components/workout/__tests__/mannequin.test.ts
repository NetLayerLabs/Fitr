import { describe, expect, it } from "vitest";
import { EXERCISE_MODULES } from "@/lib/pose/exercises/registry";
import { EXERCISE_KINDS } from "@/lib/pose/types";
import {
  MANNEQUIN_PALETTE,
  analyzeRig,
  buildFigure,
  capsulePath,
  capsuleRim,
  drawFigure,
  partPath,
  svgPathOf,
  type Capsule,
  type PathSink,
  type Vec,
} from "../mannequin";

/** Records every coordinate written to the sink. */
function recorder() {
  const coords: number[] = [];
  const moves: Vec[] = [];
  const sink: PathSink = {
    moveTo: (x, y) => {
      coords.push(x, y);
      moves.push({ x, y });
    },
    lineTo: (x, y) => coords.push(x, y),
    quadraticCurveTo: (...a) => coords.push(...a),
    bezierCurveTo: (...a) => coords.push(...a),
    closePath: () => {},
  };
  return { sink, coords, moves };
}

/** A 2D context stand-in: every method is a no-op, gradients accept colour stops. */
function fakeContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string, unknown>, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      if (key === "createLinearGradient" || key === "createRadialGradient") return () => gradient;
      return () => {};
    },
    set: (target, key, value) => {
      target[key as string] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const cap = (over: Partial<Capsule> = {}): Capsule => ({
  ax: 0, ay: 0, ar: 10, bx: 100, by: 0, br: 6, bulgeP: 0, bulgeM: 0, bulgeT: 0.4, ...over,
});

describe("analyzeRig", () => {
  it("tells side-view from front-view demos", () => {
    expect(analyzeRig(EXERCISE_MODULES.pushup.demo.frames()).view).toBe("side");
    expect(analyzeRig(EXERCISE_MODULES.squat.demo.frames()).view).toBe("side");
    expect(analyzeRig(EXERCISE_MODULES.jumping_jack.demo.frames()).view).toBe("front");
    expect(analyzeRig(EXERCISE_MODULES.high_knees.demo.frames()).view).toBe("front");
    expect(analyzeRig(EXERCISE_MODULES.pullup.demo.frames()).view).toBe("front");
  });

  it("has a positive body scale, with a fallback for no frames", () => {
    expect(analyzeRig(EXERCISE_MODULES.plank.demo.frames()).scale).toBeGreaterThan(50);
    expect(analyzeRig([])).toEqual({ view: "side", scale: 100 });
  });
});

describe("capsulePath", () => {
  it("starts on circle A and stays finite", () => {
    const { sink, coords, moves } = recorder();
    capsulePath(sink, cap({ bulgeP: 2, bulgeM: 3 }));
    expect(coords.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(moves[0].x, moves[0].y)).toBeCloseTo(10, 6);
  });

  it("falls back to a circle when one end swallows the other", () => {
    const { sink, coords } = recorder();
    capsulePath(sink, cap({ bx: 2, br: 3 }));
    expect(coords.every(Number.isFinite)).toBe(true);
    const xs = coords.filter((_, i) => i % 2 === 0);
    expect(Math.max(...xs)).toBeCloseTo(10, 1);
  });

  it("puts the rim on the side facing the top-left light", () => {
    // Horizontal limb: the lit side is the top one (smaller y).
    const rim = capsuleRim(cap(), 1);
    expect(rim).not.toBeNull();
    expect(rim!.y0).toBeLessThan(0);
    expect(rim!.strength).toBeGreaterThan(0.5);
  });
});

describe("buildFigure", () => {
  it.each(EXERCISE_KINDS)("produces finite geometry for every %s demo frame", (kind) => {
    const frames = EXERCISE_MODULES[kind].demo.frames();
    const rig = analyzeRig(frames);
    for (const f of frames) {
      const fig = buildFigure((i) => ({ x: f.landmarks[i].x * 640, y: f.landmarks[i].y * 480 }), rig.view, rig.scale);
      const { sink, coords } = recorder();
      for (const group of fig.groups) for (const part of group) partPath(sink, part);
      expect(coords.length).toBeGreaterThan(100);
      expect(coords.every(Number.isFinite)).toBe(true);
    }
  });

  it("draws far limbs before the body in side view and both sides in front view", () => {
    const side = EXERCISE_MODULES.pushup.demo.frames()[0];
    const fig = buildFigure((i) => side.landmarks[i], "side", 0.3);
    expect(fig.groups[0][0].depth).toBe("far");
    expect(fig.groups.at(-1)![0].depth).toBe("near");
    const front = EXERCISE_MODULES.jumping_jack.demo.frames()[0];
    const ff = buildFigure((i) => front.landmarks[i], "front", 0.2);
    expect(ff.groups.flat().every((p) => p.depth === "near")).toBe(true);
  });

  it("serialises to SVG without NaN and draws on a canvas without throwing", () => {
    const f = EXERCISE_MODULES.burpee.demo.frames()[40];
    const fig = buildFigure((i) => ({ x: f.landmarks[i].x * 320, y: f.landmarks[i].y * 240 }), "side", 50);
    const d = svgPathOf((k) => fig.groups.flat().forEach((p) => partPath(k, p)));
    expect(d).toMatch(/^M/);
    expect(d).not.toContain("NaN");
    expect(() => drawFigure(fakeContext(), fig, { ...MANNEQUIN_PALETTE, rim: "#c6f432" }, 1)).not.toThrow();
  });
});
