import { EXERCISE_KINDS, type ExerciseKind } from "@/lib/pose/types";

export type GoalUnit = "reps" | "seconds";

export type ExerciseCategory = "push" | "pull" | "legs" | "core" | "cardio";

export type ExerciseEquipment = "none" | "bar" | "chair" | "wall";

/** Which way the user faces the phone: side-on (most exercises) or square-on to it. */
export type CameraView = "side" | "front";

export type ExerciseLevel = "beginner" | "intermediate" | "advanced";

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
  /** Main muscles worked, most important first. */
  muscles: string[];
  /** How a rep is counted when it is not obvious (alternating exercises). */
  repNote?: string;
  /** Where to put the phone, shown before the camera starts. */
  setupTips: string[];
}

export interface ExerciseCategoryInfo {
  id: ExerciseCategory;
  label: string;
  description: string;
}

/** Display order of the categories (strength first, then core and cardio). */
export const EXERCISE_CATEGORIES: readonly ExerciseCategoryInfo[] = Object.freeze([
  { id: "push", label: "Chest & Arms", description: "Pressing strength: chest, shoulders and triceps." },
  { id: "pull", label: "Back", description: "Pulling strength: lats, upper back and biceps." },
  { id: "legs", label: "Legs & Glutes", description: "Quads, hamstrings and glutes, from squats to jumps." },
  { id: "core", label: "Core", description: "Abs and trunk stability, on the floor." },
  { id: "cardio", label: "Cardio", description: "Get your heart rate up, no equipment needed." },
]);

