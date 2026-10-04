"use client";

import { useNow } from "@/hooks/useSessions";
import { StreakBadge } from "./Streak";
import { formatTodayDate, greetingFor } from "./today";
import styles from "./TodayHeader.module.css";

/** Greeting + date + streak flame. Time-based text appears only after hydration. */
export default function TodayHeader() {
  const now = useNow();
  const ready = now !== 0;

  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <p className={styles.date}>{ready ? formatTodayDate(now) : " "}</p>
        <h1 className={styles.greeting}>{ready ? greetingFor(new Date(now).getHours()) : "Today"}</h1>
      </div>
      <StreakBadge />
    </header>
  );
}
