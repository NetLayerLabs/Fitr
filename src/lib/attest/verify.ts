/**
 * Server-side verdict over a decoded session trace. Pure and deterministic: no I/O, no clock.
 *
 * Re-runs the SAME rep engine the client runs (src/lib/pose/engine) over the trace, so the count
 * is the server's own, never the client's, then applies plausibility checks the client engine
 * does not: bone-length constancy, teleport ratio, cadence, minimum duration, tracking quality,
 * frame rate, trace clock vs server clock, and the live challenges.
 *
 * These checks raise the bar for cheating; they do not make it impossible (see engine/index.ts
 * LIMITS). Product copy: "cheat-resistant", never "un-cheatable".
 */
import { EXERCISES } from "@/lib/exercises";
import { createRepEngine } from "@/lib/pose/engine";
import { LM } from "@/lib/pose/landmarks";
import type { ExerciseKind, Landmark, PoseFrame, SessionSummary } from "@/lib/pose/types";
import { detectChallenge, minSessionMs, type ChallengeType } from "./challenges";

export type VerifyReason =
  | "no_frames"
  | "below_goal"
  | "session_too_short"
  | "trace_ahead_of_clock"
  | "teleporting_joints"
  | "bone_length_inconsistent"
  | "cadence_implausible"
  | "low_tracking_confidence"
  | "frame_rate_implausible"
  | "challenge_not_issued"
  | "challenge_missed"
  | "duplicate_session";

export interface ChunkReceipt {
  seq: number;
  /** Trace time of the chunk's first / last frame (null when it had no frames). */
  firstMs: number | null;
  lastMs: number | null;
  /** Server ms since session start when the chunk arrived. */
  receivedAtElapsedMs: number;
}

export interface ChallengeRecord {
  id: string;
  type: ChallengeType;
  atMsFromStart: number;
  windowMs: number;
  /** Trace time from which an answer counts (last frame of the chunk whose response revealed it). */
  revealedAtTraceMs: number | null;
}

export interface VerifyConfig {
  /** Trace may run ahead of the server clock by at most this much (network / clock slack). */
  clockSlackMs: number;
  /** Extra ms after a challenge window in which a late answer still counts. */
  challengeSlackMs: number;
  /** A pair of consecutive frames "teleports" if a visible key joint moves > this x frame height. */
  teleportFraction: number;
  /** Only frame pairs closer than this are judged for teleports. */
  teleportMaxDtMs: number;
  /** Fail when teleporting pairs exceed this fraction of judged pairs (and teleportMinCount). */
  teleportMaxRatio: number;
  teleportMinCount: number;
  /** A bone deviates when |ratio / median - 1| exceeds this. */
  boneDeviation: number;
  /** Fail when more than this fraction of frames has a deviating bone. */
  boneMaxBadFraction: number;
  /** Need at least this many measured frames for the bone check to apply. */
  boneMinFrames: number;
  /** Minimum median rep duration (ms) per exercise (ignored for timed holds). */
  minMedianRepMs: Record<ExerciseKind, number>;
  /** Maximum reps per active minute (ignored for timed holds). */
  maxRepsPerMinute: Record<ExerciseKind, number>;
  minAvgTrackingConfidence: number;
  minPoseFrameFraction: number;
  minFps: number;
  maxFps: number;
}

export const VERIFY_DEFAULTS: VerifyConfig = Object.freeze({
  clockSlackMs: 1500,
  challengeSlackMs: 1500,
  teleportFraction: 0.25,
  teleportMaxDtMs: 150,
  teleportMaxRatio: 0.01,
  teleportMinCount: 3,
  boneDeviation: 0.4,
  boneMaxBadFraction: 0.15,
  boneMinFrames: 30,
  minMedianRepMs: {
    pushup: 600,
    squat: 800,
    plank: 0,
    lunge: 600,
    situp: 700,
    leg_raise: 800,
    glute_bridge: 600,
    wall_sit: 0,
    pike_pushup: 700,
    jump_squat: 700,
    pullup: 1000,
    dip: 600,
    burpee: 1500,
    mountain_climber: 180,
    jumping_jack: 350,
    high_knees: 150,
  },
  maxRepsPerMinute: {
    pushup: 60,
    squat: 50,
    plank: Infinity,
    lunge: 70,
    situp: 60,
    leg_raise: 50,
    glute_bridge: 70,
    wall_sit: Infinity,
    pike_pushup: 60,
    jump_squat: 60,
    pullup: 45,
    dip: 70,
    burpee: 30,
    mountain_climber: 240,
    jumping_jack: 150,
    high_knees: 300,
  },
  minAvgTrackingConfidence: 0.6,
  minPoseFrameFraction: 0.5,
  minFps: 8,
  maxFps: 120,
}) as VerifyConfig;