/** The phone must stand upright in portrait for every exercise; these tips add the specifics. */
export const EXERCISES: Record<ExerciseKind, ExerciseInfo> = {
  pushup: {
    kind: "pushup",
    code: 0,
    name: "Push-ups",
    tagline: "Chest to fist, elbows under 90°",
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "push",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Chest", "Triceps", "Shoulders"],
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Your whole body, from head to heels, must be in frame.",
      "Lower until your elbows bend past 90°, then lock out at the top.",
    ],
  },
  squat: {
    kind: "squat",
    code: 1,
    name: "Squats",
    tagline: "Hips to knee height, stand tall",
    unit: "reps",
    defaultGoal: 25,
    minGoal: 15,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    setupTips: [
      "Stand the phone up about 2.5 m away, side-on works best.",
      "Keep hips, knees and ankles in frame the whole time.",
      "Sit back until your knees bend past 90°, then stand fully upright.",
    ],
  },
  plank: {
    kind: "plank",
    code: 2,
    name: "Plank",
    tagline: "Straight line, shoulders to heels",
    unit: "seconds",
    defaultGoal: 60,
    minGoal: 30,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Abs", "Lower back", "Shoulders"],
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Keep shoulders, hips and ankles in one straight line.",
      "The timer only runs while your form holds.",
    ],
  },
  lunge: {
    kind: "lunge",
    code: 3,
    name: "Lunges",
    tagline: "Front knee to 90°, back knee near the floor",
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Quads", "Glutes", "Hamstrings"],
    repNote: "Each leg counts as one rep.",
    setupTips: [
      "Stand the phone up about 2.5 m away at hip height, side-on to you.",
      "Leave room in frame for a long step forward: head to both feet visible at the bottom.",
      "Lunge in place or step back; alternate legs each rep.",
    ],
  },
  situp: {
    kind: "situp",
    code: 4,
    name: "Sit-ups",
    tagline: "Flat on your back to fully upright",
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Abs", "Hip flexors"],
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Lie with your head away from the phone's side so head, hips and feet all stay in frame.",
      "Shoulder blades touch the floor at the bottom; sit up until your chest is over your hips.",
    ],
  },
  leg_raise: {
    kind: "leg_raise",
    code: 5,
    name: "Leg raises",
    tagline: "Straight legs up to vertical and back down",
    unit: "reps",
    defaultGoal: 15,
    minGoal: 10,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscles: ["Lower abs", "Hip flexors"],
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Lying flat, your raised feet must still be in frame: tilt the phone up slightly if needed.",
      "Keep your legs straight; lower until your heels almost touch the floor.",
    ],
  },
  glute_bridge: {
    kind: "glute_bridge",
    code: 6,
    name: "Glute bridges",
    tagline: "Hips up to one line, knees to shoulders",
    unit: "reps",
    defaultGoal: 20,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "beginner",
    muscles: ["Glutes", "Hamstrings", "Lower back"],
    setupTips: [
      "Place the phone on the floor about 1.5–2 m away, side-on to your hips.",
      "Lie on your back, knees bent, feet flat: shoulders, hips and knees must be in frame.",
      "Drive your hips up until knees, hips and shoulders line up, then lower to the floor.",
    ],
  },
  wall_sit: {
    kind: "wall_sit",
    code: 7,
    name: "Wall sit",
    tagline: "Back on the wall, knees at 90°",
    unit: "seconds",
    defaultGoal: 60,
    minGoal: 30,
    category: "legs",
    equipment: "wall",
    camera: "side",
    level: "beginner",
    muscles: ["Quads", "Glutes"],
    setupTips: [
      "Stand the phone up about 2 m away at knee-to-hip height, side-on to the wall.",
      "The wall should run from one side of the frame to the other, with you fully in view.",
      "Slide down until your thighs are level; the timer only runs while you hold it.",
    ],
  },
  pike_pushup: {
    kind: "pike_pushup",
    code: 8,
    name: "Pike push-ups",
    tagline: "Hips high, head down toward the floor",
    unit: "reps",
    defaultGoal: 10,
    minGoal: 5,
    category: "push",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscles: ["Shoulders", "Triceps", "Upper chest"],
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Your raised hips are the highest point: make sure they and your hands and feet are in frame.",
      "Bend your elbows to bring your head toward the floor, then press back up.",
    ],
  },
  jump_squat: {
    kind: "jump_squat",
    code: 9,
    name: "Jump squats",
    tagline: "Full squat, then both feet off the floor",
    unit: "reps",
    defaultGoal: 15,
    minGoal: 10,
    category: "legs",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscles: ["Quads", "Glutes", "Calves"],
    setupTips: [
      "Stand the phone up about 3 m away at hip height, side-on to you.",
      "Leave headroom above you: your head must stay in frame at the top of the jump.",
      "Squat until your knees pass 90°, then jump so both feet leave the floor.",
    ],
  },
  pullup: {
    kind: "pullup",
    code: 10,
    name: "Pull-ups",
    tagline: "Chin over the bar, arms straight at the bottom",
    unit: "reps",
    defaultGoal: 8,
    minGoal: 3,
    category: "pull",
    equipment: "bar",
    camera: "front",
    level: "advanced",
    muscles: ["Lats", "Biceps", "Upper back"],
    setupTips: [
      "Face the camera: stand the phone 2.5–3 m in front of the bar, front-facing.",
      "Tilt it up so the bar, your hands and your feet are all in frame while you hang.",
      "Start from a dead hang with straight arms; pull until your chin clears the bar.",
    ],
  },
  dip: {
    kind: "dip",
    code: 11,
    name: "Dips",
    tagline: "Elbows past 90°, lock out at the top",
    unit: "reps",
    defaultGoal: 12,
    minGoal: 5,
    category: "push",
    equipment: "chair",
    camera: "side",
    level: "intermediate",
    muscles: ["Triceps", "Chest", "Shoulders"],
    setupTips: [
      "Use a sturdy chair, bench or parallel bars that will not slide.",
      "Stand the phone up about 2 m away at seat height, side-on to you.",
      "Shoulder, elbow and wrist must stay in frame: lower until your elbows pass 90°.",
    ],
  },
  burpee: {
    kind: "burpee",
    code: 12,
    name: "Burpees",
    tagline: "Squat, plank, push-up, jump",
    unit: "reps",
    defaultGoal: 10,
    minGoal: 5,
    category: "cardio",
    equipment: "none",
    camera: "side",
    level: "advanced",
    muscles: ["Full body", "Chest", "Legs"],
    setupTips: [
      "Stand the phone up about 3 m away at hip height, side-on to you.",
      "You must be fully in frame both standing with arms up and lying in the plank.",
      "Each rep: squat down, kick back to a plank, do a push-up, jump up with hands overhead.",
    ],
  },
  mountain_climber: {
    kind: "mountain_climber",
    code: 13,
    name: "Mountain climbers",
    tagline: "Plank position, knees drive to the chest",
    unit: "reps",
    defaultGoal: 40,
    minGoal: 20,
    category: "core",
    equipment: "none",
    camera: "side",
    level: "intermediate",
    muscles: ["Abs", "Hip flexors", "Shoulders"],
    repNote: "Each knee drive counts as one rep.",
    setupTips: [
      "Place the phone on the floor about 2 m away, side-on to your body.",
      "Hold a straight-arm plank with your whole body, head to heels, in frame.",
      "Drive one knee toward your chest at a time; keep your hips level.",
    ],
  },
  jumping_jack: {
    kind: "jumping_jack",
    code: 14,
    name: "Jumping jacks",
    tagline: "Hands meet overhead, feet out wide",
    unit: "reps",
    defaultGoal: 40,
    minGoal: 20,
    category: "cardio",
    equipment: "none",
    camera: "front",
    level: "beginner",
    muscles: ["Full body", "Calves", "Shoulders"],
    setupTips: [
      "Face the camera: stand the phone 2.5–3 m in front of you at chest height, front-facing.",
      "Your raised hands and wide feet must stay in frame: step back until they do.",
      "Each rep: jump out with hands meeting overhead, then back to feet together.",
    ],
  },
  high_knees: {
    kind: "high_knees",
    code: 15,
    name: "High knees",
    tagline: "Knees up to hip height, fast",
    unit: "reps",
    defaultGoal: 50,
    minGoal: 20,
    category: "cardio",
    equipment: "none",
    camera: "front",
    level: "beginner",
    muscles: ["Hip flexors", "Quads", "Calves"],
    repNote: "Each knee counts as one rep.",
    setupTips: [
      "Face the camera: stand the phone 2.5–3 m in front of you at hip height, front-facing.",
      "Keep your whole body, head to feet, in frame.",
      "Run in place, bringing each knee up to hip height.",
    ],
  },
};

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
