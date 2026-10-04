"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckIcon, PlayIcon, RefreshIcon, TrashIcon, TrophyIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind, SessionSummary } from "@/lib/pose/types";
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

/** What to fix when every rep attempt was seen but rejected (rep exercises only). */
const REJECTED_GUIDANCE: Record<ExerciseKind, string | null> = {
  pushup:
    "Lower until your elbows bend past 90°, lock your arms out at the top, and keep your body straight from shoulders to heels, with your knees off the floor.",
  squat: "Sit back until your knees bend past 90°, stand fully upright between reps, and keep each rep controlled.",
  plank: null,
  lunge: "Drop until your front knee bends to 90° and your back knee nears the floor, then stand fully upright.",
  situp: "Start with your shoulder blades on the floor and sit all the way up until your chest is over your hips.",
  leg_raise: "Keep your legs straight, raise them until they point at the ceiling, and lower them almost to the floor.",
  glute_bridge: "Drive your hips up until knees, hips and shoulders form a straight line, then lower all the way down.",
  wall_sit: null,
  pike_pushup: "Keep your hips high, lower your head toward the floor until your elbows bend past 90°, then press to straight arms.",
  jump_squat: "Squat until your knees pass 90°, then jump so both feet leave the floor, staying side-on to the camera.",
  pullup: "Start each rep from a dead hang with straight arms and pull until your chin clears the bar, facing the camera.",
  dip: "Lower until your elbows bend past 90°, then press up until your arms lock out at the top.",
  burpee: "Do the full sequence every rep: squat, plank, a full push-up, then jump with your hands overhead.",
  mountain_climber: "Hold a straight-arm plank and drive each knee well toward your chest, keeping your hips level.",
  jumping_jack: "Face the camera, bring your hands together overhead and jump your feet wide, then back together.",
  high_knees: "Face the camera and drive each knee up to hip height.",
};

const GENERIC_REJECTED_GUIDANCE = "Use the full range of motion on every rep and keep each rep controlled.";

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
        <p className={styles.momentEyebrow}>{info.name}</p>
        <h1 ref={headingRef} tabIndex={-1} className={styles.momentTitle}>
          {worked ? "Workout complete" : "Nothing counted"}
        </h1>
        <section className={styles.momentResult} data-goal={goalMet ? "" : undefined} aria-label="Result">
          <p className={styles.momentValue}>{timed ? formatClock(summary.holdMs) : summary.reps}</p>
          <p className={styles.momentUnit}>
            {timed ? "held with good form" : `${summary.reps === 1 ? "rep" : "reps"} verified`}
          </p>
          {goalMet ? (
            <p className={styles.goalBadge} data-met="">
              <TrophyIcon size={18} />
              Goal met · {formatGoal(goal, info.unit)}
            </p>
          ) : (
            <p className={styles.goalBadge}>
              Goal {formatGoal(goal, info.unit)} ·{" "}
              {timed ? `${formatValue(remaining, "seconds")} to go` : `${remaining} to go`}
            </p>
          )}
        </section>
      </header>

      {verification}

      {worked ? (
        <dl className={styles.statsGrid}>
          {!timed ? (
            <div className={styles.statTile}>
              <dt>Not counted</dt>
              <dd>{summary.rejectedReps}</dd>
            </div>
          ) : null}
          {!timed ? (
            <div className={styles.statTile}>
              <dt>Avg rep</dt>
              <dd>{avgRepMs === null ? "–" : formatSecondsShort(avgRepMs)}</dd>
            </div>
          ) : null}
          <div className={styles.statTile}>
            <dt>Active time</dt>
            <dd>{formatClock(summary.activeMs)}</dd>
          </div>
          <div className={styles.statTile}>
            <dt>Tracking</dt>
            <dd>{Math.round(summary.avgTrackingConfidence * 100)}%</dd>
          </div>
        </dl>
      ) : rejectedOnly ? (
        <div className={styles.card}>
          <p className={styles.cardText}>
            <strong>
              {summary.rejectedReps} {summary.rejectedReps === 1 ? "rep" : "reps"} seen, none met the standard.
            </strong>{" "}
            {REJECTED_GUIDANCE[exercise] ?? GENERIC_REJECTED_GUIDANCE}
          </p>
        </div>
      ) : (
        <div className={styles.card}>
          <p className={styles.cardText}>
            No {timed ? "valid hold time" : "valid reps"} were recorded. Check that your whole body is in
            frame and {info.camera === "front" ? "facing" : "side-on to"} the camera, then try again.
          </p>
        </div>
      )}

      {saveState === "memory-only" ? (
        <p className={styles.inlineWarning} role="alert">
          <AlertIcon size={20} />
          Saved for this visit only. This browser&apos;s storage is full or blocked, so the workout will
          be gone when you close Fitr.
        </p>
      ) : null}
      {saveState === "failed" ? (
        <p className={styles.inlineWarning} role="alert">
          <AlertIcon size={20} />
          This workout couldn&apos;t be saved.
        </p>
      ) : null}

      <div className={styles.finishedActions}>
        {saveState !== "unsaved" ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={onGoHome}>
              <CheckIcon size={22} />
              Done
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onRetry}>
              <RefreshIcon size={20} />
              Go again
            </button>
          </>
        ) : worked ? (
          <>
            <button type="button" className={styles.primaryButton} onClick={onSaveAndFinish}>
              <CheckIcon size={22} />
              Save &amp; finish
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onSaveAndGoAgain}>
              <RefreshIcon size={20} />
              Save &amp; go again
            </button>
            {confirmDiscard ? (
              <div className={styles.confirmRow} role="group" aria-label="Discard this workout? It hasn't been saved.">
                <button type="button" className={styles.dangerButton} onClick={onDiscard}>
                  <TrashIcon size={20} />
                  Yes, discard
                </button>
                <button ref={keepRef} type="button" className={styles.ghostButton} onClick={() => setConfirmDiscard(false)}>
                  Keep it
                </button>
              </div>
            ) : (
              <button ref={discardRef} type="button" className={styles.ghostButton} onClick={() => setConfirmDiscard(true)}>
                <TrashIcon size={20} />
                Discard
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className={styles.primaryButton} onClick={onRetry}>
              <PlayIcon size={22} />
              Try again
            </button>
            <button type="button" className={styles.secondaryButton} onClick={onGoHome}>
              Back home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
