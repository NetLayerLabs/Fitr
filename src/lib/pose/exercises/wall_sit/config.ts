/**
 * Tunable thresholds for the wall sit engine (degrees / ms). Owned by the wall_sit engine
 * module; engine/config.ts wires `WallSitConfig` and `WALL_SIT_DEFAULTS` into
 * EngineConfigMap / ENGINE_DEFAULTS. See engine.ts. Timer settings mirror the plank's.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface WallSitConfig extends CommonEngineConfig {
  /** Valid knee angle range (hip-knee-ankle). Above max => go_lower, below min => go_higher. */
  minKneeDeg: number;
  maxKneeDeg: number;
  /** Thigh (hip-knee) within this of horizontal; else go_lower (hip high) / go_higher (hip low). */
  maxThighFromHorizontalDeg: number;
  /** Torso (shoulder-hip) within this of vertical (back on the wall); else keep_back_on_wall. */
  maxTorsoFromVerticalDeg: number;
  /** Same grace rules as the plank (see engine/plank.ts). */
  graceMs: number;
  /** Credit cap for a frame after a stall longer than maxFrameGapMs (as the plank). */
  maxCreditPerFrameMs: number;
}

export const WALL_SIT_DEFAULTS: Readonly<WallSitConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  minKneeDeg: 65,
  maxKneeDeg: 115,
  maxThighFromHorizontalDeg: 30,
  maxTorsoFromVerticalDeg: 25,
  graceMs: 500,
  maxCreditPerFrameMs: 200,
});
