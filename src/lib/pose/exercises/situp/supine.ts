/**
 * Shared synthetic-skeleton helpers for the "floor-core" exercises (sit-up, leg raise, glute
 * bridge, mountain climber). Test / demo code only: engines never import this.
 *
 * World space follows testing/synthetic.ts: y up, units of standing height, floor at y = 0.
 * Lying bodies have the head towards +x and the feet towards -x, so they fit the "floor"
 * camera layout (visible world x is about -0.96 .. 0.26, y about -0.26 .. 0.66).
 */
import { mulberry32, renderLandmarks, type CameraLayout, type RenderOptions, type SideSkeleton, type Vec } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";

export const DEG = Math.PI / 180;

export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
/** Unit vector at `deg` degrees counter-clockwise from +x (world, y up). */
export const dirDeg = (deg: number): Vec => ({ x: Math.cos(deg * DEG), y: Math.sin(deg * DEG) });
/** Rotate counter-clockwise by `deg` degrees. */
export const rotate = (v: Vec, deg: number): Vec => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
export const unit = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};

/**
 * Knee position for a leg with the hip and ankle fixed (thigh length a, shin length b). Of the
 * two solutions, `up` picks the one with the larger world y (knees pointing at the ceiling).
 * When the hip and ankle are too far apart the leg is straight.
 */
export function kneeBetween(hip: Vec, ankle: Vec, a: number, b: number, up = true): Vec {
  const d = Math.hypot(ankle.x - hip.x, ankle.y - hip.y);
  const u = unit(sub(ankle, hip));
  if (d >= a + b - 1e-9 || d === 0) return add(hip, scale(u, a));
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(a * a - along * along, 0));
  const base = add(hip, scale(u, along));
  const n1 = { x: -u.y, y: u.x };
  const k1 = add(base, scale(n1, h));
  const k2 = add(base, scale(n1, -h));
  return (k1.y >= k2.y) === up ? k1 : k2;
}

/** Uniform noise in [-amplitude, +amplitude] (0 draws nothing, so seeded runs stay stable). */
export function noise(rng: () => number, amplitude: number): number {
  return amplitude === 0 ? 0 : (rng() * 2 - 1) * amplitude;
}

export interface FloorSequenceOptions extends RenderOptions {
  fps?: number;
  /** Timestamp of the first frame. */
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise in degrees added to every angle that drives the pose. */
  jitterDeg?: number;
}

/** Frame timestamps (relative) at `fps`, rounded to whole ms like the live runtime. */
export function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

/** Render a skeleton-over-time into PoseFrames (side view). */
export function renderSkeletonSequence(
  durationMs: number,
  layout: CameraLayout,
  options: FloorSequenceOptions,
  skeletonAt: (tMs: number, rng: () => number) => SideSkeleton,
): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480 } = options;
  const rng = mulberry32(seed);
  return frameOffsets(durationMs, fps).map((offset) => ({
    timestampMs: startMs + offset,
    landmarks: renderLandmarks(skeletonAt(offset, rng), layout, { ...options, width, height }),
    imageWidth: width,
    imageHeight: height,
  }));
}

/** Arms lying on the floor alongside the torso, hands towards the hips. */
export function armsAlongBody(shoulder: Vec, hip: Vec) {
  const down = unit(sub(hip, shoulder));
  const elbow = add(shoulder, scale(down, 0.186));
  const wrist = add(elbow, scale(down, 0.146));
  return { elbow, wrist, handDir: down };
}

/** Feet flat on the floor, toes pointing away from the body (-x). */
export function flatFoot(ankle: Vec) {
  return { heel: add(ankle, { x: 0.03, y: -0.03 }), footIndex: add(ankle, { x: -0.13, y: -0.04 }) };
}

/** Foot continuing the shin direction (toes pointed), for legs off the floor. */
export function pointedFoot(knee: Vec, ankle: Vec) {
  const d = unit(sub(ankle, knee));
  const n = { x: -d.y, y: d.x };
  return { heel: add(ankle, add(scale(d, -0.02), scale(n, -0.04))), footIndex: add(ankle, scale(d, 0.13)) };
}
