/**
 * Live challenges: short instructions the server reveals mid-workout that a pre-recorded video or
 * landmark replay cannot anticipate (which hand? when?). Pure functions, client-safe.
 *
 * Sides are ANATOMICAL: the runtime feeds MediaPipe the unmirrored camera frame, so LEFT_WRIST is
 * the person's left wrist whether or not the preview is shown mirrored. The detectors therefore
 * read the landmark of the requested side and never look at screen x.
 */
import { LM } from "@/lib/pose/landmarks";
import { EXERCISE_KINDS, type ExerciseKind, type Landmark, type PoseFrame } from "@/lib/pose/types";

export type ChallengeType = "raise_right_hand" | "raise_left_hand" | "hold_still_top";

export const CHALLENGE_TYPES: readonly ChallengeType[] = ["raise_right_hand", "raise_left_hand", "hold_still_top"];

export interface ChallengeSpec {
  type: ChallengeType;
  /** Copy for the prompt. */
  prompt: string;
  /** How long after the reveal the answer is accepted (trace ms). */
  windowMs: number;
  exercises: readonly ExerciseKind[];
}

export const CHALLENGE_SPECS: Record<ChallengeType, ChallengeSpec> = {
  raise_right_hand: {
    type: "raise_right_hand",
    prompt: "Raise your RIGHT hand above your head",
    windowMs: 6000,
    exercises: EXERCISE_KINDS,
  },
  raise_left_hand: {
    type: "raise_left_hand",
    prompt: "Raise your LEFT hand above your head",
    windowMs: 6000,
    exercises: EXERCISE_KINDS,
  },
  hold_still_top: {
    type: "hold_still_top",
    prompt: "Stand tall and hold still for 2 seconds",
    windowMs: 8000,
    exercises: ["squat", "lunge", "jump_squat", "jumping_jack", "high_knees", "burpee"],
  },
};

export function isChallengeType(v: unknown): v is ChallengeType {
  return typeof v === "string" && (CHALLENGE_TYPES as readonly string[]).includes(v);
}

export function challengeTypesFor(exercise: ExerciseKind): ChallengeType[] {
  return CHALLENGE_TYPES.filter((t) => CHALLENGE_SPECS[t].exercises.includes(exercise));
}

// ---------------------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------------------

export interface PlannedChallenge {
  id: string;
  type: ChallengeType;
  /** Server ms after session start when the challenge becomes due. */
  atMsFromStart: number;
  windowMs: number;
}

/**
 * Fastest honest pace per goal unit (ms per rep, or 1000 per second of hold). Deliberately
 * lenient: it only has to rule out traces that are physically too short for the goal.
 * Alternating exercises count each side, so their per-rep time is short.
 */
export const HONEST_MS_PER_UNIT: Readonly<Record<ExerciseKind, number>> = Object.freeze({
  pushup: 700,
  squat: 900,
  plank: 1000,
  lunge: 800,
  situp: 900,
  leg_raise: 1000,
  glute_bridge: 800,
  wall_sit: 1000,
  pike_pushup: 900,
  jump_squat: 900,
  pullup: 1200,
  dip: 800,
  burpee: 2000,
  mountain_climber: 250,
  jumping_jack: 450,
  high_knees: 200,
});

/** Lower bound on how long an honest session for this goal takes (ms). */
export function minSessionMs(exercise: ExerciseKind, goalTarget: number): number {
  return goalTarget * HONEST_MS_PER_UNIT[exercise];
}

/**
 * 1 challenge for short sessions, 2 when the honest minimum is >= 30 s. The first is due 6-14 s
 * in, the second 12-30 s after the first. At least one is a raise-hand (unpredictable side).
 */
