"use client";

import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons/Icons";
import { CALENDAR_FIRST_MONTH, monthCalendar, type CalendarDay } from "@/lib/storage/awards";
import type { WorkoutSession } from "@/lib/storage/history";
import styles from "./Progress.module.css";

// 2024-01-01 was a Monday: format the 7 weekday names in the user's locale, Monday first.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));
const NARROW = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const LONG_WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const FULL_DATE = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const DAY_OF_MONTH = new Intl.DateTimeFormat(undefined, { day: "numeric" });
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const MONTH = new Intl.DateTimeFormat(undefined, { month: "long" });

const FIRST = CALENDAR_FIRST_MONTH.year * 12 + CALENDAR_FIRST_MONTH.month;

function status(day: CalendarDay): string {
  if (day.isFuture) return "upcoming";
  if (day.goalMet) return "goal met";
  if (day.active) return "worked out, goal not met";
  return day.isToday ? "not done yet" : "no goal";
}

/**
 * One month at a time, Monday first, goal days in lime; starts at the current month and pages
 * back to October 2026 (launch). A real table so screen readers get rows/columns.
 */
export default function StreakCalendar({
  sessions,
  nowMs,
  headingId,
}: {
  sessions: readonly WorkoutSession[];
  nowMs: number;
  headingId: string;
}) {
  const now = new Date(nowMs);
  const last = Math.max(FIRST, now.getFullYear() * 12 + now.getMonth());
  const [picked, setPicked] = useState<number | null>(null);
  const shown = Math.min(last, Math.max(FIRST, picked ?? last));
  const { year, month, weeks, goalDays } = monthCalendar(sessions, nowMs, Math.floor(shown / 12), shown % 12);
  const monthStart = new Date(year, month, 1);
  const label = MONTH_YEAR.format(monthStart);

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarNav}>
        <button
          type="button"
          className={styles.calendarNavButton}
          onClick={() => setPicked(shown - 1)}
          disabled={shown <= FIRST}
          aria-label="Previous month"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <p className={styles.calendarMonth} aria-live="polite">
          {label}
        </p>
        <button
          type="button"
          className={styles.calendarNavButton}
          onClick={() => setPicked(shown + 1)}
          disabled={shown >= last}
          aria-label="Next month"
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>
      <table className={styles.calendar} aria-labelledby={headingId} aria-describedby={`${headingId}-summary`}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d.getDay()} scope="col" abbr={LONG_WEEKDAY.format(d)}>
                {NARROW.format(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, w) => (
            <tr key={w}>
              {week.map((day, d) => (
                <td key={day?.day ?? `blank-${d}`}>
                  {day && (
                    <span
                      className={styles.calendarDay}
                      data-goal={day.goalMet ? "" : undefined}
                      data-active={day.active ? "" : undefined}
                      data-today={day.isToday ? "" : undefined}
                      data-future={day.isFuture ? "" : undefined}
                    >
                      <span aria-hidden="true">{DAY_OF_MONTH.format(day.dayStartMs)}</span>
                      <span className="sr-only">
                        {FULL_DATE.format(day.dayStartMs)}
                        {day.isToday ? " (today)" : ""}: {status(day)}
                      </span>
                    </span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p id={`${headingId}-summary`} className={styles.calendarLegend}>
        <span className={styles.legendSwatch} aria-hidden="true" />
        Goal met on {goalDays} {goalDays === 1 ? "day" : "days"} in {MONTH.format(monthStart)}
      </p>
    </div>
  );
}
