/**
 * Tunable thresholds for the sit-up engine (degrees / ms). See engine.ts for how each is used.
 *
 * The primary signal is the torso's rise from the floor: the hip->shoulder segment measured
 * from the floor direction pointing away from the feet (0 = lying flat, 90 = upright,
 * ~100 = chest over the knees).
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface SitupConfig extends CommonEngineConfig {
  /** Torso rise below this (debounced) = lying back down (start / end of every rep). */
  lyingMaxDeg: number;
  /** Torso rise above this (debounced) = sat up (the far end of the rep). */
  sitUpMinDeg: number;
  /** Rising above this without reaching sitUpMinDeg, then lying back, is a half rep (go_higher). */
  partialMinDeg: number;
  /** Reps faster than this (leaving the floor -> back on the floor) are rejected as too_fast. */
  minRepMs: number;
  /** Knees must be bent: knee angle (hip-knee-ankle) at most this. */
  maxKneeAngleDeg: number;
  /**
   * Knees up: the knee must be higher on screen than the hip by at least this many thigh
   * lengths. True for a bent-knee sit-up lying on the floor; false standing, sitting on a
   * chair or lying with straight legs.
   */
  minKneeAboveHipThighRatio: number;
  /**
   * Hips on the floor: the hip may be at most this many shin lengths above the ankle (the
   * feet are planted on the same floor). False when standing or kneeling.
   */
  maxHipAboveAnkleShinRatio: number;
}

export const SITUP_DEFAULTS: Readonly<SitupConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  lyingMaxDeg: 25,
  sitUpMinDeg: 70,
  partialMinDeg: 40,
  minRepMs: 600,
  maxKneeAngleDeg: 135,
  minKneeAboveHipThighRatio: 0.3,
  maxHipAboveAnkleShinRatio: 0.6,
});
