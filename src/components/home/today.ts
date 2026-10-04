/**
 * Pure helpers for the Today screen (no React, unit-tested).
 */

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
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 18) return "Good afternoon";
  return "Good evening";
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
export function formatTimeLeft(deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (!(left > 0)) return "Deadline passed";
  const totalMinutes = Math.floor(left / 60_000);
  if (totalMinutes < 1) return "<1m left";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

/** Spoken form of formatTimeLeft, e.g. "3 hours 12 minutes left". */
export function spokenTimeLeft(deadlineMs: number, nowMs: number): string {
  const left = deadlineMs - nowMs;
  if (!(left > 0)) return "Deadline passed";
  const totalMinutes = Math.floor(left / 60_000);
  if (totalMinutes < 1) return "Less than a minute left";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? "hour" : "hours"}`);
  if (m > 0 || h === 0) parts.push(`${m} ${m === 1 ? "minute" : "minutes"}`);
  return `${parts.join(" ")} left`;
}

/** Goal noun after the big number: "push-ups" for reps, "seconds of plank" for holds. */
export function goalNoun(name: string, unit: "reps" | "seconds", target: number): string {
  if (unit === "seconds") return `${target === 1 ? "second" : "seconds"} of ${name.toLowerCase()}`;
  return name.toLowerCase();
}
