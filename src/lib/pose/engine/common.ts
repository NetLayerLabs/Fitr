/**
 * Shared machinery for the rep engines: frame validation, side selection, visibility gating,
 * glitch ("teleport") detection, frame-gap handling, debouncing, issue bookkeeping, event
 * emission and session summary accumulation.
 *
 * Everything here is pure and deterministic: time only ever comes from frame.timestampMs.
 */
import { LANDMARK_COUNT, SIDE_JOINTS, type SideJoints } from "@/lib/pose/landmarks";
import {
  distance,
  frameAspect,
  isFiniteNumber,
  meanVisibility,
  minVisibility,
  toImagePoints,
  type Point2,
} from "@/lib/pose/geometry";
import { OneEuroFilter } from "@/lib/pose/filters";
import type {
  EngineEvent,
  EnginePhase,
  EngineState,
  EngineUpdate,
  ExerciseKind,
  FormIssue,
  Landmark,
  PoseFrame,
  RepEngine,
  SessionSummary,
} from "@/lib/pose/types";
import type { CommonEngineConfig } from "./config";

export type JointName = keyof SideJoints;
export type TrackedSide = "left" | "right";
/** Landmark indices of one body side, keyed by joint name. */
export type SideJointIndices = { readonly [K in JointName]: number };

/** Order used for EngineState.formIssues: tracking problems, then posture, then rep quality. */
export const ISSUE_PRIORITY: readonly FormIssue[] = [
  "body_not_visible",
  "unstable_tracking",
  "face_camera",
  "turn_side_on",
  "body_not_horizontal",
  "body_on_floor",
  "hips_sagging",
  "hips_piked",
  "keep_hips_high",
  "keep_back_on_wall",
  "chest_up",
  "chin_over_bar",
  "go_lower",
  "go_higher",
  "arms_overhead",
  "jump_higher",
  "extend_fully",
  "too_fast",
];

/** De-duplicate and order issues by ISSUE_PRIORITY. */
export function sortIssues(issues: Iterable<FormIssue>): FormIssue[] {
  const set = new Set(issues);
  return ISSUE_PRIORITY.filter((issue) => set.has(issue));
}

// ---------------------------------------------------------------------------------------
// Frame reading (never throws)
// ---------------------------------------------------------------------------------------

/** frame.timestampMs when it is a finite number, else null. */
export function readTimestamp(frame: unknown): number | null {
  if (!frame || typeof frame !== "object") return null;
  const t = (frame as Partial<PoseFrame>).timestampMs;
  return isFiniteNumber(t) ? t : null;
}

/**
 * The landmark array when it has at least 33 entries and at least one of them is a real
 * point (finite x and y), else null (= no pose).
 */
export function readPoseLandmarks(frame: unknown): Landmark[] | null {
  if (!frame || typeof frame !== "object") return null;
  const lms = (frame as Partial<PoseFrame>).landmarks;
  if (!Array.isArray(lms) || lms.length < LANDMARK_COUNT) return null;
  const anyPoint = lms.some(
    (lm: unknown) =>
      !!lm && typeof lm === "object" && isFiniteNumber((lm as Landmark).x) && isFiniteNumber((lm as Landmark).y),
  );
  return anyPoint ? lms : null;
}

/** imageWidth / imageHeight, or null when the frame has no usable dimensions. */
export function readAspect(frame: unknown): number | null {
  if (!frame || typeof frame !== "object") return null;
  const f = frame as Partial<PoseFrame>;
  return frameAspect(f.imageWidth as number, f.imageHeight as number);
}

// ---------------------------------------------------------------------------------------
// Small stateful helpers
// ---------------------------------------------------------------------------------------

/**
 * Confirms a condition only after it has held for >= minFrames consecutive frames AND
 * >= minMs between the first and the latest of those frames.
 */
export class Debouncer {
  private count = 0;
  private since: number | null = null;

  constructor(
    private readonly minFrames: number,
    private readonly minMs: number,
  ) {}

