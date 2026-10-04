/**
 * Tunable thresholds for the jump squat engine (degrees / ms / leg-length ratios). Owned by
 * the jump_squat engine module; engine/config.ts wires `JumpSquatConfig` and
 * `JUMP_SQUAT_DEFAULTS` into EngineConfigMap / ENGINE_DEFAULTS. See engine.ts.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface JumpSquatConfig extends CommonEngineConfig {
  /** Standing: knee angle above this. */
  upAngleDeg: number;
  /** Squat depth: knee angle below this, feet on the floor. */
  downAngleDeg: number;
  /** Dipping below this without reaching depth is a partial squat (go_lower). */
  partialAngleDeg: number;
  /**
   * Airborne: the tracked ankle (and the other ankle when visible) rose at least this many
   * leg lengths (hip-knee + knee-ankle, measured standing) above its standing baseline.
   */
  jumpMinLegRatio: number;
  /** Airborne also needs the hip this fraction of jumpMinLegRatio above its standing height. */
  hipRiseFraction: number;
  /**
   * Airborne also needs the toe (foot index), when visible, this many leg lengths above its
   * baseline. Rising onto the toes (calf raise) lifts the ankle but not the toe.
   */
  toeMinLegRatio: number;
  /**
   * When the toe is not visible, the ankle (and other ankle) must rise this many times
   * jumpMinLegRatio instead: more than any calf raise can lift the ankle.
   */
  noToeJumpMultiplier: number;
  /** Landed: the tracked ankle is back below this fraction of jumpMinLegRatio. */
  landFraction: number;
  /** Visibility needed to use the other ankle / the toe in the jump checks. */
  extraJointVisibilityThreshold: number;
  /**
   * After reaching depth, standing back up (feet down) for this long without a takeoff is
   * a plain squat: rejected as jump_higher.
   */
  standWithoutJumpMs: number;
  /** Knee bends within this long after a landing are absorption, never partial squats. */
  landingAbsorbMs: number;
  /** A counted rep (start -> depth -> takeoff -> landing) must take at least this long. */
  minRepMs: number;
  /** 'ready' needs the torso within this of vertical. */
  maxStandingTorsoFromVerticalDeg: number;
  /** Torso further than this from vertical during a set (lying down) cancels it. */
  maxTorsoFromVerticalDeg: number;
}

export const JUMP_SQUAT_DEFAULTS: Readonly<JumpSquatConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 160,
  downAngleDeg: 100,
  partialAngleDeg: 140,
  jumpMinLegRatio: 0.15,
  hipRiseFraction: 0.7,
  toeMinLegRatio: 0.06,
  noToeJumpMultiplier: 1.25,
  landFraction: 0.5,
  extraJointVisibilityThreshold: 0.3,
  standWithoutJumpMs: 300,
  landingAbsorbMs: 700,
  minRepMs: 600,
  maxStandingTorsoFromVerticalDeg: 30,
  maxTorsoFromVerticalDeg: 75,
});
