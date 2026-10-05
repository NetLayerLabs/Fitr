/**
 * Pure mapping from today's commitment (useTodayCommitment) + streak to what the Android app
 * shows outside the WebView: the home-screen widget (WidgetState) and the clock-in reminders
 * (ReminderPlan). No React, no window: unit-tested on its own.
 */
import type { TodayCommitment } from "@/components/stake/plan";
import { EXERCISES } from "@/lib/exercises";
import { activeLocale, tr, type Translator, type Vars } from "@/lib/i18n";
import { exerciseGoal } from "@/lib/i18n/exercise";
import type { ReminderPlan, WidgetMode, WidgetState } from "@/lib/native/bridge";
import type { ExerciseKind } from "@/lib/pose/types";

/** Notify this many minutes before the deadline. */
export const REMINDER_OFFSETS_MIN: readonly number[] = Object.freeze([120, 30]);

/**
 * The "exercises" translator in the active language, for text built outside render (these labels
 * go to the Android widget and notifications from effects, never into the rendered page).
 */
function exercisesTranslator(): Translator<"exercises"> {
  const t = ((key: string, vars?: Vars) => tr("exercises", key as never, vars)) as Translator<"exercises">;
  t.plural = (key, count, vars) => {
    const all = { count, ...vars };
    const k = `${key}_${new Intl.PluralRules(activeLocale()).select(count)}`;
    const s = tr("exercises", k as never, all);
    return s === k ? tr("exercises", `${key}_other` as never, all) : s;
  };
  t.locale = activeLocale();
  return t;
}

/** "20 push-ups", "60 seconds of plank" (in the app's language); "" when unknown. */
export function goalLabel(exercise: ExerciseKind | undefined, target: number | undefined): string {
  if (!exercise || !target || target <= 0) return "";
  if (!EXERCISES[exercise]) return "";
  return exerciseGoal(exercisesTranslator(), exercise, target);
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
    // {left} stays in the text: the Android app fills it in when each notification fires.
    title: goal ? tr("you", "nativeReminderTitleGoal", { goal }) : tr("you", "nativeReminderTitle"),
    body: stake ? tr("you", "nativeReminderBodyStake", { stake }) : tr("you", "nativeReminderBody"),
    openPath: workoutPath(c.exercise, c.crewId),
  };
}
