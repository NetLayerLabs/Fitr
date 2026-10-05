"use client";

import { LockIcon, TrophyIcon } from "@/components/icons/Icons";
import { splitAround, SPLIT_MARK } from "@/components/home/today";
import { useT } from "@/lib/i18n/I18nProvider";
import type { AwardStatus } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

/** Every award; earned ones in lime, locked ones greyed with their progress. */
export default function AwardsGrid({ awards }: { awards: readonly AwardStatus[] }) {
  const t = useT("progress");
  const date = new Intl.DateTimeFormat(t.locale, { month: "short", day: "numeric", year: "numeric" });
  const number = new Intl.NumberFormat(t.locale);
  const [earnedBefore, earnedAfter] = splitAround(t("awardEarnedOn", { date: SPLIT_MARK }));
  const earned = awards.filter((a) => a.unlocked).length;
  return (
    <>
      <p className={styles.muted}>
        {t("awardsEarnedCount", { earned, total: awards.length })}
      </p>
      <ul className={styles.awards} role="list">
        {awards.map((a) => {
          const title = t(a.titleKey);
          return (
          <li
            key={a.id}
            className={styles.award}
            data-unlocked={a.unlocked ? "" : undefined}
          >
            <span className={styles.awardIcon} aria-hidden="true">
              {a.unlocked ? <TrophyIcon size={22} /> : <LockIcon size={18} />}
            </span>
            <p className={styles.awardTitle}>
              {title}
              <span className="sr-only">{a.unlocked ? t("awardEarnedSuffix") : t("awardLockedSuffix")}</span>
            </p>
            <p className={styles.awardText}>{t(a.descriptionKey)}</p>
            {a.unlocked ? (
              a.unlockedAt !== null ? (
                <p className={styles.awardMeta}>
                  {earnedBefore}
                  <time dateTime={new Date(a.unlockedAt).toISOString()}>{date.format(a.unlockedAt)}</time>
                  {earnedAfter}
                </p>
              ) : (
                <p className={styles.awardMeta}>{t("awardEarned")}</p>
              )
            ) : a.target > 1 ? (
              <div className={styles.awardProgress}>
                <progress
                  className={styles.awardBar}
                  max={a.target}
                  value={a.progress}
                  aria-label={t("awardProgressLabel", { title })}
                />
                <p className={styles.awardMeta}>
                  {number.format(a.progress)} / {number.format(a.target)}
                </p>
              </div>
            ) : null}
          </li>
          );
        })}
      </ul>
    </>
  );
}
