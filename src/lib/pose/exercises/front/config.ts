/**
 * Front-view settings shared by square-on engines. Kept import-free (like
 * engine/commonConfig.ts) so per-exercise config files can extend it without import cycles.
 */
export interface FrontViewConfig {
  /** Shoulder width / torso length below this => not square-on (face_camera). */
  minShoulderWidthRatio: number;
  /** Torso further than this from vertical => not upright (chest_up). 180 disables. */
  maxTorsoFromVerticalDeg: number;
}

export const FRONT_VIEW_DEFAULTS: Readonly<FrontViewConfig> = Object.freeze({
  minShoulderWidthRatio: 0.45,
  maxTorsoFromVerticalDeg: 35,
});
