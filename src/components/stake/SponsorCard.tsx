"use client";

import { useState } from "react";
import type { Address } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import { SkrAmount } from "@/components/brand/SkrAmount";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Chip, ChipRow } from "@/components/ui/Chip";
import {
  notifyBalancesChanged,
  useSendingSigner,
} from "@/components/wallet/hooks";
import { notifyVaultChanged } from "@/hooks/useVault";
import { SKR_DECIMALS, solanaConfig } from "@/lib/solana/config";
import { formatSkr } from "@/lib/solana/format";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { getPoolAddresses } from "@/lib/solana/vault/addresses";
import { describeTxError, friendlyTxError } from "@/lib/solana/vault/errors";
import {
  getFundReserveInstruction,
  type Pool,
} from "@/lib/solana/vault/generated";
import { userTokenAccount } from "@/lib/solana/vault/instructions";
import { ExplorerLink, TxError, TxProgress } from "./TxStatus";
import { sendVaultTx, type TxStep } from "./txflow";
import type { VaultTxPhase } from "./useVaultTx";
import styles from "./stake.module.css";

/** fund_reserve measured about 40k CU; the simulation re-sizes it anyway. */
const FUND_RESERVE_CU = 80_000;
const PICKS_SKR = [5, 10, 25, 50, 100] as const;
const UNIT = 10n ** BigInt(SKR_DECIMALS);
const fmt = (a: bigint) => formatSkr(a, { maxFractionDigits: 2 });

/** One line for the stake form: "Sponsored: up to 10 SKR extra for today's finishers". */
export function SponsoredNote({
  pool,
}: {
  pool: Pick<Pool, "dailySponsorAmount" | "reserve">;
}) {
  const perDay =
    pool.dailySponsorAmount < pool.reserve
      ? pool.dailySponsorAmount
      : pool.reserve;
  if (pool.dailySponsorAmount === 0n || perDay === 0n) return null;
  return (
    <p className={styles.sponsoredNote} role="note">
      <span className={styles.sponsoredTag}>Sponsored</span>
      <span>
        Up to <SkrAmount value={fmt(perDay)} /> extra per day, shared by the
        people who finish.
      </span>
    </p>
  );
}

/**
 * "Sponsor this pool": anyone deposits SKR into the pool's sponsor reserve (fund_reserve). The
 * program only accepts it while the pool's daily sponsor amount is above 0, so the card hides when
 * sponsoring is closed. Framed as a bonus for showing up, never as yield.
 */
export default function SponsorCard({
  account,
  owner,
  pool,
  crewId,
  crewName,
  balance,
}: {
  account: UiWalletAccount;
  owner: Address;
  pool: Pick<Pool, "dailySponsorAmount" | "reserve">;
  /** 0 / omitted = the global pool. */
  crewId?: bigint;
  crewName?: string | null;
  /** The wallet's SKR balance (base units), when known. */
  balance: bigint | null;
}) {
  const signer = useSendingSigner(account);
  const [pick, setPick] = useState<number>(10);
  const [phase, setPhase] = useState<VaultTxPhase>("idle");
  const [error, setError] = useState<{
    message: string;
    detail: string;
  } | null>(null);
  const [done, setDone] = useState<{
    signature: string;
    amount: bigint;
  } | null>(null);

  if (pool.dailySponsorAmount === 0n) return null;
  const mint = solanaConfig.skrMint;
  const amount = BigInt(pick) * UNIT;
  const tooMuch = balance !== null && amount > balance;
  const busy =
    phase === "preparing" ||
    phase === "simulating" ||
    phase === "signing" ||
    phase === "confirming";
  const who = crewName ? crewName : "the global pool";

  async function sponsor() {
    if (!mint || busy) return;
    setError(null);
    setDone(null);
    setPhase("preparing");
    let step: TxStep = "preparing";
    try {
      const { pool: poolAddress, vault } = await getPoolAddresses(
        mint,
        undefined,
        crewId ?? 0n,
      );
      const ix = getFundReserveInstruction({
        funder: signer,
        pool: poolAddress,
        mint,
        funderToken: await userTokenAccount(owner, mint),
        vault,
        amount,
      });
      const res = await sendVaultTx({
        rpc: getBrowserRpc(),
        signer,
        ixs: [ix],
        unitLimit: FUND_RESERVE_CU,
        onStep: (s) => {
          step = s;
          setPhase(s);
        },
      });
      setDone({ signature: res.signature, amount });
      setPhase("done");
    } catch (err) {
      setError({
        message: friendlyTxError(err, solanaConfig.tokenLabel),
        detail: `step=${step} · ${describeTxError(err)}`,
      });
      setPhase("error");
    } finally {
      notifyVaultChanged();
      notifyBalancesChanged();
    }
  }

  return (
    <Card as="section" padding="md" aria-labelledby="sponsor-title">
      <h2 id="sponsor-title" className={styles.cardTitle}>
        Sponsor {crewName ? crewName : "a day"}
      </h2>
      <p className={styles.sponsorLede}>
        Add an extra bonus for showing up. Your {solanaConfig.tokenLabel} goes
        into the sponsor reserve of {who}, which adds up to{" "}
        <SkrAmount value={fmt(pool.dailySponsorAmount)} /> to each day&apos;s
        bonus, only on days where someone finishes.
      </p>
      <p className={styles.sponsorReserve}>
        Reserve now: <SkrAmount value={fmt(pool.reserve)} />
      </p>

      {done ? (
        <div className={styles.sponsorDone} role="status">
          <p>
            Thank you! <SkrAmount value={fmt(done.amount)} /> now goes to the
            people who show up and finish.
          </p>
          <ExplorerLink signature={done.signature} />
          <Button
            variant="ghost"
            onClick={() => {
              setPhase("idle");
              setDone(null);
            }}
          >
            Sponsor again
          </Button>
        </div>
      ) : (
        <>
          <ChipRow label="Sponsor amount">
            {PICKS_SKR.map((n) => (
              <Chip
                key={n}
                selected={pick === n}
                onClick={() => setPick(n)}
                disabled={busy}
              >
                {n} {solanaConfig.tokenLabel}
              </Chip>
            ))}
          </ChipRow>
          {error ? (
            <TxError
              message={error.message}
              signature={null}
              detail={error.detail}
              onDismiss={() => setError(null)}
            />
          ) : null}
          {busy ? <TxProgress phase={phase} /> : null}
          <Button
            variant="secondary"
            size="lg"
            block
            onClick={sponsor}
            disabled={busy || tooMuch || !mint}
          >
            {tooMuch
              ? `Not enough ${solanaConfig.tokenLabel}`
              : `Sponsor ${pick} ${solanaConfig.tokenLabel}`}
          </Button>
          <p className={styles.fine}>
            A bonus for the people who finish, not an investment: sponsored SKR
            is not returned, and nobody (not Fitr either) can withdraw it from
            the reserve.
          </p>
        </>
      )}
    </Card>
  );
}
