"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon, ExerciseIcon, FlameIcon, HistoryIcon, TrashIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { formatClock, formatValue, timeOfDayFormat } from "@/components/workout/format";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { EXERCISES, EXERCISE_LIST } from "@/lib/exercises";
import { clearSessions, type WorkoutSession } from "@/lib/storage/history";
import { computeStreak, groupSessionsByDay, localDayIndex, type DayGroup } from "@/lib/storage/streak";
import styles from "./HistoryList.module.css";

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" });
const DAY_FORMAT_WITH_YEAR = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
/** When a workout ended; "at 01:07" / "at 1:07 PM", never mistakable for a plank time like "1:07". */
const TIME_FORMAT = timeOfDayFormat();

function dayLabel(group: DayGroup, today: number, nowMs: number): string {
  if (group.day === today) return "Today";
  if (group.day === today - 1) return "Yesterday";
  const sameYear = new Date(group.dayStartMs).getFullYear() === new Date(nowMs).getFullYear();
  return (sameYear ? DAY_FORMAT : DAY_FORMAT_WITH_YEAR).format(group.dayStartMs);
}

/** "22 push-ups · 25 squats · 1:05 plank" for the exercises done that day. */
function dayTotalsText(group: DayGroup): string {
  const parts: string[] = [];
  for (const info of EXERCISE_LIST) {
    const value = group.totals[info.kind];
    if (value <= 0) continue;
    parts.push(
      info.unit === "seconds"
        ? `${formatValue(value, "seconds")} ${info.name.toLowerCase()}`
        : `${Math.floor(value)} ${info.name.toLowerCase()}`,
    );
  }
  return parts.join(" · ");
}

function SessionRow({ session }: { session: WorkoutSession }) {
  const info = EXERCISES[session.exercise];
  const timed = info.unit === "seconds";
  const { summary } = session;
  const value = timed ? formatClock(summary.holdMs) : String(summary.reps);
  const unitLabel = timed ? "held" : summary.reps === 1 ? "rep" : "reps";

  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} data-met={session.goalMet ? "" : undefined}>
        <ExerciseIcon kind={session.exercise} size={24} />
      </span>
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{info.name}</p>
        <p className={styles.rowMeta}>
          at <time dateTime={new Date(session.endedAt).toISOString()}>{TIME_FORMAT.format(session.endedAt)}</time>
          {!timed && summary.rejectedReps > 0 ? <span className={styles.nowrap}> · {summary.rejectedReps} not counted</span> : null}
          {session.goalMet ? (
            <span className={styles.rowGoal}>
              {" "}
              · <CheckIcon size={14} /> Goal met
            </span>
          ) : null}
        </p>
      </div>
      <p className={styles.rowValue}>
        <span className={styles.rowNumber}>{value}</span>
        <span className={styles.rowUnit}>{unitLabel}</span>
      </p>
    </li>
  );
}

export interface HistoryListProps {
  /**
   * Show the streak / workouts summary tiles above the list (default true). The Progress tab
   * turns it off because its own header already shows those stats.
   */
  showSummary?: boolean;
  /** Heading level for each day (default 2; 3 when the list sits under a section heading). */
  dayHeadingLevel?: 2 | 3;
}

/** Local workout history grouped by day, with streak stats and a guarded "Clear history". */
export default function HistoryList({ showSummary = true, dayHeadingLevel = 2 }: HistoryListProps = {}) {
  const DayHeading = dayHeadingLevel === 3 ? "h3" : "h2";
  const sessions = useSessions();
  const hydrated = useHydrated();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);
  const confirmId = useId();

  // Where focus goes after the "Clear history" controls swap, so it never falls to <body>:
  // the Cancel button when the question opens (the safe choice, and the question is read as
  // the group's label), back to "Clear history" on cancel, the empty-state heading after
  // deleting. Set in the click handlers, applied once the new controls are rendered.
  const focusNextRef = useRef<"cancel" | "clear" | "empty" | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const clearRef = useRef<HTMLButtonElement | null>(null);
  const emptyHeadingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const target = focusNextRef.current;
    if (!target) return;
    focusNextRef.current = null;
    const el = target === "cancel" ? cancelRef.current : target === "clear" ? clearRef.current : emptyHeadingRef.current;
    el?.focus();
  });

  if (!hydrated || now === 0) {
    return (
      <p className={styles.loading} role="status">
        Loading your history…
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <section className={styles.empty} aria-labelledby="history-empty-heading">
        <span className={styles.emptyIcon}>
          <HistoryIcon size={32} />
        </span>
        <DayHeading id="history-empty-heading" ref={emptyHeadingRef} tabIndex={-1} className={styles.emptyTitle}>
          No workouts yet
        </DayHeading>
        <p className={styles.emptyText}>
          Finish any workout and it shows up here. Everything stays on this device.
        </p>
        <div className={styles.cta}>
          <Button variant="primary" size="lg" href="/" trailingPlay>
            Start a workout
          </Button>
        </div>
      </section>
    );
  }

  const groups = groupSessionsByDay(sessions);
  const streak = computeStreak(sessions, now);
  const today = localDayIndex(now);

  return (
    <>
      {showSummary ? (
      <dl className={styles.summary}>
        <div className={styles.summaryTile}>
          <dt>Current streak</dt>
          <dd>
            <FlameIcon size={20} className={styles.flame} />
            {streak.current}
            <span className={styles.summaryUnit}>{streak.current === 1 ? "day" : "days"}</span>
          </dd>
        </div>
        <div className={styles.summaryTile}>
          <dt>Best streak</dt>
          <dd>
            {streak.best}
            <span className={styles.summaryUnit}>{streak.best === 1 ? "day" : "days"}</span>
          </dd>
        </div>
        <div className={styles.summaryTile}>
          <dt>Workouts</dt>
          <dd>{sessions.length}</dd>
        </div>
      </dl>
      ) : null}

      <div className={styles.days}>
        {groups.map((group) => {
          const headingId = `day-${group.day}`;
          return (
            <section key={group.day} className={styles.day} aria-labelledby={headingId}>
              <header className={styles.dayHeader}>
                <DayHeading id={headingId} className={styles.dayTitle}>
                  {dayLabel(group, today, now)}
                </DayHeading>
                {group.goalMet ? (
                  <p className={styles.dayBadge}>
                    <CheckIcon size={14} />
                    Goal day
                  </p>
                ) : null}
              </header>
              <p className={styles.dayTotals}>{dayTotalsText(group) || "No verified reps"}</p>
              <ul className={styles.rows} role="list">
                {group.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <div className={styles.clearArea}>
        {confirming ? (
          <div className={styles.confirm} role="group" aria-labelledby={confirmId}>
            <p id={confirmId} className={styles.confirmText}>
              {sessions.length === 1
                ? "Delete this workout from this device?"
                : `Delete all ${sessions.length} workouts from this device?`}{" "}
              This also resets your streak and can&apos;t be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => {
                  focusNextRef.current = "empty";
                  clearSessions();
                  setConfirming(false);
                }}
              >
                <TrashIcon size={20} />
                {sessions.length === 1 ? "Delete" : "Delete all"}
              </button>
              <button
                ref={cancelRef}
                type="button"
                className={styles.cancelButton}
                onClick={() => {
                  focusNextRef.current = "clear";
                  setConfirming(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={clearRef}
            type="button"
            className={styles.clearButton}
            onClick={() => {
              focusNextRef.current = "cancel";
              setConfirming(true);
            }}
          >
            <TrashIcon size={20} />
            Clear history
          </button>
        )}
      </div>
    </>
  );
}
