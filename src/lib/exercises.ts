import EN from "@/lib/i18n/messages/en/exercises";
import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";

export type GoalUnit = "reps" | "seconds";

export type ExerciseCategory = "push" | "pull" | "legs" | "core" | "cardio";

export type ExerciseEquipment = "none" | "bar" | "chair" | "wall";

/** Which way the user faces the phone: side-on (most exercises) or square-on to it. */
export type CameraView = "side" | "front";

export type ExerciseLevel = "beginner" | "intermediate" | "advanced";

/** Muscle groups; each has a `muscle_<id>` key in the "exercises" namespace. */
export type Muscle =
  | "chest"
  | "triceps"
  | "shoulders"
  | "upperChest"
  | "quads"
  | "glutes"
  | "hamstrings"
  | "calves"
  | "legs"
  | "abs"
  | "lowerAbs"
  | "lowerBack"
  | "hipFlexors"
  | "lats"
  | "biceps"
  | "upperBack"
  | "fullBody";

export interface ExerciseInfo {
  kind: ExerciseKind;
  /**
   * Onchain exercise code stored with each stake (the vault's u8). Equals the index in
   * EXERCISE_KINDS. Never renumber.
   */
  code: number;
  name: string;
  tagline: string;
  unit: GoalUnit;
  /** Default daily goal, in `unit`. */
  defaultGoal: number;
  /** Smallest goal a stake may use, in `unit` (mirrors the vault's per-exercise minimum). */
  minGoal: number;
  category: ExerciseCategory;
  equipment: ExerciseEquipment;
  camera: CameraView;
  level: ExerciseLevel;
  /** Main muscles worked, most important first (English; screens use exerciseMuscles()). */
  muscles: string[];
  /** The same muscles as ids, for translation (`muscle_<id>`). */
  muscleIds: readonly Muscle[];
  /** How a rep is counted when it is not obvious (alternating exercises). */
  repNote?: string;
  /** Where to put the phone, shown before the camera starts. */
  setupTips: string[];
}

/**
 * The English text fields (name, tagline, muscles, repNote, setupTips) come from the "exercises"
 * messages (src/lib/i18n/messages/en/exercises.ts); screens show them translated through
 * src/lib/i18n/exercise.ts (exerciseTagline, exerciseSetupTips, ...).
 */
type ExerciseSpec = Omit<ExerciseInfo, "name" | "tagline" | "muscles" | "repNote" | "setupTips">;

type EnKey = keyof typeof EN;

/** How many setup tips each exercise has (`<kind>_setupTip1..n`). */
export const SETUP_TIP_COUNT = 3;

export interface ExerciseCategoryInfo {
  id: ExerciseCategory;
  label: string;
  description: string;
}

/** Display order of the categories (strength first, then core and cardio). */
export const EXERCISE_CATEGORIES: readonly ExerciseCategoryInfo[] = Object.freeze(
  (["push", "pull", "legs", "core", "cardio"] as const).map((id) => ({
    id,
    label: EN[`category_${id}`],
    description: EN[`category_${id}_description`],
  })),
);

