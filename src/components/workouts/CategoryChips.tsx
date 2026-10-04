"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { EXERCISE_CATEGORIES } from "@/lib/exercises";
import { categoryLabel, type CategoryFilter } from "./catalog";
import styles from "./workouts.module.css";

const FILTERS: readonly CategoryFilter[] = ["all", ...EXERCISE_CATEGORIES.map((c) => c.id)];

export interface CategoryChipsProps {
  value: CategoryFilter;
  onChange?: (value: CategoryFilter) => void;
  /** Accessible name of the chip group. */
  label: string;
  /** Workout count per chip; shown as a small number when given. */
  counts?: Record<CategoryFilter, number>;
  /** Extra toggle chips rendered after the categories (e.g. "No equipment"). */
  children?: ReactNode;
}

/**
 * Horizontally scrolling row of category toggle buttons (aria-pressed, exactly one pressed).
 * Plain buttons rather than a radiogroup so Tab reaches every chip without arrow-key handling.
 */
export default function CategoryChips({ value, onChange, label, counts, children }: CategoryChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  // Keep the selected chip in view (e.g. /workouts?c=cardio opens with "Cardio" off-screen).
  // Scrolls only the chip row, never the page.
  useEffect(() => {
    const row = rowRef.current;
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!row || !chip || typeof row.scrollTo !== "function") return;
    const left = chip.offsetLeft - row.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left >= row.scrollLeft && right <= row.scrollLeft + row.clientWidth) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: Math.max(0, left - (row.clientWidth - chip.offsetWidth) / 2), behavior: reduce ? "auto" : "smooth" });
  }, [value]);

  return (
    <div ref={rowRef} className={styles.chips} role="group" aria-label={label}>
      {FILTERS.map((filter) => {
        const name = categoryLabel(filter);
        const count = counts?.[filter];
        const pressed = filter === value;
        return (
          <button
            key={filter}
            type="button"
            className={styles.chip}
            aria-pressed={pressed}
            aria-label={count === undefined ? undefined : `${name}, ${count} ${count === 1 ? "workout" : "workouts"}`}
            data-filter={filter}
            onClick={() => onChange?.(filter)}
          >
            {name}
            {count === undefined ? null : (
              <span className={styles.chipCount} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
      {children}
    </div>
  );
}
