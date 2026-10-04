"use client";

import { CheckIcon } from "@/components/icons/Icons";
import ExerciseThumb from "@/components/workouts/ExerciseThumb";
import { formatGoal, spokenValue } from "@/components/workout/format";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { EXERCISE_LIST } from "@/lib/exercises";
import { todayProgress } from "@/lib/storage/streak";
import styles from "./TodayActivity.module.css";

/**
 * Compact list of the exercises done today (local history only). With 16 exercises, listing
 * every default goal would read as "do all of these", so only what you actually did shows.
 */
export default function TodayActivity() {
  const sessions = useSessions();
  const hydrated = useHydrated();
  const now = useNow();
  const progress = hydrated && now !== 0 ? todayProgress(sessions, now) : null;
  const done = progress ? EXERCISE_LIST.filter((info) => progress[info.kind].value > 0) : [];

  return (
    <section className={styles.section} aria-labelledby="today-activity-heading">
      <h2 id="today-activity-heading" className={styles.heading}>
        Today&apos;s activity
      </h2>
      {progress === null ? (
        <p className={styles.empty}>Loading…</p>
      ) : done.length === 0 ? (
        <p className={styles.empty}>Nothing logged yet today.</p>
      ) : (
        <ul className={styles.list} role="list">
          {done.map((info) => {
            const value = Math.floor(progress[info.kind].value);
            const hit = value >= info.defaultGoal;
            return (
              <li key={info.kind} className={styles.row}>
                <ExerciseThumb kind={info.kind} size={36} />
                <span className={styles.name}>{info.name}</span>
                <span className={styles.value}>
                  <span aria-hidden="true">{formatGoal(value, info.unit)}</span>
                  <span className="sr-only">{spokenValue(value, info.unit)}</span>
                </span>
                {hit ? (
                  <span className={styles.hit}>
                    <CheckIcon size={16} title="Default goal hit" />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
