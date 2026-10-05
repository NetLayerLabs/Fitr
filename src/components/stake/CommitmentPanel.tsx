"use client";

import { CheckIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { workoutHrefFor } from "@/components/crews/multiPool";
import { EXERCISES, exerciseFromCode } from "@/lib/exercises";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseNameInSentence } from "@/lib/i18n/exercise";
import { dayEnd, dayStart, type DayConfig } from "@/lib/solana/vault/day";
import { claimOpensAt, estimatePayout, type Settlement } from "@/lib/solana/vault/status";
import { CommitmentStatus, type Pool } from "@/lib/solana/vault/generated";
import type { EntryView } from "./plan";
import { formatHold, goalUnitLabel } from "./form";
import { rich } from "./rich";
import { formatLocalDeadline } from "./StakeForm";
import styles from "./stake.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

export function formatDayLabel(day: number, cfg: DayConfig, locales?: string | string[]): string {
  // Midday of the pool day, so short offsets never tip it into the neighbouring local date.
  const mid = (dayStart(day, cfg) + Math.floor(cfg.dayLengthSecs / 2)) * 1000;
  return new Intl.DateTimeFormat(locales, { weekday: "short", month: "short", day: "numeric" }).format(new Date(mid));
}

function GoalLine({ code, goal }: { code: number; goal: number }) {
  const t = useT("stake");
  const tx = useT("exercises");
  const kind = exerciseFromCode(code);
  const info = kind ? EXERCISES[kind] : null;
  if (!info) return <>{goal}</>;
  return (
    <>
      <span className={`numeral ${styles.goalBig}`}>{info.unit === "seconds" ? formatHold(goal, t) : goal}</span>{" "}
      <span className={styles.goalNoun}>
        {exerciseNameInSentence(tx, info.kind)}
        <span className="sr-only"> ({goalUnitLabel(info.unit, goal, t)})</span>
      </span>
    </>
  );
}

export interface CommitmentPanelProps {
  entries: EntryView[];
  today: number;
  cfg: DayConfig;
  pool: Pick<Pool, "dailySponsorAmount" | "reserve">;
  fmt: (amount: bigint) => string;
  /** The settlement the next transaction would include (claim gets its own button). */
  settlement: Settlement | null;
  busy: boolean;
  onSettle: (s: Settlement) => void;
  /** The crew this panel belongs to (its "Start workout" verifies for this crew). */
  crewId?: bigint;
}

