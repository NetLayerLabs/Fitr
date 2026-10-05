/**
 * Pure helpers for the Today screen (no React, unit-tested).
 */
import type { Translator } from "@/lib/i18n";
import type { GoalUnit } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";

export type TodayState =
  | "loading"
  | "no_wallet"
  | "not_seeker"
  | "vault_unavailable"
  | "can_commit"
  | "committed"
  | "verifying"
  | "verified"
  | "claimable"
  | "missed"
  | "revoked";

const KNOWN_STATES: ReadonlySet<string> = new Set<TodayState>([
  "loading",
  "no_wallet",
  "not_seeker",
  "vault_unavailable",
  "can_commit",
  "committed",
  "verifying",
  "verified",
  "claimable",
  "missed",
  "revoked",
]);

/** Unknown / missing states fall back to the plain "commit" call to action. */
export function normalizeTodayState(state: unknown): TodayState {
  return typeof state === "string" && KNOWN_STATES.has(state) ? (state as TodayState) : "can_commit";
}

/** "Good morning" (05:00–11:59), "Good afternoon" (12:00–17:59), "Good evening" otherwise. */
export function greetingFor(t: Translator<"today">, hour: number): string {
  if (hour >= 5 && hour < 12) return t("greetingMorning");
  if (hour >= 12 && hour < 18) return t("greetingAfternoon");
  return t("greetingEvening");
}

/** "Sunday, 4 October" in the user's locale. */
export function formatTodayDate(nowMs: number, locales?: string | string[]): string {
  return new Intl.DateTimeFormat(locales, { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(nowMs),
  );
}

/**
 * Time left until `deadlineMs`, rounded down to the minute: "3h 12m left", "42m left",
 * "<1m left", or "Deadline passed".
 */
export function formatTimeLeft(t: Translator<"today">, deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (!(left > 0)) return t("deadlinePassed");
  const totalMinutes = Math.floor(left / 60_000);
  if (totalMinutes < 1) return t("timeLeftUnderMinute");
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? t("timeLeftHoursMinutes", { hours, minutes }) : t("timeLeftMinutes", { minutes });
}

/** Spoken form of formatTimeLeft, e.g. "3 hours 12 minutes left". */
export function spokenTimeLeft(t: Translator<"today">, deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (!(left > 0)) return t("deadlinePassed");
  const totalMinutes = Math.floor(left / 60_000);
  if (totalMinutes < 1) return t("spokenUnderMinute");
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(t.plural("spokenHours", h));
  if (m > 0 || h === 0) parts.push(t.plural("spokenMinutes", m));
  return t("spokenLeft", { time: parts.join(" ") });
}

/** Goal text such as "20 reps" or "60 s". */
export function goalAmount(t: Translator<"today">, value: number, unit: GoalUnit): string {
  return t.plural(unit === "seconds" ? "goalSeconds" : "goalReps", value);
}

/** Screen-reader friendly amount, e.g. "12 reps" or "1 minute 5 seconds". */
export function spokenAmount(t: Translator<"today">, value: number, unit: GoalUnit): string {
  if (unit === "reps") return t.plural("goalReps", Math.floor(value));
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (m > 0) parts.push(t.plural("spokenMinutes", m));
  if (s > 0 || m === 0) parts.push(t.plural("spokenSeconds", s));
  return parts.join(" ");
}

const MARK = "\u0000";

/**
 * Splits a translated template around one placeholder, so the caller can render rich content
 * (a styled number, a link) in its place: `splitAround(t("atStake", { amount: MARK }))`.
 */
export function splitAround(text: string): [before: string, after: string] {
  const i = text.indexOf(MARK);
  return i < 0 ? [text, ""] : [text.slice(0, i), text.slice(i + MARK.length)];
}

/** Placeholder value for splitAround. */
export const SPLIT_MARK = MARK;

/**
 * Today's goal phrase split around its number, e.g. ["", " push-ups"] for 20 push-ups, so the
 * number can be styled on its own. Uses the exercises namespace's goal phrase.
 */
export function goalParts(tx: Translator<"exercises">, kind: ExerciseKind, target: number): [string, string] {
  return splitAround(tx.plural(`${kind}_goal`, target, { count: MARK }));
}

/**
 * English-only goal noun: "push-ups" for reps, "seconds of plank" for holds.
 * @deprecated Use goalParts (or exerciseGoal from @/lib/i18n/exercise), which follow the app's language.
 */
export function goalNoun(name: string, unit: "reps" | "seconds", target: number): string {
  if (unit === "seconds") return `${target === 1 ? "second" : "seconds"} of ${name.toLowerCase()}`;
  return name.toLowerCase();
}
