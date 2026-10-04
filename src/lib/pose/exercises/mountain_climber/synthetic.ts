/**
 * Synthetic mountain-climber sequences (side view, floor layout), for tests and the
 * form-guide demo. Unlike testing/synthetic.ts, the two legs move independently: the near
 * leg comes from the near-side skeleton and the far leg is rendered from a second skeleton
 * and spliced in (same far-side offset and visibility as renderLandmarks uses).
 * Deterministic: randomness only from the seeded PRNG.
 */
import { LM } from "@/lib/pose/landmarks";
import {
  mulberry32,
  PROPORTIONS,
  plankSkeleton,
  pushupSkeleton,
  renderLandmarks,
  standingSkeleton,
  type CameraLayout,
  type SideSkeleton,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { add, frameOffsets, noise, pointedFoot, rotate, scale, sub, unit, type FloorSequenceOptions } from "../situp/supine";

/**
 * Replace the leg of `base` with one driven `driveDeg` towards the chest (0 = leg straight
 * back along its rest direction). `towards` = +1 rotates the thigh counter-clockwise from the
 * rest direction (under the body for a plank facing +x, forward for a standing body), -1
 * clockwise (up towards the chest when lying on the back).
 */
export function driveLeg(base: SideSkeleton, driveDeg: number, towards: 1 | -1 = 1): SideSkeleton {
  const rest = unit(sub(base.ankle, base.hip));
  const thighDir = rotate(rest, towards * driveDeg);
  const knee = add(base.hip, scale(thighDir, PROPORTIONS.thigh));
  // Knee angle 180 - 1.15 x drive: the foot trails behind the knee, off the floor.
  const shinDir = rotate(thighDir, -towards * Math.min(1.15 * driveDeg, 140));
  const ankle = add(knee, scale(shinDir, PROPORTIONS.shin));
  return { ...base, knee, ankle, ...pointedFoot(knee, ankle) };
}

export type ClimberBody = "plank" | "forearm" | "standing" | "supine";

export interface ClimberPoseParams {
  /** Near-leg drive (deg). */
  nearDeg: number;
  /** Far-leg drive (deg). */
  farDeg: number;
  /** Body: straight-arm plank (default), forearm plank, standing (high knees) or lying on the back. */
  body?: ClimberBody;
  /** + sags the hips, - pikes them (plank bodies). */
  hipBendDeg?: number;
  /** Drop the planted knees towards the floor (+deg), plank bodies. */
  kneeBendDeg?: number;
}

function baseSkeleton(body: ClimberBody, hipBendDeg: number, kneeBendDeg: number): SideSkeleton {
  if (body === "standing") return standingSkeleton({ kneeDeg: 178, torsoLeanDeg: 0 });
  if (body === "supine") {
    const hip = { x: -0.2, y: 0.06 };
    const shoulder = { x: 0.1, y: 0.06 };
    const ankle = { x: -0.69, y: 0.06 };
    return {
      shoulder,
      // Arms reaching up to the ceiling (dead bug).
      elbow: add(shoulder, { x: 0, y: PROPORTIONS.upperArm }),
      wrist: add(shoulder, { x: 0, y: PROPORTIONS.upperArm + PROPORTIONS.forearm }),
      hip,
      knee: { x: -0.445, y: 0.06 },
      ankle,
      heel: { x: -0.71, y: 0.04 },
      footIndex: { x: -0.72, y: 0.15 },
      headDir: { x: 1, y: 0 },
      faceDir: { x: 0, y: 1 },
      handDir: { x: 0, y: 1 },
    };
  }
  if (body === "forearm") return plankSkeleton({ style: "forearm", hipBendDeg, kneeBendDeg });
  return pushupSkeleton({ elbowDeg: 176, hipBendDeg, kneeBendDeg });
}

export function climberSkeletons({ nearDeg, farDeg, body = "plank", hipBendDeg = 0, kneeBendDeg = 0 }: ClimberPoseParams) {
  const base = baseSkeleton(body, hipBendDeg, kneeBendDeg);
  const towards = body === "supine" ? -1 : 1;
  // With a knee bend the planted leg keeps its bent shape; only driven legs are rebuilt.
  const near = nearDeg > 0.5 ? driveLeg(base, nearDeg, towards) : base;
  const far = farDeg > 0.5 ? driveLeg(base, farDeg, towards) : base;
  return { near, far };
}

const LEG_KEYS = ["KNEE", "ANKLE", "HEEL", "FOOT_INDEX"] as const;

export interface ClimberSequenceOptions extends FloorSequenceOptions {
  /** Number of knee drives (alternating, near leg first). Default 10. */
  drives?: number;
  /** Duration of one drive (leg back -> in -> back). Default 600 ms. */
  driveMs?: number;
  /** Time between the starts of consecutive drives. Default = driveMs (no overlap). */
  spacingMs?: number;
  /** Peak drive angle (deg from the rest leg). Default 105 (hip angle ~75). */
  peakDeg?: number | readonly number[];
  /** Only drive the near leg (each drive uses the near leg). */
  nearOnly?: boolean;
  leadInMs?: number;
  leadOutMs?: number;
  body?: ClimberBody;
  hipBendDeg?: number;
  kneeBendDeg?: number;
  /** Visibility of the far leg's joints (default: renderLandmarks' far visibility 0.6). */
  farLegVisibility?: number;
}

export interface ClimberTimeline {
  durationMs: number;
  /** Drive angles (near, far) at a relative time. */
  at(tMs: number): { near: number; far: number };
}

export function climberTimeline(options: ClimberSequenceOptions = {}): ClimberTimeline {
  const { drives = 10, driveMs = 600, leadInMs = 900, leadOutMs = 700, nearOnly = false, peakDeg = 105 } = options;
  const spacing = options.spacingMs ?? driveMs;
  const starts = Array.from({ length: drives }, (_, i) => leadInMs + i * spacing);
  const durationMs = drives === 0 ? leadInMs + leadOutMs : starts[drives - 1] + driveMs + leadOutMs;
  return {
    durationMs,
    at(tMs: number) {
      let near = 0;
      let far = 0;
      starts.forEach((s, i) => {
        if (tMs < s || tMs > s + driveMs) return;
        const peak = typeof peakDeg === "number" ? peakDeg : (peakDeg[i] ?? 105);
        const v = (peak * (1 - Math.cos((2 * Math.PI * (tMs - s)) / driveMs))) / 2;
        if (nearOnly || i % 2 === 0) near = Math.max(near, v);
        else far = Math.max(far, v);
      });
      return { near, far };
    },
  };
}

export function climberSequence(options: ClimberSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480, jitterDeg = 0, nearSide = "left" } = options;
  const { body = "plank", hipBendDeg = 0, kneeBendDeg = 0, farLegVisibility } = options;
  const layout: CameraLayout = body === "standing" ? "standing" : "floor";
  const timeline = climberTimeline(options);
  const rng = mulberry32(seed);
  const farSide = nearSide === "left" ? "RIGHT" : "LEFT";
  return frameOffsets(timeline.durationMs, fps).map((offset) => {
    const { near: n, far: f } = timeline.at(offset);
    const bend = hipBendDeg + noise(rng, jitterDeg);
    const nearDeg = n > 0.5 ? n + noise(rng, jitterDeg) : n;
    const farDeg = f > 0.5 ? f + noise(rng, jitterDeg) : f;
    const { near, far } = climberSkeletons({ nearDeg, farDeg, body, hipBendDeg: bend, kneeBendDeg });
    const render = { ...options, width, height };
    const landmarks = renderLandmarks(near, layout, render);
    const farLms = renderLandmarks(far, layout, render);
    for (const key of LEG_KEYS) {
      const i = LM[`${farSide}_${key}`];
      landmarks[i] = { ...farLms[i] };
    }
    if (farLegVisibility !== undefined) {
      for (const key of ["HIP", ...LEG_KEYS] as const) {
        const i = LM[`${farSide}_${key}`];
        landmarks[i] = { ...landmarks[i], visibility: farLegVisibility };
      }
    }
    return { timestampMs: startMs + offset, landmarks, imageWidth: width, imageHeight: height };
  });
}
