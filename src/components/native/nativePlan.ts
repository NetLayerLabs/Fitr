/**
 * Pure mapping from today's commitment (useTodayCommitment) + streak to what the Android app
 * shows outside the WebView: the home-screen widget (WidgetState) and the clock-in reminders
 * (ReminderPlan). No React, no window: unit-tested on its own.
 */
import { goalNoun } from "@/components/home/today";
import type { TodayCommitment } from "@/components/stake/plan";
import { EXERCISES } from "@/lib/exercises";
import type { ReminderPlan, WidgetMode, WidgetState } from "@/lib/native/bridge";
import type { ExerciseKind } from "@/lib/pose/types";

/** Notify this many minutes before the deadline. */
export const REMINDER_OFFSETS_MIN: readonly number[] = Object.freeze([120, 30]);

/** "20 push-ups", "60 seconds of plank"; "" when unknown. */
export function goalLabel(exercise: ExerciseKind | undefined, target: number | undefined): string {
  if (!exercise || !target || target <= 0) return "";
  const info = EXERCISES[exercise];
  if (!info) return "";
  return `${target} ${goalNoun(info.name, info.unit, target)}`;
}

/** /workout/<exercise>, plus ?crew=<id> for a crew stake so the right pool is verified. */
function workoutPath(exercise: ExerciseKind | undefined, crewId?: string): string {
  if (!exercise) return "/";
  return crewId && /^[1-9][0-9]*$/.test(crewId) ? `/workout/${exercise}?crew=${crewId}` : `/workout/${exercise}`;
}

/**
 * The widget state for a commitment, or null while it is still loading (keep showing the last
 * known state rather than flashing "none").
 */
export function widgetStateFor(c: TodayCommitment, streak: number): WidgetState | null {
  if (c.state === "loading") return null;
  const base = {
    streak: Math.max(0, Math.floor(streak)),
    goalLabel: goalLabel(c.exercise, c.goalTarget),
    stakeLabel: c.amountLabel ?? "",
    deadlineMs: c.deadlineMs ?? 0,
  };
  let mode: WidgetMode;
  let openPath = "/";
  switch (c.state) {
    case "can_commit":
      mode = "commit";
      openPath = "/commit";
      break;
    case "committed":
      mode = "committed";
      openPath = workoutPath(c.exercise, c.crewId);
      break;
    case "verifying":
      mode = "verifying";
      break;
    case "verified":
      mode = "verified";
      break;
    case "claimable":
      mode = "claimable";
      // The widget's claim line shows what is waiting, not today's (absent) stake.
      base.stakeLabel = c.claimableLabel ?? "";
      break;
    case "missed":
      mode = "missed";
      openPath = "/commit";
      break;
    default:
      // no_wallet, not_seeker, vault_unavailable (pool not deployed yet), revoked.
      mode = "none";
      base.goalLabel = "";
      base.stakeLabel = "";
      base.deadlineMs = 0;
  }
  return { mode, openPath, ...base };
}

/**
 * Clock-in reminders for an open, unverified commitment with a future deadline; null means
 * "cancel any scheduled reminders".
 */
export function reminderPlanFor(c: TodayCommitment, nowMs: number): ReminderPlan | null {
  if (c.state !== "committed") return null;
  if (!c.deadlineMs || !(c.deadlineMs > nowMs)) return null;
  const goal = goalLabel(c.exercise, c.goalTarget);
  const stake = c.amountLabel ?? "";
  return {
    deadlineMs: c.deadlineMs,
    offsetsMin: [...REMINDER_OFFSETS_MIN],
    title: goal ? `{left} left: ${goal}` : "{left} left to clock in",
    body: stake
      ? `Finish today or your ${stake} stake goes to the people who showed up.`
      : "Finish today's workout before the deadline.",
    openPath: workoutPath(c.exercise, c.crewId),
  };
}
