/**
 * Turns the per-frame engine output into the few values the HUD displays, without React state
 * churn: a new HUD snapshot is produced only when a displayed value changes, throttled to one
 * per `publishIntervalMs` (rep count / goal / rejection changes publish immediately).
 * Also debounces form issues, expires "rep not counted" notices, throttles screen-reader
 * announcements and decides when to vibrate. Pure (no DOM), driven by frame timestamps.
 */
import type { GoalUnit } from "@/lib/exercises";
import type { EngineEvent, EnginePhase, EngineState, ExerciseKind, FormIssue } from "@/lib/pose/types";
import { FORM_ISSUE_COPY } from "./formIssueCopy";

export type ConfidenceLevel = "none" | "low" | "fair" | "good";

export interface HudSnapshot {
  reps: number;
  rejectedReps: number;
  phase: EnginePhase;
  /** Debounced top form issue. */
  issue: FormIssue | null;
  /** Hold time floored to 100 ms steps. */
  holdTenths: number;
  confidence: ConfidenceLevel;
  /** Reason of the most recent rejected rep while its notice is showing. */
  rejection: FormIssue | null;
  goalReached: boolean;
  /** True for a few seconds after the goal is first reached. */
  celebrating: boolean;
}

export interface HudTrackerOptions {
  exercise: ExerciseKind;
  unit: GoalUnit;
  /** Goal in `unit` (reps or seconds). 0 disables goal handling. */
  goal: number;
  publishIntervalMs?: number;
  issueStableMs?: number;
  rejectionShowMs?: number;
  celebrateMs?: number;
  announceIntervalMs?: number;
  /** Plank: announce the hold time every N seconds. */
  holdAnnounceEverySec?: number;
}

export interface HudTrackerOutput {
  hud: HudSnapshot | null;
  announce: string | null;
  vibrate: number | number[] | null;
}

export interface HudTracker {
  readonly snapshot: HudSnapshot;
  update(state: EngineState, events: readonly EngineEvent[], nowMs: number, hasPose: boolean): HudTrackerOutput;
}

/** Thresholds for the tracking-confidence indicator. */
export const CONFIDENCE_FAIR = 0.5;
export const CONFIDENCE_GOOD = 0.75;

export function confidenceLevel(confidence: number, hasPose: boolean): ConfidenceLevel {
  if (!hasPose) return "none";
  if (confidence >= CONFIDENCE_GOOD) return "good";
  if (confidence >= CONFIDENCE_FAIR) return "fair";
  return "low";
}

export function hudEqual(a: HudSnapshot, b: HudSnapshot): boolean {
  return (
    a.reps === b.reps &&
    a.rejectedReps === b.rejectedReps &&
    a.phase === b.phase &&
    a.issue === b.issue &&
    a.holdTenths === b.holdTenths &&
    a.confidence === b.confidence &&
    a.rejection === b.rejection &&
    a.goalReached === b.goalReached &&
    a.celebrating === b.celebrating
  );
}

export const INITIAL_HUD: HudSnapshot = {
  reps: 0,
  rejectedReps: 0,
  phase: "searching",
  issue: null,
  holdTenths: 0,
  confidence: "none",
  rejection: null,
  goalReached: false,
  celebrating: false,
};

// Announcement priorities: higher replaces a pending lower one.
const PRIORITY = { hold: 1, issue: 2, rejected: 3, rep: 4, goal: 5 } as const;

export function createHudTracker(options: HudTrackerOptions): HudTracker {
  const {
    unit,
    goal,
    publishIntervalMs = 100,
    issueStableMs = 300,
    rejectionShowMs = 2200,
    celebrateMs = 3500,
    announceIntervalMs = 1500,
    holdAnnounceEverySec = 10,
  } = options;

  let published: HudSnapshot = INITIAL_HUD;
  let lastPublishMs = Number.NEGATIVE_INFINITY;

  let issueCandidate: FormIssue | null = null;
  let issueCandidateSince = 0;
  let stableIssue: FormIssue | null = null;

  let rejection: { reason: FormIssue; atMs: number } | null = null;
  let goalReachedAtMs: number | null = null;

  let pending: { text: string; priority: number } | null = null;
  let lastAnnounceMs = Number.NEGATIVE_INFINITY;
  let lastHoldMilestone = 0;

  function queue(text: string, priority: number) {
    if (!pending || priority >= pending.priority) pending = { text, priority };
  }

  return {
    get snapshot() {
      return published;
    },

    update(state, events, nowMs, hasPose) {
      let vibrate: number | number[] | null = null;

      for (const event of events) {
        if (event.type === "rep") {
          vibrate = 30;
          queue(`${event.repIndex} ${event.repIndex === 1 ? "rep" : "reps"}`, PRIORITY.rep);
        } else if (event.type === "rep_rejected") {
          rejection = { reason: event.reason, atMs: nowMs };
          queue(`Rep not counted. ${FORM_ISSUE_COPY[event.reason]}`, PRIORITY.rejected);
        }
      }

      // Debounce the top issue so the toast doesn't flicker between frames.
      const rawIssue = state.formIssues[0] ?? null;
      if (rawIssue !== issueCandidate) {
        issueCandidate = rawIssue;
        issueCandidateSince = nowMs;
      }
      if (issueCandidate !== stableIssue && nowMs - issueCandidateSince >= issueStableMs) {
        stableIssue = issueCandidate;
        if (stableIssue) queue(FORM_ISSUE_COPY[stableIssue], PRIORITY.issue);
      }

      if (rejection && nowMs - rejection.atMs >= rejectionShowMs) rejection = null;

      // Goal: celebrate once, never auto-end.
      const value = unit === "seconds" ? state.holdMs / 1000 : state.reps;
      if (goalReachedAtMs === null && goal > 0 && value >= goal) {
        goalReachedAtMs = nowMs;
        vibrate = [60, 50, 60];
        queue("Goal reached! Keep going, or tap End when you're done.", PRIORITY.goal);
      }

      if (unit === "seconds" && holdAnnounceEverySec > 0) {
        const seconds = Math.floor(state.holdMs / 1000);
        const milestone = seconds - (seconds % holdAnnounceEverySec);
        if (milestone > lastHoldMilestone) {
          lastHoldMilestone = milestone;
          queue(`${milestone} seconds`, PRIORITY.hold);
        }
      }

      const next: HudSnapshot = {
        reps: state.reps,
        rejectedReps: state.rejectedReps,
        phase: state.phase,
        issue: stableIssue,
        holdTenths: Math.floor(state.holdMs / 100),
        confidence: confidenceLevel(state.trackingConfidence, hasPose),
        rejection: rejection?.reason ?? null,
        goalReached: goalReachedAtMs !== null,
        celebrating: goalReachedAtMs !== null && nowMs - goalReachedAtMs < celebrateMs,
      };

      let hud: HudSnapshot | null = null;
      if (!hudEqual(next, published)) {
        const urgent =
          next.reps !== published.reps ||
          next.goalReached !== published.goalReached ||
          next.rejection !== published.rejection;
        if (urgent || nowMs - lastPublishMs >= publishIntervalMs) {
          published = next;
          lastPublishMs = nowMs;
          hud = next;
        }
      }

      let announce: string | null = null;
      if (pending && nowMs - lastAnnounceMs >= announceIntervalMs) {
        announce = pending.text;
        pending = null;
        lastAnnounceMs = nowMs;
      }

      return { hud, announce, vibrate };
    },
  };
}
