import { spokenValue } from "@/components/workout/format";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_LIST,
  type ExerciseCategory,
  type ExerciseEquipment,
  type ExerciseInfo,
  type ExerciseLevel,
} from "@/lib/exercises";
import { isExerciseKind, type ExerciseKind } from "@/lib/pose/types";

/** A category chip's value: one category, or every exercise. */
export type CategoryFilter = ExerciseCategory | "all";

export interface CatalogFilter {
  category: CategoryFilter;
  /** Only exercises that need no equipment at all. */
  noEquipment: boolean;
}

/** URL query keys on /workouts (?c=legs&eq=none). */
export const CATEGORY_PARAM = "c";
export const EQUIPMENT_PARAM = "eq";

const CATEGORY_IDS = new Set<string>(EXERCISE_CATEGORIES.map((c) => c.id));

/** A ?c= value to a filter; anything unknown (or missing) is "all". */
export function parseCategory(value: string | null | undefined): CategoryFilter {
  return typeof value === "string" && CATEGORY_IDS.has(value) ? (value as ExerciseCategory) : "all";
}

export function parseNoEquipment(value: string | null | undefined): boolean {
  return value === "none";
}

/** Query string for a filter ("" for the default view), e.g. "?c=legs&eq=none". */
export function catalogQuery({ category, noEquipment }: CatalogFilter): string {
  const params = new URLSearchParams();
  if (category !== "all") params.set(CATEGORY_PARAM, category);
  if (noEquipment) params.set(EQUIPMENT_PARAM, "none");
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** Exercises matching the filter, in onchain code order. */
export function filterExercises({ category, noEquipment }: CatalogFilter): ExerciseInfo[] {
  return EXERCISE_LIST.filter(
    (info) => (category === "all" || info.category === category) && (!noEquipment || info.equipment === "none"),
  );
}

/** How many exercises each chip would show, honouring the equipment toggle. */
export function categoryCounts(noEquipment: boolean): Record<CategoryFilter, number> {
  const counts = { all: 0, push: 0, pull: 0, legs: 0, core: 0, cardio: 0 } as Record<CategoryFilter, number>;
  for (const info of EXERCISE_LIST) {
    if (noEquipment && info.equipment !== "none") continue;
    counts.all += 1;
    counts[info.category] += 1;
  }
  return counts;
}

export function categoryLabel(category: CategoryFilter): string {
  if (category === "all") return "All";
  return EXERCISE_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/** Short visible badge for the gear an exercise needs, or null when it needs none. */
export function equipmentBadge(equipment: ExerciseEquipment): string | null {
  switch (equipment) {
    case "bar":
      return "Bar";
    case "chair":
      return "Chair";
    case "wall":
      return "Wall";
    default:
      return null;
  }
}

/** Spoken form of the equipment requirement, or null when none is needed. */
export function equipmentPhrase(equipment: ExerciseEquipment): string | null {
  switch (equipment) {
    case "bar":
      return "needs a bar";
    case "chair":
      return "needs a chair or bench";
    case "wall":
      return "needs a wall";
    default:
      return null;
  }
}

export const LEVEL_LABEL: Record<ExerciseLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** 1-3, for the level dots. */
export const LEVEL_RANK: Record<ExerciseLevel, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 };

/**
 * Full accessible name for a workout card link, e.g.
 * "Pull-ups, 8 reps, needs a bar, front camera, advanced".
 */
export function workoutAccessibleName(info: ExerciseInfo): string {
  const parts = [info.name, spokenValue(info.defaultGoal, info.unit)];
  const gear = equipmentPhrase(info.equipment);
  if (gear) parts.push(gear);
  if (info.camera === "front") parts.push("front camera");
  parts.push(info.level);
  return parts.join(", ");
}

export function workoutHref(kind: ExerciseKind): string {
  return `/workout/${kind}`;
}

/** Shown when the user has no history yet: the three original, best-tuned exercises. */
export const QUICK_START_FALLBACK: readonly ExerciseKind[] = Object.freeze(["pushup", "squat", "plank"]);

/**
 * The user's `count` most recent distinct exercises (newest first), topped up from
 * QUICK_START_FALLBACK so the row always has `count` entries.
 */
export function quickStartKinds(
  sessions: ReadonlyArray<{ exercise: ExerciseKind; startedAt: number }>,
  count = 3,
): ExerciseKind[] {
  const picked: ExerciseKind[] = [];
  const newestFirst = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const session of newestFirst) {
    if (picked.length >= count) break;
    if (!isExerciseKind(session.exercise)) continue;
    if (!picked.includes(session.exercise)) picked.push(session.exercise);
  }
  for (const kind of QUICK_START_FALLBACK) {
    if (picked.length >= count) break;
    if (!picked.includes(kind)) picked.push(kind);
  }
  return picked;
}
