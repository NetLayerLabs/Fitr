/** Synthetic front-view high-knees sequences (tests and the form-guide demo). */
import { keyframes } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { frontSequence, type FrontPoseParams, type FrontSequenceOptions } from "../front/skeleton";

export interface HighKneesSequenceOptions extends FrontSequenceOptions {
  /** Number of knee lifts (alternating left, right, ... unless `side` is set). */
  lifts?: number;
  /** Peak hip flexion of each lift (90 = thigh horizontal). Number or per-lift list. */
  topDeg?: number | readonly number[];
  /** Down -> up -> down time of one knee. */
  liftMs?: number;
  /** Pause with both feet down between lifts. */
  gapMs?: number;
  leadInMs?: number;
  leadOutMs?: number;
  /** Lift only this knee (one-legged knee pumping). */
  side?: "left" | "right";
  /** Swing the knee out sideways (abduction) instead of forward. */
  lateral?: boolean;
  turnDeg?: number;
  rollDeg?: number;
}

/** A standing pose with the given hip flexion per leg; the shin hangs roughly vertical. */
export function kneeLiftPose(leftFlex: number, rightFlex: number, extra: Partial<FrontPoseParams> = {}): FrontPoseParams {
  const leg = (flex: number) => ({ hipFlexDeg: flex, kneeFlexDeg: Math.min(flex * 1.05, 120), legSpreadDeg: 3 });
  return {
    // Arms pump opposite to the legs, elbows bent.
    left: { ...leg(leftFlex), upperArmDeg: 10 + rightFlex * 0.15, forearmDeg: 10 + rightFlex * 0.5 },
    right: { ...leg(rightFlex), upperArmDeg: 10 + leftFlex * 0.15, forearmDeg: 10 + leftFlex * 0.5 },
    ...extra,
  };
}

/** Running in place: alternating knee lifts. Defaults: 560 ms per lift, 60 ms between lifts. */
export function highKneesSequence(options: HighKneesSequenceOptions = {}): PoseFrame[] {
  const {
    lifts = 6,
    topDeg = 88,
    liftMs = 560,
    gapMs = 60,
    leadInMs = 1000,
    leadOutMs = 800,
    side,
    lateral = false,
    turnDeg = 0,
    rollDeg = 0,
    ...rest
  } = options;
  const left: [number, number][] = [[0, 0]];
  const right: [number, number][] = [[0, 0]];
  let t = leadInMs;
  for (let i = 0; i < lifts; i++) {
    const s = side ?? (i % 2 === 0 ? "left" : "right");
    const top = typeof topDeg === "number" ? topDeg : (topDeg[i] ?? 88);
    const k = s === "left" ? left : right;
    k.push([t, 0], [t + liftMs * 0.45, top], [t + liftMs * 0.55, top], [t + liftMs, 0]);
    t += liftMs + gapMs;
  }
  const durationMs = t + leadOutMs;
  const l = keyframes(left);
  const r = keyframes(right);
  return frontSequence(durationMs, { ...rest, seed: rest.seed }, (tm) => {
    if (lateral) {
      return {
        left: { legSpreadDeg: 3 + l(tm), upperArmDeg: 10 },
        right: { legSpreadDeg: 3 + r(tm), upperArmDeg: 10 },
        turnDeg,
        rollDeg,
      };
    }
    return kneeLiftPose(l(tm), r(tm), { turnDeg, rollDeg });
  });
}

export interface FrontSquatOptions extends FrontSequenceOptions {
  reps?: number;
  repMs?: number;
  holdMs?: number;
}

/** Squats filmed from the front: both knees come forward and up together. Must not count. */
export function frontSquatSequence(options: FrontSquatOptions = {}): PoseFrame[] {
  const { reps = 5, repMs = 1600, holdMs = 400, ...rest } = options;
  const points: [number, number][] = [[0, 0]];
  let t = 1000;
  for (let i = 0; i < reps; i++) {
    points.push([t, 0], [t + repMs / 2, 1], [t + repMs, 0]);
    t += repMs + holdMs;
  }
  const u = keyframes(points);
  return frontSequence(t + 800, rest, (tm) => {
    const d = u(tm);
    const leg = { hipFlexDeg: 85 * d, kneeFlexDeg: 110 * d, legSpreadDeg: 8 };
    return {
      left: { ...leg, upperArmDeg: 10 + 70 * d },
      right: { ...leg, upperArmDeg: 10 + 70 * d },
      torsoLeanDeg: 25 * d,
    };
  });
}
