"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { CameraIcon, ExpandIcon, ShieldIcon, ShrinkIcon, StopIcon, TrophyIcon } from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { EnginePhase, ExerciseKind } from "@/lib/pose/types";
import FormFeedback from "./FormFeedback";
import { formatClock, formatGoal } from "./format";
import type { ConfidenceLevel, HudSnapshot } from "./hudTracker";
import type { FitMode } from "./overlay";
import ProgressRing from "./ProgressRing";
import styles from "./WorkoutScreen.module.css";

const PHASE_LABEL: Record<EnginePhase, string> = {
  searching: "Finding you",
  ready: "Ready",
  up: "Up",
  down: "Down",
  holding: "Holding",
  paused: "Paused",
};

function phaseLabel(phase: EnginePhase, exercise: ExerciseKind): string {
  const info = EXERCISES[exercise];
  if (phase === "ready" && info.unit === "seconds") return `Get into ${info.name.toLowerCase()}`;
  return PHASE_LABEL[phase];
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  none: "No body",
  low: "Weak",
  fair: "Fair",
  good: "Good",
};

const CONFIDENCE_BARS: Record<ConfidenceLevel, number> = { none: 0, low: 1, fair: 2, good: 3 };

function TrackingIndicator({ level }: { level: ConfidenceLevel }) {
  const lit = CONFIDENCE_BARS[level];
  return (
    <p className={styles.tracking} data-level={level}>
      <span className={styles.bars} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={styles.bar} data-on={n <= lit ? "" : undefined} />
        ))}
      </span>
      <span>
        <span className="sr-only">Tracking </span>
        {CONFIDENCE_LABEL[level]}
      </span>
    </p>
  );
}

/** Shown instead of form feedback while the phone is on its side / upside down. */
export const TILTED_COPY = "Your phone isn't upright. Stand it upright in portrait to keep counting.";

export interface HudVerification {
  /** The live check prompt (ChallengePrompt), when one is open. */
  challenge?: ReactNode;
  /** Short status line, e.g. "Verified run" or a connection warning. */
  note: string;
  tone: "ok" | "warn";
  /** E.g. "Retry" after the verifier could not be reached. */
  action?: { label: string; onClick: () => void };
}

export interface HudProps {
  exercise: ExerciseKind;
  hud: HudSnapshot;
  fps: number;
  delegate: "GPU" | "CPU" | null;
  fit: FitMode;
  /** The phone is not upright: nothing is being counted until it is. */
  tilted?: boolean;
  /** Goal in the exercise unit; the staked goal on a verified run. Default: the exercise default. */
  goal?: number;
  /** Present on a verified (staked) run. */
  verification?: HudVerification | null;
  onToggleFit: () => void;
  onEnd: () => void;
}

/** Live workout heads-up display. Pure presentation; values come from the HUD tracker. */
export default function Hud({
  exercise,
  hud,
  fps,
  delegate,
  fit,
  tilted = false,
  goal,
  verification = null,
  onToggleFit,
  onEnd,
}: HudProps) {
  const info = EXERCISES[exercise];
  const target = goal ?? info.defaultGoal;
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    // The HUD replaces the loading panel (or the Start button): land focus on its heading so
    // screen-reader users know the workout is live and can move on to "End workout".
    headingRef.current?.focus();
  }, []);
  const timed = info.unit === "seconds";
  const holdMs = hud.holdTenths * 100;
  const value = timed ? holdMs / 1000 : hud.reps;
  const fraction = target > 0 ? Math.min(1, value / target) : 0;
  const active = hud.phase === "holding" || hud.phase === "up" || hud.phase === "down";
  const unitLabel = timed ? "held" : hud.reps === 1 ? "rep" : "reps";

  return (
    <div className={styles.hud}>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {info.name} workout in progress
      </h1>
      <div className={styles.hudTop}>
        <p className={styles.phase} data-active={active ? "" : undefined} data-phase={hud.phase}>
          <span className={styles.phaseDot} aria-hidden="true" />
          {phaseLabel(hud.phase, exercise)}
        </p>
        <div className={styles.hudTopRight}>
          <TrackingIndicator level={hud.confidence} />
          <button
            type="button"
            className={styles.iconButton}
            onClick={onToggleFit}
            aria-label={fit === "cover" ? "Show the full camera frame" : "Fill the screen"}
          >
            {fit === "cover" ? <ShrinkIcon size={22} /> : <ExpandIcon size={22} />}
          </button>
        </div>
      </div>

      {verification ? (
        <div className={styles.verifiedRow}>
          <p className={styles.verifiedPill} data-tone={verification.tone}>
            <ShieldIcon size={16} />
            <span>{verification.note}</span>
          </p>
          {verification.action ? (
            <button type="button" className={styles.verifiedAction} onClick={verification.action.onClick}>
              {verification.action.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {verification?.challenge ?? null}

      {timed ? (
        <div className={styles.counterBlock}>
          <ProgressRing fraction={fraction} size={208} stroke={10} label="Goal progress">
            <p className={styles.ringValue} data-goal={hud.goalReached ? "" : undefined}>
              {formatClock(holdMs)}
            </p>
            <p className={styles.ringGoal}>goal {formatGoal(target, info.unit)}</p>
          </ProgressRing>
        </div>
      ) : (
        <div className={styles.counterBlock}>
          <p className={styles.counter} data-goal={hud.goalReached ? "" : undefined}>
            {hud.reps}
          </p>
          <p className={styles.counterGoal}>
            <span className="sr-only">{unitLabel}, goal</span>
            <span aria-hidden="true">of</span> {formatGoal(target, info.unit)}
          </p>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Goal progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction * 100)}
          >
            <span className={styles.progressFill} style={{ transform: `scaleX(${fraction})` }} />
          </div>
        </div>
      )}

      {hud.celebrating ? (
        <p className={styles.celebrate}>
          <TrophyIcon size={20} />
          Goal reached! Keep going or end.
        </p>
      ) : null}

      <div className={styles.hudBottom}>
        {tilted ? (
          <div className={styles.toast} data-tone="tracking">
            <CameraIcon size={22} />
            <p>{TILTED_COPY}</p>
          </div>
        ) : (
          <FormFeedback issue={hud.issue} rejection={hud.rejection} />
        )}
        <p className={styles.hudMeta}>
          {!timed ? <span>{hud.rejectedReps} not counted</span> : null}
          <span>
            {fps > 0 ? Math.round(fps) : "–"} fps{delegate ? ` · ${delegate}` : ""}
          </span>
        </p>
        <button type="button" className={styles.endButton} onClick={onEnd}>
          <StopIcon size={20} />
          End workout
        </button>
      </div>
    </div>
  );
}
