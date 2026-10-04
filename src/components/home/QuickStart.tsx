"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRightIcon, ExerciseIcon, PlayIcon } from "@/components/icons/Icons";
import { formatGoal } from "@/components/workout/format";
import { quickStartKinds, workoutAccessibleName, workoutHref } from "@/components/workouts/catalog";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { useSessions } from "@/hooks/useSessions";
import { exerciseArt } from "@/lib/exerciseArt";
import { EXERCISES } from "@/lib/exercises";
import styles from "./QuickStart.module.css";

/** Three most recent exercises as horizontal cards, plus a link to the full catalogue. */
export default function QuickStart() {
  const sessions = useSessions();
  const kinds = useMemo(() => quickStartKinds(sessions), [sessions]);

  return (
    <section className={styles.section} aria-labelledby="quick-start-heading">
      <div className={styles.head}>
        <h2 id="quick-start-heading" className={styles.heading}>
          Quick start
        </h2>
        <Link href="/workouts" className={styles.all}>
          All workouts
          <ChevronRightIcon size={18} />
        </Link>
      </div>
      <ul className={styles.list} role="list">
        {kinds.map((kind) => {
          const info = EXERCISES[kind];
          const art = exerciseArt(kind);
          return (
            <li key={kind} className={styles.item}>
              <Link
                href={workoutHref(kind)}
                className={styles.card}
                data-art={art ? "photo" : "icon"}
                aria-label={workoutAccessibleName(info)}
              >
                {/* Below the fold on Today, so lazy; decorative next to the name. */}
                <span className={styles.media} data-framing={art?.framing} aria-hidden="true">
                  {art ? (
                    <ArtPhoto art={art} decorative className={styles.photo} sizes="(max-width: 480px) 31vw, 150px" />
                  ) : (
                    <span className={styles.icon}>
                      <ExerciseIcon kind={kind} size={24} />
                    </span>
                  )}
                </span>
                <span className={styles.name} aria-hidden="true">
                  {info.name}
                </span>
                <span className={styles.foot} aria-hidden="true">
                  <span className={styles.goal}>{formatGoal(info.defaultGoal, info.unit)}</span>
                  <span className={styles.play}>
                    <PlayIcon size={14} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
