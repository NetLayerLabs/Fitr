import type { CalendarDay } from "@/lib/storage/awards";
import styles from "./Progress.module.css";

// 2024-01-01 was a Monday: format the 7 weekday names in the user's locale, Monday first.
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i));
const NARROW = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });
const LONG_WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const FULL_DATE = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const DAY_OF_MONTH = new Intl.DateTimeFormat(undefined, { day: "numeric" });

function status(day: CalendarDay): string {
  if (day.isFuture) return "upcoming";
  if (day.goalMet) return "goal met";
  if (day.active) return "worked out, goal not met";
  return day.isToday ? "not done yet" : "no goal";
}

/** Last N weeks, Monday first, goal days in lime. A real table so screen readers get rows/columns. */
export default function StreakCalendar({ weeks, headingId }: { weeks: CalendarDay[][]; headingId: string }) {
  const goalDays = weeks.flat().filter((d) => d.goalMet).length;
  return (
    <div className={styles.calendarWrap}>
      <table className={styles.calendar} aria-labelledby={headingId} aria-describedby={`${headingId}-summary`}>
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
          {weeks.map((week) => (
            <tr key={week[0].day}>
              {week.map((day) => (
                <td key={day.day}>
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
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p id={`${headingId}-summary`} className={styles.calendarLegend}>
        <span className={styles.legendSwatch} aria-hidden="true" />
        Goal met on {goalDays} {goalDays === 1 ? "day" : "days"} in the last {weeks.length} weeks
      </p>
    </div>
  );
}
