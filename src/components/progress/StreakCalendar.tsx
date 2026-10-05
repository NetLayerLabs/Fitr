"use client";

import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons/Icons";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Translator } from "@/lib/i18n";
import { CALENDAR_FIRST_MONTH, monthCalendar, type CalendarDay } from "@/lib/storage/awards";
import type { WorkoutSession } from "@/lib/storage/history";
import styles from "./Progress.module.css";

// 2024-01-01 was a Monday: format the 7 weekday names in the user's locale, Monday first.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));

function formatters(locale: string) {
  return {
    narrow: new Intl.DateTimeFormat(locale, { weekday: "narrow" }),
    longWeekday: new Intl.DateTimeFormat(locale, { weekday: "long" }),
    fullDate: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }),
    dayOfMonth: new Intl.DateTimeFormat(locale, { day: "numeric" }),
    monthYear: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }),
    month: new Intl.DateTimeFormat(locale, { month: "long" }),
  };
}

const FIRST = CALENDAR_FIRST_MONTH.year * 12 + CALENDAR_FIRST_MONTH.month;

function status(t: Translator<"progress">, day: CalendarDay): string {
  if (day.isFuture) return t("dayStatusUpcoming");
  if (day.goalMet) return t("dayStatusGoalMet");
  if (day.active) return t("dayStatusActive");
  return day.isToday ? t("dayStatusNotDoneYet") : t("dayStatusNoGoal");
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
  const t = useT("progress");
  const fmt = useMemo(() => formatters(t.locale), [t.locale]);
  const now = new Date(nowMs);
  const last = Math.max(FIRST, now.getFullYear() * 12 + now.getMonth());
  const [picked, setPicked] = useState<number | null>(null);
  const shown = Math.min(last, Math.max(FIRST, picked ?? last));
  const { year, month, weeks, goalDays } = monthCalendar(sessions, nowMs, Math.floor(shown / 12), shown % 12);
  const monthStart = new Date(year, month, 1);
  const label = fmt.monthYear.format(monthStart);

  return (
    <div className={styles.calendarWrap}>
      <div className={styles.calendarNav}>
        <button
          type="button"
          className={styles.calendarNavButton}
          onClick={() => setPicked(shown - 1)}
          disabled={shown <= FIRST}
          aria-label={t("previousMonth")}
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
          aria-label={t("nextMonth")}
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>
      <table className={styles.calendar} aria-labelledby={headingId} aria-describedby={`${headingId}-summary`}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d.getDay()} scope="col" abbr={fmt.longWeekday.format(d)}>
                {fmt.narrow.format(d)}
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
                      <span aria-hidden="true">{fmt.dayOfMonth.format(day.dayStartMs)}</span>
                      <span className="sr-only">
                        {t(day.isToday ? "calendarDayToday" : "calendarDay", {
                          date: fmt.fullDate.format(day.dayStartMs),
                          status: status(t, day),
                        })}
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
        {t.plural("calendarLegend", goalDays, { month: fmt.month.format(monthStart) })}
      </p>
    </div>
  );
}
