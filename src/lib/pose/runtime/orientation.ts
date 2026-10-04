/**
 * Which way is down in the camera image?
 *
 * The rep engines judge posture against the image axes ("horizontal body", "wrist under the
 * shoulder"), which assumes the phone is upright so that image-down is gravity. A phone lying
 * on its side or standing upside down breaks that: a standing person looks horizontal, arms
 * held forward look like arms pointing at the floor. These pure helpers turn a
 * DeviceOrientationEvent reading into the roll of the scene in the video frame, so the runtime
 * can stop feeding frames to the engine while the phone is not upright.
 *
 * No browser imports: callers pass the raw angles. See src/hooks/useDeviceOrientation.ts.
 */
import type { PoseFrame } from "@/lib/pose/types";

const DEG = Math.PI / 180;

/** "tilted": the scene is rolled too far in the frame for posture checks to mean anything. */
export type OrientationStatus = "upright" | "tilted" | "unknown";

/** Roll beyond this (either way) turns the gate on... */
export const TILTED_ENTER_DEG = 40;
/** ...and it only turns off again below this (hysteresis, so sensor noise cannot flicker it). */
export const TILTED_EXIT_DEG = 30;
/**
 * Below this much of gravity in the screen plane (sin of the screen's angle from horizontal)
 * the phone is lying nearly flat, the roll is meaningless, and the status is "unknown".
 */
export const MIN_SCREEN_GRAVITY = 0.5;

export interface SceneRoll {
  /**
   * Angle in (-180, 180] between gravity projected into the video frame and the frame's
   * "down" (+y). 0 = upright, +-90 = on its side, 180 = upside down.
   */
  rollDeg: number;
  /** 0..1: how much of gravity lies in the screen plane (1 = screen vertical, 0 = flat). */
  inPlane: number;
}

/**
 * Scene roll from DeviceOrientationEvent beta / gamma (degrees, W3C intrinsic Z-X'-Y'' angles)
 * and the screen orientation angle (screen.orientation.angle: how far the displayed content,
 * and with it the camera frames the browser hands out, is rotated from the device's natural
 * orientation). Null when the reading is incomplete.
 *
 * Gravity in device coordinates (x right, y up the screen, z out of it) for those angles is
 * (cos b sin g, -sin b, -cos b cos g). Its in-plane direction, measured from the device's
 * "down" (-y), is the device roll; the displayed content (and camera frame) is rotated back by
 * the screen angle, so the scene roll is deviceRoll + screenAngle.
 */
export function sceneRoll(
  beta: number | null | undefined,
  gamma: number | null | undefined,
  screenAngleDeg: number | null | undefined,
): SceneRoll | null {
  if (typeof beta !== "number" || !Number.isFinite(beta)) return null;
  if (typeof gamma !== "number" || !Number.isFinite(gamma)) return null;
  const gx = Math.cos(beta * DEG) * Math.sin(gamma * DEG);
  const gy = -Math.sin(beta * DEG);
  const inPlane = Math.min(1, Math.hypot(gx, gy));
  const deviceRoll = Math.atan2(gx, -gy) / DEG;
  const screen = typeof screenAngleDeg === "number" && Number.isFinite(screenAngleDeg) ? screenAngleDeg : 0;
  return { rollDeg: normalizeDeg(deviceRoll + screen), inPlane };
}

/** Next gate status for a new reading, with hysteresis around the previous status. */
export function nextOrientationStatus(previous: OrientationStatus, roll: SceneRoll | null): OrientationStatus {
  if (!roll || roll.inPlane < MIN_SCREEN_GRAVITY) return "unknown";
  const off = Math.abs(roll.rollDeg);
  if (previous === "tilted") return off < TILTED_EXIT_DEG ? "upright" : "tilted";
  return off > TILTED_ENTER_DEG ? "tilted" : "upright";
}

/**
 * The frame the rep engine should see: while the phone is known to be tilted, a frame with no
 * pose, so nothing is counted or credited (reps in progress are abandoned, a plank pauses).
 * Unknown orientation (no sensor, permission denied, phone flat) passes frames through.
 */
export function gateFrameByOrientation(frame: PoseFrame, status: OrientationStatus): PoseFrame {
  if (status !== "tilted" || frame.landmarks.length === 0) return frame;
  return { timestampMs: frame.timestampMs, landmarks: [], imageWidth: frame.imageWidth, imageHeight: frame.imageHeight };
}

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}
