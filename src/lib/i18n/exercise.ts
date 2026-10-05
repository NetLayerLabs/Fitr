import type { ExerciseKind } from "@/lib/pose/types";
import type { ExerciseCategory } from "@/lib/exercises";
import type { Translator } from "./translate";

/**
 * Exercise names and goal phrases in the app's language, from the "exercises" namespace.
 * `const tx = useT("exercises"); exerciseName(tx, "pushup")` -> "Push-ups";
 * `exerciseGoal(tx, "pushup", 20)` -> "20 push-ups"; plank -> "45 seconds of plank".
 */
export function exerciseName(t: Translator<"exercises">, kind: ExerciseKind): string {
  return t(`${kind}_name` as Parameters<Translator<"exercises">>[0]);
}

export function exerciseGoal(t: Translator<"exercises">, kind: ExerciseKind, count: number): string {
  return t.plural(`${kind}_goal`, count);
}

export function categoryLabel(t: Translator<"exercises">, id: ExerciseCategory): string {
  return t(`category_${id}` as Parameters<Translator<"exercises">>[0]);
}

export function categoryDescription(t: Translator<"exercises">, id: ExerciseCategory): string {
  return t(`category_${id}_description` as Parameters<Translator<"exercises">>[0]);
}
