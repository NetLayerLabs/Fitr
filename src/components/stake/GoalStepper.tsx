"use client";

import { useId, useState } from "react";
import { PlusIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { clampInt, formatHold, goalUnitLabel, stepGoal, type Bounds } from "./form";
import styles from "./stake.module.css";

function MinusIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
    </svg>
  );
}

export interface GoalStepperProps {
  kind: ExerciseKind;
  value: number;
  bounds: Bounds<number>;
  onChange: (value: number) => void;
}

/** − [big numeral] + with the pool's per-exercise min/max; typing a number also works. */
export default function GoalStepper({ kind, value, bounds, onChange }: GoalStepperProps) {
  const info = EXERCISES[kind];
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const unit = goalUnitLabel(info.unit, value);

  const commitDraft = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    onChange(clampInt(Number.isFinite(n) ? n : value, bounds));
    setDraft(null);
  };

  return (
    <div className={styles.stepper}>
      <label htmlFor={id} className={styles.fieldLabel}>
        Daily goal
      </label>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.stepButton}
          aria-label="Decrease goal"
          disabled={value <= bounds.min}
          onClick={() => onChange(stepGoal(info.unit, value, -1, bounds))}
        >
          <MinusIcon />
        </button>
        <div className={styles.stepValue}>
          <input
            id={id}
            className={`numeral ${styles.goalInput}`}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            aria-describedby={`${id}-range`}
            value={draft ?? String(value)}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft();
            }}
          />
          <span className={styles.stepUnit}>{unit}</span>
        </div>
        <button
          type="button"
          className={styles.stepButton}
          aria-label="Increase goal"
          disabled={value >= bounds.max}
          onClick={() => onChange(stepGoal(info.unit, value, 1, bounds))}
        >
          <PlusIcon size={22} />
        </button>
      </div>
      <p id={`${id}-range`} className={styles.hint}>
        {info.unit === "seconds"
          ? `${formatHold(value)} hold · allowed ${formatHold(bounds.min)} to ${formatHold(bounds.max)}`
          : `Allowed ${bounds.min} to ${bounds.max.toLocaleString("en-US")} reps`}
        {info.repNote ? ` · ${info.repNote}` : ""}
      </p>
    </div>
  );
}
