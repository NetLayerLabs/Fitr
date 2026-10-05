import { CoinIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { solanaConfig } from "@/lib/solana/config";
import CommitmentWalletRow from "./CommitmentWalletRow";
import { StreakDays } from "./Streak";
import styles from "./CommitmentCard.module.css";

const STEPS = [
  {
    title: "Stake",
    body: "Pick your daily goal and how much SKR to lock. Both are fixed onchain when you commit.",
  },
  {
    title: "Show up",
    body: "Hit your goal, counted on-device by pose tracking and re-checked by Fitr's verifier. Your stake comes back plus a share of the pool.",
  },
  {
    title: "Or pay up",
    body: "Miss it and your stake goes to the people who showed up, minus a 5% fee.",
  },
] as const;

/**
 * The $SKR commitment card: explains the mechanic, shows the real local streak and the connected
 * wallet, and sends the user to the Commit tab (which handles connect, Seeker gating, vault
 * availability and the stake flow).
 */
export default function CommitmentCard() {
  return (
    <section className={styles.card} aria-labelledby="commit-heading">
      <div className={styles.head}>
        <span className={styles.icon}>
          <CoinIcon size={22} />
        </span>
        <h2 id="commit-heading" className={styles.title}>
          Daily $SKR Commitment
        </h2>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.stepIndex} aria-hidden="true">
              {i + 1}
            </span>
            <p>
              <strong className={styles.stepTitle}>{step.title}.</strong> {step.body}
            </p>
          </li>
        ))}
      </ol>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Current streak</dt>
          <dd>
            <StreakDays valueClassName={styles.statValue} />
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Pool multiplier</dt>
          <dd>
            <span className={styles.statValue} aria-hidden="true">
              —
            </span>
            <span className="sr-only">Not available yet</span>
          </dd>
        </div>
      </dl>

      <CommitmentWalletRow />

      <Button variant="primary" size="lg" block trailingPlay href="/commit" aria-describedby="stake-note">
        Commit {solanaConfig.tokenLabel}
      </Button>
      <p id="stake-note" className={styles.note}>
        You choose the goal and the stake. Nothing is staked until you sign in your wallet.
      </p>
    </section>
  );
}
