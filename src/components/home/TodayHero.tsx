"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { workoutHref } from "@/components/workouts/catalog";
import { useNow } from "@/hooks/useSessions";
import { useTodayCommitment } from "@/hooks/useTodayCommitment";
import { STANDING_ART, type ExerciseArt } from "@/lib/exerciseArt";
import { EXERCISES } from "@/lib/exercises";
import { isExerciseKind } from "@/lib/pose/types";
import { formatTimeLeft, goalNoun, normalizeTodayState, spokenTimeLeft, type TodayState } from "./today";
import styles from "./TodayHero.module.css";

type Tone = "default" | "lime";

function Cta({ href, children, play = false }: { href: string; children: ReactNode; play?: boolean }) {
  return (
    <Button variant="primary" size="lg" block href={href} trailingPlay={play}>
      {children}
    </Button>
  );
}

function Shell({
  state,
  tone = "default",
  eyebrow,
  title,
  children,
  action,
  busy = false,
  art,
}: {
  state: TodayState;
  tone?: Tone;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  busy?: boolean;
  /** Mood photo on the right, behind the copy. Decorative: the title carries the message. */
  art?: ExerciseArt | null;
}) {
  return (
    <Card
      as="section"
      tone={tone}
      padding="lg"
      className={styles.hero}
      data-state={state}
      aria-labelledby="today-hero-title"
      aria-busy={busy || undefined}
      data-art={art ? "" : undefined}
    >
      {art ? (
        <span className={styles.art} aria-hidden="true">
          {/* First image on Today and above the fold: eager, high priority. */}
          <ArtPhoto art={art} decorative priority className={styles.artPhoto} sizes="(max-width: 480px) 60vw, 300px" />
        </span>
      ) : null}
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="today-hero-title" className={styles.title}>
        {title}
      </h2>
      {children}
      {action ? <div className={styles.actions}>{action}</div> : null}
    </Card>
  );
}

/**
 * The one adaptive card on Today, driven by useTodayCommitment(): commit, today's goal with a
 * Start button, verifying, verified, claim or missed.
 */
export default function TodayHero() {
  const commitment = useTodayCommitment();
  const now = useNow();
  const state = normalizeTodayState(commitment?.state);
  const kind = commitment?.exercise;
  const info = kind && isExerciseKind(kind) ? EXERCISES[kind] : null;
  const target = commitment?.goalTarget ?? info?.defaultGoal ?? 0;

  switch (state) {
    case "loading":
      return (
        <Shell state={state} eyebrow="Today" title="Checking your commitment…" busy>
          <div className={styles.skeleton} aria-hidden="true" />
        </Shell>
      );

    case "committed": {
      const deadline = commitment?.deadlineMs;
      const showTime = typeof deadline === "number" && now !== 0;
      return (
        <Shell
          state={state}
          eyebrow="Your goal"
          title={
            info ? (
              <>
                <span className={`numeral ${styles.big}`}>{target}</span>{" "}
                <span className={styles.noun}>{goalNoun(info.name, info.unit, target)}</span>
              </>
            ) : (
              "Today's goal"
            )
          }
          action={
            info ? (
              <Cta href={workoutHref(info.kind)} play>
                Start
              </Cta>
            ) : (
              <Cta href="/commit">View commitment</Cta>
            )
          }
        >
          <ul className={styles.meta} role="list">
            {showTime ? (
              <li>
                <span aria-hidden="true">{formatTimeLeft(deadline, now)}</span>
                <span className="sr-only">{spokenTimeLeft(deadline, now)}</span>
              </li>
            ) : null}
            {commitment?.amountLabel ? (
              <li>
                <strong className={styles.stake}>{commitment.amountLabel}</strong> at stake
              </li>
            ) : null}
          </ul>
        </Shell>
      );
    }

    case "verifying":
      return (
        <Shell state={state} eyebrow="Almost there" title="Verifying your workout…" busy>
          <p className={styles.body}>
            Fitr is re-checking your reps and live challenges. This usually takes a moment.
          </p>
        </Shell>
      );

    case "verified":
      return (
        <Shell
          state={state}
          tone="lime"
          eyebrow="Today"
          title={
            <>
              <span className={styles.check} aria-hidden="true">
                <CheckIcon size={28} />
              </span>
              Goal verified
            </>
          }
          action={<Cta href="/progress">See progress</Cta>}
        >
          <p className={styles.body}>
            {info ? `${target} ${goalNoun(info.name, info.unit, target)}, done and on-chain. ` : "Done and on-chain. "}
            Your stake is safe. Come back tomorrow.
          </p>
        </Shell>
      );

    case "claimable":
      return (
        <Shell
          state={state}
          tone="lime"
          eyebrow="Ready to claim"
          title={
            commitment?.claimableLabel ? (
              <span className={`numeral ${styles.big}`}>{commitment.claimableLabel}</span>
            ) : (
              "Your stake is back"
            )
          }
          action={<Cta href="/commit">Claim</Cta>}
        >
          <p className={styles.body}>You kept your word. Claim your stake and your share.</p>
        </Shell>
      );

    case "missed":
      return (
        <Shell state={state} eyebrow="Goal missed" title="Tomorrow is a new day" action={<Cta href="/commit">Commit again</Cta>}>
          <p className={styles.body}>The deadline passed before a verified workout. Set a goal you can keep.</p>
        </Shell>
      );

    case "revoked":
      return (
        <Shell state={state} eyebrow="Under review" title="Verification withdrawn" action={<Cta href="/commit">View details</Cta>}>
          <p className={styles.body}>
            Fitr&apos;s review withdrew today&apos;s verification. Your stake is not forfeited: you can claim it back
            (no bonus) once the day closes.
          </p>
        </Shell>
      );

    case "not_seeker":
      return (
        <Shell state={state} eyebrow="Train free" title="Commitments need a Seeker" action={<Cta href="/workouts">Pick a workout</Cta>}>
          <p className={styles.body}>
            Staking is for Solana Seeker owners. Every workout and rep counter is still yours.
          </p>
        </Shell>
      );

    case "vault_unavailable":
      return (
        <Shell state={state} eyebrow="Train free" title="Commitments are paused" action={<Cta href="/workouts">Pick a workout</Cta>}>
          <p className={styles.body}>Staking is offline right now. Your workouts still count.</p>
        </Shell>
      );

    case "no_wallet":
    case "can_commit":
    default:
      return (
        <Shell
          state={state}
          eyebrow="Today"
          title="Put your word on the line"
          action={<Cta href="/commit">Commit</Cta>}
          art={STANDING_ART}
        >
          <p className={styles.body}>
            {state === "no_wallet"
              ? "Connect your wallet, pick a goal and stake SKR on showing up today."
              : "Pick a goal and stake SKR on showing up today. Hit it and your stake comes back."}
          </p>
        </Shell>
      );
  }
}