/** The user's own slots: today's (and tomorrow's) commitment, plus anything to claim. */
export default function CommitmentPanel({ entries, today, cfg, pool, fmt, settlement, busy, onSettle, crewId }: CommitmentPanelProps) {
  const t = useT("stake");
  const dayLabel = (day: number) => formatDayLabel(day, cfg, t.locale);
  const deadline = (ms: number) => formatLocalDeadline(ms, t.locale);
  const claimOpens = (status: string, at: number) =>
    status === "claimable" ? t("claimOpensNow") : t("claimOpensAfter", { time: deadline(at) });
  const mine = entries.filter((e) => e.commitment && e.day >= today);
  const claim = settlement?.kind === "claim" ? entries.find((e) => e.day === settlement.day) : undefined;
  const claimPayout = claim ? estimatePayout(claim, pool) : null;
  const missedPast = entries.filter((e) => e.day < today && e.status === "missed");

  return (
    <>
      {claim && claimPayout && settlement ? (
        <Card as="section" tone="lime" padding="lg" aria-labelledby="claim-title">
          <p className={styles.eyebrowInk}>{t("readyToClaim", { day: dayLabel(claim.day) })}</p>
          <h2 id="claim-title" className={styles.claimTitle}>
            <span className={`numeral ${styles.claimBig}`}>
              {claimPayout.exact ? "" : "≈ "}
              <SkrText text={fmt(claimPayout.principal + claimPayout.bonus)} />
            </span>
          </h2>
          <p className={styles.claimBody}>
            <SkrText
              text={
                claim.dayState?.voided
                  ? t("claimVoided")
                  : claim.commitment?.status === CommitmentStatus.Revoked
                    ? t("claimRevoked", { stake: fmt(claimPayout.principal) })
                    : claimPayout.bonus > 0n
                      ? t("claimBonus", { stake: fmt(claimPayout.principal), bonus: fmt(claimPayout.bonus) })
                      : t("claimNoBonus", { stake: fmt(claimPayout.principal) })
              }
            />
          </p>
          <Button variant="primary" size="lg" block disabled={busy} onClick={() => onSettle(settlement)}>
            {busy ? t("working") : t("claim")}
          </Button>
        </Card>
      ) : null}

      {mine.map((e) => {
        const c = e.commitment!;
        const kind = exerciseFromCode(c.exercise);
        const isToday = e.day === today;
        const finishBy = dayEnd(e.day, cfg) * 1000 - 1000;
        // Claim opens once finalize_day is possible: attest deadline + any pause + the review window.
        const claimAt = claimOpensAt(e, cfg) * 1000;
        const revoked = c.status === CommitmentStatus.Revoked;
        if (revoked && (e.status === "revoked" || e.status === "claimable")) {
          return (
            <Card key={e.day} as="section" padding="lg" aria-label={t("withdrawnAria", { day: dayLabel(e.day) })}>
              <p className={styles.missedTag}>{t("withdrawnTag")}</p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                {rich(t("withdrawnBody", { when: claimOpens(e.status, claimAt) }), { amount: <SkrText text={fmt(c.amount)} /> })}
              </p>
            </Card>
          );
        }
        if (e.status === "completed_pending" || e.status === "claimable") {
          return (
            <Card key={e.day} as="section" tone="elevated" padding="lg" aria-label={t("verifiedAria", { day: dayLabel(e.day) })}>
              <p className={styles.verified}>
                <CheckIcon size={18} /> {t("verifiedOnchain")}
              </p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                {rich(t("verifiedBody", { when: claimOpens(e.status, claimAt) }), { amount: <SkrText text={fmt(c.amount)} /> })}
              </p>
            </Card>
          );
        }
        if (e.status === "missed") {
          return (
            <Card key={e.day} as="section" padding="lg" aria-label={t("missedAria", { day: dayLabel(e.day) })}>
              <p className={styles.missedTag}>{t("missedTag")}</p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                {rich(t("missedBody"), { amount: <SkrText text={fmt(c.amount)} /> })}
              </p>
            </Card>
          );
        }
        return (
          <Card key={e.day} as="section" tone="elevated" padding="lg" aria-label={isToday ? t("yourCommitmentTodayAria") : t("yourCommitmentTomorrowAria")}>
            <p className={styles.eyebrow}>{isToday ? t("committedToday") : t("committedTomorrow")}</p>
            <p className={styles.goalLine}>
              <GoalLine code={c.exercise} goal={c.goalTarget} />
            </p>
            <p className={styles.hint}>
              {rich(t("atStakeFinishBy", { deadline: deadline(finishBy) }), {
                amount: (
                  <strong className={styles.stakeStrong}>
                    <SkrText text={fmt(c.amount)} />
                  </strong>
                ),
              })}
            </p>
            {isToday && kind ? (
              <Button variant="primary" size="lg" block trailingPlay href={workoutHrefFor(kind, crewId)}>
                {t("startWorkout")}
              </Button>
            ) : null}
            {isToday ? (
              <p className={styles.fine}>
                {t("afterFinishFine")}
              </p>
            ) : null}
          </Card>
        );
      })}

      {missedPast.length > 0 && !mine.some((e) => e.status === "missed") ? (
        <p className={styles.hint}>
          {rich(t("missedPast", { day: dayLabel(missedPast[0].day) }), {
            amount: <SkrText text={fmt(missedPast[0].commitment!.amount)} />,
          })}
        </p>
      ) : null}
    </>
  );
}
