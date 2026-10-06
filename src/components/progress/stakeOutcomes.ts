import { dayStart } from "@/lib/solana/vault/day";
import type { VaultSnapshot } from "@/lib/solana/vault/read";
import { deriveUserDayStatus } from "@/lib/solana/vault/status";
import type { StakeRecord } from "@/lib/storage/stakes";
import { localDayIndex } from "@/lib/storage/streak";

/** What happened to a staked day, for History. */
export type StakeOutcomeKind = "open" | "verified" | "claimable" | "missed" | "refunded";

export interface StakeOutcome {
  kind: StakeOutcomeKind;
  /** Base units staked (0 when only the onchain completion mask is known). */
  amount: bigint;
}

type Snapshot = Pick<VaultSnapshot, "entries" | "cfg" | "profile">;

/** Was vault day `day` completed (attested, not revoked), per the profile's 64-day mask? */
export function completedOnchain(profile: Snapshot["profile"], day: number): boolean {
  if (!profile || !profile.hasCompleted) return false;
  const i = profile.lastCompletedDay - day;
  return i >= 0 && i < 64 && ((profile.completedDaysMask >> BigInt(i)) & 1n) === 1n;
}

/**
 * Outcomes of the global-pool days this wallet staked (from the local stake log) plus every day the
 * onchain mask says was completed, keyed by the LOCAL day index History groups sessions by.
 * Open accounts give the exact status; once claim / close_missed closed an account, the mask decides
 * between verified and missed.
 */
export function stakeOutcomes(snapshot: Snapshot, stakes: readonly StakeRecord[], owner: string, nowSecs: number): Map<number, StakeOutcome> {
  const byVaultDay = new Map<number, StakeOutcome>();
  const today = Math.floor((nowSecs - Number(snapshot.cfg.dayOffsetSecs)) / Number(snapshot.cfg.dayLengthSecs));

  for (const s of stakes) {
    if (s.owner !== owner || s.crewId !== "0") continue;
    const amount = BigInt(s.amount);
    const entry = snapshot.entries.find((e) => e.day === s.day && e.commitment);
    let kind: StakeOutcomeKind;
    if (entry) {
      const status = deriveUserDayStatus(entry, snapshot.cfg, nowSecs);
      kind =
        status === "completed_pending"
          ? "verified"
          : status === "claimable"
            ? "claimable"
            : status === "missed"
              ? "missed"
              : status === "revoked"
                ? "refunded"
                : status === "resolved"
                  ? completedOnchain(snapshot.profile, s.day)
                    ? "verified"
                    : "missed"
                  : "open";
    } else if (completedOnchain(snapshot.profile, s.day)) {
      kind = "verified";
    } else {
      kind = s.day < today ? "missed" : "open";
    }
    byVaultDay.set(s.day, { kind, amount });
  }

  const p = snapshot.profile;
  if (p?.hasCompleted) {
    for (let i = 0; i < 64; i++) {
      const day = p.lastCompletedDay - i;
      if (!byVaultDay.has(day) && completedOnchain(p, day)) byVaultDay.set(day, { kind: "verified", amount: 0n });
    }
  }

  const byLocalDay = new Map<number, StakeOutcome>();
  for (const [day, o] of byVaultDay) {
    // A vault day is 24 h in UTC; History groups by the local date, so use the vault day's midpoint.
    byLocalDay.set(localDayIndex((dayStart(day, snapshot.cfg) + Number(snapshot.cfg.dayLengthSecs) / 2) * 1000), o);
  }
  return byLocalDay;
}
