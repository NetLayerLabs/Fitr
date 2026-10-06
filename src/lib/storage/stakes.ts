/**
 * Stakes this device made, so History can show each staked day's outcome after its onchain
 * Commitment account is closed (claim / close_missed close it; only the profile's 64-day
 * completion mask remains). Local only; nothing here is authoritative.
 */
export interface StakeRecord {
  /** Vault day index. */
  day: number;
  /** 0 = global pool. Stored as a decimal string (bigint). */
  crewId: string;
  /** Base units, decimal string. */
  amount: string;
  owner: string;
  at: number;
}

const KEY = "fitr.stakes.v1";
const MAX = 200;

export function loadStakes(): StakeRecord[] {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (r): r is StakeRecord =>
            !!r && typeof r === "object" && Number.isInteger((r as StakeRecord).day) && typeof (r as StakeRecord).amount === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function recordStake(r: Omit<StakeRecord, "at">, now = Date.now()): void {
  const list = loadStakes().filter((x) => !(x.day === r.day && x.crewId === r.crewId && x.owner === r.owner));
  try {
    window.localStorage.setItem(KEY, JSON.stringify([{ ...r, at: now }, ...list].slice(0, MAX)));
  } catch {
    // Private mode: History just won't show this stake's outcome.
  }
}
