"use client";

import { useState } from "react";
import ExerciseThumb from "@/components/workouts/ExerciseThumb";

import { Chip, ChipRow } from "@/components/ui/Chip";
import { filterExercises, type CategoryFilter } from "@/components/workouts/catalog";
import { useT } from "@/lib/i18n/I18nProvider";
import { categoryLabel, exerciseName } from "@/lib/i18n/exercise";
import { rich } from "./rich";
import { EXERCISE_CATEGORIES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import styles from "./stake.module.css";

const FILTERS: readonly CategoryFilter[] = ["all", ...EXERCISE_CATEGORIES.map((c) => c.id)];

export interface ExercisePickerProps {
  value: ExerciseKind;
  onChange: (kind: ExerciseKind) => void;
}

/** Category chips + a compact grid of the 16 exercises (single-select radio group). */
export default function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const t = useT("stake");
  const tx = useT("exercises");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const list = filterExercises({ category, noEquipment: false });

  return (
    <div className={styles.picker}>
      <ChipRow label={t("exerciseCategory")}>
        {FILTERS.map((f) => (
          <Chip key={f} selected={f === category} onClick={() => setCategory(f)}>
            {f === "all" ? t("categoryAll") : categoryLabel(tx, f)}
          </Chip>
        ))}
      </ChipRow>
      <div className={styles.exerciseGrid} role="radiogroup" aria-label={t("exerciseGroup")}>
        {list.map((info) => {
          const selected = info.kind === value;
          return (
            <button
              key={info.kind}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`${styles.exercise} ${selected ? styles.exerciseSelected : ""}`}
              onClick={() => onChange(info.kind)}
            >
              <ExerciseThumb kind={info.kind} size={40} />
              <span className={styles.exerciseName}>{exerciseName(tx, info.kind)}</span>
              <span className={styles.exerciseUnit}>{info.unit === "seconds" ? t("unitTimedHold") : t("unitReps")}</span>
            </button>
          );
        })}
      </div>
      {list.every((i) => i.kind !== value) ? (
        <p className={styles.hint}>
          {rich(t("selectedExercise"), { exercise: <strong>{exerciseName(tx, value)}</strong> })}
        </p>
      ) : null}
    </div>
  );
}
