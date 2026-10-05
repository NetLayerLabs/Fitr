import Card from "@/components/ui/Card";
import StatTile from "@/components/ui/StatTile";
import { formatTokenAmount } from "@/lib/solana/format";
import type { DayState } from "@/lib/solana/vault/generated";
import styles from "./stake.module.css";
import { SkrAmount } from "@/components/brand/SkrAmount";

export interface PoolSummaryProps {
  dayState: Pick<DayState, "committedCount" | "completedCount" | "totalStaked"> | null;
  decimals: number;
  label: string;
  /** One line about the user's own slot, e.g. "You're in: 20 push-ups". */
  yourStatus?: string | null;
}

/** Today's pool: how many committed, how much is on the line, how many already verified. */
export default function PoolSummary({ dayState, decimals, label, yourStatus }: PoolSummaryProps) {
  const committed = dayState?.committedCount ?? 0;
  const verified = dayState?.completedCount ?? 0;
  const staked = dayState?.totalStaked ?? 0n;
  return (
    <Card as="section" aria-labelledby="pool-title" padding="md">
      <div className={styles.cardHead}>
        <h2 id="pool-title" className={styles.cardTitle}>
          Today&apos;s pool
        </h2>
        <span className={styles.live}>
          <span className={styles.liveDot} aria-hidden="true" />
          Onchain
        </span>
      </div>
      <div className={styles.stats}>
        <StatTile label="Committed" value={committed.toLocaleString("en-US")} unit={committed === 1 ? "person" : "people"} />
        <StatTile
          label="At stake"
          value={
            <SkrAmount
              value={formatTokenAmount(staked, decimals, { maxFractionDigits: staked >= 10n ** BigInt(decimals + 3) ? 0 : 2 })}
              label={label}
            />
          }
        />
        <StatTile label="Verified" value={verified.toLocaleString("en-US")} unit="so far" />
      </div>
      {yourStatus ? <p className={styles.yourStatus}>{yourStatus}</p> : null}
      {committed === 0 ? <p className={styles.hint}>No one has committed today yet. Be the first.</p> : null}
    </Card>
  );
}
