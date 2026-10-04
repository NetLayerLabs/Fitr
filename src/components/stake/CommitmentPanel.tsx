"use client";

import { CheckIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { workoutHrefFor } from "@/components/crews/multiPool";
import { EXERCISES, exerciseFromCode } from "@/lib/exercises";
import { dayEnd, dayStart, type DayConfig } from "@/lib/solana/vault/day";
import { claimOpensAt, estimatePayout, type Settlement } from "@/lib/solana/vault/status";
import { CommitmentStatus, type Pool } from "@/lib/solana/vault/generated";
import type { EntryView } from "./plan";
import { formatHold, goalUnitLabel } from "./form";
import { formatLocalDeadline } from "./StakeForm";
import styles from "./stake.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

export function formatDayLabel(day: number, cfg: DayConfig, locales?: string | string[]): string {
  // Midday of the pool day, so short offsets never tip it into the neighbouring local date.
  const mid = (dayStart(day, cfg) + Math.floor(cfg.dayLengthSecs / 2)) * 1000;
  return new Intl.DateTimeFormat(locales, { weekday: "short", month: "short", day: "numeric" }).format(new Date(mid));
}

function GoalLine({ code, goal }: { code: number; goal: number }) {
  const kind = exerciseFromCode(code);
  const info = kind ? EXERCISES[kind] : null;
  if (!info) return <>{goal}</>;
  return (
    <>
      <span className={`numeral ${styles.goalBig}`}>{info.unit === "seconds" ? formatHold(goal) : goal}</span>{" "}
      <span className={styles.goalNoun}>
        {info.name.toLowerCase()}
        <span className="sr-only"> ({goalUnitLabel(info.unit, goal)})</span>
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
  const mine = entries.filter((e) => e.commitment && e.day >= today);
  const claim = settlement?.kind === "claim" ? entries.find((e) => e.day === settlement.day) : undefined;
  const claimPayout = claim ? estimatePayout(claim, pool) : null;
  const missedPast = entries.filter((e) => e.day < today && e.status === "missed");

  return (
    <>
      {claim && claimPayout && settlement ? (
        <Card as="section" tone="lime" padding="lg" aria-labelledby="claim-title">
          <p className={styles.eyebrowInk}>Ready to claim · {formatDayLabel(claim.day, cfg)}</p>
          <h2 id="claim-title" className={styles.claimTitle}>
            <span className={`numeral ${styles.claimBig}`}>
              {claimPayout.exact ? "" : "≈ "}
              <SkrText text={fmt(claimPayout.principal + claimPayout.bonus)} />
            </span>
          </h2>
          <p className={styles.claimBody}>
            <SkrText text={claim.dayState?.voided
              ? "That day was cancelled, so your full stake comes back."
              : claim.commitment?.status === CommitmentStatus.Revoked
                ? `Your verification was withdrawn after review, so your ${fmt(claimPayout.principal)} stake comes back with no bonus.`
                : claimPayout.bonus > 0n
                ? `Your ${fmt(claimPayout.principal)} stake plus ${fmt(claimPayout.bonus)} from people who missed.`
                : `Your ${fmt(claimPayout.principal)} stake back. Everyone showed up, so there is no bonus this time.`} />
          </p>
          <Button variant="primary" size="lg" block disabled={busy} onClick={() => onSettle(settlement)}>
            {busy ? "Working…" : "Claim"}
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
            <Card key={e.day} as="section" padding="lg" aria-label={`Verification withdrawn, ${formatDayLabel(e.day, cfg)}`}>
              <p className={styles.missedTag}>Verification withdrawn</p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                Fitr&apos;s review withdrew this verification. Your <SkrText text={fmt(c.amount)} /> stake is not forfeited and comes back
                with no bonus. Claim opens {e.status === "claimable" ? "now" : <>after {formatLocalDeadline(claimAt)}</>}.
              </p>
            </Card>
          );
        }
        if (e.status === "completed_pending" || e.status === "claimable") {
          return (
            <Card key={e.day} as="section" tone="elevated" padding="lg" aria-label={`Verified commitment, ${formatDayLabel(e.day, cfg)}`}>
              <p className={styles.verified}>
                <CheckIcon size={18} /> Verified on-chain
              </p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                <SkrText text={fmt(c.amount)} /> comes back with your share of forfeits. Claim opens{" "}
                {e.status === "claimable" ? "now" : <>after {formatLocalDeadline(claimAt)}</>}.
              </p>
            </Card>
          );
        }
        if (e.status === "missed") {
          return (
            <Card key={e.day} as="section" padding="lg" aria-label={`Missed commitment, ${formatDayLabel(e.day, cfg)}`}>
              <p className={styles.missedTag}>Missed</p>
              <p className={styles.goalLine}>
                <GoalLine code={c.exercise} goal={c.goalTarget} />
              </p>
              <p className={styles.hint}>
                <SkrText text={fmt(c.amount)} /> was forfeited to the people who showed up. Tomorrow is a new day.
              </p>
            </Card>
          );
        }
        return (
          <Card key={e.day} as="section" tone="elevated" padding="lg" aria-label={`Your commitment, ${isToday ? "today" : "tomorrow"}`}>
            <p className={styles.eyebrow}>{isToday ? "You're committed today" : "You're committed for tomorrow"}</p>
            <p className={styles.goalLine}>
              <GoalLine code={c.exercise} goal={c.goalTarget} />
            </p>
            <p className={styles.hint}>
              <strong className={styles.stakeStrong}><SkrText text={fmt(c.amount)} /></strong> at stake · finish before{" "}
              {formatLocalDeadline(finishBy)}
            </p>
            {isToday && kind ? (
              <Button variant="primary" size="lg" block trailingPlay href={workoutHrefFor(kind, crewId)}>
                Start workout
              </Button>
            ) : null}
            {isToday ? (
              <p className={styles.fine}>
                When you finish, Fitr re-checks the session and marks it complete on-chain. It usually takes under a
                minute.
              </p>
            ) : null}
          </Card>
        );
      })}

      {missedPast.length > 0 && !mine.some((e) => e.status === "missed") ? (
        <p className={styles.hint}>
          Missed {formatDayLabel(missedPast[0].day, cfg)}: <SkrText text={fmt(missedPast[0].commitment!.amount)} /> was forfeited. Your
          next commit also closes it out and returns the account rent.
        </p>
      ) : null}
    </>
  );
}
