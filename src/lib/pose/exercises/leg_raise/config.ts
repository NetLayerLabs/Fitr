/**
 * Tunable thresholds for the leg-raise engine (degrees / ms). See engine.ts for how each is
 * used. The primary signal is the hip angle shoulder-hip-ankle: ~180 legs flat, 90 legs
 * vertical.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface LegRaiseConfig extends CommonEngineConfig {
  /** Hip angle above this (debounced) = legs lowered back near the floor (start / end of a rep). */
  upAngleDeg: number;
  /** Hip angle below this (debounced) = legs raised to (near) vertical. */
  downAngleDeg: number;
  /** Raising past this without reaching downAngleDeg, then lowering, is a half rep (go_higher). */
  partialAngleDeg: number;
  /** Reps faster than this are rejected as too_fast. */
  minRepMs: number;
  /**
   * The back stays on the floor: the shoulder may be raised above the hip by at most this
   * (shoulder-hip segment vs horizontal). Stops sit-ups with flat legs (which close the same
   * hip angle) and anything standing.
   */
  maxTorsoLiftDeg: number;
  /** Legs (mostly) straight: knee angle must stay at least this during a rep, else extend_fully. */
  minKneeAngleDeg: number;
}

export const LEG_RAISE_DEFAULTS: Readonly<LegRaiseConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 150,
  downAngleDeg: 100,
  partialAngleDeg: 135,
  minRepMs: 700,
  maxTorsoLiftDeg: 30,
  minKneeAngleDeg: 145,
});
