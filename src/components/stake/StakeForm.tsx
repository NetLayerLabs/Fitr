"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import type { ExerciseKind } from "@/lib/pose/types";
import { dayEnd, type DayConfig } from "@/lib/solana/vault/day";
import type { Pool } from "@/lib/solana/vault/generated";
import { formatTokenAmount } from "@/lib/solana/format";
import AmountField from "./AmountField";
import ExercisePicker from "./ExercisePicker";
import GoalStepper from "./GoalStepper";
import { checkAmount, clampInt, defaultGoal, formatGoal, goalBounds } from "./form";
import styles from "./stake.module.css";
import { SkrText } from "@/components/brand/SkrAmount";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseName } from "@/lib/i18n/exercise";
import { rich } from "./rich";

export interface StakeSubmit {
  exercise: ExerciseKind;
  goalTarget: number;
  amount: bigint;
}

export interface StakeFormProps {
  pool: Pick<Pool, "goalLimits" | "minStake" | "maxStake" | "feeBps">;
  cfg: DayConfig;
  /** The day this commitment lands on. */
  targetDay: number;
  isTomorrow: boolean;
  decimals: number;
  label: string;
  balance: bigint | null;
  /** Not enough SOL for fees + rent: blocks submit with an explanation. */
  solShortfall: string | null;
  /** e.g. "≈ 52.3 SKR from yesterday": the same signature also claims it. */
  bundledClaim: string | null;
  busy: boolean;
  initialExercise?: ExerciseKind;
  /** A crew's fixed exercise: shown locked instead of the picker. */
  fixedExercise?: ExerciseKind | null;
  /** A crew's fixed goal (needs fixedExercise): shown locked instead of the stepper. */
  fixedGoal?: number | null;
  /** e.g. "Run Club": the form commits into this crew. */
  crewName?: string | null;
  onSubmit: (v: StakeSubmit) => void;
}

/** "Mon 23:59" style local time for an instant in ms (pass `t.locale` for the app language). */
export function formatLocalDeadline(ms: number, locales?: string | string[]): string {
  return new Intl.DateTimeFormat(locales, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function formatFeePercent(feeBps: number): string {
  const pct = feeBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}

export default function StakeForm(p: StakeFormProps) {
  const t = useT("stake");
  const tx = useT("exercises");
  const g = { t, tx };
  const fixedKind = p.fixedExercise ?? null;
  const fixedGoal = fixedKind ? (p.fixedGoal ?? null) : null;
  const [pickedKind, setKind] = useState<ExerciseKind>(fixedKind ?? p.initialExercise ?? "pushup");
  const kind = fixedKind ?? pickedKind;
  const [goal, setGoal] = useState(() => fixedGoal ?? defaultGoal(p.pool, kind));
  const [amountText, setAmountText] = useState("");
  const [touched, setTouched] = useState(false);

  const bounds = goalBounds(p.pool, kind);
  const safeGoal = fixedGoal ?? clampInt(goal, bounds);
  const check = checkAmount(amountText, p.pool, p.balance, p.decimals);
  // The program rejects commits after day_start + cutoff; the workout itself must land before day end.
  const finishByMs = dayEnd(p.targetDay, p.cfg) * 1000 - 1000;
  const fee = formatFeePercent(p.pool.feeBps);
  const amountLabel = check.ok ? `${formatTokenAmount(check.amount, p.decimals, { maxFractionDigits: 2 })} ${p.label}` : null;
  const submitLabel = p.bundledClaim
    ? amountLabel
      ? t("submitClaimCommitAmount", { amount: amountLabel })
      : t("submitClaimCommit")
    : amountLabel
      ? t("submitCommitAmount", { amount: amountLabel })
      : t("submitCommit");

  const pick = (k: ExerciseKind) => {
    setKind(k);
    setGoal(defaultGoal(p.pool, k));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!check.ok || p.solShortfall || p.busy) return;
    p.onSubmit({ exercise: kind, goalTarget: safeGoal, amount: check.amount });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby="stake-form-title">
      <div className={styles.formHead}>
        <p className={styles.eyebrow}>{p.isTomorrow ? t("tomorrow") : t("today")}</p>
        <h2 id="stake-form-title" className={styles.sectionTitle}>
          {p.crewName ? t("formTitleCrew") : t("formTitle")}
        </h2>
      </div>

      <section className={styles.step} aria-label={t("stepExerciseAria")}>
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">1</span>{" "}
          {fixedKind ? t("crewExercise") : t("pickExercise")}
        </h3>
        {fixedKind ? (
          <p className={styles.locked} data-testid="locked-exercise">
            {rich(t("lockedExercise"), { exercise: <strong>{exerciseName(tx, fixedKind)}</strong> })}
          </p>
        ) : (
          <ExercisePicker value={kind} onChange={pick} />
        )}
      </section>

      <section className={styles.step} aria-label={t("stepGoalAria")}>
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">2</span> {fixedGoal ? t("crewBar") : t("setBar")}
        </h3>
        {fixedGoal ? (
          <p className={styles.locked} data-testid="locked-goal">
            {rich(t("lockedGoal"), { goal: <strong>{formatGoal(kind, fixedGoal, g)}</strong> })}
          </p>
        ) : (
          <GoalStepper kind={kind} value={safeGoal} bounds={bounds} onChange={setGoal} />
        )}
      </section>

      <section className={styles.step} aria-label={t("stepStakeAria")}>
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">3</span> {t("stakeStepTitle", { token: p.label })}
        </h3>
        <AmountField
          text={amountText}
          onText={(text) => {
            setAmountText(text);
            if (text.trim() !== "") setTouched(true);
          }}
          pool={p.pool}
          balance={p.balance}
          decimals={p.decimals}
          label={p.label}
          showError={touched}
        />
      </section>

      <section className={styles.rules} aria-labelledby="stake-rules-title">
        <h3 id="stake-rules-title" className={styles.rulesTitle}>
          {t("dealTitle")}
        </h3>
        <ul className={styles.rulesList}>
          <li>
            {rich(t("dealDo"), {
              goal: <strong>{formatGoal(kind, safeGoal, g)}</strong>,
              deadline: (
                <strong>
                  <time dateTime={new Date(finishByMs).toISOString()}>{formatLocalDeadline(finishByMs, t.locale)}</time>
                </strong>
              ),
            })}
          </li>
          <li>{p.crewName ? t("dealShowUpCrew") : t("dealShowUp")}</li>
          <li>{p.crewName ? t("dealMissCrew", { fee }) : t("dealMiss", { fee })}</li>
          <li>{t("dealLocked")}</li>
        </ul>
      </section>

      {p.solShortfall ? (
        <p className={styles.warning} role="note">
          {p.solShortfall}
        </p>
      ) : null}
      {p.bundledClaim ? (
        <p className={styles.hint}>
          {rich(t("bundledClaimHint"), {
            amount: (
              <strong>
                <SkrText text={p.bundledClaim} />
              </strong>
            ),
          })}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        block
        trailingPlay
        disabled={p.busy || Boolean(p.solShortfall) || (touched && !check.ok)}
        aria-describedby="stake-rules-title"
      >
        <SkrText text={p.busy ? t("working") : submitLabel} />
      </Button>
      <p className={styles.fine}>{t("formFine", { exercise: exerciseName(tx, kind) })}</p>
    </form>
  );
}
