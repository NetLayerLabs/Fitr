/**
 * Every exercise module, keyed by kind. createRepEngine() and the form-guide demo read from
 * here; adding an exercise = a new folder + one line below (TypeScript enforces completeness).
 */
import type { ExerciseKind } from "@/lib/pose/types";
import type { ExerciseModule } from "./types";
import * as pushup from "./pushup";
import * as squat from "./squat";
import * as plank from "./plank";
import * as lunge from "./lunge";
import * as situp from "./situp";
import * as legRaise from "./leg_raise";
import * as gluteBridge from "./glute_bridge";
import * as wallSit from "./wall_sit";
import * as pikePushup from "./pike_pushup";
import * as jumpSquat from "./jump_squat";
import * as pullup from "./pullup";
import * as dip from "./dip";
import * as burpee from "./burpee";
import * as mountainClimber from "./mountain_climber";
import * as jumpingJack from "./jumping_jack";
import * as highKnees from "./high_knees";

export const EXERCISE_MODULES: { readonly [K in ExerciseKind]: ExerciseModule<K> } = Object.freeze({
  pushup: pushup,
  squat: squat,
  plank: plank,
  lunge: lunge,
  situp: situp,
  leg_raise: legRaise,
  glute_bridge: gluteBridge,
  wall_sit: wallSit,
  pike_pushup: pikePushup,
  jump_squat: jumpSquat,
  pullup: pullup,
  dip: dip,
  burpee: burpee,
  mountain_climber: mountainClimber,
  jumping_jack: jumpingJack,
  high_knees: highKnees,
});

/** The module for `kind`, or null for a value that is not an ExerciseKind. */
export function exerciseModule<K extends ExerciseKind>(kind: K): ExerciseModule<K> | null {
  return Object.prototype.hasOwnProperty.call(EXERCISE_MODULES, kind)
    ? (EXERCISE_MODULES[kind] as ExerciseModule<K>)
    : null;
}
