import type { GoalUnit } from "@/lib/exercises";

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
export function formatSecondsShort(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
}

/** A value in an exercise unit, for display: reps as an integer, seconds as m:ss. */
export function formatValue(value: number, unit: GoalUnit): string {
  return unit === "seconds" ? formatClock(value * 1000) : String(Math.floor(value));
}

/** Goal text such as "20 reps" or "60 s". */
export function formatGoal(goal: number, unit: GoalUnit): string {
  return unit === "seconds" ? `${goal} s` : `${goal} ${goal === 1 ? "rep" : "reps"}`;
}

/** Screen-reader friendly value, e.g. "12 reps" or "1 minute 5 seconds". */
export function spokenValue(value: number, unit: GoalUnit): string {
  if (unit === "reps") {
    const n = Math.floor(value);
    return `${n} ${n === 1 ? "rep" : "reps"}`;
  }
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  if (s > 0 || m === 0) parts.push(`${s} ${s === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}
