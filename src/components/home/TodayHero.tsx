"use client";

import { timeOfDayFormat } from "@/components/workout/format";
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons/Icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ArtPhoto from "@/components/workouts/ArtPhoto";
import { workoutHrefFor } from "@/components/crews/multiPool";
import { crewPath, parseCrewId } from "@/lib/solana/vault/crews";
import { useNow } from "@/hooks/useSessions";
import { useTodayCommitment } from "@/hooks/useTodayCommitment";
import { STANDING_ART, type ExerciseArt } from "@/lib/exerciseArt";
import { EXERCISES } from "@/lib/exercises";
import { isExerciseKind } from "@/lib/pose/types";
import { useT } from "@/lib/i18n/I18nProvider";
import { exerciseGoal } from "@/lib/i18n/exercise";
import {
  SPLIT_MARK,
  formatTimeLeft,
  goalParts,
  normalizeTodayState,
  splitAround,
  spokenTimeLeft,
  type TodayState,
} from "./today";
import styles from "./TodayHero.module.css";
import { SkrText } from "@/components/brand/SkrAmount";

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
  const t = useT("today");
  const tx = useT("exercises");
  const commitment = useTodayCommitment();
  const now = useNow();
  const state = normalizeTodayState(commitment?.state);
  const kind = commitment?.exercise;
  const info = kind && isExerciseKind(kind) ? EXERCISES[kind] : null;
  const target = commitment?.goalTarget ?? info?.defaultGoal ?? 0;
  // A crew commitment (multi-pool: the most urgent one wins the hero) carries its crew.
  const crewId = parseCrewId(commitment?.crewId);
  const crewTag = crewId && commitment?.crewName ? ` · ${commitment.crewName}` : "";
  const poolHref = crewId ? crewPath(crewId) : "/commit";

  switch (state) {
    case "loading":
      return (
        <Shell state={state} eyebrow={t("todayTitle")} title={t("heroLoadingTitle")} busy>
          <div className={styles.skeleton} aria-hidden="true" />
        </Shell>
      );

    case "committed": {
      const deadline = commitment?.deadlineMs;
      // Committed after today's cutoff: the stake is for tomorrow's day, so a workout now is
      // practice. Say when it starts counting instead of offering a Start that would not count.
      const forTomorrow = commitment?.forDay === "tomorrow";
      const countsFrom =
        forTomorrow && typeof deadline === "number" ? timeOfDayFormat(t.locale).format(deadline - 86_400_000) : null;
      const showTime = typeof deadline === "number" && now !== 0;
      const [goalBefore, goalAfter] = info ? goalParts(tx, info.kind, target) : ["", ""];
      const [stakeBefore, stakeAfter] = splitAround(t("atStake", { amount: SPLIT_MARK }));
      return (
        <Shell
          state={state}
          eyebrow={`${t(forTomorrow ? "heroGoalTomorrowEyebrow" : "heroGoalEyebrow")}${crewTag}`}
          title={
            info ? (
              <>
                {goalBefore.trim() ? (
                  <>
                    <span className={styles.noun}>{goalBefore.trim()}</span>{" "}
                  </>
                ) : null}
                <span className={`numeral ${styles.big}`}>{target}</span>
                {goalAfter.trim() ? (
                  <>
                    {" "}
                    <span className={styles.noun}>{goalAfter.trim()}</span>
                  </>
                ) : null}
              </>
            ) : (
              t("heroGoalFallback")
            )
          }
          action={
            info ? (
              <Cta href={workoutHrefFor(info.kind, crewId)} play>
                {t(forTomorrow ? "practiceNow" : "start")}
              </Cta>
            ) : (
              <Cta href={poolHref}>{t("viewCommitment")}</Cta>
            )
          }
        >
          <ul className={styles.meta} role="list">
            {countsFrom ? (
              <li>{t("countsFrom", { time: countsFrom })}</li>
            ) : showTime ? (
              <li>
                <span aria-hidden="true">{formatTimeLeft(t, deadline, now)}</span>
                <span className="sr-only">{spokenTimeLeft(t, deadline, now)}</span>
              </li>
            ) : null}
            {commitment?.amountLabel ? (
              <li>
                {stakeBefore}
                <strong className={styles.stake}><SkrText text={commitment.amountLabel} /></strong>
                {stakeAfter}
              </li>
            ) : null}
          </ul>
        </Shell>
      );
    }

    case "verifying":
      return (
        <Shell state={state} eyebrow={t("verifyingEyebrow")} title={t("verifyingTitle")} busy>
          <p className={styles.body}>{t("verifyingBody")}</p>
        </Shell>
      );

    case "verified":
      return (
        <Shell
          state={state}
          tone="lime"
          eyebrow={`${t("todayTitle")}${crewTag}`}
          title={
            <>
              <span className={styles.check} aria-hidden="true">
                <CheckIcon size={28} />
              </span>
              {t("verifiedTitle")}
            </>
          }
          action={<Cta href="/progress">{t("seeProgress")}</Cta>}
        >
          <p className={styles.body}>
            {info ? t("verifiedBodyWithGoal", { goal: exerciseGoal(tx, info.kind, target) }) : t("verifiedBody")}
          </p>
        </Shell>
      );

    case "claimable":
      return (
        <Shell
          state={state}
          tone="lime"
          eyebrow={`${t("claimEyebrow")}${crewTag}`}
          title={
            commitment?.claimableLabel ? (
              <span className={`numeral ${styles.big}`}><SkrText text={commitment.claimableLabel} /></span>
            ) : (
              t("claimFallbackTitle")
            )
          }
          action={<Cta href={poolHref}>{t("claim")}</Cta>}
        >
          <p className={styles.body}>{t("claimBody")}</p>
        </Shell>
      );

    case "missed":
      return (
        <Shell
          state={state}
          eyebrow={`${t("missedEyebrow")}${crewTag}`}
          title={t("missedTitle")}
          action={<Cta href={poolHref}>{t("commitAgain")}</Cta>}
        >
          <p className={styles.body}>{t("missedBody")}</p>
        </Shell>
      );

    case "revoked":
      return (
        <Shell
          state={state}
          eyebrow={`${t("revokedEyebrow")}${crewTag}`}
          title={t("revokedTitle")}
          action={<Cta href={poolHref}>{t("viewDetails")}</Cta>}
        >
          <p className={styles.body}>{t("revokedBody")}</p>
        </Shell>
      );

    case "not_seeker":
      return (
        <Shell
          state={state}
          eyebrow={t("trainFreeEyebrow")}
          title={t("notSeekerTitle")}
          action={<Cta href="/workouts">{t("pickWorkout")}</Cta>}
        >
          <p className={styles.body}>{t("notSeekerBody")}</p>
        </Shell>
      );

    case "vault_unavailable":
      return (
        <Shell
          state={state}
          eyebrow={t("trainFreeEyebrow")}
          title={t("pausedTitle")}
          action={<Cta href="/workouts">{t("pickWorkout")}</Cta>}
        >
          <p className={styles.body}>{t("pausedBody")}</p>
        </Shell>
      );

    case "no_wallet":
    case "can_commit":
    default:
      return (
        <Shell
          state={state}
          eyebrow={t("todayTitle")}
          title={t("commitTitle")}
          action={<Cta href="/commit">{t("commit")}</Cta>}
          art={STANDING_ART}
        >
          <p className={styles.body}>
            {state === "no_wallet" ? t("commitBodyNoWallet") : t("commitBody")}
          </p>
        </Shell>
      );
  }
}