  update(condition: boolean, t: number): boolean {
    if (!condition) {
      this.count = 0;
      this.since = null;
      return false;
    }
    if (this.since === null) this.since = t;
    this.count++;
    return this.count >= this.minFrames && t - this.since >= this.minMs;
  }

  reset(): void {
    this.count = 0;
    this.since = null;
  }
}

export interface SideCandidate {
  /** Mean visibility of the joints this exercise needs on that side. */
  score: number;
  /** Every required joint on that side passes the visibility threshold. */
  usable: boolean;
}

/**
 * Picks the body side to read. Starts with the better side, then only switches when the
 * current side becomes unusable while the other is usable, or the other side's score beats
 * the current one by more than `margin` (hysteresis, so near-equal sides do not flip-flop).
 */
export class SideSelector {
  private current: TrackedSide | null = null;

  constructor(private readonly margin: number) {}

  get side(): TrackedSide | null {
    return this.current;
  }

  select(left: SideCandidate, right: SideCandidate): TrackedSide {
    if (this.current === null) {
      if (left.usable !== right.usable) this.current = left.usable ? "left" : "right";
      else this.current = right.score > left.score ? "right" : "left";
      return this.current;
    }
    const cur = this.current === "left" ? left : right;
    const other = this.current === "left" ? right : left;
    if ((other.usable && !cur.usable) || other.score > cur.score + this.margin) {
      this.current = this.current === "left" ? "right" : "left";
    }
    return this.current;
  }

  reset(): void {
    this.current = null;
  }
}

/**
 * Detects single-frame tracking glitches: a key joint jumping further than `maxJump`
 * (aspect-corrected units = frame heights) between consecutive pose frames.
 *
 * A frame is a glitch only if it is far from BOTH the previous raw frame and the last
 * accepted frame. So a one-frame spike is flagged once (the frame after it is close to the
 * last accepted pose again), while a genuine relocation is accepted on its second frame
 * (it is close to the previous raw frame) instead of being flagged forever.
 */
export class JumpDetector {
  private prevRaw: readonly Point2[] | null = null;
  private accepted: readonly Point2[] | null = null;

  check(points: readonly Point2[], indices: readonly number[], maxJump: number): boolean {
    const prev = this.prevRaw;
    const acc = this.accepted;
    this.prevRaw = points;
    if (!prev || !acc) {
      this.accepted = points;
      return false;
    }
    let farFromPrev = false;
    let farFromAccepted = false;
    for (const i of indices) {
      const p = points[i];
      if (!p) continue;
      if (prev[i] && distance(p, prev[i]) > maxJump) farFromPrev = true;
      if (acc[i] && distance(p, acc[i]) > maxJump) farFromAccepted = true;
    }
    const jump = farFromPrev && farFromAccepted;
    if (!jump) this.accepted = points;
    return jump;
  }

  reset(): void {
    this.prevRaw = null;
    this.accepted = null;
  }
}

// ---------------------------------------------------------------------------------------
// Rep cycle (up -> down -> up) shared by push-ups and squats
// ---------------------------------------------------------------------------------------

export interface RepThresholds {
  upAngleDeg: number;
  downAngleDeg: number;
  partialAngleDeg: number;
}

export type RepCycleEvent =
  | { type: "none" }
  /** Depth reached: the rep attempt is now at the bottom. */
  | { type: "down" }
  /** Came back to the top from the bottom. Validation (speed, form) is up to the engine. */
  | { type: "complete"; durationMs: number; minAngleDeg: number; maxAngleDeg: number }
  /** Came back to the top after dipping below partialAngleDeg but never reaching depth. */
  | { type: "partial" }
  /** Rose above partialAngleDeg from the bottom, then went back to depth without locking out. */
  | { type: "redip" };

/**
 * Hysteresis state machine on a primary angle where "top" is a large angle (elbow / knee
 * extended) and "bottom" a small one. Callers pass the smoothed angle plus the *debounced*
 * top/bottom confirmations.
 *
 * Rep duration runs from the last frame the angle was at/above the top threshold before
 * the descent, to the frame the top is confirmed again.
 */
