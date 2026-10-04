import { LockIcon, TrophyIcon } from "@/components/icons/Icons";
import type { AwardStatus } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

const DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const NUMBER = new Intl.NumberFormat();

/** Every award; earned ones in lime, locked ones greyed with their progress. */
export default function AwardsGrid({ awards }: { awards: readonly AwardStatus[] }) {
  const earned = awards.filter((a) => a.unlocked).length;
  return (
    <>
      <p className={styles.muted}>
        {earned} of {awards.length} earned
      </p>
      <ul className={styles.awards} role="list">
        {awards.map((a) => (
          <li
            key={a.id}
            className={styles.award}
            data-unlocked={a.unlocked ? "" : undefined}
          >
            <span className={styles.awardIcon} aria-hidden="true">
              {a.unlocked ? <TrophyIcon size={22} /> : <LockIcon size={18} />}
            </span>
            <p className={styles.awardTitle}>
              {a.title}
              <span className="sr-only">{a.unlocked ? " (earned)" : " (locked)"}</span>
            </p>
            <p className={styles.awardText}>{a.description}</p>
            {a.unlocked ? (
              a.unlockedAt !== null ? (
                <p className={styles.awardMeta}>
                  Earned <time dateTime={new Date(a.unlockedAt).toISOString()}>{DATE.format(a.unlockedAt)}</time>
                </p>
              ) : (
                <p className={styles.awardMeta}>Earned</p>
              )
            ) : a.target > 1 ? (
              <div className={styles.awardProgress}>
                <progress
                  className={styles.awardBar}
                  max={a.target}
                  value={a.progress}
                  aria-label={`${a.title} progress`}
                />
                <p className={styles.awardMeta}>
                  {NUMBER.format(a.progress)} / {NUMBER.format(a.target)}
                </p>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
