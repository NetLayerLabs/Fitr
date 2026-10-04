"use client";

import type { UiWallet } from "@wallet-standard/react";
import { AlertIcon } from "@/components/icons/Icons";
import { sortWallets, useConnectWallet, usePlatform, useSelectedWallet, walletLabel } from "./hooks";
import { WalletIcon } from "./WalletIcon";
import styles from "./Wallet.module.css";

function WalletOption({ wallet }: { wallet: UiWallet }) {
  const { connect, connecting, error } = useConnectWallet(wallet);
  const label = walletLabel(wallet);
  return (
    <li>
      <button
        type="button"
        className={styles.walletOption}
        onClick={() => void connect()}
        disabled={connecting}
        aria-busy={connecting || undefined}
      >
        {wallet.icon ? (
          // Wallet icons are data: URIs from the wallet itself; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={wallet.icon} alt="" width={28} height={28} className={styles.walletOptionIcon} />
        ) : (
          <WalletIcon size={28} />
        )}
        <span className={styles.walletOptionLabel}>{connecting ? "Waiting for wallet…" : label}</span>
      </button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Wallet picker. Connecting happens only when the user taps an option. On Android the phone's
 * own wallet (Mobile Wallet Adapter; Seed Vault on Seeker) is listed first as "Use Installed Wallet".
 */
export default function ConnectWalletList() {
  const platform = usePlatform();
  const { wallets } = useSelectedWallet();

  if (platform === null) return null;

  if (platform === "ios") {
    return (
      <div className={styles.notice} role="note">
        <AlertIcon size={20} />
        <p>
          Wallet connection is not supported on iOS. Fitr staking works on Android, built for the
          Solana Seeker.
        </p>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className={styles.notice} role="note">
        <AlertIcon size={20} />
        <p>
          {platform === "android"
            ? "No Solana wallet app found. Install one (Seeker has one built in), then come back."
            : "No Solana wallet found in this browser. Open Fitr on your Seeker or Android phone."}
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.walletList} role="list" aria-label="Wallets">
      {sortWallets(wallets).map((wallet) => (
        <WalletOption key={wallet.name} wallet={wallet} />
      ))}
    </ul>
  );
}
