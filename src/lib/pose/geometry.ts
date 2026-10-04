/**
 * Pure 2D vector helpers for the rep engine.
 *
 * MediaPipe landmarks are normalized to [0, 1] on *each* axis, so on a 640x480 frame one
 * unit of x is 640 px while one unit of y is 480 px. Angles computed on raw normalized
 * coordinates are therefore distorted (badly so in portrait). Every helper here works on
 * "aspect-corrected" points: x is multiplied by imageWidth / imageHeight so both axes are
 * measured in *frame heights*. Image space is y-down.
 *
 * All functions are total: bad input (NaN, missing points, zero-length segments) yields NaN
 * or 0 instead of throwing.
 */
import type { Landmark } from "@/lib/pose/types";

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

const RAD_TO_DEG = 180 / Math.PI;

const NAN_POINT: Point2 = Object.freeze({ x: Number.NaN, y: Number.NaN });

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isFinitePoint(p: Point2 | null | undefined): p is Point2 {
  return !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);
}

/** imageWidth / imageHeight, or null when either dimension is missing, zero or not finite. */
export function frameAspect(imageWidth: number, imageHeight: number): number | null {
  if (!isFiniteNumber(imageWidth) || !isFiniteNumber(imageHeight)) return null;
  if (imageWidth <= 0 || imageHeight <= 0) return null;
  return imageWidth / imageHeight;
}

/**
 * Aspect-corrected point for a normalized landmark (units: frame heights).
 * Returns a NaN point for a missing or non-finite landmark.
 */
export function toImagePoint(lm: Landmark | null | undefined, aspect: number): Point2 {
  if (!lm || typeof lm !== "object" || !isFiniteNumber(lm.x) || !isFiniteNumber(lm.y)) {
    return NAN_POINT;
  }
  return { x: lm.x * aspect, y: lm.y };
}

/** Aspect-corrected points for every landmark, index-aligned with the input. */
export function toImagePoints(landmarks: readonly Landmark[], aspect: number): Point2[] {
  const out: Point2[] = new Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) out[i] = toImagePoint(landmarks[i], aspect);
  return out;
}

export function distance(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Interior angle at `b` formed by a-b-c, in degrees within [0, 180].
 * NaN when any point is non-finite or either arm has zero length.
 */
export function angleDeg(a: Point2, b: Point2, c: Point2): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const n1 = Math.hypot(v1x, v1y);
  const n2 = Math.hypot(v2x, v2y);
  if (!(n1 > 0) || !(n2 > 0) || !Number.isFinite(n1) || !Number.isFinite(n2)) return Number.NaN;
  // atan2 of cross/dot is numerically stable near 0 and 180 degrees (acos is not).
  const cross = v1x * v2y - v1y * v2x;
  const dot = v1x * v2x + v1y * v2y;
  return Math.abs(Math.atan2(cross, dot)) * RAD_TO_DEG;
}

/** Angle of segment a-b against the horizontal axis, folded into [0, 90] degrees. */
export function segmentAngleFromHorizontalDeg(a: Point2, b: Point2): number {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return Number.NaN;
  return Math.atan2(dy, dx) * RAD_TO_DEG;
}

/** Angle of segment a-b against the vertical axis, folded into [0, 90] degrees. */
export function segmentAngleFromVerticalDeg(a: Point2, b: Point2): number {
  const h = segmentAngleFromHorizontalDeg(a, b);
  return Number.isNaN(h) ? Number.NaN : 90 - h;
}

/**
 * Angle in [0, 180] between the direction from -> to and "straight down" in image space.
 * 0 means `to` is directly below `from`; 90 means level with it; 180 directly above.
 * Used to check that a supporting limb (wrist / elbow) is under the shoulder.
 */
export function angleFromDownDeg(from: Point2, to: Point2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return Number.NaN;
  return Math.abs(Math.atan2(dx, dy)) * RAD_TO_DEG;
}

/**
 * Signed perpendicular distance of `p` from the infinite line through a and b.
 * Sign follows the 2D cross product (b - a) x (p - a) / |b - a|: in y-down image space a
 * positive value means `p` lies clockwise of the direction a -> b on screen.
 * NaN when a == b or any input is non-finite.
 */
export function signedDistanceFromLine(p: Point2, a: Point2, b: Point2): number {
  const lx = b.x - a.x;
  const ly = b.y - a.y;
  const len = Math.hypot(lx, ly);
  if (!(len > 0) || !Number.isFinite(len)) return Number.NaN;
  return (lx * (p.y - a.y) - ly * (p.x - a.x)) / len;
}

/**
 * Perpendicular offset of `p` from the line through a and b, positive when `p` is *below*
 * the line in image space (larger y, i.e. towards the floor for an upright camera) and
 * negative when above. For an exactly vertical line "below" is undefined and the offset is
 * measured towards +x. NaN on degenerate input.
 *
 * Push-up / plank use: offsetBelowLine(hip, shoulder, ankle) > 0 means the hips sag,
 * < 0 means they are piked, independent of which way the person faces.
 */
export function offsetBelowLine(p: Point2, a: Point2, b: Point2): number {
  const lx = b.x - a.x;
  const ly = b.y - a.y;
  const len = Math.hypot(lx, ly);
  if (!(len > 0) || !Number.isFinite(len)) return Number.NaN;
  // Unit normal, oriented to point down the screen (+y), or +x for a vertical line.
  let nx = -ly / len;
  let ny = lx / len;
  if (ny < 0 || (ny === 0 && nx < 0)) {
    nx = -nx;
    ny = -ny;
  }
  return (p.x - a.x) * nx + (p.y - a.y) * ny;
}

/** Visibility of one landmark clamped to [0, 1]; 0 when missing or non-finite. */
export function landmarkVisibility(lm: Landmark | null | undefined): number {
  if (!lm || typeof lm !== "object") return 0;
  if (!isFiniteNumber(lm.x) || !isFiniteNumber(lm.y)) return 0;
  const v = lm.visibility;
  if (!isFiniteNumber(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Mean visibility of the given landmark indices (0 for an empty list). */
export function meanVisibility(landmarks: readonly Landmark[], indices: readonly number[]): number {
  if (indices.length === 0) return 0;
  let sum = 0;
  for (const i of indices) sum += landmarkVisibility(landmarks[i]);
  return sum / indices.length;
}

/** Minimum visibility of the given landmark indices (0 for an empty list). */
export function minVisibility(landmarks: readonly Landmark[], indices: readonly number[]): number {
  if (indices.length === 0) return 0;
  let min = 1;
  for (const i of indices) min = Math.min(min, landmarkVisibility(landmarks[i]));
  return min;
}
