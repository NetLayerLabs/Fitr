/**
 * Tunable thresholds for the burpee engine (degrees / ms). Side view.
 * See engine.ts for how each one is used.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface BurpeeConfig extends CommonEngineConfig {
  /** Standing: knee angle (hip-knee-ankle) at least this... */
  standKneeDeg: number;
  /** ...and the torso (shoulder-hip) within this of vertical. */
  maxStandTorsoDeg: number;
  /** Squat / hands down: knee angle at most this... */
  crouchKneeDeg: number;
  /** ...with the wrist below the knee (image y) by at least this many shin lengths (hands to the floor). */
  minHandsBelowKneeShin: number;
  /** Plank: the shoulder->ankle line within this of horizontal. */
  plankMaxInclineDeg: number;
  /** Plank: body line (shoulder-hip-ankle) at least this (no sagging / piking). */
  plankMinBodyLineDeg: number;
  /** Plank: legs straight, knee angle at least this (no knee "planks"). */
  plankMinKneeDeg: number;
  /** Plank: the wrist under the shoulder, shoulder->wrist within this of straight down. */
  plankMaxArmFromVerticalDeg: number;
  /** A complete sequence (standing -> standing) faster than this is rejected as too_fast. */
  minRepMs: number;
  /** An attempt that has not finished within this is abandoned (stand up to start again). */
  maxRepMs: number;
}

export const BURPEE_DEFAULTS: Readonly<BurpeeConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  standKneeDeg: 155,
  maxStandTorsoDeg: 30,
  crouchKneeDeg: 120,
  minHandsBelowKneeShin: 0,
  plankMaxInclineDeg: 30,
  plankMinBodyLineDeg: 150,
  plankMinKneeDeg: 150,
  plankMaxArmFromVerticalDeg: 50,
  minRepMs: 1000,
  maxRepMs: 6000,
});
