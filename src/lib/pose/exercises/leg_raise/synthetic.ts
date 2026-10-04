/**
 * Synthetic leg-raise skeletons and sequences (side view, floor layout), for tests and the
 * form-guide demo. Deterministic: randomness only from the seeded PRNG.
 */
import { PROPORTIONS, repTimeline, standingSkeleton, type AngleProfile, type RepTimelineOptions, type SideSkeleton } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { add, armsAlongBody, dirDeg, noise, pointedFoot, renderSkeletonSequence, rotate, scale, type FloorSequenceOptions } from "../situp/supine";

export interface LegRaisePoseParams {
  /** Leg elevation from the floor (hip -> ankle): 0 = flat, 90 = vertical. */
  legDeg: number;
  /** Knee bend: the knee angle is 180 - kneeBendDeg. Default 0 (straight). */
  kneeBendDeg?: number;
  /** Torso rise from the floor (0 = back flat). Default 2. */
  torsoDeg?: number;
}

/** Lying on the back, arms along the body, legs raised to `legDeg`. Head towards +x. */
export function legRaiseSkeleton({ legDeg, kneeBendDeg = 0, torsoDeg = 2 }: LegRaisePoseParams): SideSkeleton {
  const hip = { x: -0.2, y: 0.06 };
  const headDir = dirDeg(torsoDeg);
  const shoulder = add(hip, scale(headDir, PROPORTIONS.torso));
  const knee = add(hip, scale(dirDeg(180 - legDeg - kneeBendDeg / 2), PROPORTIONS.thigh));
  const ankle = add(knee, scale(dirDeg(180 - legDeg + kneeBendDeg / 2), PROPORTIONS.shin));
  return {
    shoulder,
    ...armsAlongBody(shoulder, hip),
    hip,
    knee,
    ankle,
    ...pointedFoot(knee, ankle),
    headDir,
    faceDir: rotate(headDir, 90),
  };
}

export interface LegRaiseSequenceOptions extends FloorSequenceOptions, Partial<RepTimelineOptions> {
  kneeBendDeg?: number;
  /** Torso rise as a function of the leg elevation (default: flat, 2 deg). */
  torsoAt?: (legDeg: number) => number;
  /** Custom leg-elevation profile; overrides the rep timeline options. */
  profile?: AngleProfile;
}

/** Leg-raise timeline defaults: heels hovering at 6 deg, up to 88 deg, 2 s reps. */
export function legRaiseTimeline(options: Partial<RepTimelineOptions> = {}) {
  return repTimeline({ reps: 5, topAngle: 6, bottomAngle: 88, repMs: 2000, holdMs: 300, ...options });
}

export function legRaiseSequence(options: LegRaiseSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0, kneeBendDeg = 0, torsoAt } = options;
  const profile = options.profile ?? legRaiseTimeline(options);
  return renderSkeletonSequence(profile.durationMs, "floor", options, (t, rng) => {
    const leg = profile.angleAt(t);
    return legRaiseSkeleton({
      legDeg: leg + noise(rng, jitterDeg),
      kneeBendDeg: kneeBendDeg + noise(rng, jitterDeg),
      torsoDeg: (torsoAt ? torsoAt(leg) : 2) + noise(rng, jitterDeg),
    });
  });
}

/** Standing knee raises / front kicks (hip flexing 0 -> 90 deg): must not count. */
export function standingLegKickSequence(options: LegRaiseSequenceOptions = {}): PoseFrame[] {
  const profile = repTimeline({ reps: 5, topAngle: 0, bottomAngle: 95, repMs: 1600, ...options });
  return renderSkeletonSequence(profile.durationMs, "standing", options, (t) => {
    const s = standingSkeleton({ kneeDeg: 178, torsoLeanDeg: 0 });
    const thigh = rotate({ x: 0, y: -1 }, profile.angleAt(t));
    const knee = add(s.hip, scale(thigh, PROPORTIONS.thigh));
    const ankle = add(knee, scale(thigh, PROPORTIONS.shin));
    return { ...s, knee, ankle, ...pointedFoot(knee, ankle) };
  });
}
