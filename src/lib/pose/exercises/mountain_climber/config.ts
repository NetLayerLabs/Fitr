/**
 * Tunable thresholds for the mountain-climber engine (degrees / ms). See engine.ts.
 * Each leg is read on its own: hip angle shoulder-hip-knee, ~180 with the leg back in the
 * plank, closing below 100 when the knee is driven towards the chest.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface MountainClimberConfig extends CommonEngineConfig {
  /** Hip angle above this (debounced) = that leg is back in the plank. */
  upAngleDeg: number;
  /** Hip angle below this (debounced) = that knee is driven in (counts once it goes back). */
  downAngleDeg: number;
  /** Closing past this without reaching downAngleDeg, then extending, is a short drive (go_higher). */
  partialAngleDeg: number;
  /** One leg's drive (leg back -> knee in -> leg back) faster than this is rejected as too_fast. */
  minRepMs: number;
  /** Torso (shoulder-hip) within this of horizontal, else body_not_horizontal. */
  maxTorsoFromHorizontalDeg: number;
  /** Hands under the shoulders: shoulder->wrist within this of straight down, else body_on_floor. */
  maxArmFromVerticalDeg: number;
  /**
   * While a knee is driven in, the plank line shoulder-hip-ankle of the OTHER (planted) leg
   * must stay above this, else the drive is rejected with hips_piked / hips_sagging.
   */
  minBodyLineDeg: number;
  /** The planted leg must be straight (knee angle at least this): no knees on the floor. */
  minStraightKneeDeg: number;
  /**
   * Visibility needed for the far leg's hip, knee and ankle (the near side uses
   * visibilityThreshold). The far leg is partly hidden in a side view, so this is lower.
   */
  farLegVisibilityThreshold: number;
}

export const MOUNTAIN_CLIMBER_DEFAULTS: Readonly<MountainClimberConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 150,
  downAngleDeg: 100,
  partialAngleDeg: 135,
  minRepMs: 320,
  maxTorsoFromHorizontalDeg: 45,
  maxArmFromVerticalDeg: 50,
  minBodyLineDeg: 150,
  minStraightKneeDeg: 150,
  farLegVisibilityThreshold: 0.3,
});