export interface VerifyInput {
  exercise: ExerciseKind;
  /** Committed goal (reps, or seconds for plank). */
  goalTarget: number;
  /** Decoded trace frames in order (strictly increasing timestamps). */
  frames: readonly PoseFrame[];
  chunks: readonly ChunkReceipt[];
  challenges: readonly ChallengeRecord[];
  /** The same trace content was already accepted in another session. */
  duplicateContent?: boolean;
  config?: Partial<VerifyConfig>;
}

export interface VerifyMetrics {
  durationMs: number;
  frames: number;
  framesWithPose: number;
  fps: number;
  avgTrackingConfidence: number;
  teleportPairs: number;
  judgedPairs: number;
  boneBadFraction: number | null;
  medianRepMs: number | null;
  repsPerMinute: number | null;
  challenges: Array<{ id: string; type: ChallengeType; passed: boolean; atMs: number | null }>;
  engine: SessionSummary;
}

export interface VerifyResult {
  ok: boolean;
  /** Server-computed reps, or whole seconds of valid hold for plank. */
  count: number;
  reasons: VerifyReason[];
  metrics: VerifyMetrics;
}

// ---------------------------------------------------------------------------------------

const KEY_JOINTS = [
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
];

const BONES: ReadonlyArray<readonly [number, number]> = [
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.LEFT_HIP, LM.LEFT_KNEE],
  [LM.LEFT_KNEE, LM.LEFT_ANKLE],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.RIGHT_HIP, LM.RIGHT_KNEE],
  [LM.RIGHT_KNEE, LM.RIGHT_ANKLE],
];

const VIS = 0.5;

function visible(lm: Landmark | undefined): lm is Landmark {
  return !!lm && Number.isFinite(lm.x) && Number.isFinite(lm.y) && (lm.visibility ?? 0) >= VIS;
}

function aspect(f: PoseFrame): number {
  return f.imageWidth > 0 && f.imageHeight > 0 ? f.imageWidth / f.imageHeight : 1;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function teleportStats(frames: readonly PoseFrame[], cfg: VerifyConfig) {
  let judged = 0;
  let jumps = 0;
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1];
    const b = frames[i];
    if (a.landmarks.length === 0 || b.landmarks.length === 0) continue;
    if (b.timestampMs - a.timestampMs > cfg.teleportMaxDtMs) continue;
    const ar = aspect(b);
    let compared = false;
    let jumped = false;
    for (const j of KEY_JOINTS) {
      const p = a.landmarks[j];
      const q = b.landmarks[j];
      if (!visible(p) || !visible(q)) continue;
      compared = true;
      if (Math.hypot((p.x - q.x) * ar, p.y - q.y) > cfg.teleportFraction) {
        jumped = true;
        break;
      }
    }
    if (compared) judged++;
    if (jumped) jumps++;
  }
  return { judged, jumps };
}

/** Fraction of measured frames where a limb bone / torso ratio deviates from its median. */
function boneBadFraction(frames: readonly PoseFrame[], cfg: VerifyConfig): number | null {
  const ratios: number[][] = BONES.map(() => []);
  const perFrame: Array<Array<number | null>> = [];
  for (const f of frames) {
    if (f.landmarks.length === 0) continue;
    const ar = aspect(f);
    const len = (i: number, j: number) => {
      const p = f.landmarks[i];
      const q = f.landmarks[j];
      return visible(p) && visible(q) ? Math.hypot((p.x - q.x) * ar, p.y - q.y) : null;
    };
    const torsos = [len(LM.LEFT_SHOULDER, LM.LEFT_HIP), len(LM.RIGHT_SHOULDER, LM.RIGHT_HIP)].filter(
      (v): v is number => v !== null && v > 1e-4,
    );
    if (torsos.length === 0) continue;
    const torso = Math.max(...torsos);
    const row = BONES.map(([i, j], k) => {
      const l = len(i, j);
      if (l === null) return null;
      const r = l / torso;
      ratios[k].push(r);
      return r;
    });
    if (row.some((r) => r !== null)) perFrame.push(row);
  }
  if (perFrame.length < cfg.boneMinFrames) return null;
  const medians = ratios.map(median);
  let bad = 0;
  for (const row of perFrame) {
    const deviates = row.some((r, k) => {
      const m = medians[k];
      return r !== null && m !== null && m > 0 && Math.abs(r / m - 1) > cfg.boneDeviation;
    });
    if (deviates) bad++;
  }
  return bad / perFrame.length;
}

