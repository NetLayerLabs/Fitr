/**
 * Tunable thresholds for the pull-up engine (front view; degrees / ms / ratios). See
 * engine.ts for how each one is used. Lengths are measured in shoulder widths (the distance
 * between the two shoulders), which is stable in a front view.
 */
import { COMMON_DEFAULTS, type CommonEngineConfig } from "@/lib/pose/engine/commonConfig";

export interface PullupConfig extends CommonEngineConfig {
  /** Mean elbow angle (both arms) above this (debounced, wrists above the head) = dead hang. */
  upAngleDeg: number;
  /** Mean elbow angle below this, with the chin over the bar (debounced) = top of the pull. */
  downAngleDeg: number;
  /** Pulling below this without reaching the top, then hanging again = half rep (chin_over_bar). */
  partialAngleDeg: number;
  /** Hang -> top -> hang faster than this is rejected as too_fast (kipping / swinging). */
  minRepMs: number;
  /**
   * Chin over the bar: the mouth (nose if the mouth is not visible) must be at least this many
   * shoulder widths above the wrist line (the bar). 0 = mouth level with the hands.
   */
  minChinClearanceRatio: number;
  /**
   * The body must actually rise: the shoulders must move up by at least this many shoulder
   * widths between the hang and the top, else chin_over_bar.
   */
  minShoulderRiseRatio: number;
  /**
   * The hands stay on the bar: during a rep the wrist line may move at most this many shoulder
   * widths in the image (static phone), else the attempt is cancelled (pulling the arms down
   * through the air with no bar).
   */
  maxWristDriftRatio: number;
  /**
   * Front-facing check: shoulder width / torso length (mid-shoulder to mid-hip) must be at
   * least this. Side-on it is near 0 (face_camera).
   */
  minShoulderWidthRatio: number;
}

export const PULLUP_DEFAULTS: Readonly<PullupConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 150,
  downAngleDeg: 90,
  partialAngleDeg: 130,
  minRepMs: 900,
  minChinClearanceRatio: 0,
  minShoulderRiseRatio: 0.4,
  maxWristDriftRatio: 0.35,
  minShoulderWidthRatio: 0.4,
});
