import type { Metadata } from "next";
import { Suspense } from "react";
import WorkoutCatalog from "@/components/workouts/WorkoutCatalog";
import WorkoutCatalogRoute from "@/components/workouts/WorkoutCatalogRoute";
import { EXERCISE_LIST } from "@/lib/exercises";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Workouts",
  description: `All ${EXERCISE_LIST.length} Fitr workouts by muscle group, each rep checked by on-device pose AI.`,
};

/**
 * Static page. The URL-bound catalogue reads ?c= with useSearchParams, so it sits in a
 * Suspense boundary whose fallback is the unfiltered catalogue: the prerendered HTML is the
 * full list, and the filter applies on hydration.
 */
export default function WorkoutsPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Workouts</h1>
        <p className={styles.subtitle}>
          {EXERCISE_LIST.length} exercises, every rep verified on your device.
        </p>
      </header>
      <Suspense fallback={<WorkoutCatalog filter={{ category: "all", noEquipment: false }} />}>
        <WorkoutCatalogRoute />
      </Suspense>
    </div>
  );
}
