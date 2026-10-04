"use client";

import { useState } from "react";
import { ExerciseIcon } from "@/components/icons/Icons";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { categoryLabel, filterExercises, type CategoryFilter } from "@/components/workouts/catalog";
import { EXERCISE_CATEGORIES, EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import styles from "./stake.module.css";

const FILTERS: readonly CategoryFilter[] = ["all", ...EXERCISE_CATEGORIES.map((c) => c.id)];

export interface ExercisePickerProps {
  value: ExerciseKind;
  onChange: (kind: ExerciseKind) => void;
}

/** Category chips + a compact grid of the 16 exercises (single-select radio group). */
export default function ExercisePicker({ value, onChange }: ExercisePickerProps) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const list = filterExercises({ category, noEquipment: false });

  return (
    <div className={styles.picker}>
      <ChipRow label="Exercise category">
        {FILTERS.map((f) => (
          <Chip key={f} selected={f === category} onClick={() => setCategory(f)}>
            {categoryLabel(f)}
          </Chip>
        ))}
      </ChipRow>
      <div className={styles.exerciseGrid} role="radiogroup" aria-label="Exercise">
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
              <ExerciseIcon kind={info.kind} size={26} />
              <span className={styles.exerciseName}>{info.name}</span>
              <span className={styles.exerciseUnit}>{info.unit === "seconds" ? "Timed hold" : "Reps"}</span>
            </button>
          );
        })}
      </div>
      {list.every((i) => i.kind !== value) ? (
        <p className={styles.hint}>
          Selected: <strong>{EXERCISES[value].name}</strong>
        </p>
      ) : null}
    </div>
  );
}
