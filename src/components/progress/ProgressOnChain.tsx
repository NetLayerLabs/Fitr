"use client";

import { useSelectedWallet } from "@/components/wallet/hooks";
import { useVault } from "@/hooks/useVault";
import ProgressDashboard, { type ProgressDashboardProps } from "./ProgressDashboard";

/** Onchain verified days for the connected wallet (UserProfile.totalCompleted), or undefined. */
export function verifiedDaysFrom(vault: ReturnType<typeof useVault>): number | undefined {
  return vault.snapshot?.profile?.totalCompleted ?? undefined;
}

/**
 * ProgressDashboard with the "Verified onchain" award fed from the vault read. No wallet (or no
 * profile yet) leaves it undefined, so the award stays locked.
 */
export default function ProgressOnChain(props: Omit<ProgressDashboardProps, "verifiedOnChainDays">) {
  const { owner } = useSelectedWallet();
  const vault = useVault(owner);
  return <ProgressDashboard {...props} verifiedOnChainDays={owner ? verifiedDaysFrom(vault) : undefined} />;
}
