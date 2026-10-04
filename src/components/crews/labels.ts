/**
 * Plain-text crew labels shared by the app (client) and the public invite page (server). Pure.
 */
import { formatGoal } from "@/components/stake/form";
import { EXERCISES } from "@/lib/exercises";
import type { CrewInfo } from "@/lib/solana/vault/crews";

/** "20 push-ups for everyone", "Push-ups, everyone sets their own goal" or "Everyone picks…". */
export function challengeLabel(c: Pick<CrewInfo, "fixedExercise" | "fixedGoal">): string {
  if (!c.fixedExercise) return "Everyone picks their own workout";
  if (c.fixedGoal) return `${formatGoal(c.fixedExercise, c.fixedGoal)} for everyone`;
  return `${EXERCISES[c.fixedExercise].name}, everyone sets their own goal`;
}

/** The share text for an invite (the link is passed separately to the share sheet). */
export function inviteText(crewName: string, challenge: string): string {
  return `Join my Fitr crew "${crewName}". ${challenge}. Stake SKR on showing up: no-shows fund the people who do.`;
}