export class RepCycle {
  private atBottom = false;
  private lastTopT: number | null = null;
  private lastTopAngle = Number.NaN;
  private partial = false;
  private startT = 0;
  private minAngle = Number.POSITIVE_INFINITY;
  private maxAngle = Number.NEGATIVE_INFINITY;
  private rose = false;
  private riseMax = Number.NEGATIVE_INFINITY;
  private riseMaxT = 0;

  constructor(private readonly th: RepThresholds) {}

  get inBottom(): boolean {
    return this.atBottom;
  }

  /** Start tracking from a confirmed top position (entering 'ready'). */
  begin(t: number, angle: number): void {
    this.reset();
    this.lastTopT = t;
    this.lastTopAngle = angle;
  }

  reset(): void {
    this.atBottom = false;
    this.lastTopT = null;
    this.lastTopAngle = Number.NaN;
    this.partial = false;
    this.startT = 0;
    this.minAngle = Number.POSITIVE_INFINITY;
    this.maxAngle = Number.NEGATIVE_INFINITY;
    this.rose = false;
    this.riseMax = Number.NEGATIVE_INFINITY;
    this.riseMaxT = 0;
  }

  step(t: number, angle: number, topConfirmed: boolean, bottomConfirmed: boolean): RepCycleEvent {
    if (!this.atBottom) {
      if (angle >= this.th.upAngleDeg) {
        this.lastTopT = t;
        this.lastTopAngle = angle;
      }
      if (angle < this.th.partialAngleDeg) this.partial = true;
      if (bottomConfirmed) {
        this.atBottom = true;
        this.partial = false;
        this.rose = false;
        this.startT = this.lastTopT ?? t;
        this.minAngle = angle;
        this.maxAngle = Number.isNaN(this.lastTopAngle) ? angle : Math.max(this.lastTopAngle, angle);
        return { type: "down" };
      }
      if (topConfirmed && this.partial) {
        this.partial = false;
        return { type: "partial" };
      }
      return { type: "none" };
    }

    this.minAngle = Math.min(this.minAngle, angle);
    this.maxAngle = Math.max(this.maxAngle, angle);
    if (topConfirmed) {
      const event: RepCycleEvent = {
        type: "complete",
        durationMs: t - this.startT,
        minAngleDeg: this.minAngle,
        maxAngleDeg: this.maxAngle,
      };
      this.atBottom = false;
      this.partial = false;
      this.rose = false;
      this.lastTopT = t;
      this.lastTopAngle = angle;
      return event;
    }
    if (angle > this.th.partialAngleDeg && (!this.rose || angle >= this.riseMax)) {
      this.rose = true;
      this.riseMax = angle;
      this.riseMaxT = t;
    }
    if (this.rose && bottomConfirmed) {
      // The previous attempt never locked out. A new attempt starts from the highest point
      // reached in between.
      this.startT = this.riseMaxT;
      this.minAngle = angle;
      this.maxAngle = this.riseMax;
      this.rose = false;
      return { type: "redip" };
    }
    return { type: "none" };
  }
}

// ---------------------------------------------------------------------------------------
// Base engine
// ---------------------------------------------------------------------------------------

export interface JointRequirements {
  /**
   * Joints that must all be visible on the tracked side. There is deliberately no fallback
   * (e.g. judging a push-up's body line from shoulder-hip-knee when the ankles are out of
   * frame): without the ankle, knee push-ups and knee planks cannot be told apart from the
   * real thing, so such frames count as "body not visible".
   */
  required: readonly JointName[];
}

export interface PoseContext {
  t: number;
  /** ms since the previous processed frame (0 on the first frame). */
  dt: number;
  /** Aspect-corrected points (frame-height units, y down), index-aligned with landmarks. */
  points: readonly Point2[];
  side: TrackedSide;
  joints: SideJointIndices;
  /**
   * True during the freeze window after a tracking glitch: update smoothing and angles for
   * display, but make no phase transitions and count nothing.
   */
  frozen: boolean;
}

