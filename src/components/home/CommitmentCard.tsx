"use client";

import { CoinIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { useT } from "@/lib/i18n/I18nProvider";
import { solanaConfig } from "@/lib/solana/config";
import CommitmentWalletRow from "./CommitmentWalletRow";
import { StreakDays } from "./Streak";
import styles from "./CommitmentCard.module.css";

const STEPS = [
  { id: "stake", title: "stepStakeTitle", body: "stepStakeBody" },
  { id: "show-up", title: "stepShowUpTitle", body: "stepShowUpBody" },
  { id: "pay-up", title: "stepPayUpTitle", body: "stepPayUpBody" },
] as const;

/**
 * The $SKR commitment card: explains the mechanic, shows the real local streak and the connected
 * wallet, and sends the user to the Commit tab (which handles connect, Seeker gating, vault
 * availability and the stake flow).
 */
export default function CommitmentCard() {
  const t = useT("today");
  return (
    <section className={styles.card} aria-labelledby="commit-heading">
      <div className={styles.head}>
        <span className={styles.icon}>
          <CoinIcon size={22} />
        </span>
        <h2 id="commit-heading" className={styles.title}>
          {t("commitmentCardTitle")}
        </h2>
      </div>

      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li key={step.id} className={styles.step}>
            <span className={styles.stepIndex} aria-hidden="true">
              {i + 1}
            </span>
            <p>
              <strong className={styles.stepTitle}>{t(step.title)}</strong> {t(step.body)}
            </p>
          </li>
        ))}
      </ol>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>{t("currentStreak")}</dt>
          <dd>
            <StreakDays valueClassName={styles.statValue} />
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>{t("poolMultiplier")}</dt>
          <dd>
            <span className={styles.statValue} aria-hidden="true">
              —
            </span>
            <span className="sr-only">{t("notAvailableYet")}</span>
          </dd>
        </div>
      </dl>

      <CommitmentWalletRow />

      <Button variant="primary" size="lg" block trailingPlay href="/commit" aria-describedby="stake-note">
        {t("commitToken", { token: solanaConfig.tokenLabel })}
      </Button>
      <p id="stake-note" className={styles.note}>
        {t("stakeNote")}
      </p>
    </section>
  );
}
