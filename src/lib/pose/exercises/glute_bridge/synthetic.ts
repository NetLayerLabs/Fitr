/**
 * Synthetic glute-bridge skeletons and sequences (side view, floor layout), for tests and
 * the form-guide demo. Deterministic: randomness only from the seeded PRNG.
 */
import { PROPORTIONS, repTimeline, type AngleProfile, type RepTimelineOptions, type SideSkeleton, type Vec } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { add, dirDeg, flatFoot, kneeBetween, noise, renderSkeletonSequence, scale, type FloorSequenceOptions } from "../situp/supine";
import { signedHipExtensionDeg } from "./engine";

/** Shoulders on the floor here; head towards +x. */
const SHOULDER: Vec = { x: 0.1, y: 0.06 };
/** Feet planted here (hips-down knee angle ~84 deg). */
const ANKLE: Vec = { x: -0.53, y: 0.06 };

const flip = (v: Vec) => ({ x: v.x, y: -v.y });

function bridgeAt(torsoDeg: number) {
  const hip = add(SHOULDER, scale(dirDeg(180 - torsoDeg), PROPORTIONS.torso));
  const knee = kneeBetween(hip, ANKLE, PROPORTIONS.thigh, PROPORTIONS.shin, true);
  return { hip, knee, extension: signedHipExtensionDeg(flip(SHOULDER), flip(hip), flip(knee)) };
}

function skeletonFrom(hip: Vec, knee: Vec, ankle: Vec): SideSkeleton {
  const elbow = { x: SHOULDER.x - PROPORTIONS.upperArm, y: 0.05 };
  return {
    shoulder: SHOULDER,
    elbow,
    wrist: { x: elbow.x - PROPORTIONS.forearm, y: 0.04 },
    hip,
    knee,
    ankle,
    ...flatFoot(ankle),
    headDir: { x: 1, y: 0 },
    faceDir: { x: 0, y: 1 },
    handDir: { x: -1, y: 0 },
  };
}

/**
 * Bridge with the hip extension (signed shoulder-hip-knee, see engine.ts) at `extensionDeg`.
 * Values below the hips-down extension (~131) clamp to hips on the floor.
 */
export function bridgeSkeleton({ extensionDeg }: { extensionDeg: number }): SideSkeleton {
  let lo = 0;
  let hi = 60;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (bridgeAt(mid).extension < extensionDeg) lo = mid;
    else hi = mid;
  }
  const { hip, knee } = bridgeAt(lo);
  return skeletonFrom(hip, knee, ANKLE);
}

/** Hips on the floor, sliding the heels out (knee angle `kneeDeg`): opens the hip, no lift. */
export function heelSlideSkeleton({ kneeDeg }: { kneeDeg: number }): SideSkeleton {
  const a = PROPORTIONS.thigh;
  const b = PROPORTIONS.shin;
  const hip = add(SHOULDER, { x: -PROPORTIONS.torso, y: 0 });
  const reach = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((kneeDeg * Math.PI) / 180));
  const ankle = { x: hip.x - reach, y: 0.06 };
  return skeletonFrom(hip, kneeBetween(hip, ankle, a, b, true), ankle);
}

export interface BridgeSequenceOptions extends FloorSequenceOptions, Partial<RepTimelineOptions> {
  /** Custom extension profile; overrides the rep timeline options. */
  profile?: AngleProfile;
}

/** Bridge timeline defaults: hips down (131), up to a straight line (178), 1.6 s reps. */
export function bridgeTimeline(options: Partial<RepTimelineOptions> = {}) {
  return repTimeline({ reps: 5, topAngle: 131, bottomAngle: 178, repMs: 1600, holdMs: 300, bottomHoldMs: 200, ...options });
}

export function bridgeSequence(options: BridgeSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  const profile = options.profile ?? bridgeTimeline(options);
  return renderSkeletonSequence(profile.durationMs, "floor", options, (t, rng) =>
    bridgeSkeleton({ extensionDeg: profile.angleAt(t) + noise(rng, jitterDeg) }),
  );
}

/** Heel slides (knee 84 -> 178 -> 84) with the hips on the floor: must not count. */
export function heelSlideSequence(options: BridgeSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  const profile = repTimeline({ reps: 5, topAngle: 84, bottomAngle: 178, repMs: 1600, ...options });
  return renderSkeletonSequence(profile.durationMs, "floor", options, (t, rng) =>
    heelSlideSkeleton({ kneeDeg: profile.angleAt(t) + noise(rng, jitterDeg) }),
  );
}
