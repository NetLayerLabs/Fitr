/**
 * Tunable thresholds for the jumping-jack engine (degrees / ms / ratios). Front view.
 * See engine.ts for how each one is used.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";
import { FRONT_VIEW_DEFAULTS, type FrontViewConfig } from "../front/config";

export interface JumpingJackConfig extends CommonEngineConfig, FrontViewConfig {
  /**
   * Arms "overhead": BOTH arm angles (hip-shoulder-wrist) at least this. 140 deg puts the wrist
   * about 0.25 body heights above the shoulder, i.e. above the top of the head.
   */
  openArmDeg: number;
  /** Arms "down" (closed): BOTH arm angles at most this (wrists well below the shoulders). */
  closedArmDeg: number;
  /** Either arm above this starts an attempt (used to report partial reps). */
  partialArmDeg: number;
  /** Feet "out": ankle-to-ankle distance at least this many shoulder widths. */
  openSpreadRatio: number;
  /** Feet "together" (closed): ankle distance at most this many shoulder widths. */
  closedSpreadRatio: number;
  /** Ankle distance above this starts an attempt (used to report partial reps). */
  partialSpreadRatio: number;
  /** Closed -> open -> closed faster than this is rejected as too_fast. */
  minRepMs: number;
}

export const JUMPING_JACK_DEFAULTS: Readonly<JumpingJackConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  ...FRONT_VIEW_DEFAULTS,
  openArmDeg: 140,
  closedArmDeg: 50,
  partialArmDeg: 75,
  openSpreadRatio: 1.5,
  closedSpreadRatio: 1.1,
  partialSpreadRatio: 1.25,
  minRepMs: 400,
});