interface SideView extends SideCandidate {
  confidence: number;
  keyIndices: number[];
}

/**
 * Implements the RepEngine contract around per-exercise hooks. Per frame:
 *  1. ignore frames with a missing / non-increasing timestamp (state unchanged);
 *  2. a gap > maxFrameGapMs since the previous frame calls onGap (cancel in-progress rep);
 *  3. no landmarks, bad image size, or required joints below visibilityThreshold on the
 *     selected side => onLost; after lostTimeoutMs the frame also gets body_not_visible;
 *  4. a key joint jumping > teleportFraction of the frame height => onGlitch (frame not
 *     used), unstable_tracking, and the next glitchFreezeMs of frames arrive frozen;
 *  5. otherwise onPose.
 */
export abstract class BaseEngine<C extends CommonEngineConfig> implements RepEngine {
  readonly exercise: ExerciseKind;
  protected readonly cfg: C;
  private readonly requirements: JointRequirements;
  private readonly sideSelector: SideSelector;
  private readonly jumps = new JumpDetector();

  protected phase: EnginePhase = "searching";
  protected reps = 0;
  protected rejectedReps = 0;
  protected holdMs = 0;
  protected primaryAngle: number | null = null;
  protected bodyLine: number | null = null;

  private side: TrackedSide | null = null;
  private confidence = 0;
  private lastT: number | null = null;
  private firstT: number | null = null;
  private lastUsableT: number | null = null;
  private freezeUntil = Number.NEGATIVE_INFINITY;
  private frameIssues: FormIssue[] = [];
  private readonly heldIssues = new Map<FormIssue, number>();
  private events: EngineEvent[] = [];
  private state: EngineState;

  private repDurations: number[] = [];
  private framesProcessed = 0;
  private framesWithPose = 0;
  private firstPoseT: number | null = null;
  private lastPoseT: number | null = null;
  private confidenceSum = 0;

  protected constructor(exercise: ExerciseKind, cfg: C, requirements: JointRequirements) {
    this.exercise = exercise;
    this.cfg = cfg;
    this.requirements = requirements;
    this.sideSelector = new SideSelector(cfg.sideSwitchMargin);
    this.state = this.buildState(null);
  }

  // --- hooks -----------------------------------------------------------------------------

  /** A usable pose on the selected side. */
  protected abstract onPose(ctx: PoseContext): void;
  /** The frame that triggered glitch detection; its landmarks must not be used. */
  protected abstract onGlitch(t: number, dt: number): void;
  /** No usable pose this frame; `lostMs` = time since the last usable pose (or first frame). */
  protected abstract onLost(t: number, dt: number, lostMs: number): void;
  /** Called before processing a frame that arrives > maxFrameGapMs after the previous one. */
  protected abstract onGap(t: number): void;
  /** Reset exercise-specific state (called from reset()). */
  protected abstract resetExercise(): void;

  // --- RepEngine ---------------------------------------------------------------------------

