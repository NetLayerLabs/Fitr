import type { GoalUnit } from "@/lib/exercises";
import { makeTranslator, type Locale, type Translator } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages";

/**
 * The "workout" namespace in English. Helpers below default to it so callers outside this area
 * (and tests) keep working; render code passes its own `useT("workout")`.
 */
export const EN_WORKOUT: Translator<"workout"> = makeTranslator("en", en, "workout");

/**
 * Any display name inside a sentence: lower case, except German nouns. For exercise names prefer
 * exerciseNameInSentence (src/lib/i18n/exercise.ts).
 */
export function nameInSentence(name: string, locale: Locale): string {
  return locale === "de" ? name : name.toLocaleLowerCase(locale);
}

/** "m:ss" (or "h:mm:ss") from milliseconds, flooring to whole seconds. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Formatter for a time of day in the viewer's locale: "1:07 PM" on a 12-hour clock, "13:07" on a
 * 24-hour one. A 24-hour clock always gets a two-digit hour ("01:07"), because "1:07" there has
 * no AM/PM to tell it apart from an m:ss duration from formatClock. Callers still prefix it
 * ("at 01:07") wherever durations are shown nearby.
 */
export function timeOfDayFormat(locales?: string | string[]): Intl.DateTimeFormat {
  const { hourCycle } = new Intl.DateTimeFormat(locales, { hour: "numeric" }).resolvedOptions();
  const twelveHour = hourCycle === "h11" || hourCycle === "h12";
  return new Intl.DateTimeFormat(locales, { hour: twelveHour ? "numeric" : "2-digit", minute: "2-digit" });
}

/** "1.8 s" style duration with one decimal. */
export function formatSecondsShort(ms: number, t: Translator<"workout"> = EN_WORKOUT): string {
  return t("secondsShort", { value: (Math.max(0, ms) / 1000).toFixed(1) });
}

/** A value in an exercise unit, for display: reps as an integer, seconds as m:ss. */
export function formatValue(value: number, unit: GoalUnit): string {
  return unit === "seconds" ? formatClock(value * 1000) : String(Math.floor(value));
}

/** Goal text such as "20 reps" or "60 s". */
export function formatGoal(goal: number, unit: GoalUnit, t: Translator<"workout"> = EN_WORKOUT): string {
  return unit === "seconds" ? t("goalSeconds", { count: goal }) : t.plural("reps", goal);
}

/** Screen-reader friendly value, e.g. "12 reps" or "1 minute 5 seconds". */
export function spokenValue(value: number, unit: GoalUnit, t: Translator<"workout"> = EN_WORKOUT): string {
  if (unit === "reps") return t.plural("reps", Math.floor(value));
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return t.plural("seconds", s);
  const minutes = t.plural("minutes", m);
  return s > 0 ? t("minutesAndSeconds", { minutes, seconds: t.plural("seconds", s) }) : minutes;
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
