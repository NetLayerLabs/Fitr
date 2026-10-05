"use client";

import type { UiWallet } from "@wallet-standard/react";
import { AlertIcon } from "@/components/icons/Icons";
import { sortWallets, useConnectWallet, usePlatform, useSelectedWallet, walletLabel } from "./hooks";
import { WalletIcon } from "./WalletIcon";
import styles from "./Wallet.module.css";
import { useT } from "@/lib/i18n/I18nProvider";

function WalletOption({ wallet }: { wallet: UiWallet }) {
  const t = useT("wallet");
  const { connect, connecting, error } = useConnectWallet(wallet);
  const label = walletLabel(wallet, t);
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
        <span className={styles.walletOptionLabel}>{connecting ? t("waitingForWallet") : label}</span>
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
  const t = useT("wallet");
  const platform = usePlatform();
  const { wallets } = useSelectedWallet();

  if (platform === null) return null;

  if (platform === "ios") {
    return (
      <div className={styles.notice} role="note">
        <AlertIcon size={20} />
        <p>{t("iosUnsupported")}</p>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className={styles.notice} role="note">
        <AlertIcon size={20} />
        <p>
          {platform === "android"
            ? t("noWalletAndroid")
            : t("noWalletBrowser")}
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.walletList} role="list" aria-label={t("walletsLabel")}>
      {sortWallets(wallets).map((wallet) => (
        <WalletOption key={wallet.name} wallet={wallet} />
      ))}
    </ul>
  );
}
