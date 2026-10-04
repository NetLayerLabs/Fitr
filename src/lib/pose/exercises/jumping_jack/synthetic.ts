/** Synthetic front-view jumping-jack sequences (tests and the form-guide demo). */
import { repTimeline, type RepSpec } from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { frontSequence, type FrontPoseParams, type FrontSequenceOptions } from "../front/skeleton";

export interface JackPoseParams {
  /** 0 = closed (feet together, arms down), 1 = fully open. */
  openness: number;
  /** Arm angle at full openness (0 = hanging, 180 = overhead). */
  armTopDeg?: number;
  /** Arm angle when closed. */
  armBottomDeg?: number;
  /** Per-leg spread at full openness. */
  legTopDeg?: number;
  /** Per-leg spread when closed. */
  legBottomDeg?: number;
  /** Raise only the left arm (the right stays down). */
  oneArm?: boolean;
  /** Small hop at mid-movement (body heights). */
  hop?: number;
  turnDeg?: number;
  rollDeg?: number;
}

/** A jumping-jack pose at a given openness. */
export function jackPose({
  openness,
  armTopDeg = 172,
  armBottomDeg = 10,
  legTopDeg = 22,
  legBottomDeg = 2,
  oneArm = false,
  hop = 0.03,
  turnDeg = 0,
  rollDeg = 0,
}: JackPoseParams): FrontPoseParams {
  const u = Math.max(0, Math.min(1, openness));
  const arm = armBottomDeg + (armTopDeg - armBottomDeg) * u;
  const leg = legBottomDeg + (legTopDeg - legBottomDeg) * u;
  return {
    left: { upperArmDeg: arm, legSpreadDeg: leg },
    right: { upperArmDeg: oneArm ? armBottomDeg : arm, legSpreadDeg: leg },
    lift: hop * Math.sin(Math.PI * u),
    turnDeg,
    rollDeg,
  };
}

export interface JackSequenceOptions extends FrontSequenceOptions, Omit<JackPoseParams, "openness"> {
  reps?: number | readonly RepSpec[];
  /** Closed -> open -> closed time (holds excluded). */
  repMs?: number;
  /** Pause closed after each rep. */
  holdMs?: number;
  /** Pause at the open position. */
  bottomHoldMs?: number;
  leadInMs?: number;
  leadOutMs?: number;
  /** Peak openness per rep (default 1): < 1 = partial range on both arms and legs. */
  peak?: number;
}

/**
 * Jumping jacks: lead-in closed, then `reps` closed -> open -> closed cycles. Defaults: 900 ms
 * reps with a 150 ms pause closed and an 80 ms pause open.
 */
export function jumpingJackSequence(options: JackSequenceOptions = {}): PoseFrame[] {
  const {
    reps = 5,
    repMs = 900,
    holdMs = 150,
    bottomHoldMs = 80,
    leadInMs = 1000,
    leadOutMs = 800,
    peak = 1,
    ...rest
  } = options;
  const timeline = repTimeline({ reps, topAngle: 0, bottomAngle: peak, repMs, holdMs, bottomHoldMs, leadInMs, leadOutMs });
  return frontSequence(timeline.durationMs, rest, (t) => jackPose({ ...rest, openness: timeline.angleAt(t) }));
}