export function verifySession(input: VerifyInput): VerifyResult {
  const cfg: VerifyConfig = { ...VERIFY_DEFAULTS, ...input.config };
  const { exercise, goalTarget, frames } = input;
  const reasons = new Set<VerifyReason>();

  const engine = createRepEngine(exercise);
  for (const f of frames) engine.update(f);
  const summary = engine.summary();
  const timed = EXERCISES[exercise].unit === "seconds";
  const count = timed ? Math.floor(summary.holdMs / 1000) : summary.reps;

  const durationMs = frames.length > 1 ? frames[frames.length - 1].timestampMs - frames[0].timestampMs : 0;
  const fps = durationMs > 0 ? ((frames.length - 1) * 1000) / durationMs : 0;

  if (frames.length === 0 || summary.framesWithPose === 0) reasons.add("no_frames");
  if (count < goalTarget) reasons.add("below_goal");
  if (durationMs < minSessionMs(exercise, goalTarget)) reasons.add("session_too_short");

  // The trace clock must never be ahead of the server's: a pre-recorded trace uploaded faster
  // than real time fails here.
  for (const c of input.chunks) {
    if (c.lastMs !== null && c.lastMs > c.receivedAtElapsedMs + cfg.clockSlackMs) {
      reasons.add("trace_ahead_of_clock");
      break;
    }
  }

  const tele = teleportStats(frames, cfg);
  if (tele.jumps >= cfg.teleportMinCount && tele.jumps > cfg.teleportMaxRatio * Math.max(1, tele.judged)) {
    reasons.add("teleporting_joints");
  }

  const boneBad = boneBadFraction(frames, cfg);
  if (boneBad !== null && boneBad > cfg.boneMaxBadFraction) reasons.add("bone_length_inconsistent");

  let medianRepMs: number | null = null;
  let repsPerMinute: number | null = null;
  if (!timed && summary.reps > 0) {
    medianRepMs = median(summary.repDurationsMs);
    repsPerMinute = summary.activeMs > 0 ? (summary.reps * 60_000) / summary.activeMs : Infinity;
    if (
      (medianRepMs !== null && medianRepMs < cfg.minMedianRepMs[exercise]) ||
      repsPerMinute > cfg.maxRepsPerMinute[exercise]
    ) {
      reasons.add("cadence_implausible");
    }
  }

  const poseFraction = summary.framesProcessed > 0 ? summary.framesWithPose / summary.framesProcessed : 0;
  if (
    summary.framesWithPose > 0 &&
    (summary.avgTrackingConfidence < cfg.minAvgTrackingConfidence || poseFraction < cfg.minPoseFrameFraction)
  ) {
    reasons.add("low_tracking_confidence");
  }

  if (frames.length > 1 && (fps < cfg.minFps || fps > cfg.maxFps)) reasons.add("frame_rate_implausible");

  const challengeResults = input.challenges.map((c) => {
    if (c.revealedAtTraceMs === null) {
      reasons.add("challenge_not_issued");
      return { id: c.id, type: c.type, passed: false, atMs: null };
    }
    const from = c.revealedAtTraceMs;
    const det = detectChallenge(c.type, frames, from, from + c.windowMs + cfg.challengeSlackMs);
    if (!det.passed) reasons.add("challenge_missed");
    return { id: c.id, type: c.type, passed: det.passed, atMs: det.atMs };
  });

  if (input.duplicateContent) reasons.add("duplicate_session");

  return {
    ok: reasons.size === 0,
    count,
    reasons: [...reasons],
    metrics: {
      durationMs,
      frames: frames.length,
      framesWithPose: summary.framesWithPose,
      fps,
      avgTrackingConfidence: summary.avgTrackingConfidence,
      teleportPairs: tele.jumps,
      judgedPairs: tele.judged,
      boneBadFraction: boneBad,
      medianRepMs,
      repsPerMinute,
      challenges: challengeResults,
      engine: summary,
    },
  };
}
