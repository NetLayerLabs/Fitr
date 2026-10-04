/**
 * Tunable thresholds for the rep engines. All angles are in degrees, all times in ms.
 * Angles are 2D image-space angles after aspect correction (see geometry.ts).
 *
 * The defaults assume the recommended side-view camera. `createRepEngine(kind, overrides)`
 * merges a partial override on top of the defaults for that exercise.
 */
import type { ExerciseKind } from "@/lib/pose/types";
import type { OneEuroParams } from "@/lib/pose/filters";
import { COMMON_DEFAULTS, DEFAULT_ANGLE_FILTER, type CommonEngineConfig } from "./commonConfig";
import { LUNGE_DEFAULTS, type LungeConfig } from "@/lib/pose/exercises/lunge/config";
import { SITUP_DEFAULTS, type SitupConfig } from "@/lib/pose/exercises/situp/config";
import { LEG_RAISE_DEFAULTS, type LegRaiseConfig } from "@/lib/pose/exercises/leg_raise/config";
import { GLUTE_BRIDGE_DEFAULTS, type GluteBridgeConfig } from "@/lib/pose/exercises/glute_bridge/config";
import { WALL_SIT_DEFAULTS, type WallSitConfig } from "@/lib/pose/exercises/wall_sit/config";
import { PIKE_PUSHUP_DEFAULTS, type PikePushupConfig } from "@/lib/pose/exercises/pike_pushup/config";
import { JUMP_SQUAT_DEFAULTS, type JumpSquatConfig } from "@/lib/pose/exercises/jump_squat/config";
import { PULLUP_DEFAULTS, type PullupConfig } from "@/lib/pose/exercises/pullup/config";
import { DIP_DEFAULTS, type DipConfig } from "@/lib/pose/exercises/dip/config";
import { BURPEE_DEFAULTS, type BurpeeConfig } from "@/lib/pose/exercises/burpee/config";
import { MOUNTAIN_CLIMBER_DEFAULTS, type MountainClimberConfig } from "@/lib/pose/exercises/mountain_climber/config";
import { JUMPING_JACK_DEFAULTS, type JumpingJackConfig } from "@/lib/pose/exercises/jumping_jack/config";
import { HIGH_KNEES_DEFAULTS, type HighKneesConfig } from "@/lib/pose/exercises/high_knees/config";

export { COMMON_DEFAULTS, DEFAULT_ANGLE_FILTER, type CommonEngineConfig };
export { LUNGE_DEFAULTS, type LungeConfig };
export { SITUP_DEFAULTS, type SitupConfig };
export { LEG_RAISE_DEFAULTS, type LegRaiseConfig };
export { GLUTE_BRIDGE_DEFAULTS, type GluteBridgeConfig };
export { WALL_SIT_DEFAULTS, type WallSitConfig };
export { PIKE_PUSHUP_DEFAULTS, type PikePushupConfig };
export { JUMP_SQUAT_DEFAULTS, type JumpSquatConfig };
export { PULLUP_DEFAULTS, type PullupConfig };
export { DIP_DEFAULTS, type DipConfig };
export { BURPEE_DEFAULTS, type BurpeeConfig };
export { MOUNTAIN_CLIMBER_DEFAULTS, type MountainClimberConfig };
export { JUMPING_JACK_DEFAULTS, type JumpingJackConfig };
export { HIGH_KNEES_DEFAULTS, type HighKneesConfig };

