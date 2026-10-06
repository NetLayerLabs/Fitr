"use client";

import { useMemo } from "react";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { useT } from "@/lib/i18n/I18nProvider";
import { computeAwards, computeProgressStats, personalRecords } from "@/lib/storage/awards";
import AwardsGrid from "./AwardsGrid";
import HistoryList from "./HistoryList";
import type { StakeOutcome } from "./stakeOutcomes";
import PersonalRecords from "./PersonalRecords";
import ProgressStats from "./ProgressStats";
import StreakCalendar from "./StreakCalendar";
import styles from "./Progress.module.css";

export interface ProgressDashboardProps {
  /**
   * Days verified complete onchain for the connected wallet, when known. Unlocks the
   * "Verified onchain" award; leave undefined until the vault read is wired in.
   */
  verifiedOnChainDays?: number;
  /** Per local day: what happened to that day's stake (see stakeOutcomes.ts). */
  outcomes?: ReadonlyMap<number, StakeOutcome>;
  /** The wallet's onchain totals (UserProfile), when it has staked. */
  onchainTotals?: { verified: number; missed: number };
}

/** The Progress tab: stats, streak calendar, records, awards, then the full history. */
export default function ProgressDashboard({ verifiedOnChainDays, outcomes, onchainTotals }: ProgressDashboardProps) {
  const t = useT("progress");
  const sessions = useSessions();
  const hydrated = useHydrated();
  const now = useNow();
  const ready = hydrated && now !== 0;

  const derived = useMemo(() => {
    if (!ready) return null;
    return {
      stats: computeProgressStats(sessions, now),
      records: personalRecords(sessions),
      awards: computeAwards(sessions, { verifiedOnChainDays }),
    };
  }, [ready, sessions, now, verifiedOnChainDays]);

  if (!derived) {
    return (
      <p className={styles.muted} role="status">
        {t("loadingProgress")}
      </p>
    );
  }

  return (
    <div className={styles.dashboard}>
      <ProgressStats stats={derived.stats} />
      {onchainTotals ? (
        <p className={styles.onchainRecord}>{t("onchainRecord", { verified: onchainTotals.verified, missed: onchainTotals.missed })}</p>
      ) : null}

      <section className={styles.section} aria-labelledby="progress-calendar-heading">
        <h2 id="progress-calendar-heading" className={styles.sectionTitle}>
          {t("streakCalendarHeading")}
        </h2>
        <StreakCalendar sessions={sessions} nowMs={now} headingId="progress-calendar-heading" />
      </section>

      <section className={styles.section} aria-labelledby="progress-records-heading">
        <h2 id="progress-records-heading" className={styles.sectionTitle}>
          {t("personalRecordsHeading")}
        </h2>
        <PersonalRecords records={derived.records} />
      </section>

      <section className={styles.section} aria-labelledby="progress-awards-heading">
        <h2 id="progress-awards-heading" className={styles.sectionTitle}>
          {t("awardsHeading")}
        </h2>
        <AwardsGrid awards={derived.awards} />
      </section>

      <section className={styles.section} aria-labelledby="progress-history-heading">
        <h2 id="progress-history-heading" className={styles.sectionTitle}>
          {t("historyHeading")}
        </h2>
        <HistoryList showSummary={false} dayHeadingLevel={3} outcomes={outcomes} />
      </section>
    </div>
  );
}
