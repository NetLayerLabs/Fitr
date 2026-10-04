/**
 * Config shared by every rep engine. Kept in its own module (no imports from exercise
 * folders) so per-exercise config files under src/lib/pose/exercises/<kind>/config.ts can
 * extend it without an import cycle through engine/config.ts.
 */
import type { OneEuroParams } from "@/lib/pose/filters";

export interface CommonEngineConfig {
  /** A joint counts as visible when its visibility is >= this. */
  visibilityThreshold: number;
  /** Required joints not visible for this long => phase 'searching' + body_not_visible. */
  lostTimeoutMs: number;
  /** The other body side must beat the current side's mean visibility by this much to switch. */
  sideSwitchMargin: number;
  /** A key joint moving more than this fraction of the frame height between frames is a glitch. */
  teleportFraction: number;
  /** After a glitch, no phase transitions / counting for this long (unstable_tracking). */
  glitchFreezeMs: number;
  /** A gap between consecutive frames longer than this cancels any in-progress rep. */
  maxFrameGapMs: number;
  /** Debounce: a threshold must stay crossed for at least this many consecutive frames... */
  debounceFrames: number;
  /** ...and for at least this long (first to last frame of the run). */
  debounceMs: number;
  /** How long a transient issue (e.g. go_lower after a rejected rep) stays in formIssues. */
  issueHoldMs: number;
  /** One Euro filter applied to every angle signal (degrees). */
  angleFilter: OneEuroParams;
}

export const DEFAULT_ANGLE_FILTER: Readonly<OneEuroParams> = Object.freeze({
  minCutoff: 1.0,
  beta: 0.02,
  dCutoff: 1.0,
});

export const COMMON_DEFAULTS: Readonly<CommonEngineConfig> = Object.freeze({
  visibilityThreshold: 0.5,
  lostTimeoutMs: 300,
  sideSwitchMargin: 0.15,
  teleportFraction: 0.25,
  glitchFreezeMs: 300,
  maxFrameGapMs: 500,
  debounceFrames: 2,
  debounceMs: 50,
  issueHoldMs: 1500,
  angleFilter: DEFAULT_ANGLE_FILTER,
});

