import type { Metadata } from "next";
import { Suspense } from "react";
import WorkoutCatalog from "@/components/workouts/WorkoutCatalog";
import WorkoutCatalogRoute from "@/components/workouts/WorkoutCatalogRoute";
import { EXERCISE_LIST } from "@/lib/exercises";
import { getT } from "@/lib/i18n/server";
import styles from "./page.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("workouts");
  return {
    title: t("pageTitle"),
    description: t("pageDescription", { count: EXERCISE_LIST.length }),
  };
}

/**
 * The URL-bound catalogue reads ?c= with useSearchParams, so it sits in a
 * Suspense boundary whose fallback is the unfiltered catalogue: the prerendered HTML is the
 * full list, and the filter applies on hydration.
 */
export default async function WorkoutsPage() {
  const t = await getT("workouts");
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("pageTitle")}</h1>
        <p className={styles.subtitle}>{t("pageSubtitle", { count: EXERCISE_LIST.length })}</p>
      </header>
      <Suspense fallback={<WorkoutCatalog filter={{ category: "all", noEquipment: false }} />}>
        <WorkoutCatalogRoute />
      </Suspense>
    </div>
  );
}
