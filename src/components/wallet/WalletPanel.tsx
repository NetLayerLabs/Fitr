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

function TestModeBanner() {
  if (!solanaConfig.isTestToken) return null;
  return (
    <p className={styles.testBanner} role="note">
      Developer test mode: Solana {solanaConfig.cluster} with test tokens ({solanaConfig.tokenLabel}). No real
      value.
    </p>
  );
}

function DisconnectButton({ wallet }: { wallet: UiWallet }) {
  const { disconnect, disconnecting } = useDisconnectWallet(wallet);
  return (
    <button type="button" className={styles.secondary} onClick={() => void disconnect()} disabled={disconnecting}>
      {disconnecting ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

function CopyAddress({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className={styles.copyButton}
        aria-label={copied ? "Address copied" : "Copy address"}
        title={copied ? "Copied" : "Copy address"}
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
        {copied ? "Address copied" : ""}
      </span>
    </>
  );
}

function ConnectedWallet({ account, wallet, owner }: { account: UiWalletAccount; wallet: UiWallet | undefined; owner: Address }) {
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
              {wallet ? walletLabel(wallet) : "Wallet"}
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
            View on Explorer
          </a>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="wallet-balance-heading">
        <div className={styles.balanceHead}>
          <h2 id="wallet-balance-heading" className={styles.label}>
            {solanaConfig.tokenLabel} balance
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
            aria-label="Refresh balances"
          >
            <RefreshIcon size={18} />
          </button>
        </div>
        <p className={styles.balance} aria-live="polite" aria-busy={skr.status === "loading" || undefined}>
          {skr.data ? formatSkr(skr.data.amount) : skr.status === "loading" ? "Loading…" : "—"}
        </p>
        {skr.status === "error" ? (
          <p className={styles.error} role="alert">
            Could not load your {solanaConfig.tokenLabel} balance. {skr.error}
          </p>
        ) : null}
        <p className={styles.subtle}>
          SOL for network fees: {sol.data !== null ? formatSol(sol.data) : sol.status === "error" ? "unavailable" : "…"}
        </p>
        {lowSol ? (
          <p className={styles.warn}>
            <AlertIcon size={16} /> Low SOL. Add a little SOL to pay network fees before staking.
          </p>
        ) : null}
      </section>

      <p className={styles.subtle}>
        Fitr never moves funds on its own. Every stake or claim is approved by you in your wallet.
      </p>

      {wallet ? <DisconnectButton wallet={wallet} /> : null}
    </div>
  );
}

/** The /wallet screen body: connect, then account, balances and Seeker status. */
export default function WalletPanel() {
  const { account, wallet, owner } = useSelectedWallet();
  return (
    <div className={styles.stack}>
      <TestModeBanner />
      {account && owner ? (
        <ConnectedWallet account={account} wallet={wallet} owner={owner} />
      ) : (
        <section className={styles.card} aria-labelledby="wallet-connect-heading">
          <h2 id="wallet-connect-heading" className={styles.cardTitle}>
            Connect your wallet
          </h2>
          <p className={styles.subtle}>
            Connect to see your {solanaConfig.tokenLabel} balance and stake on your daily goal.
          </p>
          <ConnectWalletList />
        </section>
      )}
    </div>
  );
}