export interface PushupConfig extends CommonEngineConfig {
  /** Elbow angle above this (debounced) = locked out at the top. */
  upAngleDeg: number;
  /** Elbow angle below this (debounced) = deep enough at the bottom. */
  downAngleDeg: number;
  /** Dipping below this without reaching `downAngleDeg` is a partial rep (go_lower). */
  partialAngleDeg: number;
  /** Reps faster than this (leaving lockout -> lockout again) are rejected as too_fast. */
  minRepMs: number;
  /**
   * The shoulder->ankle line must be within this of horizontal, else body_not_horizontal.
   * The whole-body line is used rather than the shoulder-hip segment so that sagging / piked
   * hips (which tilt the torso) are reported as hips_sagging / hips_piked instead of being
   * masked by body_not_horizontal.
   */
  maxBodyFromHorizontalDeg: number;
  /** Shoulder-hip-ankle angle must stay above this during the bottom of the rep. */
  minBodyLineDeg: number;
  /**
   * Lockout only counts when the wrist is under the shoulder: the shoulder->wrist direction
   * must be within this of straight down. Stops "arm waving while lying on the floor"
   * (reported as body_on_floor).
   */
  maxArmFromVerticalDeg: number;
  /**
   * Legs must be straight: the knee angle (hip-knee-ankle) must be at least this to start a
   * set, and must not drop below it at any point of a rep, else the rep is rejected with
   * body_on_floor. Knee push-ups keep the shoulder-hip-knee line straight but bend the knee
   * (about 140 deg at the top), so this is what tells them apart from real push-ups.
   */
  minKneeAngleDeg: number;
  /**
   * Hands and feet stay planted in a real push-up: during a rep the wrist may move at most
   * this fraction of the body length (shoulder->ankle distance at lockout) relative to the
   * ankle. Pressing the hands through the air (e.g. standing chest presses, or presses while
   * lying on the back, filmed by a phone lying on its side or upside down so the body looks
   * horizontal) moves the wrist instead of the shoulder; the attempt is then cancelled as
   * body_not_horizontal. Orientation-independent, unlike the image-axis posture gates.
   */
  maxWristDriftRatio: number;
}

export interface SquatConfig extends CommonEngineConfig {
  /** Knee angle above this (debounced) = standing. */
  upAngleDeg: number;
  /** Knee angle below this (debounced) = deep enough. */
  downAngleDeg: number;
  /** Dipping below this without reaching `downAngleDeg` is a partial rep (go_lower). */
  partialAngleDeg: number;
  /** Reps faster than this are rejected as too_fast. */
  minRepMs: number;
  /** 'ready' requires the torso (shoulder-hip) within this of vertical. */
  maxStandingTorsoFromVerticalDeg: number;
  /** Torso leaning further than this from vertical at the bottom raises chest_up. */
  chestUpTorsoFromVerticalDeg: number;
  /** When true a rep with chest_up at the bottom is rejected; default false (warn only). */
  rejectOnChestUp: boolean;
  /** Torso further than this from vertical (lying down) cancels the set back to 'searching'. */
  maxTorsoFromVerticalDeg: number;
  /**
   * The hip must drop by at least this many shin lengths (knee-ankle distance) between
   * standing and the bottom, else the rep is rejected with go_lower. A real squat to a
   * 95 deg knee drops the hip ~0.5 shin lengths; seated knee extensions and one-legged knee
   * bends drop it ~0, so they cannot pass as squats.
   */
  minHipDropShinRatio: number;
}

export interface PlankConfig extends CommonEngineConfig {
  /** Shoulder-hip-ankle angle must be above this for the hold to count. */
  minBodyLineDeg: number;
  /** Shoulder->ankle line must be within this of horizontal (see PushupConfig). */
  maxBodyFromHorizontalDeg: number;
  /**
   * Legs must be straight (knee angle hip-knee-ankle at least this), else body_on_floor.
   * A plank on the knees keeps the shoulder-hip-ankle line nearly straight (~169 deg) but
   * bends the knee to ~158 deg.
   */
  minKneeAngleDeg: number;
  /**
   * Breaks (bad form / lost tracking) shorter than this do not pause the timer. The time spent
   * in such a break is credited only after good form has been held again for graceMs, so
   * rhythmically dipping out of form cannot earn a full hold.
   */
  graceMs: number;
  /**
   * Credit cap for a frame that arrives more than maxFrameGapMs after the previous one (a
   * stalled camera cannot inflate the hold). Frames closer together than maxFrameGapMs count
   * as continuous tracking and are credited in full, so a slow (2-5 fps) device is not
   * under-credited.
   */
  maxCreditPerFrameMs: number;
  /**
   * Require the body to be propped up on the arms: the elbow must be under the shoulder
   * (within `maxUpperArmFromVerticalDeg` of straight down). Rejects lying flat on the floor
   * (body_on_floor). Works for both forearm and straight-arm planks.
   */
  requireArmSupport: boolean;
  maxUpperArmFromVerticalDeg: number;
}

/**
 * Config type per exercise. The 13 newer exercises keep their config next to their engine
 * (src/lib/pose/exercises/<kind>/config.ts).
 */