  update(frame: PoseFrame): EngineUpdate {
    this.events = [];
    this.frameIssues = [];
    this.framesProcessed++;

    const t = readTimestamp(frame);
    if (t === null || (this.lastT !== null && t <= this.lastT)) {
      return { state: this.getState(), events: [] };
    }
    const dt = this.lastT === null ? 0 : t - this.lastT;
    if (this.lastT !== null && dt > this.cfg.maxFrameGapMs) {
      this.jumps.reset();
      this.freezeUntil = Number.NEGATIVE_INFINITY;
      this.onGap(t);
    }
    this.lastT = t;
    if (this.firstT === null) this.firstT = t;

    const landmarks = readPoseLandmarks(frame);
    const aspect = landmarks ? readAspect(frame) : null;
    let usable = false;
    this.confidence = 0;

    if (landmarks) {
      this.framesWithPose++;
      if (this.firstPoseT === null) this.firstPoseT = t;
      this.lastPoseT = t;
    }

    if (landmarks && aspect !== null) {
      const left = this.viewSide(landmarks, "left");
      const right = this.viewSide(landmarks, "right");
      const side = this.sideSelector.select(left, right);
      const view = side === "left" ? left : right;
      this.confidence = view.confidence;
      if (view.usable) {
        usable = true;
        this.side = side;
        this.lastUsableT = t;
        const points = toImagePoints(landmarks, aspect);
        if (this.jumps.check(points, view.keyIndices, this.cfg.teleportFraction)) {
          this.freezeUntil = t + this.cfg.glitchFreezeMs;
          this.flagIssue("unstable_tracking");
          this.onGlitch(t, dt);
        } else {
          const frozen = t < this.freezeUntil;
          if (frozen) this.flagIssue("unstable_tracking");
          this.onPose({
            t,
            dt,
            points,
            side,
            joints: SIDE_JOINTS[side],
            frozen,
          });
        }
      }
    }
    if (landmarks) this.confidenceSum += this.confidence;

    if (!usable) {
      const lostMs = t - (this.lastUsableT ?? this.firstT);
      if (lostMs >= this.cfg.lostTimeoutMs) {
        this.flagIssue("body_not_visible");
        this.side = null;
        // The body may legitimately reappear elsewhere; do not treat that as a glitch.
        this.jumps.reset();
      }
      this.onLost(t, dt, lostMs);
    }

    this.state = this.buildState(t);
    return { state: this.getState(), events: this.events };
  }

  getState(): EngineState {
    return { ...this.state, formIssues: [...this.state.formIssues] };
  }

  summary(): SessionSummary {
    return {
      exercise: this.exercise,
      reps: this.reps,
      rejectedReps: this.rejectedReps,
      holdMs: this.holdMs,
      repDurationsMs: [...this.repDurations],
      activeMs:
        this.firstPoseT !== null && this.lastPoseT !== null ? this.lastPoseT - this.firstPoseT : 0,
      framesProcessed: this.framesProcessed,
      framesWithPose: this.framesWithPose,
      avgTrackingConfidence: this.framesWithPose > 0 ? this.confidenceSum / this.framesWithPose : 0,
    };
  }

  reset(): void {
    this.sideSelector.reset();
    this.jumps.reset();
    this.phase = "searching";
    this.reps = 0;
    this.rejectedReps = 0;
    this.holdMs = 0;
    this.primaryAngle = null;
    this.bodyLine = null;
    this.side = null;
    this.confidence = 0;
    this.lastT = null;
    this.firstT = null;
    this.lastUsableT = null;
    this.freezeUntil = Number.NEGATIVE_INFINITY;
    this.frameIssues = [];
    this.heldIssues.clear();
    this.events = [];
    this.repDurations = [];
    this.framesProcessed = 0;
    this.framesWithPose = 0;
    this.firstPoseT = null;
    this.lastPoseT = null;
    this.confidenceSum = 0;
    this.resetExercise();
    this.state = this.buildState(null);
  }

  // --- helpers for subclasses ---------------------------------------------------------------

  protected setPhase(to: EnginePhase, t: number): void {
    if (to === this.phase) return;
    this.events.push({ type: "phase", from: this.phase, to, tMs: t });
    this.phase = to;
  }

  protected emit(event: EngineEvent): void {
    this.events.push(event);
  }

  /** Report an issue for the current frame only. */
  protected flagIssue(issue: FormIssue): void {
    this.frameIssues.push(issue);
  }

  /** Keep an issue in formIssues for issueHoldMs (feedback for a rejected / flawed rep). */
  protected holdIssue(issue: FormIssue, t: number): void {
    this.heldIssues.set(issue, t + this.cfg.issueHoldMs);
  }

  protected countRep(t: number, durationMs: number, minAngleDeg: number, maxAngleDeg: number): void {
    this.reps++;
    this.repDurations.push(durationMs);
    this.events.push({ type: "rep", repIndex: this.reps, durationMs, minAngleDeg, maxAngleDeg, tMs: t });
  }

