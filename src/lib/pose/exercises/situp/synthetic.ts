/**
 * Synthetic sit-up skeletons and sequences (side view, floor layout), for tests and the
 * form-guide demo. Deterministic: randomness only from the seeded PRNG.
 */
import { PROPORTIONS, repTimeline, standingSkeleton, type AngleProfile, type RepTimelineOptions, type SideSkeleton } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { add, clamp, dirDeg, flatFoot, kneeBetween, noise, renderSkeletonSequence, rotate, scale, type FloorSequenceOptions } from "./supine";

export interface SitupPoseParams {
  /** Torso rise from the floor: 0 = lying flat, 90 = upright, ~100 = chest over the knees. */
  riseDeg: number;
  /** Interior knee angle (feet flat on the floor). Default 80. */
  kneeDeg?: number;
  /** Lift the hip off the floor by this much (world units). Default 0. */
  hipLift?: number;
}

/** Lying on the back, knees bent, feet flat, arms crossed on the chest; torso at `riseDeg`. */
export function situpSkeleton({ riseDeg, kneeDeg = 80, hipLift = 0 }: SitupPoseParams): SideSkeleton {
  const a = PROPORTIONS.thigh;
  const b = PROPORTIONS.shin;
  const k = clamp(kneeDeg, 30, 180);
  const reach = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((k * Math.PI) / 180));
  const hip = { x: -0.22, y: 0.06 + hipLift };
  const ankle = { x: hip.x - Math.sqrt(Math.max(reach * reach - hipLift * hipLift, 1e-6)), y: 0.06 };
  const knee = kneeBetween(hip, ankle, a, b, true);
  const headDir = dirDeg(riseDeg);
  const shoulder = add(hip, scale(headDir, PROPORTIONS.torso));
  const faceDir = rotate(headDir, 90);
  // Arms crossed on the chest.
  const elbow = add(add(shoulder, scale(headDir, -0.13)), scale(faceDir, 0.09));
  const wrist = add(add(shoulder, scale(headDir, -0.02)), scale(faceDir, 0.07));
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    ...flatFoot(ankle),
    headDir,
    faceDir,
    handDir: headDir,
  };
}

export interface SitupSequenceOptions extends FloorSequenceOptions, Partial<RepTimelineOptions> {
  /** Knee angle (constant). Default 80. */
  kneeDeg?: number;
  /** Custom rise profile; overrides the rep timeline options. */
  profile?: AngleProfile;
}

/** Sit-up timeline defaults: lying at 5 deg, up to 95 deg, 1.6 s reps with a 0.3 s rest. */
export function situpTimeline(options: Partial<RepTimelineOptions> = {}) {
  return repTimeline({ reps: 5, topAngle: 5, bottomAngle: 95, repMs: 1600, holdMs: 300, ...options });
}

export function situpSequence(options: SitupSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0, kneeDeg = 80 } = options;
  const profile = options.profile ?? situpTimeline(options);
  return renderSkeletonSequence(profile.durationMs, "floor", options, (t, rng) =>
    situpSkeleton({ riseDeg: profile.angleAt(t) + noise(rng, jitterDeg), kneeDeg: kneeDeg + noise(rng, jitterDeg) }),
  );
}

/** Standing toe-touches (torso folding forward 0 -> 85 deg): must not count as sit-ups. */
export function standingToeTouchSequence(options: SitupSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  const profile = repTimeline({ reps: 5, topAngle: 0, bottomAngle: 85, repMs: 1600, ...options });
  return renderSkeletonSequence(profile.durationMs, "standing", options, (t, rng) =>
    standingSkeleton({ kneeDeg: 175 + noise(rng, jitterDeg), torsoLeanDeg: profile.angleAt(t) + noise(rng, jitterDeg) }),
  );
}