export function planChallenges(
  exercise: ExerciseKind,
  goalTarget: number,
  random: () => number,
  makeId: (i: number) => string = (i) => `c${i + 1}`,
): PlannedChallenge[] {
  const count = minSessionMs(exercise, goalTarget) >= 30_000 ? 2 : 1;
  const allowed = challengeTypesFor(exercise);
  const hands: ChallengeType[] = ["raise_right_hand", "raise_left_hand"];
  const out: PlannedChallenge[] = [];
  let at = 6000 + Math.floor(random() * 8000);
  for (let i = 0; i < count; i++) {
    const pool = i === 0 ? hands : allowed;
    const type = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    out.push({ id: makeId(i), type, atMsFromStart: at, windowMs: CHALLENGE_SPECS[type].windowMs });
    at += CHALLENGE_SPECS[type].windowMs + 12_000 + Math.floor(random() * 18_000);
  }
  // Shuffle order of types so "first is always a hand" is not predictable either.
  if (out.length === 2 && random() < 0.5) {
    const [a, b] = out;
    out[0] = { ...a, type: b.type, windowMs: b.windowMs };
    out[1] = { ...b, type: a.type, windowMs: a.windowMs };
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------------------

export interface DetectionResult {
  passed: boolean;
  /** Trace time the response was confirmed, or null. */
  atMs: number | null;
}

export interface RaisedHandOptions {
  minVisibility?: number;
  /** Wrist must be this many torso lengths above both the nose and the shoulder. Default 0.15. */
  marginTorso?: number;
  /** The raise must be held this long. Default 300 ms (and >= 3 frames). */
  holdMs?: number;
  minFrames?: number;
}

interface P {
  x: number;
  y: number;
  ok: boolean;
}

function pt(lms: readonly Landmark[], i: number, aspect: number, minVis: number): P {
  const lm = lms[i];
  if (!lm || !Number.isFinite(lm.x) || !Number.isFinite(lm.y)) return { x: 0, y: 0, ok: false };
  return { x: lm.x * aspect, y: lm.y, ok: (lm.visibility ?? 0) >= minVis };
}

function aspectOf(f: PoseFrame): number | null {
  if (!(f.imageWidth > 0) || !(f.imageHeight > 0)) return null;
  return f.imageWidth / f.imageHeight;
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

function torsoLength(lms: readonly Landmark[], aspect: number, minVis: number): number | null {
  let best: number | null = null;
  for (const [s, h] of [
    [LM.LEFT_SHOULDER, LM.LEFT_HIP],
    [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  ] as const) {
    const a = pt(lms, s, aspect, minVis);
    const b = pt(lms, h, aspect, minVis);
    if (a.ok && b.ok) best = Math.max(best ?? 0, dist(a, b));
  }
  return best !== null && best > 1e-4 ? best : null;
}

function isHandRaised(
  lms: readonly Landmark[],
  aspect: number,
  side: "left" | "right",
  minVis: number,
  marginTorso: number,
  torso: number,
): boolean | null {
  const wrist = pt(lms, side === "left" ? LM.LEFT_WRIST : LM.RIGHT_WRIST, aspect, minVis);
  const shoulder = pt(lms, side === "left" ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER, aspect, minVis);
  const nose = pt(lms, LM.NOSE, aspect, minVis);
  if (!wrist.ok) return null;
  const refs = [shoulder, nose].filter((p) => p.ok);
  if (refs.length === 0) return null;
  const top = Math.min(...refs.map((p) => p.y)); // y grows downwards
  return wrist.y < top - marginTorso * torso;
}

/**
 * The requested (anatomical) hand is clearly above the head while the other hand is not, for at
 * least `holdMs` within [fromMs, toMs].
 */
export function detectRaisedHand(
  frames: readonly PoseFrame[],
  side: "left" | "right",
  fromMs: number,
  toMs: number,
  options: RaisedHandOptions = {},
): DetectionResult {
  const { minVisibility = 0.5, marginTorso = 0.15, holdMs = 300, minFrames = 3 } = options;
  const other = side === "left" ? "right" : "left";
  let runStart: number | null = null;
  let runFrames = 0;
  let prevT: number | null = null;
  for (const f of frames) {
    const t = f.timestampMs;
    if (t < fromMs) continue;
    if (t > toMs) break;
    const aspect = aspectOf(f);
    let good = false;
    if (aspect !== null && f.landmarks.length > 0) {
      const torso = torsoLength(f.landmarks, aspect, minVisibility);
      if (torso !== null) {
        const asked = isHandRaised(f.landmarks, aspect, side, minVisibility, marginTorso, torso);
        const wrong = isHandRaised(f.landmarks, aspect, other, minVisibility, marginTorso, torso);
        good = asked === true && wrong !== true;
      }
    }
    // A frame gap > 300 ms breaks the run.
    if (!good || (prevT !== null && t - prevT > 300)) {
      runStart = good ? t : null;
      runFrames = good ? 1 : 0;
    } else {
      if (runStart === null) runStart = t;
      runFrames++;
    }
    prevT = t;
    if (runStart !== null && runFrames >= minFrames && t - runStart >= holdMs) return { passed: true, atMs: t };
  }
  return { passed: false, atMs: null };
}

export interface HoldStillOptions {
  minVisibility?: number;
  /** Required still time. Default 2000 ms. */
  holdMs?: number;
  /** Max drift of hip / shoulder / knee from the start of the hold, in torso lengths. Default 0.12. */
  maxDriftTorso?: number;
  /** Minimum interior knee angle to count as standing tall. Default 160. */
  minKneeDeg?: number;
}

function kneeAngleDeg(hip: P, knee: P, ankle: P): number {
  const a = { x: hip.x - knee.x, y: hip.y - knee.y };
  const b = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const den = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (den <= 0) return 0;
  const c = Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / den));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Standing upright (knee >= minKneeDeg) and still for `holdMs` within [fromMs, toMs]. */
export function detectHoldStill(
  frames: readonly PoseFrame[],
  fromMs: number,
  toMs: number,
  options: HoldStillOptions = {},
): DetectionResult {
  const { minVisibility = 0.5, holdMs = 2000, maxDriftTorso = 0.12, minKneeDeg = 160 } = options;
  let anchor: { t: number; pts: P[]; torso: number } | null = null;
  let prevT: number | null = null;
  for (const f of frames) {
    const t = f.timestampMs;
    if (t < fromMs) continue;
    if (t > toMs) break;
    const aspect = aspectOf(f);
    let pts: P[] | null = null;
    let torso: number | null = null;
    if (aspect !== null && f.landmarks.length > 0) {
      torso = torsoLength(f.landmarks, aspect, minVisibility);
      for (const s of ["left", "right"] as const) {
        const L = s === "left";
        const sh = pt(f.landmarks, L ? LM.LEFT_SHOULDER : LM.RIGHT_SHOULDER, aspect, minVisibility);
        const hip = pt(f.landmarks, L ? LM.LEFT_HIP : LM.RIGHT_HIP, aspect, minVisibility);
        const knee = pt(f.landmarks, L ? LM.LEFT_KNEE : LM.RIGHT_KNEE, aspect, minVisibility);
        const ankle = pt(f.landmarks, L ? LM.LEFT_ANKLE : LM.RIGHT_ANKLE, aspect, minVisibility);
        if (sh.ok && hip.ok && knee.ok && ankle.ok && kneeAngleDeg(hip, knee, ankle) >= minKneeDeg) {
          pts = [sh, hip, knee];
          break;
        }
      }
    }
    const gap = prevT !== null && t - prevT > 300;
    prevT = t;
    if (!pts || torso === null) {
      anchor = null;
      continue;
    }
    const drifted =
      anchor !== null && pts.some((p, i) => dist(p, anchor!.pts[i]) > maxDriftTorso * anchor!.torso);
    if (anchor === null || gap || drifted) {
      anchor = { t, pts, torso };
      continue;
    }
    if (t - anchor.t >= holdMs) return { passed: true, atMs: t };
  }
  return { passed: false, atMs: null };
}

export function detectChallenge(
  type: ChallengeType,
  frames: readonly PoseFrame[],
  fromMs: number,
  toMs: number,
): DetectionResult {
  switch (type) {
    case "raise_right_hand":
      return detectRaisedHand(frames, "right", fromMs, toMs);
    case "raise_left_hand":
      return detectRaisedHand(frames, "left", fromMs, toMs);
    case "hold_still_top":
      return detectHoldStill(frames, fromMs, toMs);
  }
}
