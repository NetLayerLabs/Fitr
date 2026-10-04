"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import { EXERCISES } from "@/lib/exercises";
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
  onSubmit: (v: StakeSubmit) => void;
}

/** "Mon 23:59" style local time for an instant in ms. */
export function formatLocalDeadline(ms: number, locales?: string | string[]): string {
  return new Intl.DateTimeFormat(locales, { weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function formatFeePercent(feeBps: number): string {
  const pct = feeBps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, "")}%`;
}

export default function StakeForm(p: StakeFormProps) {
  const [kind, setKind] = useState<ExerciseKind>(p.initialExercise ?? "pushup");
  const [goal, setGoal] = useState(() => defaultGoal(p.pool, p.initialExercise ?? "pushup"));
  const [amountText, setAmountText] = useState("");
  const [touched, setTouched] = useState(false);

  const bounds = goalBounds(p.pool, kind);
  const safeGoal = clampInt(goal, bounds);
  const check = checkAmount(amountText, p.pool, p.balance, p.decimals);
  // The program rejects commits after day_start + cutoff; the workout itself must land before day end.
  const finishByMs = dayEnd(p.targetDay, p.cfg) * 1000 - 1000;
  const fee = formatFeePercent(p.pool.feeBps);
  const amountLabel = check.ok ? `${formatTokenAmount(check.amount, p.decimals, { maxFractionDigits: 2 })} ${p.label}` : null;

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
        <p className={styles.eyebrow}>{p.isTomorrow ? "Tomorrow" : "Today"}</p>
        <h2 id="stake-form-title" className={styles.sectionTitle}>
          Set your commitment
        </h2>
      </div>

      <section className={styles.step} aria-label="1. Exercise">
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">1</span> Pick an exercise
        </h3>
        <ExercisePicker value={kind} onChange={pick} />
      </section>

      <section className={styles.step} aria-label="2. Goal">
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">2</span> Set the bar
        </h3>
        <GoalStepper kind={kind} value={safeGoal} bounds={bounds} onChange={setGoal} />
      </section>

      <section className={styles.step} aria-label="3. Stake">
        <h3 className={styles.stepTitle}>
          <span className={styles.stepNum} aria-hidden="true">3</span> Put {p.label} on it
        </h3>
        <AmountField
          text={amountText}
          onText={(t) => {
            setAmountText(t);
            if (t.trim() !== "") setTouched(true);
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
          The deal
        </h3>
        <ul className={styles.rulesList}>
          <li>
            Do <strong>{formatGoal(kind, safeGoal)}</strong> before{" "}
            <strong>
              <time dateTime={new Date(finishByMs).toISOString()}>{formatLocalDeadline(finishByMs)}</time>
            </strong>{" "}
            (your local time). Fitr counts on your phone and re-checks it with live challenges.
          </li>
          <li>
            Show up and you get your full stake back, plus a share of what others forfeited.
          </li>
          <li>
            Miss it and your stake is forfeited to the people who showed up. Fitr keeps a {fee} fee on
            forfeited stakes only.
          </li>
          <li>Goal and stake are locked on-chain when you sign. There is no cancel.</li>
        </ul>
      </section>

      {p.solShortfall ? (
        <p className={styles.warning} role="note">
          {p.solShortfall}
        </p>
      ) : null}
      {p.bundledClaim ? (
        <p className={styles.hint}>
          The same signature also claims <strong><SkrText text={p.bundledClaim} /></strong> waiting from an earlier day.
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
        <SkrText
          text={
            p.busy ? "Working…" : `${p.bundledClaim ? "Claim & commit" : "Commit"}${amountLabel ? ` ${amountLabel}` : ""}`
          }
        />
      </Button>
      <p className={styles.fine}>
        {EXERCISES[kind].name} · one signature in your wallet · network fee under 0.001 SOL plus refundable
        account rent.
      </p>
    </form>
  );
}