  protected rejectRep(reason: FormIssue, t: number): void {
    this.rejectedReps++;
    this.events.push({ type: "rep_rejected", reason, tMs: t });
    this.holdIssue(reason, t);
  }

  protected newAngleFilter(): OneEuroFilter {
    return new OneEuroFilter(this.cfg.angleFilter);
  }

  protected newDebouncer(): Debouncer {
    return new Debouncer(this.cfg.debounceFrames, this.cfg.debounceMs);
  }

  // --- internals ----------------------------------------------------------------------------

  private viewSide(landmarks: readonly Landmark[], side: TrackedSide): SideView {
    const j: SideJointIndices = SIDE_JOINTS[side];
    const threshold = this.cfg.visibilityThreshold;
    const required = this.requirements.required.map((name) => j[name]);
    const score = meanVisibility(landmarks, required);
    const usable = minVisibility(landmarks, required) >= threshold;
    return { score, usable, confidence: score, keyIndices: required };
  }

  private buildState(t: number | null): EngineState {
    const issues: FormIssue[] = [...this.frameIssues];
    for (const [issue, until] of this.heldIssues) {
      if (t !== null && until > t) issues.push(issue);
      else this.heldIssues.delete(issue);
    }
    return {
      exercise: this.exercise,
      phase: this.phase,
      reps: this.reps,
      rejectedReps: this.rejectedReps,
      holdMs: this.holdMs,
      primaryAngleDeg: this.primaryAngle,
      bodyLineDeg: this.bodyLine,
      formIssues: sortIssues(issues),
      trackingConfidence: this.confidence,
      side: this.side,
    };
  }
}

// ---------------------------------------------------------------------------------------
// Base for up/down rep exercises (push-up, squat)
// ---------------------------------------------------------------------------------------

/**
 * Adds the shared rep cycle plus top/bottom debouncers. Losing tracking for longer than
 * lostTimeoutMs, or a frame gap, abandons any in-progress rep and returns to 'searching'
 * (the start position must be re-confirmed, so a rep can never be completed from a state
 * the engine did not actually observe).
 */
export abstract class CyclicRepEngine<C extends CommonEngineConfig & RepThresholds> extends BaseEngine<C> {
  protected readonly cycle: RepCycle;
  protected readonly topDebounce: Debouncer;
  protected readonly bottomDebounce: Debouncer;

  protected constructor(exercise: ExerciseKind, cfg: C, requirements: JointRequirements) {
    super(exercise, cfg, requirements);
    this.cycle = new RepCycle(cfg);
    this.topDebounce = this.newDebouncer();
    this.bottomDebounce = this.newDebouncer();
  }

  /** Reset the exercise's filters and any extra debouncers. */
  protected abstract resetSignals(): void;

  protected resetDebouncers(): void {
    this.topDebounce.reset();
    this.bottomDebounce.reset();
  }

  /** Cancel any attempt and go back to 'searching'; the start position must be shown again. */
  protected cancelSet(t: number): void {
    this.cycle.reset();
    this.resetDebouncers();
    this.setPhase("searching", t);
  }

  /** cancelSet() and also forget smoothing state and angles (tracking lost / frame gap). */
  protected abandon(t: number): void {
    this.cancelSet(t);
    this.resetSignals();
    this.primaryAngle = null;
    this.bodyLine = null;
  }

  protected onGlitch(): void {
    this.resetDebouncers();
  }

  protected onLost(t: number, _dt: number, lostMs: number): void {
    // Frames either side of a dropout are not "consecutive" for debouncing.
    this.resetDebouncers();
    if (lostMs >= this.cfg.lostTimeoutMs) this.abandon(t);
  }

  protected onGap(t: number): void {
    this.abandon(t);
  }

  protected resetExercise(): void {
    this.cycle.reset();
    this.resetDebouncers();
    this.resetSignals();
  }
}
