/**
 * Jumping-jack engine (FRONT view, both body sides; see ../front/engine.ts for the view gates).
 *
 * Signals (aspect-corrected 2D, One Euro smoothed):
 *  - arm angle per side: hip-shoulder-wrist (0 = arm hanging, 90 = out sideways, 180 =
 *    straight overhead). The engine uses the LOWER of the two arms ("arms") for "overhead" and
 *    the HIGHER of the two for "down", so both arms must do the full movement;
 *  - feet spread: ankle-to-ankle distance / shoulder width (scale and distance invariant).
 *    Smoothed as percent (x100) so the shared degree-tuned filter behaves the same.
 *
 * Rep = closed -> open -> closed:
 *  - closed: both arms <= closedArmDeg (50) AND spread <= closedSpreadRatio (1.1);
 *  - open: both arms >= openArmDeg (140, wrists above the head) AND spread >= openSpreadRatio
 *    (1.5 shoulder widths);
 *  - both debounced (>= 2 frames and >= 50 ms). The rep counts when closed is confirmed
 *    again; its duration runs from the last closed frame before the attempt.
 *
 * ANTI-CHEAT / rejections:
 *  - Square-on and upright view gates (FrontEngine): side-on (face_camera) or lying down
 *    ("snow angels", chest_up) never counts and abandons the set after lostTimeoutMs.
 *  - Both halves are required. Arms only (feet stay together) is rejected with jump_higher;
 *    feet only, arms to shoulder height, or one arm only is rejected with arms_overhead.
 *    An attempt starts when either arm passes partialArmDeg (75) or the spread passes
 *    partialSpreadRatio (1.25); returning to closed without reaching open rejects it.
 *  - too_fast: closed -> closed in < minRepMs (400 ms; the server's lenient floors are a
 *    350 ms median and 150 reps/min, i.e. 400 ms).
 *  - Hysteresis between closed and open thresholds plus debouncing: tracking jitter cannot
 *    mint reps. Lost tracking (300 ms) or a frame gap abandons the attempt; a teleporting
 *    joint freezes counting (unstable_tracking).
 */
import { angleDeg, distance } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { Debouncer } from "@/lib/pose/engine/common";
import { FrontEngine, type FrontPose } from "../front/engine";
import type { JumpingJackConfig } from "./config";

export class JumpingJackEngine extends FrontEngine<JumpingJackConfig> {
  private readonly leftArmFilter: OneEuroFilter;
  private readonly rightArmFilter: OneEuroFilter;
  private readonly spreadFilter: OneEuroFilter;
  private readonly openDebounce: Debouncer;
  private readonly closedDebounce: Debouncer;

  /** Confirmed open, waiting to close again. */
  private isOpen = false;
  /** An attempt (partial movement) is in progress. */
  private attempt = false;
  private lastClosedT = 0;
  private startT = 0;
  /** Best "lower arm" angle and best spread seen in the current attempt. */
  private peakArm = Number.NEGATIVE_INFINITY;
  private peakSpread = Number.NEGATIVE_INFINITY;
  private minArmSeen = Number.POSITIVE_INFINITY;
  private maxArmSeen = Number.NEGATIVE_INFINITY;

