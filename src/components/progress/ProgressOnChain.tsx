"use client";

import { useMemo } from "react";
import { useSelectedWallet } from "@/components/wallet/hooks";
import { useNow, useSessions } from "@/hooks/useSessions";
import { useVault } from "@/hooks/useVault";
import { loadStakes } from "@/lib/storage/stakes";
import ProgressDashboard, { type ProgressDashboardProps } from "./ProgressDashboard";
import { stakeOutcomes } from "./stakeOutcomes";
import { useStakeBackfill } from "./useStakeBackfill";

/** Onchain verified days for the connected wallet (UserProfile.totalCompleted), or undefined. */
export function verifiedDaysFrom(vault: ReturnType<typeof useVault>): number | undefined {
  return vault.snapshot?.profile?.totalCompleted ?? undefined;
}

/**
 * ProgressDashboard with the "Verified onchain" award fed from the vault read. No wallet (or no
 * profile yet) leaves it undefined, so the award stays locked.
 */
export default function ProgressOnChain(props: Omit<ProgressDashboardProps, "verifiedOnChainDays" | "outcomes" | "onchainTotals">) {
  const { owner } = useSelectedWallet();
  const vault = useVault(owner);
  const now = useNow();
  const snapshot = vault.snapshot;
  const sessions = useSessions();
  // Fills the local stake log from the chain for days staked before it existed.
  const backfilled = useStakeBackfill(owner, snapshot?.cfg ? snapshot : null, sessions);
  // History's per-day stake outcome (the local stake log + the profile's completion mask).
  const outcomes = useMemo(
    () => (owner && snapshot?.cfg && now > 0 ? stakeOutcomes(snapshot, loadStakes(), owner, Math.floor(now / 1000)) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `backfilled` re-reads the stake log
    [owner, snapshot, now, backfilled],
  );
  const profile = owner ? snapshot?.profile : null;
  return (
    <ProgressDashboard
      {...props}
      verifiedOnChainDays={owner ? verifiedDaysFrom(vault) : undefined}
      outcomes={outcomes}
      onchainTotals={profile && profile.totalCommitted > 0 ? { verified: profile.totalCompleted, missed: profile.totalMissed } : undefined}
    />
  );
}
