"use client";

import { useMemo } from "react";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { computeAwards, computeProgressStats, personalRecords, streakCalendar } from "@/lib/storage/awards";
import AwardsGrid from "./AwardsGrid";
import HistoryList from "./HistoryList";
import PersonalRecords from "./PersonalRecords";
import ProgressStats from "./ProgressStats";
import StreakCalendar from "./StreakCalendar";
import styles from "./Progress.module.css";

export interface ProgressDashboardProps {
  /**
   * Days verified complete on-chain for the connected wallet, when known. Unlocks the
   * "Verified on-chain" award; leave undefined until the vault read is wired in.
   */
  verifiedOnChainDays?: number;
  /** Calendar rows (weeks), default 5. */
  calendarWeeks?: number;
}

/** The Progress tab: stats, streak calendar, records, awards, then the full history. */
export default function ProgressDashboard({ verifiedOnChainDays, calendarWeeks = 5 }: ProgressDashboardProps) {
  const sessions = useSessions();
  const hydrated = useHydrated();
  const now = useNow();
  const ready = hydrated && now !== 0;

  const derived = useMemo(() => {
    if (!ready) return null;
    return {
      stats: computeProgressStats(sessions, now),
      weeks: streakCalendar(sessions, now, calendarWeeks),
      records: personalRecords(sessions),
      awards: computeAwards(sessions, { verifiedOnChainDays }),
    };
  }, [ready, sessions, now, calendarWeeks, verifiedOnChainDays]);

  if (!derived) {
    return (
      <p className={styles.muted} role="status">
        Loading your progress…
      </p>
    );
  }

  return (
    <div className={styles.dashboard}>
      <ProgressStats stats={derived.stats} />

      <section className={styles.section} aria-labelledby="progress-calendar-heading">
        <h2 id="progress-calendar-heading" className={styles.sectionTitle}>
          Streak calendar
        </h2>
        <StreakCalendar weeks={derived.weeks} headingId="progress-calendar-heading" />
      </section>

      <section className={styles.section} aria-labelledby="progress-records-heading">
        <h2 id="progress-records-heading" className={styles.sectionTitle}>
          Personal records
        </h2>
        <PersonalRecords records={derived.records} />
      </section>

      <section className={styles.section} aria-labelledby="progress-awards-heading">
        <h2 id="progress-awards-heading" className={styles.sectionTitle}>
          Awards
        </h2>
        <AwardsGrid awards={derived.awards} />
      </section>

      <section className={styles.section} aria-labelledby="progress-history-heading">
        <h2 id="progress-history-heading" className={styles.sectionTitle}>
          History
        </h2>
        <HistoryList showSummary={false} dayHeadingLevel={3} />
      </section>
    </div>
  );
}
