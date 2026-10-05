/**
 * Workouts the verification server rejected, by their local endedAt (ms). The Today card uses it
 * so a rejected session never shows as "Verifying" (the stake is still open: train again).
 */
const KEY = "fitr.verifyFailed.v1";
const MAX = 50;

function read(): number[] {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is number => typeof x === "number" && Number.isFinite(x)) : [];
  } catch {
    return [];
  }
}

export function markVerificationFailed(endedAt: number): void {
  const list = read();
  if (list.includes(endedAt)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([endedAt, ...list].slice(0, MAX)));
  } catch {
    // Private mode: the 3-minute window in useTodayCommitment still ends "Verifying".
  }
}

export function failedVerificationEndTimes(): ReadonlySet<number> {
  return new Set(read());
}
