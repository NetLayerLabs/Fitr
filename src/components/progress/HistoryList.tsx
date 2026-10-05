"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import ExerciseThumb from "@/components/workouts/ExerciseThumb";
import { CheckIcon, FlameIcon, HistoryIcon, TrashIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import { formatClock, formatValue, nameInSentence, timeOfDayFormat } from "@/components/workout/format";
import { useHydrated, useNow, useSessions } from "@/hooks/useSessions";
import { EXERCISES, EXERCISE_LIST } from "@/lib/exercises";
import { splitAround, SPLIT_MARK } from "@/components/home/today";
import type { Translator } from "@/lib/i18n";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseGoal, exerciseName } from "@/lib/i18n/exercise";
import { clearSessions, type WorkoutSession } from "@/lib/storage/history";
import { computeStreak, groupSessionsByDay, localDayIndex, type DayGroup } from "@/lib/storage/streak";
import styles from "./HistoryList.module.css";

function formatters(locale: string) {
  return {
    day: new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }),
    dayWithYear: new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" }),
    /** When a workout ended; "at 01:07" / "at 1:07 PM", never mistakable for a plank time like "1:07". */
    time: timeOfDayFormat(locale),
  };
}
type Formatters = ReturnType<typeof formatters>;

function dayLabel(t: Translator<"progress">, fmt: Formatters, group: DayGroup, today: number, nowMs: number): string {
  if (group.day === today) return t("dayToday");
  if (group.day === today - 1) return t("dayYesterday");
  const sameYear = new Date(group.dayStartMs).getFullYear() === new Date(nowMs).getFullYear();
  return (sameYear ? fmt.day : fmt.dayWithYear).format(group.dayStartMs);
}

/** "22 push-ups · 25 squats · 1:05 plank" for the exercises done that day. */
function dayTotalsText(t: Translator<"progress">, tx: Translator<"exercises">, group: DayGroup): string {
  const parts: string[] = [];
  for (const info of EXERCISE_LIST) {
    const value = group.totals[info.kind];
    if (value <= 0) continue;
    if (info.unit === "seconds") {
      const exercise = nameInSentence(exerciseName(tx, info.kind), t.locale);
      parts.push(t("holdTotal", { time: formatValue(value, "seconds"), exercise }));
    } else {
      parts.push(exerciseGoal(tx, info.kind, Math.floor(value)));
    }
  }
  return parts.join(" · ");
}

function SessionRow({ session, fmt }: { session: WorkoutSession; fmt: Formatters }) {
  const t = useT("progress");
  const tx = useT("exercises");
  const info = EXERCISES[session.exercise];
  const timed = info.unit === "seconds";
  const { summary } = session;
  const value = timed ? formatClock(summary.holdMs) : String(summary.reps);
  const unitLabel = timed ? t("unitHeld") : t.plural("repUnit", summary.reps);
  const [atBefore, atAfter] = splitAround(t("sessionAt", { time: SPLIT_MARK }));

  return (
    <li className={styles.row}>
      <span className={styles.rowIcon} data-met={session.goalMet ? "" : undefined}>
        <ExerciseThumb kind={session.exercise} size={44} />
      </span>
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{exerciseName(tx, session.exercise)}</p>
        <p className={styles.rowMeta}>
          {atBefore}
          <time dateTime={new Date(session.endedAt).toISOString()}>{fmt.time.format(session.endedAt)}</time>
          {atAfter}
          {!timed && summary.rejectedReps > 0 ? (
            <span className={styles.nowrap}> · {t("notCounted", { count: summary.rejectedReps })}</span>
          ) : null}
          {session.goalMet ? (
            <span className={styles.rowGoal}>
              {" "}
              · <CheckIcon size={14} /> {t("goalMet")}
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
  const t = useT("progress");
  const tx = useT("exercises");
  const fmt = useMemo(() => formatters(t.locale), [t.locale]);
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
        {t("loadingHistory")}
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
          {t("emptyTitle")}
        </DayHeading>
        <p className={styles.emptyText}>
          {t("emptyText")}
        </p>
        <div className={styles.cta}>
          <Button variant="primary" size="lg" href="/" trailingPlay>
            {t("startWorkout")}
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
          <dt>{t("currentStreak")}</dt>
          <dd>
            <FlameIcon size={20} className={styles.flame} />
            {streak.current}
            <span className={styles.summaryUnit}>{t.plural("dayUnit", streak.current)}</span>
          </dd>
        </div>
        <div className={styles.summaryTile}>
          <dt>{t("bestStreak")}</dt>
          <dd>
            {streak.best}
            <span className={styles.summaryUnit}>{t.plural("dayUnit", streak.best)}</span>
          </dd>
        </div>
        <div className={styles.summaryTile}>
          <dt>{t("workoutsLabel")}</dt>
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
                  {dayLabel(t, fmt, group, today, now)}
                </DayHeading>
                {group.goalMet ? (
                  <p className={styles.dayBadge}>
                    <CheckIcon size={14} />
                    {t("goalDay")}
                  </p>
                ) : null}
              </header>
              <p className={styles.dayTotals}>{dayTotalsText(t, tx, group) || t("noVerifiedReps")}</p>
              <ul className={styles.rows} role="list">
                {group.sessions.map((session) => (
                  <SessionRow key={session.id} session={session} fmt={fmt} />
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
              {sessions.length === 1 ? t("confirmDeleteOne") : t("confirmDeleteAll", { count: sessions.length })}{" "}
              {t("confirmResetNote")}
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
                {sessions.length === 1 ? t("deleteOne") : t("deleteAll")}
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
                {t("cancel")}
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
            {t("clearHistory")}
          </button>
        )}
      </div>
    </>
  );
}
