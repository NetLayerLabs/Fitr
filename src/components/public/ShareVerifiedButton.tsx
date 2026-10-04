"use client";

/**
 * "Share" on the verified-on-chain result: opens the share sheet with the public card
 * https://fitr.day/s/<wallet>/<day> (its preview image is read from the chain). The day is passed
 * in when known; otherwise today's commitment is looked up on tap.
 */
import { useState } from "react";
import { useSelectedWallet } from "@/components/wallet/hooks";
import { loadTodayCommitment } from "@/hooks/useVerifiedSession";
import { shareUrl } from "@/lib/actions/links";
import { solanaConfig } from "@/lib/solana/config";
import { getPoolAddresses } from "@/lib/solana/vault/addresses";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { shareLink, type ShareOutcome } from "./share";
import styles from "./Public.module.css";

export interface ShareVerifiedButtonProps {
  /** Pool day of the verified commitment, when the caller knows it. */
  dayIndex?: number | null;
  /** Crew pool address (omit for the global pool). */
  pool?: string | null;
  /** Crew id of the verified stake; its pool address is derived on tap when `pool` is omitted. */
  crewId?: bigint | null;
  /** e.g. "30 push-ups", for the share text. */
  label?: string | null;
}

const STATUS: Partial<Record<ShareOutcome, string>> = {
  copied: "Link copied. Paste it anywhere.",
  failed: "Couldn't share right now.",
};

function ShareGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}

export default function ShareVerifiedButton({ dayIndex = null, pool = null, crewId = null, label = null }: ShareVerifiedButtonProps) {
  const { owner } = useSelectedWallet();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  if (!owner) return null;

  async function onShare() {
    if (!owner) return;
    setBusy(true);
    setStatus(null);
    try {
      let day = dayIndex;
      let poolParam = pool;
      if (!poolParam && crewId) {
        const mint = solanaConfig.skrMint;
        poolParam = mint ? ((await getPoolAddresses(mint, undefined, crewId).catch(() => null))?.pool ?? null) : null;
        if (!poolParam) {
          setStatus(STATUS.failed ?? null);
          return;
        }
      }
      if (day === null && !crewId) {
        const c = await loadTodayCommitment(getBrowserRpc(), owner, {
          mint: solanaConfig.skrMint,
          nowSecs: Math.floor(Date.now() / 1000),
        }).catch(() => null);
        day = c?.dayIndex ?? null;
      }
      if (day === null) {
        setStatus(STATUS.failed ?? null);
        return;
      }
      const url = shareUrl({ wallet: owner, dayIndex: day, pool: poolParam });
      const outcome = await shareLink(
        {
          url,
          title: "Verified on-chain · Fitr",
          text: label ? `I did ${label} today, verified on-chain with Fitr. Join me tomorrow:` : "My workout is verified on-chain with Fitr. Join me tomorrow:",
        },
        typeof navigator === "undefined" ? undefined : navigator,
      );
      setStatus(STATUS[outcome] ?? null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" className={styles.shareButton} onClick={onShare} disabled={busy}>
        <ShareGlyph />
        Share
      </button>
      {status ? (
        <p className={styles.shareStatus} role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
