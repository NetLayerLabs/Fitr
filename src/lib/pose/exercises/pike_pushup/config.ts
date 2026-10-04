/**
 * Tunable thresholds for the pike push-up engine (degrees / ms). See engine.ts for how each
 * one is used. Angles are 2D image-space angles after aspect correction.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface PikePushupConfig extends CommonEngineConfig {
  /** Elbow angle (shoulder-elbow-wrist) above this (debounced) = locked out at the top. */
  upAngleDeg: number;
  /** Elbow angle below this (debounced) = deep enough (head down between the hands). */
  downAngleDeg: number;
  /** Dipping below this without reaching `downAngleDeg` is a partial rep (go_lower). */
  partialAngleDeg: number;
  /** Lockout -> lockout faster than this is rejected as too_fast. */
  minRepMs: number;
  /**
   * Pike gate: the hip angle (shoulder-hip-ankle) must be below this, with the hip above both
   * the shoulder and the ankle. A regular push-up / plank body line (~170-180) fails it.
   * Above it, the set cannot start (keep_hips_high) and a rep is rejected.
   */
  maxHipAngleDeg: number;
  /**
   * The hip angle staying above this (debounced) during a set means the body went flat (a
   * regular push-up or lying down): the set is cancelled back to 'searching'.
   */
  flatHipAngleDeg: number;
  /** Lockout only counts with the wrist under the shoulder (shoulder->wrist within this of straight down). */
  maxArmFromVerticalDeg: number;
  /**
   * Hands and feet stay planted: during a rep the wrist may move at most this fraction of the
   * body length (shoulder-hip + hip-ankle at lockout) relative to the ankle, else the attempt
   * is cancelled (arms waving in the air, not a press).
   */
  maxWristDriftRatio: number;
  /**
   * The head must travel toward the hands: between lockout and the bottom the shoulder must
   * drop (towards the wrist, image vertical) by at least this fraction of the arm length
   * (shoulder-elbow + elbow-wrist at lockout), else go_lower.
   */
  minShoulderDropRatio: number;
}

export const PIKE_PUSHUP_DEFAULTS: Readonly<PikePushupConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 155,
  downAngleDeg: 100,
  partialAngleDeg: 135,
  minRepMs: 500,
  maxHipAngleDeg: 120,
  flatHipAngleDeg: 145,
  maxArmFromVerticalDeg: 50,
  maxWristDriftRatio: 0.15,
  minShoulderDropRatio: 0.15,
});
