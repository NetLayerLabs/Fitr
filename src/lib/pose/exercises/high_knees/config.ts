/**
 * Tunable thresholds for the high-knees engine (degrees / ms / ratios). Front view.
 * See engine.ts for how each one is used.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";
import { FRONT_VIEW_DEFAULTS, type FrontViewConfig } from "../front/config";

export interface HighKneesConfig extends CommonEngineConfig, FrontViewConfig {
  /**
   * Knee lift angle (estimated hip flexion, acos((knee.y - hip.y) / thigh length)) at or above
   * this = knee up. 65 deg = the knee within 0.42 thigh lengths of hip height.
   */
  upLiftDeg: number;
  /** Lift angle at or below this = knee back down. */
  downLiftDeg: number;
  /** Lifting above this without reaching upLiftDeg is a partial lift (go_higher). */
  partialLiftDeg: number;
  /** The OTHER (standing) knee must be at or below this while a knee is up (rules out squats / jumps). */
  maxSupportLiftDeg: number;
  /** Knee more than this many thigh lengths sideways from the hip does not count as up. */
  maxKneeSideRatio: number;
  /** Down -> up -> down for one knee faster than this is rejected as too_fast. */
  minRepMs: number;
  /** Count only alternating knees: a repeat of the previous counted side is ignored. */
  requireAlternating: boolean;
  /** Time constant (ms) with which the thigh-length reference shrinks towards a shorter reading. */
  thighRefDecayMs: number;
}

export const HIGH_KNEES_DEFAULTS: Readonly<HighKneesConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  ...FRONT_VIEW_DEFAULTS,
  upLiftDeg: 65,
  downLiftDeg: 35,
  partialLiftDeg: 45,
  maxSupportLiftDeg: 40,
  maxKneeSideRatio: 0.6,
  minRepMs: 250,
  requireAlternating: true,
  thighRefDecayMs: 2000,
});
