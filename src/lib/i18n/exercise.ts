import type { ExerciseKind } from "@/lib/pose/types";
import {
  EXERCISES,
  SETUP_TIP_COUNT,
  hasRepNote,
  type ExerciseCategory,
  type ExerciseEquipment,
  type ExerciseLevel,
  type Muscle,
} from "@/lib/exercises";
import type { Translator } from "./translate";

type ExKey = Parameters<Translator<"exercises">>[0];

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

export function exerciseTagline(t: Translator<"exercises">, kind: ExerciseKind): string {
  return t(`${kind}_tagline` as ExKey);
}

/** How a rep is counted for alternating exercises ("Each leg counts as one rep."), else null. */
export function exerciseRepNote(t: Translator<"exercises">, kind: ExerciseKind): string | null {
  return hasRepNote(kind) ? t(`${kind}_repNote` as ExKey) : null;
}

/** Where to put the phone, shown before the camera starts (EXERCISES[kind].setupTips). */
export function exerciseSetupTips(t: Translator<"exercises">, kind: ExerciseKind): string[] {
  return Array.from({ length: SETUP_TIP_COUNT }, (_, i) => t(`${kind}_setupTip${i + 1}` as ExKey));
}

/** Main muscles worked, most important first (EXERCISES[kind].muscles). */
export function exerciseMuscles(t: Translator<"exercises">, kind: ExerciseKind): string[] {
  return EXERCISES[kind].muscleIds.map((id) => muscleLabel(t, id));
}

export function muscleLabel(t: Translator<"exercises">, id: Muscle): string {
  return t(`muscle_${id}` as ExKey);
}

/** "Beginner" / "Intermediate" / "Advanced"; `spoken` gives the lowercase form for sentences. */
export function levelLabel(t: Translator<"exercises">, level: ExerciseLevel, spoken = false): string {
  return t(`level_${level}${spoken ? "_spoken" : ""}` as ExKey);
}

/** Short badge for the gear an exercise needs ("Bar"), or null when it needs none. */
export function equipmentLabel(t: Translator<"exercises">, equipment: ExerciseEquipment): string | null {
  return equipment === "none" ? null : t(`equipment_${equipment}` as ExKey);
}

/** Spoken gear requirement ("needs a bar"), or null when none is needed. */
export function equipmentNeeds(t: Translator<"exercises">, equipment: ExerciseEquipment): string | null {
  return equipment === "none" ? null : t(`equipment_${equipment}_needs` as ExKey);
}

/** Alt text of the athlete photo for this exercise (see src/lib/exerciseArt.ts). */
export function exercisePhotoAlt(t: Translator<"exercises">, kind: ExerciseKind): string {
  return t(`${kind}_photoAlt` as ExKey);
}

/**
 * Alt text for any ExerciseArt: the exercise's photo alt when `kind` is given, else the neutral
 * standing portrait's.
 */
export function artAlt(t: Translator<"exercises">, kind: ExerciseKind | null | undefined): string {
  return kind ? exercisePhotoAlt(t, kind) : t("standingPhotoAlt");
}

/** The exercise name as it reads mid-sentence ("push-ups" in "Demonstration of push-ups ..."). */
export function exerciseNameInSentence(t: Translator<"exercises">, kind: ExerciseKind): string {
  return t(`${kind}_nameInSentence` as ExKey);
}
