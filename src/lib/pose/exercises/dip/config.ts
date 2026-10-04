/**
 * Tunable thresholds for the dip engine (degrees / ms). See engine.ts for how each one is
 * used. Angles are 2D image-space angles after aspect correction.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface DipConfig extends CommonEngineConfig {
  /** Elbow angle (shoulder-elbow-wrist) above this (debounced) = locked out at the top. */
  upAngleDeg: number;
  /** Elbow angle at or below this (debounced) = deep enough. */
  downAngleDeg: number;
  /** Dipping below this without reaching `downAngleDeg` is a partial rep (go_lower). */
  partialAngleDeg: number;
  /** Lockout -> lockout faster than this is rejected as too_fast. */
  minRepMs: number;
  /**
   * Torso (shoulder-hip) must be within this of vertical to start a set; a rep whose torso
   * leaned further is rejected with chest_up.
   */
  maxTorsoLeanDeg: number;
  /** Torso further than this from vertical (debounced, e.g. a push-up) cancels the set. */
  lyingTorsoDeg: number;
  /**
   * Lockout only counts when the hands press down on a support: the wrist must be below the
   * shoulder, i.e. shoulder->wrist within this of straight down.
   */
  maxLockoutArmFromVerticalDeg: number;
  /**
   * The forearm points down from the elbow to the hand on the support throughout a dip.
   * Elbow->wrist further than this from straight down (debounced) cancels the attempt: the
   * hand is lifting (an arm curl), not pressing.
   */
  maxForearmFromVerticalDeg: number;
  /**
   * The hands stay put on the support: during a rep the wrist may move at most this fraction
   * of the arm length (shoulder-elbow + elbow-wrist at lockout) in the image, else the
   * attempt is cancelled. Assumes a static phone, which the setup asks for.
   */
  maxWristDriftRatio: number;
  /**
   * The body must actually lower: between lockout and the bottom the shoulder must drop by
   * at least this fraction of the arm length (image vertical), else go_lower.
   */
  minShoulderDropRatio: number;
}

export const DIP_DEFAULTS: Readonly<DipConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 155,
  downAngleDeg: 90,
  partialAngleDeg: 130,
  minRepMs: 500,
  maxTorsoLeanDeg: 45,
  lyingTorsoDeg: 65,
  maxLockoutArmFromVerticalDeg: 35,
  maxForearmFromVerticalDeg: 45,
  maxWristDriftRatio: 0.25,
  minShoulderDropRatio: 0.3,
});
