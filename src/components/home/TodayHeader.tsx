"use client";

import { useNow } from "@/hooks/useSessions";
import { useT } from "@/lib/i18n/I18nProvider";
import { StreakBadge } from "./Streak";
import { formatTodayDate, greetingFor } from "./today";
import styles from "./TodayHeader.module.css";

/** Greeting + date + streak flame. Time-based text appears only after hydration. */
export default function TodayHeader() {
  const t = useT("today");
  const now = useNow();
  const ready = now !== 0;

  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <p className={styles.date}>{ready ? formatTodayDate(now, t.locale) : " "}</p>
        <h1 className={styles.greeting}>{ready ? greetingFor(t, new Date(now).getHours()) : t("todayTitle")}</h1>
      </div>
      <StreakBadge />
    </header>
  );
}
