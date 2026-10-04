import StatTile from "@/components/ui/StatTile";
import type { ProgressStats as Stats } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

const NUMBER = new Intl.NumberFormat();

function days(n: number): string {
  return n === 1 ? "day" : "days";
}

/** Headline numbers: current streak (hero), best streak, this week, total reps. */
export default function ProgressStats({ stats }: { stats: Stats }) {
  return (
    <section className={styles.stats} aria-label="Your stats">
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Current streak</p>
        <p className={styles.heroValue}>
          <span className={styles.heroNumber} data-zero={stats.currentStreak === 0 || undefined}>
            {stats.currentStreak}
          </span>
          <span className={styles.heroUnit}>{days(stats.currentStreak)}</span>
        </p>
        <p className={styles.heroHint}>
          {stats.todayDone
            ? "Today's goal is done. See you tomorrow."
            : stats.currentStreak > 0
              ? "Hit today's goal to keep it going."
              : "Hit a daily goal to start a streak."}
        </p>
      </div>
      <div className={styles.tiles}>
        <StatTile label="Best streak" value={stats.bestStreak} unit={days(stats.bestStreak)} />
        <StatTile
          label="This week"
          value={stats.workoutsThisWeek}
          unit={stats.workoutsThisWeek === 1 ? "workout" : "workouts"}
        />
        <StatTile label="Total reps" value={NUMBER.format(stats.totalReps)} />
      </div>
    </section>
  );
}
