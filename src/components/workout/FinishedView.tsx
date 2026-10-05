"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, PlayIcon, RefreshIcon, TrashIcon, TrophyIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind, SessionSummary } from "@/lib/pose/types";
import type { Translator } from "@/lib/i18n";
import { exerciseName } from "@/lib/i18n/exercise";
import { useT } from "@/lib/i18n/I18nProvider";
import { formatClock, formatGoal, formatSecondsShort, formatValue, mean } from "./format";
import styles from "./WorkoutScreen.module.css";

export interface FinishedResult {
  /** Pre-generated so saving is idempotent (saveSession replaces by id). */
  id: string;
  summary: SessionSummary;
  startedAt: number;
  endedAt: number;
  goal: number;
  goalMet: boolean;
}

/**
 * unsaved: not saved yet. saved: persisted to localStorage. memory-only: kept for this tab only
 * (storage full or blocked). failed: could not be saved at all.
 */
export type SaveState = "unsaved" | "saved" | "memory-only" | "failed";

export interface FinishedViewProps {
  exercise: ExerciseKind;
  result: FinishedResult;
  saveState: SaveState;
  /**
   * Bumped by the screen when the user presses the browser / Android back button while this
   * workout is unsaved: toggles the "Discard this workout?" confirmation (like a dialog, a
   * second back closes it again), so back never silently throws the workout away.
   */
  discardPrompt?: number;
  onSaveAndFinish: () => void;
  onSaveAndGoAgain: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  onGoHome: () => void;
  /** Verified-run result (VerificationCard), shown under the headline. */
  verification?: ReactNode;
}

/** Whether a session recorded anything worth saving. */
export function hasWork(summary: SessionSummary): boolean {
  return summary.reps > 0 || summary.holdMs >= 1000;
}

type WorkoutKey = Parameters<Translator<"workout">>[0];

/** What to fix when every rep attempt was seen but rejected (rep exercises only; holds have none). */
const HAS_REJECTED_HELP: Record<ExerciseKind, boolean> = {
  pushup: true,
  squat: true,
  plank: false,
  lunge: true,
  situp: true,
  leg_raise: true,
  glute_bridge: true,
  wall_sit: false,
  pike_pushup: true,
  jump_squat: true,
  pullup: true,
  dip: true,
  burpee: true,
  mountain_climber: true,
  jumping_jack: true,
  high_knees: true,
};