export interface EngineConfigMap {
  pushup: PushupConfig;
  squat: SquatConfig;
  plank: PlankConfig;
  lunge: LungeConfig;
  situp: SitupConfig;
  leg_raise: LegRaiseConfig;
  glute_bridge: GluteBridgeConfig;
  wall_sit: WallSitConfig;
  pike_pushup: PikePushupConfig;
  jump_squat: JumpSquatConfig;
  pullup: PullupConfig;
  dip: DipConfig;
  burpee: BurpeeConfig;
  mountain_climber: MountainClimberConfig;
  jumping_jack: JumpingJackConfig;
  high_knees: HighKneesConfig;
}

/** Resolved config for one exercise kind. */
export type EngineConfig<K extends ExerciseKind = ExerciseKind> = EngineConfigMap[K];

/** Partial override accepted by createRepEngine; `angleFilter` may itself be partial. */
export type EngineConfigOverrides<K extends ExerciseKind = ExerciseKind> = K extends ExerciseKind
  ? {
      [P in keyof EngineConfigMap[K]]?: P extends "angleFilter"
        ? Partial<OneEuroParams>
        : EngineConfigMap[K][P];
    }
  : never;

export const PUSHUP_DEFAULTS: Readonly<PushupConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 155,
  downAngleDeg: 90,
  partialAngleDeg: 135,
  minRepMs: 400,
  maxBodyFromHorizontalDeg: 35,
  minBodyLineDeg: 150,
  maxArmFromVerticalDeg: 50,
  minKneeAngleDeg: 160,
  maxWristDriftRatio: 0.15,
});

export const SQUAT_DEFAULTS: Readonly<SquatConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  upAngleDeg: 160,
  downAngleDeg: 95,
  partialAngleDeg: 140,
  minRepMs: 500,
  maxStandingTorsoFromVerticalDeg: 30,
  chestUpTorsoFromVerticalDeg: 60,
  rejectOnChestUp: false,
  maxTorsoFromVerticalDeg: 75,
  minHipDropShinRatio: 0.3,
});

export const PLANK_DEFAULTS: Readonly<PlankConfig> = Object.freeze({
  ...COMMON_DEFAULTS,
  minBodyLineDeg: 160,
  maxBodyFromHorizontalDeg: 35,
  minKneeAngleDeg: 165,
  graceMs: 500,
  maxCreditPerFrameMs: 200,
  requireArmSupport: true,
  maxUpperArmFromVerticalDeg: 50,
});

export const ENGINE_DEFAULTS: { readonly [K in ExerciseKind]: Readonly<EngineConfigMap[K]> } =
  Object.freeze({
    pushup: PUSHUP_DEFAULTS,
    squat: SQUAT_DEFAULTS,
    plank: PLANK_DEFAULTS,
    lunge: LUNGE_DEFAULTS,
    situp: SITUP_DEFAULTS,
    leg_raise: LEG_RAISE_DEFAULTS,
    glute_bridge: GLUTE_BRIDGE_DEFAULTS,
    wall_sit: WALL_SIT_DEFAULTS,
    pike_pushup: PIKE_PUSHUP_DEFAULTS,
    jump_squat: JUMP_SQUAT_DEFAULTS,
    pullup: PULLUP_DEFAULTS,
    dip: DIP_DEFAULTS,
    burpee: BURPEE_DEFAULTS,
    mountain_climber: MOUNTAIN_CLIMBER_DEFAULTS,
    jumping_jack: JUMPING_JACK_DEFAULTS,
    high_knees: HIGH_KNEES_DEFAULTS,
  });

/**
 * Defaults for `kind` with `overrides` merged on top. `undefined` override values are
 * ignored; `angleFilter` is merged field by field. Returns a fresh object.
 */
export function resolveConfig<K extends ExerciseKind>(
  kind: K,
  overrides?: EngineConfigOverrides<K>,
): EngineConfig<K> {
  const base = ENGINE_DEFAULTS[kind] as EngineConfig<K>;
  const merged: Record<string, unknown> = { ...base, angleFilter: { ...base.angleFilter } };
  if (overrides) {
    for (const [key, value] of Object.entries(overrides as Record<string, unknown>)) {
      if (value === undefined) continue;
      if (key === "angleFilter" && value && typeof value === "object") {
        const filter = merged.angleFilter as Record<string, unknown>;
        for (const [fk, fv] of Object.entries(value as Record<string, unknown>)) {
          if (fv !== undefined) filter[fk] = fv;
        }
      } else {
        merged[key] = value;
      }
    }
  }
  return merged as unknown as EngineConfig<K>;
}
