/**
 * Small image-space geometry helpers shared by the floor-core engines (sit-up, leg raise,
 * glute bridge, mountain climber). Points are aspect-corrected image points (y DOWN), as
 * passed to engines in PoseContext. All functions return NaN on degenerate input.
 *
 * They assume the phone is upright (image vertical = world vertical), which every side-view
 * engine already does for its posture gates.
 */
import type { Point2 } from "@/lib/pose/geometry";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * How far `to` is raised above `from`, in degrees within [-90, 90]: the angle of the segment
 * from -> to against the horizontal, positive when `to` is higher on screen than `from`.
 */
export function elevationAboveDeg(from: Point2, to: Point2): number {
  const dx = Math.abs(to.x - from.x);
  const dy = from.y - to.y;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return Number.NaN;
  return Math.atan2(dy, dx) * RAD_TO_DEG;
}

/**
 * Angle of the segment base -> tip measured from the floor direction pointing AWAY from
 * `away` (horizontally), in degrees within (-180, 180]. 0 = lying flat pointing away from
 * `away`, 90 = straight up, > 90 = past vertical, leaning towards `away`.
 *
 * Sit-up: base = hip, tip = shoulder, away = ankle gives the torso's rise from the floor
 * (0 lying, 90 upright, ~100 chest over the knees) independent of which way the person faces.
 */
export function riseFromFloorDeg(base: Point2, tip: Point2, away: Point2): number {
  const side = base.x - away.x;
  if (!Number.isFinite(side) || side === 0) return Number.NaN;
  const horizontal = (tip.x - base.x) * Math.sign(side);
  const vertical = base.y - tip.y;
  if (!Number.isFinite(horizontal) || !Number.isFinite(vertical) || (horizontal === 0 && vertical === 0)) {
    return Number.NaN;
  }
  return Math.atan2(vertical, horizontal) * RAD_TO_DEG;
}