/** Per-exercise data. The setup tips (messages) add the specifics; the phone always stands upright in portrait. */
const SPECS: Record<ExerciseKind, ExerciseSpec> = {
  pushup: {
    kind: "pushup",
    code: 0,
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "push",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["chest", "triceps", "shoulders"],
  },
  squat: {
    kind: "squat",
    code: 1,
    unit: "reps",
    defaultGoal: 25,
    minGoal: 15,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["quads", "glutes", "hamstrings"],
  },
  plank: {
    kind: "plank",
    code: 2,
    unit: "seconds",
    defaultGoal: 60,
    minGoal: 30,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["abs", "lowerBack", "shoulders"],
  },
  lunge: {
    kind: "lunge",
    code: 3,
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["quads", "glutes", "hamstrings"],
  },
  situp: {
    kind: "situp",
    code: 4,
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["abs", "hipFlexors"],
  },
  leg_raise: {
    kind: "leg_raise",
    code: 5,
    unit: "reps",
    defaultGoal: 15,
    minGoal: 10,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscleIds: ["lowerAbs", "hipFlexors"],
  },
  glute_bridge: {
    kind: "glute_bridge",
    code: 6,
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscleIds: ["glutes", "hamstrings", "lowerBack"],
  },
  wall_sit: {
    kind: "wall_sit",
    code: 7,
    unit: "seconds",
    defaultGoal: 60,
    minGoal: 30,
    category: "legs",
    equipment: "wall",
    camera: "side",
    level: "beginner",
    muscleIds: ["quads", "glutes"],
  },
  pike_pushup: {
    kind: "pike_pushup",
    code: 8,
    unit: "reps",
    defaultGoal: 10,
    minGoal: 5,
    category: "push",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscleIds: ["shoulders", "triceps", "upperChest"],
  },
  jump_squat: {
    kind: "jump_squat",
    code: 9,
    unit: "reps",
    defaultGoal: 15,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscleIds: ["quads", "glutes", "calves"],
  },
  pullup: {
    kind: "pullup",
    code: 10,
    unit: "reps",
    defaultGoal: 8,
    minGoal: 3,
    category: "pull",
    equipment: "bar",
    camera: "front",
    level: "advanced",
    muscleIds: ["lats", "biceps", "upperBack"],
  },
  dip: {
    kind: "dip",
    code: 11,
    unit: "reps",
    defaultGoal: 12,
    minGoal: 5,
    category: "push",
    equipment: "chair",
    camera: "side",
    level: "intermediate",
    muscleIds: ["triceps", "chest", "shoulders"],
  },
  burpee: {
    kind: "burpee",
    code: 12,
    unit: "reps",
    defaultGoal: 10,
    minGoal: 5,
    category: "cardio",
    equipment: "none",
    camera: "side",
    level: "advanced",
    muscleIds: ["fullBody", "chest", "legs"],
  },
  mountain_climber: {
    kind: "mountain_climber",
    code: 13,
    unit: "reps",
    defaultGoal: 40,
    minGoal: 20,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscleIds: ["abs", "hipFlexors", "shoulders"],
  },
  jumping_jack: {
    kind: "jumping_jack",
    code: 14,
    unit: "reps",
    defaultGoal: 40,
    minGoal: 20,
    category: "cardio",
    equipment: "none",
    camera: "front",
    level: "beginner",
    muscleIds: ["fullBody", "calves", "shoulders"],
  },
  high_knees: {
    kind: "high_knees",
    code: 15,
    unit: "reps",
    defaultGoal: 50,
    minGoal: 20,
    category: "cardio",
    equipment: "none",
    camera: "front",
    level: "beginner",
    muscleIds: ["hipFlexors", "quads", "calves"],
  },
};

/** Whether the exercise has a rep note (`<kind>_repNote`). */
export function hasRepNote(kind: ExerciseKind): boolean {
  return `${kind}_repNote` in EN;
}

function withEnglishText(spec: ExerciseSpec): ExerciseInfo {
  const { kind } = spec;
  const en = (key: string) => EN[key as EnKey];
  return {
    ...spec,
    name: en(`${kind}_name`),
    tagline: en(`${kind}_tagline`),
    muscles: spec.muscleIds.map((id) => en(`muscle_${id}`)),
    ...(hasRepNote(kind) ? { repNote: en(`${kind}_repNote`) } : {}),
    setupTips: Array.from({ length: SETUP_TIP_COUNT }, (_, i) => en(`${kind}_setupTip${i + 1}`)),
  };
}

export const EXERCISES: Record<ExerciseKind, ExerciseInfo> = Object.fromEntries(
  EXERCISE_KINDS.map((kind) => [kind, withEnglishText(SPECS[kind])]),
) as Record<ExerciseKind, ExerciseInfo>;

/** Every exercise in onchain code order. */
export const EXERCISE_LIST: readonly ExerciseInfo[] = Object.freeze(EXERCISE_KINDS.map((kind) => EXERCISES[kind]));

/** kind -> onchain code. */
export const EXERCISE_CODE: Readonly<Record<ExerciseKind, number>> = Object.freeze(
  Object.fromEntries(EXERCISE_KINDS.map((kind, code) => [kind, code])) as Record<ExerciseKind, number>,
);

/** Onchain code -> kind, or null for an unknown code. */
export function exerciseFromCode(code: number): ExerciseKind | null {
  return Number.isInteger(code) && code >= 0 && code < EXERCISE_KINDS.length ? EXERCISE_KINDS[code] : null;
}

/** Exercises grouped by category, in EXERCISE_CATEGORIES order (exercises in code order). */
export function exercisesByCategory(): Array<ExerciseCategoryInfo & { exercises: ExerciseInfo[] }> {
  return EXERCISE_CATEGORIES.map((category) => ({
    ...category,
    exercises: EXERCISE_LIST.filter((info) => info.category === category.id),
  }));
}
