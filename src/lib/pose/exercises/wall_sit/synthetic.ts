/**
 * Synthetic side-view wall sits (tests + form-guide demo).
 *
 * wallSitSkeleton: feet flat, shin tilted `shinTiltDeg` forward of vertical, knee bent to
 * `kneeDeg`, torso leaning `torsoLeanDeg` forward of vertical (0 = back flat on the wall),
 * arms straight out in front. Facing +x, so the wall is behind (-x).
 *
 * Also: lyingLegs9090Skeleton (cheat: on the back, hips and knees at 90 deg).
 */
import {
  mulberry32,
  PROPORTIONS,
  renderLandmarks,
  type RenderOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";

const DEG = Math.PI / 180;
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const polar = (len: number, rad: number): Vec => ({ x: len * Math.cos(rad), y: len * Math.sin(rad) });

export interface WallSitPoseParams {
  /** Interior knee angle (hip-knee-ankle). Default 90. */
  kneeDeg?: number;
  /** Shin tilt forward of vertical. Default 3. */
  shinTiltDeg?: number;
  /** Torso lean forward of vertical. Default 2. */
  torsoLeanDeg?: number;
}

export function wallSitSkeleton({ kneeDeg = 90, shinTiltDeg = 3, torsoLeanDeg = 2 }: WallSitPoseParams = {}): SideSkeleton {
  const ankle = { x: 0, y: 0.08 };
  const tilt = shinTiltDeg * DEG;
  const knee = add(ankle, { x: PROPORTIONS.shin * Math.sin(tilt), y: PROPORTIONS.shin * Math.cos(tilt) });
  const dirKA = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
  const hip = add(knee, polar(PROPORTIONS.thigh, dirKA - Math.min(Math.max(kneeDeg, 20), 180) * DEG));
  const lean = torsoLeanDeg * DEG;
  const headDir = { x: Math.sin(lean), y: Math.cos(lean) };
  const shoulder = add(hip, { x: headDir.x * PROPORTIONS.torso, y: headDir.y * PROPORTIONS.torso });
  const handDir = { x: 1, y: 0 };
  const elbow = add(shoulder, { x: PROPORTIONS.upperArm, y: 0 });
  const wrist = add(elbow, { x: PROPORTIONS.forearm, y: 0 });
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    heel: add(ankle, { x: -0.05, y: -0.05 }),
    footIndex: add(ankle, { x: 0.15, y: -0.06 }),
    headDir,
    faceDir: { x: Math.cos(lean), y: -Math.sin(lean) },
    handDir,
  };
}

/** Lying on the back, thighs vertical, shins horizontal (knee 90): a cheat. */
export function lyingLegs9090Skeleton(): SideSkeleton {
  const hip = { x: 0, y: 0.08 };
  const shoulder = { x: -PROPORTIONS.torso, y: 0.08 };
  const knee = { x: 0, y: 0.08 + PROPORTIONS.thigh };
  const ankle = { x: PROPORTIONS.shin, y: knee.y };
  return {
    shoulder,
    elbow: { x: shoulder.x + PROPORTIONS.upperArm, y: 0.06 },
    wrist: { x: shoulder.x + PROPORTIONS.upperArm + PROPORTIONS.forearm, y: 0.06 },
    hip,
    knee,
    ankle,
    heel: add(ankle, { x: 0, y: -0.05 }),
    footIndex: add(ankle, { x: 0.05, y: 0.1 }),
    headDir: { x: -1, y: 0 },
    faceDir: { x: 0, y: 1 },
    handDir: { x: 1, y: 0 },
  };
}

export interface WallSitSequenceOptions extends RenderOptions {
  durationMs: number;
  fps?: number;
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise (degrees) on the knee, shin and torso angles. */
  jitterDeg?: number;
  /** Knee angle, constant or as a function of relative time. Default 90. */
  kneeDeg?: number | ((tMs: number) => number);
  /** Torso lean, constant or as a function of relative time. Default 2. */
  torsoLeanDeg?: number | ((tMs: number) => number);
  shinTiltDeg?: number;
  /** Render a custom skeleton instead (cheats). */
  skeletonAt?: (tMs: number) => SideSkeleton;
  /** "standing" (default) or "floor" framing. */
  layout?: "standing" | "floor";
}

function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

export function wallSitSequence(options: WallSitSequenceOptions): PoseFrame[] {
  const { durationMs, fps = 30, startMs = 0, seed = 1, jitterDeg = 0, shinTiltDeg = 3, width = 640, height = 480 } = options;
  const kneeAt = typeof options.kneeDeg === "function" ? options.kneeDeg : () => (options.kneeDeg as number | undefined) ?? 90;
  const leanAt =
    typeof options.torsoLeanDeg === "function" ? options.torsoLeanDeg : () => (options.torsoLeanDeg as number | undefined) ?? 2;
  const rng = mulberry32(seed);
  const n = () => (jitterDeg === 0 ? 0 : (rng() * 2 - 1) * jitterDeg);
  return frameOffsets(durationMs, fps).map((t) => {
    const skeleton = options.skeletonAt
      ? options.skeletonAt(t)
      : wallSitSkeleton({ kneeDeg: kneeAt(t) + n(), shinTiltDeg: shinTiltDeg + n(), torsoLeanDeg: leanAt(t) + n() });
    return {
      timestampMs: startMs + t,
      landmarks: renderLandmarks(skeleton, options.layout ?? "standing", { ...options, width, height }),
      imageWidth: width,
      imageHeight: height,
    };
  });
}
