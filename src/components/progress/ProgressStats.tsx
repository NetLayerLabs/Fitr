"use client";

import StatTile from "@/components/ui/StatTile";
import { useT } from "@/lib/i18n/I18nProvider";
import type { ProgressStats as Stats } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

/** Headline numbers: current streak (hero), best streak, this week, total reps. */
export default function ProgressStats({ stats }: { stats: Stats }) {
  const t = useT("progress");
  return (
    <section className={styles.stats} aria-label={t("statsLabel")}>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>{t("currentStreak")}</p>
        <p className={styles.heroValue}>
          <span className={styles.heroNumber} data-zero={stats.currentStreak === 0 || undefined}>
            {stats.currentStreak}
          </span>
          <span className={styles.heroUnit}>{t.plural("dayUnit", stats.currentStreak)}</span>
        </p>
        <p className={styles.heroHint}>
          {stats.todayDone
            ? t("hintTodayDone")
            : stats.currentStreak > 0
              ? t("hintKeepGoing")
              : t("hintStart")}
        </p>
      </div>
      <div className={styles.tiles}>
        <StatTile label={t("bestStreak")} value={stats.bestStreak} unit={t.plural("dayUnit", stats.bestStreak)} />
        <StatTile
          label={t("thisWeek")}
          value={stats.workoutsThisWeek}
          unit={t.plural("workoutUnit", stats.workoutsThisWeek)}
        />
        <StatTile label={t("totalReps")} value={new Intl.NumberFormat(t.locale).format(stats.totalReps)} />
      </div>
    </section>
  );
}
