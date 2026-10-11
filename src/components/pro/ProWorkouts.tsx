"use client";

import { useState } from "react";
import { LockIcon } from "@/components/icons/Icons";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { exerciseArt } from "@/lib/exerciseArt";
import { useT } from "@/lib/i18n/I18nProvider";
import workoutStyles from "@/components/workouts/workouts.module.css";
import styles from "./pro.module.css";

/**
 * Advanced moves planned for Fitr Pro: shown locked, with no engine behind them yet. Each borrows
 * the photo of the closest move in the catalogue, so the cards match the rest of the grid.
 */
export const PRO_WORKOUTS = [
  { id: "pistolSquat", art: "squat" },
  { id: "handstandPushup", art: "pike_pushup" },
  { id: "plankToPushup", art: "plank" },
  { id: "burpeeLadder", art: "burpee" },
] as const;

type ProWorkoutId = (typeof PRO_WORKOUTS)[number]["id"];

/** "Fitr Pro · Coming soon": locked cards at the end of the catalogue; a tap explains, nothing more. */
export default function ProWorkouts() {
  const t = useT("pro");
  const [picked, setPicked] = useState<ProWorkoutId | null>(null);

  return (
    <section className={workoutStyles.catSection} aria-labelledby="cat-pro">
      <div className={workoutStyles.catHead}>
        <h2 id="cat-pro" className={`${workoutStyles.catTitle} ${styles.title}`}>
          {t("name")}
          <span className={styles.soon}>{t("comingSoon")}</span>
        </h2>
        <p className={workoutStyles.catDescription}>{t("workoutsLede")}</p>
      </div>
      <ul className={workoutStyles.grid} role="list">
        {PRO_WORKOUTS.map(({ id, art: kind }) => {
          const art = exerciseArt(kind);
          return (
            <li key={id} className={workoutStyles.gridItem}>
              <button
                type="button"
                className={`${workoutStyles.card} ${styles.card}`}
                data-variant="grid"
                aria-pressed={picked === id}
                aria-label={t("lockedLabel", { name: t(id) })}
                onClick={() => setPicked(picked === id ? null : id)}
              >
                <span
                  className={`${workoutStyles.cardMedia} ${styles.media}`}
                  data-art={art ? "photo" : "icon"}
                  data-framing={art?.framing}
                  aria-hidden="true"
                >
                  {art ? (
                    <ArtPhoto art={art} decorative className={workoutStyles.cardPhoto} sizes="(max-width: 480px) 46vw, 240px" />
                  ) : null}
                  <span className={styles.lock}>
                    <LockIcon size={16} />
                  </span>
                </span>
                <span className={workoutStyles.cardBody} aria-hidden="true">
                  <span className={workoutStyles.cardName}>{t(id)}</span>
                  <span className={workoutStyles.cardTagline}>{t(`${id}Tag`)}</span>
                  <span className={workoutStyles.cardMeta}>
                    <span className={styles.proBadge}>{t("name")}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className={styles.note} role="status">
        {picked ? (
          <>
            <LockIcon size={16} aria-hidden="true" />
            {t("lockedNote", { name: t(picked) })}
          </>
        ) : null}
      </p>
    </section>
  );
}