  constructor(cfg: JumpingJackConfig) {
    super("jumping_jack", cfg, ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"]);
    this.leftArmFilter = this.newAngleFilter();
    this.rightArmFilter = this.newAngleFilter();
    this.spreadFilter = this.newAngleFilter();
    this.openDebounce = this.newDebouncer();
    this.closedDebounce = this.newDebouncer();
  }

  protected resetDebouncers(): void {
    this.openDebounce.reset();
    this.closedDebounce.reset();
  }

  protected abandon(t: number): void {
    this.clearAttempt();
    this.resetDebouncers();
    this.leftArmFilter.reset();
    this.rightArmFilter.reset();
    this.spreadFilter.reset();
    this.primaryAngle = null;
    this.setPhase("searching", t);
  }

  protected resetFront(): void {
    this.clearAttempt();
    this.resetDebouncers();
    this.leftArmFilter.reset();
    this.rightArmFilter.reset();
    this.spreadFilter.reset();
    this.lastClosedT = 0;
  }

  protected onFrontPose(pose: FrontPose): void {
    const { t, left, right } = pose;
    const cfg = this.cfg;
    const leftRaw = angleDeg(left.hip, left.shoulder, left.wrist);
    const rightRaw = angleDeg(right.hip, right.shoulder, right.wrist);
    const spreadRaw = (distance(left.ankle, right.ankle) / pose.shoulderWidth) * 100;
    if (!Number.isFinite(leftRaw) || !Number.isFinite(rightRaw) || !Number.isFinite(spreadRaw)) {
      this.resetDebouncers();
      return;
    }
    const leftArm = this.leftArmFilter.filter(leftRaw, t);
    const rightArm = this.rightArmFilter.filter(rightRaw, t);
    const spread = this.spreadFilter.filter(spreadRaw, t) / 100;
    const lowArm = Math.min(leftArm, rightArm);
    const highArm = Math.max(leftArm, rightArm);
    this.primaryAngle = lowArm;

    if (pose.frozen) {
      this.resetDebouncers();
      return;
    }

    const closedRaw = highArm <= cfg.closedArmDeg && spread <= cfg.closedSpreadRatio;
    const openRaw = lowArm >= cfg.openArmDeg && spread >= cfg.openSpreadRatio;
    const closed = this.closedDebounce.update(closedRaw, t);
    const open = this.openDebounce.update(openRaw, t);

    if (this.phase === "searching") {
      // Start position: feet together, arms by the sides.
      if (closed) {
        this.setPhase("ready", t);
        this.clearAttempt();
        this.lastClosedT = t;
      }
      return;
    }

    if (!this.isOpen) {
      if (closedRaw) this.lastClosedT = t;
      if (!this.attempt && (highArm > cfg.partialArmDeg || spread > cfg.partialSpreadRatio)) {
        this.attempt = true;
        this.startT = this.lastClosedT;
      }
      if (this.attempt) this.trackPeaks(lowArm, highArm, spread);
      if (open) {
        if (!this.attempt) this.startT = this.lastClosedT;
        this.attempt = true;
        this.isOpen = true;
        this.setPhase("down", t);
        return;
      }
      if (this.attempt && closed) {
        // Back to the start without ever reaching the open position.
        this.rejectRep(this.peakArm < cfg.openArmDeg ? "arms_overhead" : "jump_higher", t);
        this.clearAttempt();
        this.setPhase("up", t);
      }
      return;
    }

    this.trackPeaks(lowArm, highArm, spread);
    if (closed) {
      const durationMs = t - this.startT;
      if (durationMs < cfg.minRepMs) this.rejectRep("too_fast", t);
      else this.countRep(t, durationMs, this.minArmSeen, this.maxArmSeen);
      this.clearAttempt();
      this.lastClosedT = t;
      this.setPhase("up", t);
    }
  }

  private trackPeaks(lowArm: number, highArm: number, spread: number): void {
    this.peakArm = Math.max(this.peakArm, lowArm);
    this.peakSpread = Math.max(this.peakSpread, spread);
    this.minArmSeen = Math.min(this.minArmSeen, lowArm);
    this.maxArmSeen = Math.max(this.maxArmSeen, highArm);
  }

  private clearAttempt(): void {
    this.isOpen = false;
    this.attempt = false;
    this.startT = 0;
    this.peakArm = Number.NEGATIVE_INFINITY;
    this.peakSpread = Number.NEGATIVE_INFINITY;
    this.minArmSeen = Number.POSITIVE_INFINITY;
    this.maxArmSeen = Number.NEGATIVE_INFINITY;
  }
}
