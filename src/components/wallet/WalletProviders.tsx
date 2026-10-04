"use client";

import { useEffect, type ReactNode } from "react";
import { SelectedWalletAccountContextProvider } from "@solana/react";
import type { UiWallet } from "@wallet-standard/react";
import { solanaConfig } from "@/lib/solana/config";
import { ensureMwaRegistered } from "@/lib/solana/mwa";

export const SELECTED_WALLET_STORAGE_KEY = "fitr:wallet:selected";

/** Only wallets that can sign-and-send on the configured cluster (mainnet in production). */
export function filterWallets(wallet: UiWallet): boolean {
  return wallet.features.includes("solana:signAndSendTransaction") && wallet.chains.includes(solanaConfig.chain);
}

/** Module-level so the provider's effects see a stable object. Storage failures are ignored. */
const stateSync = {
  getSelectedWallet(): string | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(SELECTED_WALLET_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  storeSelectedWallet(accountKey: string): void {
    try {
      window.localStorage.setItem(SELECTED_WALLET_STORAGE_KEY, accountKey);
    } catch {
      // Private mode / blocked storage: selection just won't persist.
    }
  },
  deleteSelectedWallet(): void {
    try {
      window.localStorage.removeItem(SELECTED_WALLET_STORAGE_KEY);
    } catch {
      // Ignore.
    }
  },
};

/**
 * App-wide wallet context. Registers the Mobile Wallet Adapter once (guarded, so StrictMode's
 * double effect is harmless) and remembers the selected account across visits. It never connects
 * on its own: a remembered account is only restored if the wallet still reports it authorized.
 */
export default function WalletProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensureMwaRegistered();
  }, []);

  return (
    <SelectedWalletAccountContextProvider filterWallets={filterWallets} stateSync={stateSync}>
      {children}
    </SelectedWalletAccountContextProvider>
  );
}
