"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  CameraIcon,
  ExpandIcon,
  ShieldIcon,
  ShrinkIcon,
  SpeakerIcon,
  SpeakerOffIcon,
  StopIcon,
  TrophyIcon,
} from "@/components/icons/Icons";
import { EXERCISES } from "@/lib/exercises";
import type { Translator } from "@/lib/i18n";
import { exerciseName, exerciseNameInSentence } from "@/lib/i18n/exercise";
import { useT } from "@/lib/i18n/I18nProvider";
import type { EnginePhase, ExerciseKind } from "@/lib/pose/types";
import FormFeedback from "./FormFeedback";
import { EN_WORKOUT, formatClock, formatGoal } from "./format";
import type { ConfidenceLevel, HudSnapshot } from "./hudTracker";
import type { FitMode } from "./overlay";
import ProgressRing from "./ProgressRing";
import styles from "./WorkoutScreen.module.css";

type WorkoutKey = Parameters<Translator<"workout">>[0];

const PHASE_KEY: Record<EnginePhase, WorkoutKey> = {
  searching: "phaseSearching",
  ready: "phaseReady",
  up: "phaseUp",
  down: "phaseDown",
  holding: "phaseHolding",
  paused: "phasePaused",
};

function phaseLabel(phase: EnginePhase, exercise: ExerciseKind, nameInSentence: string, t: Translator<"workout">): string {
  if (phase === "ready" && EXERCISES[exercise].unit === "seconds") return t("phaseGetInto", { name: nameInSentence });
  return t(PHASE_KEY[phase]);
}

const CONFIDENCE_KEY: Record<ConfidenceLevel, WorkoutKey> = {
  none: "confidenceNone",
  low: "confidenceLow",
  fair: "confidenceFair",
  good: "confidenceGood",
};

const CONFIDENCE_BARS: Record<ConfidenceLevel, number> = { none: 0, low: 1, fair: 2, good: 3 };

function TrackingIndicator({ level }: { level: ConfidenceLevel }) {
  const t = useT("workout");
  const lit = CONFIDENCE_BARS[level];
  return (
    <p className={styles.tracking} data-level={level}>
      <span className={styles.bars} aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={styles.bar} data-on={n <= lit ? "" : undefined} />
        ))}
      </span>
      <span>
        <span className="sr-only">{t("trackingLabel")} </span>
        {t(CONFIDENCE_KEY[level])}
      </span>
    </p>
  );
}

/**
 * Shown instead of form feedback while the phone is on its side / upside down (English; screens
 * render t("phoneTilted")).
 */
export const TILTED_COPY = EN_WORKOUT("phoneTilted");

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
  /** Voice coach on/off (the You-tab setting). The button shows only when a handler is given. */
  voiceOn?: boolean;
  onToggleVoice?: () => void;
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
  voiceOn = false,
  onToggleVoice,
  onEnd,
}: HudProps) {
  const t = useT("workout");
  const tx = useT("exercises");
  const name = exerciseName(tx, exercise);
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

  return (
    <div className={styles.hud}>
      <h1 ref={headingRef} tabIndex={-1} className="sr-only">
        {t("hudHeading", { name })}
      </h1>
      <div className={styles.hudTop}>
        <p className={styles.phase} data-active={active ? "" : undefined} data-phase={hud.phase}>
          <span className={styles.phaseDot} aria-hidden="true" />
          {phaseLabel(hud.phase, exercise, exerciseNameInSentence(tx, exercise), t)}
        </p>
        <div className={styles.hudTopRight}>
          <TrackingIndicator level={hud.confidence} />
          {onToggleVoice ? (
            <button
              type="button"
              className={styles.iconButton}
              onClick={onToggleVoice}
              aria-pressed={voiceOn}
              aria-label={t("voiceCoach")}
              data-on={voiceOn ? "" : undefined}
            >
              {voiceOn ? <SpeakerIcon size={22} /> : <SpeakerOffIcon size={22} />}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.iconButton}
            onClick={onToggleFit}
            aria-label={fit === "cover" ? t("fitShowFullFrame") : t("fitFillScreen")}
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
          <ProgressRing fraction={fraction} size={208} stroke={10} label={t("goalProgress")}>
            <p className={styles.ringValue} data-goal={hud.goalReached ? "" : undefined}>
              {formatClock(holdMs)}
            </p>
            <p className={styles.ringGoal}>{t("ringGoal", { goal: formatGoal(target, info.unit, t) })}</p>
          </ProgressRing>
        </div>
      ) : (
        <div className={styles.counterBlock}>
          <p className={styles.counter} data-goal={hud.goalReached ? "" : undefined}>
            {hud.reps}
          </p>
          <p className={styles.counterGoal}>
            <span className="sr-only">{t.plural("counterGoalSr", hud.reps)}</span>
            <span aria-hidden="true">{t("counterOf")}</span> {formatGoal(target, info.unit, t)}
          </p>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label={t("goalProgress")}
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
          {t("goalReachedKeepGoing")}
        </p>
      ) : null}

      <div className={styles.hudBottom}>
        {tilted ? (
          <div className={styles.toast} data-tone="tracking">
            <CameraIcon size={22} />
            <p>{t("phoneTilted")}</p>
          </div>
        ) : (
          <FormFeedback issue={hud.issue} rejection={hud.rejection} />
        )}
        <p className={styles.hudMeta}>
          {!timed ? <span>{t("notCountedCount", { count: hud.rejectedReps })}</span> : null}
          <span>
            {t("fps", { fps: fps > 0 ? Math.round(fps) : "–" })}
            {delegate ? ` · ${delegate}` : ""}
          </span>
        </p>
        {verification && hud.goalReached ? (
          <>
            <p className={styles.verifyHint} role="status">
              {t("goalReachedVerifyHint")}
            </p>
            <button type="button" className={`${styles.endButton} ${styles.endButtonVerify}`} onClick={onEnd}>
              <StopIcon size={20} />
              {t("finishAndVerify")}
            </button>
          </>
        ) : (
          <button type="button" className={styles.endButton} onClick={onEnd}>
            <StopIcon size={20} />
            {t("endWorkout")}
          </button>
        )}
      </div>
    </div>
  );
}
