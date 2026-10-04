/**
 * Deterministic synthetic pull-ups (FRONT view) for tests and the demo, built on the shared
 * front-view skeleton (../front, re-exported by ../jumping_jack/frontView as the README asks).
 *
 * The hands grip a fixed bar at (+-gripHalfWidth, barY). For a given elbow angle the shoulders
 * hang below the bar so that each arm (upper arm + forearm, frontal plane, elbows out) spans
 * shoulder -> hand; the whole body is lifted (`lift`) to put the shoulders there. Bending the
 * elbows therefore raises the body and brings the chin over the bar.
 *
 * mode "air" is a cheat: standing on the floor, arms overhead, pulling the hands down
 * through the air with the same arm angles. The shoulders stay put and the wrists move.
 */
import {
  mulberry32,
  PROPORTIONS,
  repTimeline,
  type AngleProfile,
  type RepTimeline,
  type RepTimelineOptions,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { FRONT_PROPORTIONS, type FrontRenderOptions } from "../front/skeleton";
import { frontSkeleton, renderFrontLandmarks, type FrontPoseParams } from "../jumping_jack/frontView";

const DEG = Math.PI / 180;

export interface PullupPoseParams {
  /** Interior elbow angle, both arms (or per arm with rightElbowDeg). */
  elbowDeg: number;
  /** Right arm's elbow angle if different (asymmetric pull). Default: elbowDeg. */
  rightElbowDeg?: number;
  /** Half the grip width (hand x offset from the midline), body heights. Default 0.24. */
  gripHalfWidth?: number;
  /** "bar": hanging from a fixed bar. "air": standing, pulling the hands down (cheat). */
  mode?: "bar" | "air";
  /** Knee bend while hanging. Default 12. */
  kneeFlexDeg?: number;
  /** Body turned away from square-on (0 = facing the camera, 90 = side-on). */
  turnDeg?: number;
}

/** Standing shoulder height of the front skeleton (lift 0, straight legs). */
function standingShoulderY(): number {
  const sk = frontSkeleton({ left: { kneeFlexDeg: 0, legSpreadDeg: 2 }, right: { kneeFlexDeg: 0, legSpreadDeg: 2 } });
  return sk.left.shoulder.y;
}

/** Distance shoulder -> wrist for an interior elbow angle. */
function reach(elbowDeg: number): number {
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  const e = Math.min(Math.max(elbowDeg, 20), 180) * DEG;
  return Math.sqrt(u * u + f * f - 2 * u * f * Math.cos(e));
}

/** Shoulder height below the hands for an elbow angle and grip. */
function hangDepth(elbowDeg: number, dx: number): number {
  const d = reach(elbowDeg);
  return Math.sqrt(Math.max(d * d - dx * dx, 0));
}

/**
 * Upper-arm / forearm directions (front-skeleton convention: degrees from straight down,
 * positive outward) for a shoulder at the origin and the hand at (dx outward, dy up).
 */
function armAngles(dx: number, dy: number): { upperArmDeg: number; forearmDeg: number } {
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  const d = Math.max(Math.hypot(dx, dy), 1e-6);
  const along = Math.min(Math.max((u * u - f * f + d * d) / (2 * d), -u), u);
  const h = Math.sqrt(Math.max(u * u - along * along, 0));
  const mx = (along * dx) / d;
  const my = (along * dy) / d;
  // The two elbow candidates; elbows point outward (larger x).
  const c1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const c2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  const elbow = c1.x >= c2.x ? c1 : c2;
  const fromDown = (vx: number, vy: number) => {
    let a = Math.atan2(vx, -vy) / DEG;
    if (a < 0) a += 360;
    return a;
  };
  return {
    upperArmDeg: fromDown(elbow.x, elbow.y),
    forearmDeg: fromDown(dx - elbow.x, dy - elbow.y),
  };
}

const STANDING_SHOULDER_Y = standingShoulderY();

/** Front-skeleton parameters for one pull-up pose. */
export function pullupPose({
  elbowDeg,
  rightElbowDeg,
  gripHalfWidth = 0.24,
  mode = "bar",
  kneeFlexDeg = 12,
  turnDeg = 0,
}: PullupPoseParams): FrontPoseParams {
  const dx = gripHalfWidth - FRONT_PROPORTIONS.shoulderHalfWidth;
  const leftDy = hangDepth(elbowDeg, dx);
  const rightDy = hangDepth(rightElbowDeg ?? elbowDeg, dx);
  // Hang the body from the bar so the hands stay at a fixed height. Reference: a dead hang
  // (172 deg) puts the feet just off the floor.
  const barY = STANDING_SHOULDER_Y + hangDepth(172, dx) + 0.06;
  const dy = (leftDy + rightDy) / 2;
  const lift = mode === "bar" ? barY - dy - STANDING_SHOULDER_Y : 0;
  const legs = mode === "bar" ? { kneeFlexDeg, hipFlexDeg: 4 } : { kneeFlexDeg: 0, hipFlexDeg: 0 };
  return {
    left: { ...armAngles(dx, leftDy), legSpreadDeg: 3, ...legs },
    right: { ...armAngles(dx, rightDy), legSpreadDeg: 3, ...legs },
    lift: Math.max(lift, 0),
    turnDeg,
  };
}

function noise(rng: () => number, amplitude: number): number {
  return amplitude === 0 ? 0 : (rng() * 2 - 1) * amplitude;
}

function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

/**
 * Pull-up timeline: "top" of the timeline = dead hang (172), "bottom" = top of the pull (55),
 * 2 s reps with a 0.4 s pause in the hang.
 */
export function pullupTimeline(options: Partial<RepTimelineOptions> = {}): RepTimeline {
  return repTimeline({ reps: 5, topAngle: 172, bottomAngle: 55, repMs: 2000, holdMs: 400, ...options });
}

export interface PullupSequenceOptions extends FrontRenderOptions, Partial<RepTimelineOptions> {
  fps?: number;
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise (degrees) on each elbow angle. */
  jitterDeg?: number;
  gripHalfWidth?: number;
  mode?: "bar" | "air";
  turnDeg?: number;
  profile?: AngleProfile;
}

export function pullupSequence(options: PullupSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480, jitterDeg = 0, gripHalfWidth, mode, turnDeg } =
    options;
  const profile = options.profile ?? pullupTimeline(options);
  const rng = mulberry32(seed);
  return frameOffsets(profile.durationMs, fps).map((offset) => {
    const base = profile.angleAt(offset);
    const pose = pullupPose({
      elbowDeg: base + noise(rng, jitterDeg),
      rightElbowDeg: base + noise(rng, jitterDeg),
      gripHalfWidth,
      mode,
      turnDeg,
    });
    return {
      timestampMs: startMs + offset,
      landmarks: renderFrontLandmarks(frontSkeleton(pose), { ...options, width, height }),
      imageWidth: width,
      imageHeight: height,
    };
  });
}
