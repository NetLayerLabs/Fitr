"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRightIcon, ExerciseIcon } from "@/components/icons/Icons";
import { formatGoal } from "@/components/workout/format";
import { useSessions } from "@/hooks/useSessions";
import { EXERCISES, EXERCISE_LIST } from "@/lib/exercises";
import CategoryChips from "./CategoryChips";
import WorkoutCard from "./WorkoutCard";
import {
  categoryLabel,
  filterExercises,
  quickStartKinds,
  workoutAccessibleName,
  workoutHref,
  type CategoryFilter,
} from "./catalog";
import styles from "./workouts.module.css";

/**
 * Home "Start a workout" block: quick start (3 most recent exercises), category chips, and a
 * snap-scrolling carousel of compact cards for the chosen category. The full catalogue lives
 * on /workouts.
 */
export default function StartWorkout() {
  const sessions = useSessions();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const quick = useMemo(() => quickStartKinds(sessions), [sessions]);
  const shown = useMemo(() => filterExercises({ category, noEquipment: false }), [category]);
  const label = categoryLabel(category);

  return (
    <section className={styles.start} aria-labelledby="workouts-heading">
      <div className={styles.startHead}>
        <h2 id="workouts-heading" className={styles.startTitle}>
          Start a workout
        </h2>
        <Link href="/workouts" className={styles.browseLink}>
          Browse all {EXERCISE_LIST.length}
          <ChevronRightIcon size={18} />
        </Link>
      </div>

      <div className={styles.quick}>
        <h3 className={styles.quickTitle} id="quick-start-heading">
          Quick start
        </h3>
        <ul className={styles.quickList} role="list" aria-labelledby="quick-start-heading">
          {quick.map((kind) => {
            const info = EXERCISES[kind];
            return (
              <li key={kind}>
                <Link
                  href={workoutHref(kind)}
                  className={styles.quickItem}
                  data-kind={kind}
                  aria-label={workoutAccessibleName(info)}
                >
                  <span className={styles.quickIcon} aria-hidden="true">
                    <ExerciseIcon kind={kind} size={22} />
                  </span>
                  <span className={styles.quickBody} aria-hidden="true">
                    <span className={styles.quickName}>{info.name}</span>
                    <span className={styles.quickGoal}>{formatGoal(info.defaultGoal, info.unit)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <CategoryChips value={category} onChange={setCategory} label="Workout category" />

      <div
        className={styles.carousel}
        role="region"
        aria-label={`${label} workouts, ${shown.length}, scroll sideways for more`}
        tabIndex={0}
      >
        {/* Keyed by category so a new filter starts scrolled to its first card. */}
        <ul key={category} className={styles.carouselList} role="list">
          {shown.map((info) => (
            <li key={info.kind} className={styles.carouselItem}>
              <WorkoutCard info={info} variant="compact" />
            </li>
          ))}
          {category !== "all" ? (
            <li className={styles.carouselItem}>
              <Link href={`/workouts?c=${category}`} className={styles.seeAllCard}>
                <span>All {label}</span>
                <ChevronRightIcon size={20} />
              </Link>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
