/**
 * Tunable thresholds for the glute-bridge engine (degrees / ms). See engine.ts for how each
 * is used. The primary signal is the hip extension shoulder-hip-knee (signed: values above
 * 180 mean the hips are pushed above the shoulder-knee line).
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface GluteBridgeConfig extends CommonEngineConfig {
  /** Hip extension below this (debounced) = hips down (start / end of a rep). */
  hipsDownMaxDeg: number;
  /** Hip extension above this (debounced) = full bridge: knees, hips and shoulders in line. */
  topMinDeg: number;
  /** Rising past this without reaching topMinDeg, then lowering, is a half rep (go_higher). */
  partialMinDeg: number;
  /** Reps faster than this are rejected as too_fast. */
  minRepMs: number;
  /** Shoulders stay on the floor: the shoulder may be raised above the hip by at most this. */
  maxTorsoLiftDeg: number;
  /** Knees bent, feet planted: knee angle (hip-knee-ankle) at most this. */
  maxKneeAngleDeg: number;
  /**
   * At the top the hip must be above the shoulder by at least this many thigh lengths.
   * A real bridge lifts it ~0.45 thigh lengths; sliding the heels out with the hips on the
   * floor (which opens the same hip angle) lifts it ~0.
   */
  minHipRiseThighRatio: number;
}

export const GLUTE_BRIDGE_DEFAULTS: Readonly<GluteBridgeConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  hipsDownMaxDeg: 145,
  topMinDeg: 165,
  partialMinDeg: 155,
  minRepMs: 500,
  maxTorsoLiftDeg: 30,
  maxKneeAngleDeg: 140,
  minHipRiseThighRatio: 0.2,
});
