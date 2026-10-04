/**
 * Tunable thresholds for the lunge engine (degrees / ms / ratios). Owned by the lunge
 * engine module; engine/config.ts wires `LungeConfig` and `LUNGE_DEFAULTS` into
 * EngineConfigMap / ENGINE_DEFAULTS. See engine.ts for how each one is used.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface LungeConfig extends CommonEngineConfig {
  /** Standing: BOTH knee angles above this (debounced). */
  upAngleDeg: number;
  /** Depth: FRONT knee angle below this (debounced, together with the back-knee checks). */
  downAngleDeg: number;
  /** Front knee dipping below this without reaching depth is a partial lunge (go_lower). */
  partialAngleDeg: number;
  /** Depth: BACK knee angle below this. */
  backKneeDownDeg: number;
  /**
   * Depth: back knee no higher above the front ankle than this many shin lengths (front shin
   * = knee-ankle distance), i.e. the back knee has dropped close to the floor.
   */
  backKneeMaxHeightShinRatio: number;
  /**
   * Depth: front knee at least this many shin lengths above the front ankle (front shin
   * roughly vertical). Blocks dropping onto both knees (kneeling).
   */
  frontKneeMinHeightShinRatio: number;
  /** Knee height difference (shin lengths) needed to (re)assign which leg is in front. */
  frontLegSwitchShinRatio: number;
  /** Minimum visibility of the non-tracked leg's hip, knee and ankle (a lunge needs both legs). */
  otherLegVisibilityThreshold: number;
  /** A counted lunge must take at least this long (top -> bottom -> top). */
  minRepMs: number;
  /** 'ready' needs the torso within this of vertical (shoulder-hip). */
  maxStandingTorsoFromVerticalDeg: number;
  /** Torso further than this from vertical during a set (lying down) cancels it. */
  maxTorsoFromVerticalDeg: number;
}

export const LUNGE_DEFAULTS: Readonly<LungeConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 160,
  downAngleDeg: 100,
  partialAngleDeg: 140,
  backKneeDownDeg: 125,
  backKneeMaxHeightShinRatio: 0.5,
  frontKneeMinHeightShinRatio: 0.6,
  frontLegSwitchShinRatio: 0.15,
  otherLegVisibilityThreshold: 0.3,
  minRepMs: 500,
  maxStandingTorsoFromVerticalDeg: 30,
  maxTorsoFromVerticalDeg: 75,
});
