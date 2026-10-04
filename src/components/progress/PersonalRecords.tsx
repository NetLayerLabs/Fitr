import Link from "next/link";
import ExerciseThumb from "@/components/workouts/ExerciseThumb";

import { formatClock } from "@/components/workout/format";
import { EXERCISES } from "@/lib/exercises";
import type { PersonalRecord } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

const DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

/** Best single session per exercise. */
export default function PersonalRecords({ records }: { records: readonly PersonalRecord[] }) {
  if (records.length === 0) {
    return (
      <p className={styles.muted}>
        Your best single set of each exercise shows up here. <Link href="/workouts" className={styles.inlineLink}>Pick a workout</Link>{" "}
        to set your first record.
      </p>
    );
  }
  return (
    <ul className={styles.records} role="list">
      {records.map((r) => {
        const info = EXERCISES[r.exercise];
        const timed = r.unit === "seconds";
        return (
          <li key={r.exercise} className={styles.record}>
            <ExerciseThumb kind={r.exercise} size={40} />
            <div className={styles.recordBody}>
              <p className={styles.recordName}>{info.name}</p>
              <p className={styles.recordMeta}>
                <time dateTime={new Date(r.achievedAt).toISOString()}>{DATE.format(r.achievedAt)}</time>
              </p>
            </div>
            <p className={styles.recordValue}>
              <span className={styles.recordNumber}>{timed ? formatClock(r.holdMs) : r.value}</span>
              <span className={styles.recordUnit}>{timed ? "held" : r.value === 1 ? "rep" : "reps"}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
