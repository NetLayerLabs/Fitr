/**
 * Plain-text crew labels shared by the app (client) and the public invite page (server). Pure.
 * The app passes its translators; without them (the English-only public invite page) the labels
 * are English.
 */
import { makeTranslator, type Translator } from "@/lib/i18n/translate";
import { en } from "@/lib/i18n/messages";
import { exerciseGoal, exerciseName } from "@/lib/i18n/exercise";
import type { CrewInfo } from "@/lib/solana/vault/crews";

const EN_CREWS = makeTranslator("en", en, "crews");
const EN_EXERCISES = makeTranslator("en", en, "exercises");

/** "20 push-ups for everyone", "Push-ups, everyone sets their own goal" or "Everyone picks…". */
export function challengeLabel(
  c: Pick<CrewInfo, "fixedExercise" | "fixedGoal">,
  t: Translator<"crews"> = EN_CREWS,
  tx: Translator<"exercises"> = EN_EXERCISES,
): string {
  if (!c.fixedExercise) return t("challengeFree");
  if (c.fixedGoal) return t("challengeFixedGoal", { goal: exerciseGoal(tx, c.fixedExercise, c.fixedGoal) });
  return t("challengeFixedExercise", { exercise: exerciseName(tx, c.fixedExercise) });
}

/** The share text for an invite (the link is passed separately to the share sheet). */
export function inviteText(crewName: string, challenge: string, t: Translator<"crews"> = EN_CREWS): string {
  return t("inviteShareText", { name: crewName, challenge });
}
