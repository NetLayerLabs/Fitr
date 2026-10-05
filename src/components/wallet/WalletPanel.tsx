"use client";

import { useState } from "react";
import type { UiWallet, UiWalletAccount } from "@wallet-standard/react";
import type { Address } from "@solana/kit";
import { AlertIcon, CheckIcon, CopyIcon, RefreshIcon } from "@/components/icons/Icons";
import { solanaConfig } from "@/lib/solana/config";
import { formatSkr, formatSol, shortenAddress } from "@/lib/solana/format";
import { MIN_SOL_FOR_FEES_LAMPORTS } from "@/lib/solana/skr";
import ConnectWalletList from "./ConnectWalletList";
import SeekerBadge from "./SeekerBadge";
import {
  useDisconnectWallet,
  useSeekerStatus,
  useSelectedWallet,
  useSkrBalance,
  useSolBalance,
  walletLabel,
} from "./hooks";
import { WalletIcon } from "./WalletIcon";
import styles from "./Wallet.module.css";
import { SkrText } from "@/components/brand/SkrAmount";
import { useT } from "@/lib/i18n/I18nProvider";

function TestModeBanner() {
  const t = useT("wallet");
  if (!solanaConfig.isTestToken) return null;
  return (
    <p className={styles.testBanner} role="note">
      {t("testMode", { cluster: solanaConfig.cluster, token: solanaConfig.tokenLabel })}
    </p>
  );
}

function DisconnectButton({ wallet }: { wallet: UiWallet }) {
  const t = useT("wallet");
  const { disconnect, disconnecting } = useDisconnectWallet(wallet);
  return (
    <button type="button" className={styles.secondary} onClick={() => void disconnect()} disabled={disconnecting}>
      {disconnecting ? t("disconnecting") : t("disconnect")}
    </button>
  );
}

function CopyAddress({ value }: { value: string }) {
  const t = useT("wallet");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.copyButton}
        aria-label={copied ? t("addressCopied") : t("copyAddress")}
        title={copied ? t("copied") : t("copyAddress")}
        data-copied={copied ? "" : undefined}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
      >
        {copied ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
      </button>
      <span className="sr-only" role="status">
        {copied ? t("addressCopied") : ""}
      </span>
    </>
  );
}

function ConnectedWallet({ account, wallet, owner }: { account: UiWalletAccount; wallet: UiWallet | undefined; owner: Address }) {
  const t = useT("wallet");
  const skr = useSkrBalance(owner);
  const sol = useSolBalance(owner);
  const seeker = useSeekerStatus(owner);
  const loading = skr.status === "loading" || sol.status === "loading";
  const lowSol = sol.data !== null && sol.data < MIN_SOL_FOR_FEES_LAMPORTS;

  return (
    <div className={styles.stack}>
      <section className={styles.card} aria-labelledby="wallet-account-heading">
        <div className={styles.accountRow}>
          <span className={styles.accountIcon}>
            <WalletIcon size={22} />
          </span>
          <div className={styles.accountText}>
            <h2 id="wallet-account-heading" className={styles.accountName}>
              {wallet ? walletLabel(wallet, t) : t("walletFallbackName")}
            </h2>
            <div className={styles.addressRow}>
              <p className={styles.address} title={account.address}>
                {shortenAddress(account.address, 6)}
              </p>
              <CopyAddress value={account.address} />
            </div>
          </div>
          <SeekerBadge state={seeker} />
        </div>
        <div className={styles.linkRow}>
          <a
            className={styles.linkButton}
            href={solanaConfig.explorerAddressUrl(account.address)}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t("viewOnExplorer")}
          </a>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="wallet-balance-heading">
        <div className={styles.balanceHead}>
          <h2 id="wallet-balance-heading" className={styles.label}>
            {t("balanceTitle", { token: solanaConfig.tokenLabel })}
          </h2>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              skr.refresh();
              sol.refresh();
              seeker.refresh();
            }}
            disabled={loading}
            aria-label={t("refreshBalances")}
          >
            <RefreshIcon size={18} />
          </button>
        </div>
        <p className={styles.balance} aria-live="polite" aria-busy={skr.status === "loading" || undefined}>
          {skr.data ? <SkrText text={formatSkr(skr.data.amount)} /> : skr.status === "loading" ? t("loading") : "—"}
        </p>
        {skr.status === "error" ? (
          <p className={styles.error} role="alert">
            {t("balanceLoadFailed", { token: solanaConfig.tokenLabel, reason: skr.error ?? "" })}
          </p>
        ) : null}
        <p className={styles.subtle}>
          {t("solForFees", {
            amount: sol.data !== null ? formatSol(sol.data) : sol.status === "error" ? t("unavailable") : "…",
          })}
        </p>
        {lowSol ? (
          <p className={styles.warn}>
            <AlertIcon size={16} /> {t("lowSol")}
          </p>
        ) : null}
      </section>

      <p className={styles.subtle}>
        {t("neverMovesFunds")}
      </p>

      {wallet ? <DisconnectButton wallet={wallet} /> : null}
    </div>
  );
}

/** The /wallet screen body: connect, then account, balances and Seeker status. */
export default function WalletPanel() {
  const t = useT("wallet");
  const { account, wallet, owner } = useSelectedWallet();
  return (
    <div className={styles.stack}>
      <TestModeBanner />
      {account && owner ? (
        <ConnectedWallet account={account} wallet={wallet} owner={owner} />
      ) : (
        <section className={styles.card} aria-labelledby="wallet-connect-heading">
          <h2 id="wallet-connect-heading" className={styles.cardTitle}>
            {t("connectTitle")}
          </h2>
          <p className={styles.subtle}>
            {t("connectHint", { token: solanaConfig.tokenLabel })}
          </p>
          <ConnectWalletList />
        </section>
      )}
    </div>
  );
}
