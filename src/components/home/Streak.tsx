"use client";

import { FlameIcon } from "@/components/icons/Icons";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { useT } from "@/lib/i18n/I18nProvider";
import { computeStreak, type StreakInfo } from "@/lib/storage/streak";
import styles from "./Streak.module.css";

/** Streak from local history; null until hydrated (so SSR never shows a wrong number). */
export function useStreak(): StreakInfo | null {
  const sessions = useSessions();
  const hydrated = useHydrated();
  const now = useNow();
  if (!hydrated || now === 0) return null;
  return computeStreak(sessions, now);
}

/** Header pill: flame + current streak. */
export function StreakBadge() {
  const t = useT("today");
  const streak = useStreak();
  const current = streak?.current ?? null;

  return (
    <p className={styles.badge} data-hot={current !== null && current > 0 ? "" : undefined}>
      <FlameIcon size={18} />
      <span className={styles.value}>{current ?? "–"}</span>
      <span className={styles.unit}>{t("dayStreak")}</span>
    </p>
  );
}

/** Bare number for use inside other cards. */
export function StreakValue({ which = "current" }: { which?: "current" | "best" }) {
  const streak = useStreak();
  return <>{streak ? streak[which] : "–"}</>;
}

/**
 * "<n> day" / "<n> days" for use inside other cards, with the number in its own span (styled
 * by the caller). The unit only appears once the number is known.
 */
export function StreakDays({ which = "current", valueClassName }: { which?: "current" | "best"; valueClassName?: string }) {
  const t = useT("today");
  const streak = useStreak();
  const n = streak ? streak[which] : null;
  return (
    <>
      <span className={valueClassName}>{n ?? "–"}</span>
      {n === null ? null : ` ${t.plural("dayUnit", n)}`}
    </>
  );
}
