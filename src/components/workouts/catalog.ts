import { EN_WORKOUT, spokenValue } from "@/components/workout/format";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_LIST,
  type ExerciseCategory,
  type ExerciseEquipment,
  type ExerciseInfo,
  type ExerciseLevel,
} from "@/lib/exercises";
import { makeTranslator, type Translator } from "@/lib/i18n";
import {
  categoryLabel as exerciseCategoryLabel,
  equipmentLabel,
  equipmentNeeds,
  exerciseName,
  levelLabel,
} from "@/lib/i18n/exercise";
import { en } from "@/lib/i18n/messages";
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

/** English translators: the default for callers that do not pass the app's translators. */
const EN_WORKOUTS = makeTranslator("en", en, "workouts");
const EN_EXERCISES = makeTranslator("en", en, "exercises");

/** A chip's label: "All" or the category name, in the app's language when `t`/`tx` are given. */
export function categoryLabel(
  category: CategoryFilter,
  t: Translator<"workouts"> = EN_WORKOUTS,
  tx: Translator<"exercises"> = EN_EXERCISES,
): string {
  return category === "all" ? t("categoryAll") : exerciseCategoryLabel(tx, category);
}

/** Short visible badge for the gear an exercise needs, or null when it needs none. */
export function equipmentBadge(equipment: ExerciseEquipment, tx: Translator<"exercises"> = EN_EXERCISES): string | null {
  return equipmentLabel(tx, equipment);
}

/** Spoken form of the equipment requirement, or null when none is needed. */
export function equipmentPhrase(equipment: ExerciseEquipment, tx: Translator<"exercises"> = EN_EXERCISES): string | null {
  return equipmentNeeds(tx, equipment);
}

/** Level badge labels in English (screens use levelLabel(tx, level) from src/lib/i18n/exercise.ts). */
export const LEVEL_LABEL: Record<ExerciseLevel, string> = {
  beginner: levelLabel(EN_EXERCISES, "beginner"),
  intermediate: levelLabel(EN_EXERCISES, "intermediate"),
  advanced: levelLabel(EN_EXERCISES, "advanced"),
};

/** 1-3, for the level dots. */
export const LEVEL_RANK: Record<ExerciseLevel, 1 | 2 | 3> = { beginner: 1, intermediate: 2, advanced: 3 };

/**
 * Full accessible name for a workout card link, e.g.
 * "Pull-ups, 8 reps, needs a bar, front camera, advanced".
 */
export function workoutAccessibleName(
  info: ExerciseInfo,
  t: Translator<"workouts"> = EN_WORKOUTS,
  tx: Translator<"exercises"> = EN_EXERCISES,
  tw: Translator<"workout"> = EN_WORKOUT,
): string {
  const parts = [exerciseName(tx, info.kind), spokenValue(info.defaultGoal, info.unit, tw)];
  const gear = equipmentPhrase(info.equipment, tx);
  if (gear) parts.push(gear);
  if (info.camera === "front") parts.push(t("frontCameraSpoken"));
  parts.push(levelLabel(tx, info.level, true));
  return parts.join(t("listSeparator"));
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