function rejectedHelp(exercise: ExerciseKind, t: Translator<"workout">): string {
  return HAS_REJECTED_HELP[exercise] ? t(`${exercise}_rejectedHelp` as WorkoutKey) : t("genericRejectedHelp");
}
/** Post-workout summary with save / discard / go-again actions. */
export default function FinishedView({
  exercise,
  result,
  saveState,
  discardPrompt = 0,
  onSaveAndFinish,
  onSaveAndGoAgain,
  onDiscard,
  onRetry,
  onGoHome,
  verification,
}: FinishedViewProps) {
  const t = useT("workout");
  const name = exerciseName(useT("exercises"), exercise);
  const info = EXERCISES[exercise];
  const { summary, goal, goalMet } = result;
  const timed = info.unit === "seconds";
  const value = timed ? summary.holdMs / 1000 : summary.reps;
  const worked = hasWork(summary);
  const avgRepMs = mean(summary.repDurationsMs);
  const remaining = Math.max(0, goal - Math.floor(value));
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [promptSeen, setPromptSeen] = useState(discardPrompt);
  if (discardPrompt !== promptSeen) {
    // Back button pressed while unsaved: open (or, on a second press, close) the confirmation.
    setPromptSeen(discardPrompt);
    setConfirmDiscard((open) => !open);
  }

  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    // Move focus to the result so keyboard and screen-reader users land on it.
    headingRef.current?.focus();
  }, []);

  // Keep focus on the discard controls as they swap: "Keep it" when the question opens (the
  // safe choice), "Discard" again when it closes. Skipped on the first render.
  const keepRef = useRef<HTMLButtonElement | null>(null);
  const discardRef = useRef<HTMLButtonElement | null>(null);
  const confirmRendered = useRef(confirmDiscard);
  useEffect(() => {
    if (confirmRendered.current === confirmDiscard) return;
    confirmRendered.current = confirmDiscard;
    (confirmDiscard ? keepRef.current : discardRef.current)?.focus();
  }, [confirmDiscard]);

  const rejectedOnly = !worked && !timed && summary.rejectedReps > 0;

  return (
    <div className={styles.page} data-variant="finished">
      <header className={styles.moment} data-tone={worked ? "lime" : "dark"}>
        <p className={styles.momentEyebrow}>{name}</p>
        <h1 ref={headingRef} tabIndex={-1} className={styles.momentTitle}>
          {worked ? t("workoutComplete") : t("nothingCounted")}
        </h1>
        <section className={styles.momentResult} data-goal={goalMet ? "" : undefined} aria-label={t("result")}>
          <p className={styles.momentValue}>{timed ? formatClock(summary.holdMs) : summary.reps}</p>
          <p className={styles.momentUnit}>
            {timed ? t("heldWithGoodForm") : t.plural("repsVerified", summary.reps)}
          </p>
          {goalMet ? (
            <p className={styles.goalBadge} data-met="">
              <TrophyIcon size={18} />
              {t("goalMet", { goal: formatGoal(goal, info.unit, t) })}
            </p>
          ) : (
            <p className={styles.goalBadge}>
              {t("goalToGo", {
                goal: formatGoal(goal, info.unit, t),
                left: timed ? formatValue(remaining, "seconds") : remaining,
              })}
            </p>
          )}
        </section>
      </header>

      {verification}

      {worked ? (
        <dl className={styles.statsGrid}>
          {!timed ? (
            <div className={styles.statTile}>
              <dt>{t("statNotCounted")}</dt>
              <dd>{summary.rejectedReps}</dd>
            </div>
          ) : null}
          {!timed ? (
            <div className={styles.statTile}>
              <dt>{t("statAvgRep")}</dt>
              <dd>{avgRepMs === null ? "–" : formatSecondsShort(avgRepMs, t)}</dd>
            </div>
          ) : null}
          <div className={styles.statTile}>
            <dt>{t("statActiveTime")}</dt>
            <dd>{formatClock(summary.activeMs)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>{t("statTracking")}</dt>
            <dd>{Math.round(summary.avgTrackingConfidence * 100)}%</dd>
          </div>
        </dl>
      ) : rejectedOnly ? (
        <div className={styles.card}>
          <p className={styles.cardText}>
            <strong>{t.plural("rejectedSeen", summary.rejectedReps)}</strong> {rejectedHelp(exercise, t)}
          </p>
        </div>
      ) : (
        <div className={styles.card}>
          <p className={styles.cardText}>
            {timed
              ? t(info.camera === "front" ? "noHoldFacing" : "noHoldSideOn")
              : t(info.camera === "front" ? "noRepsFacing" : "noRepsSideOn")}
          </p>
        </div>
      )}

      {saveState === "memory-only" ? (
        <p className={styles.inlineWarning} role="alert">
          <AlertIcon size={20} />
          {t("savedThisVisitOnly")}
        </p>
      ) : null}
      {saveState === "failed" ? (
        <p className={styles.inlineWarning} role="alert">
          <AlertIcon size={20} />
          {t("saveFailed")}
        </p>
      ) : null}

      <div className={styles.finishedActions}>
        {saveState !== "unsaved" ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={onGoHome}>
              <CheckIcon size={22} />
              {t("done")}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onRetry}>
              <RefreshIcon size={20} />
              {t("goAgain")}
            </button>
          </>
        ) : worked ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={onSaveAndFinish}>
              <CheckIcon size={22} />
              {t("saveAndFinish")}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onSaveAndGoAgain}>
              <RefreshIcon size={20} />
              {t("saveAndGoAgain")}
            </button>
            {confirmDiscard ? (
              <div className={styles.confirmRow} role="group" aria-label={t("discardQuestion")}>
                <button type="button" className={styles.dangerButton} onClick={onDiscard}>
                  <TrashIcon size={20} />
                  {t("yesDiscard")}
                </button>
                <button ref={keepRef} type="button" className={styles.ghostButton} onClick={() => setConfirmDiscard(false)}>
                  {t("keepIt")}
                </button>
              </div>
            ) : (
              <button ref={discardRef} type="button" className={styles.ghostButton} onClick={() => setConfirmDiscard(true)}>
                <TrashIcon size={20} />
                {t("discard")}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className={styles.primaryButton} onClick={onRetry}>
              <PlayIcon size={22} />
              {t("tryAgain")}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onGoHome}>
              {t("backHome")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
