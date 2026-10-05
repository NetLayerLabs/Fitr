"use client";

import Link from "next/link";
import ExerciseThumb from "@/components/workouts/ExerciseThumb";

import { formatClock } from "@/components/workout/format";
import { splitAround, SPLIT_MARK } from "@/components/home/today";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseName } from "@/lib/i18n/exercise";
import type { PersonalRecord } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

/** Best single session per exercise. */
export default function PersonalRecords({ records }: { records: readonly PersonalRecord[] }) {
  const t = useT("progress");
  const tx = useT("exercises");
  if (records.length === 0) {
    const [before, after] = splitAround(t("recordsEmpty", { link: SPLIT_MARK }));
    return (
      <p className={styles.muted}>
        {before}
        <Link href="/workouts" className={styles.inlineLink}>
          {t("recordsEmptyLink")}
        </Link>
        {after}
      </p>
    );
  }
  const date = new Intl.DateTimeFormat(t.locale, { month: "short", day: "numeric", year: "numeric" });
  return (
    <ul className={styles.records} role="list">
      {records.map((r) => {
        const timed = r.unit === "seconds";
        return (
          <li key={r.exercise} className={styles.record}>
            <ExerciseThumb kind={r.exercise} size={40} />
            <div className={styles.recordBody}>
              <p className={styles.recordName}>{exerciseName(tx, r.exercise)}</p>
              <p className={styles.recordMeta}>
                <time dateTime={new Date(r.achievedAt).toISOString()}>{date.format(r.achievedAt)}</time>
              </p>
            </div>
            <p className={styles.recordValue}>
              <span className={styles.recordNumber}>{timed ? formatClock(r.holdMs) : r.value}</span>
              <span className={styles.recordUnit}>{timed ? t("unitHeld") : t.plural("repUnit", r.value)}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
