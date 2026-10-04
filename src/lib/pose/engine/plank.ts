/**
 * Plank engine (side view). Accepts forearm and straight-arm planks.
 *
 * Shoulder, hip, knee and ankle (plus the elbow with requireArmSupport) must be visible on
 * the tracked side. There is no shoulder-hip-knee fallback when the feet are out of frame:
 * that would credit knee planks.
 *
 * A frame is "valid" when:
 *  - the shoulder->ankle line is within maxBodyFromHorizontalDeg (35) of horizontal, else
 *    body_not_horizontal (the whole-body line is used so sagging hips, which tilt the torso,
 *    still read as hips_sagging);
 *  - the body line (shoulder-hip-ankle) is > minBodyLineDeg (160), else hips_sagging (hip
 *    below the shoulder-ankle line) or hips_piked (above it);
 *  - the legs are straight (knee angle >= minKneeAngleDeg, 165), else body_on_floor: a plank
 *    on the knees keeps the body line nearly straight but bends the knee;
 *  - with requireArmSupport (default), the elbow is under the shoulder (upper arm within
 *    maxUpperArmFromVerticalDeg of straight down). Lying flat on the floor fails this and is
 *    reported as body_on_floor.
 *
 * Timer (holdMs):
 *  - 'holding' starts once validity is confirmed (>= 2 frames and >= 50 ms); that debounce
 *    window is credited retroactively, so an uninterrupted hold is credited from its first
 *    valid frame to its last. hold_start is emitted on every (re)start.
 *  - Frames closer together than maxFrameGapMs (500 ms) are continuous tracking and their
 *    interval is credited in full (so a slow 2-5 fps device is not under-credited). A frame
 *    after a longer stall is credited at most maxCreditPerFrameMs (200 ms), so a stalled
 *    camera cannot inflate the time.
 *  - A break (bad form, lost tracking, glitch) shorter than graceMs (500 ms) does not pause.
 *    Time spent in the break is held back. It becomes provisional when valid form is
 *    confirmed again within the grace window, and is credited only once that recovered run
 *    has itself lasted graceMs; if another break starts first, it is dropped. So one wobble
 *    in a steady hold costs nothing, but rhythmically dipping out of form ("hip bobbing") is
 *    only credited for the time actually spent in good form. If a break outlasts the grace
 *    window the held-back time is dropped, the phase becomes 'paused' and hold_pause(reason)
 *    is emitted.
 *  - The phase is 'searching' until the first hold starts; after that, breaks give 'paused'.
 */
import { angleDeg, angleFromDownDeg, offsetBelowLine, segmentAngleFromHorizontalDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { FormIssue } from "@/lib/pose/types";
import type { PlankConfig } from "./config";
import { BaseEngine, type Debouncer, type PoseContext } from "./common";

export class PlankEngine extends BaseEngine<PlankConfig> {
  private readonly bodyFilter: OneEuroFilter;
  private readonly inclineFilter: OneEuroFilter;
  private readonly kneeFilter: OneEuroFilter;
  private readonly validDebounce: Debouncer;
  private prevValid = false;
  /** Credited time between frames of the current valid run (excluding its first frame). */
  private runCreditMs = 0;
  /** Timestamp of the first frame of the current valid run. */
  private runStartT = 0;
  private inGrace = false;
  /** Credit accumulated during the current break (not yet credited). */
  private pendingMs = 0;
  /** Credit of the last forgiven break, waiting for the recovered run to last graceMs. */
  private provisionalMs = 0;
  private lastValidT = 0;

  constructor(cfg: PlankConfig) {
    super("plank", cfg, {
      required: cfg.requireArmSupport ? ["shoulder", "elbow", "hip", "knee", "ankle"] : ["shoulder", "hip", "knee", "ankle"],
    });
    this.bodyFilter = this.newAngleFilter();
    this.inclineFilter = this.newAngleFilter();
    this.kneeFilter = this.newAngleFilter();
    this.validDebounce = this.newDebouncer();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, dt, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const hip = p[j.hip];
    const ankle = p[j.ankle];

    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const inclineRaw = segmentAngleFromHorizontalDeg(shoulder, ankle);
    const kneeRaw = angleDeg(hip, p[j.knee], ankle);
    if (!Number.isFinite(bodyRaw) || !Number.isFinite(inclineRaw) || !Number.isFinite(kneeRaw)) {
      this.step(t, dt, "unstable_tracking");
      return;
    }
    const body = this.bodyFilter.filter(bodyRaw, t);
    const incline = this.inclineFilter.filter(inclineRaw, t);
    const knee = this.kneeFilter.filter(kneeRaw, t);
    this.primaryAngle = body;
    this.bodyLine = body;

    let reason: FormIssue | null = null;
    if (ctx.frozen) {
      reason = "unstable_tracking";
    } else if (incline > cfg.maxBodyFromHorizontalDeg) {
      reason = "body_not_horizontal";
    } else if (body < cfg.minBodyLineDeg) {
      reason = offsetBelowLine(hip, shoulder, ankle) > 0 ? "hips_sagging" : "hips_piked";
    } else if (knee < cfg.minKneeAngleDeg) {
      reason = "body_on_floor";
    } else if (cfg.requireArmSupport) {
      const upperArm = angleFromDownDeg(shoulder, p[j.elbow]);
      if (!(upperArm <= cfg.maxUpperArmFromVerticalDeg)) reason = "body_on_floor";
    }
    this.step(t, dt, reason);
  }

  protected onGlitch(t: number, dt: number): void {
    this.step(t, dt, "unstable_tracking");
  }

  protected onLost(t: number, dt: number, lostMs: number): void {
    if (lostMs >= this.cfg.lostTimeoutMs) {
      this.resetFilters();
      this.primaryAngle = null;
      this.bodyLine = null;
    }
    this.step(t, dt, "body_not_visible");
  }

  protected onGap(): void {
    this.resetFilters();
  }

  protected resetExercise(): void {
    this.resetFilters();
    this.validDebounce.reset();
    this.prevValid = false;
    this.runCreditMs = 0;
    this.runStartT = 0;
    this.inGrace = false;
    this.pendingMs = 0;
    this.provisionalMs = 0;
    this.lastValidT = 0;
  }

  private resetFilters(): void {
    this.bodyFilter.reset();
    this.inclineFilter.reset();
    this.kneeFilter.reset();
  }

  /** Time credit for a frame interval (see the timer notes at the top of this file). */
  private frameCredit(dt: number): number {
    if (!(dt > 0)) return 0;
    return dt <= this.cfg.maxFrameGapMs ? dt : Math.min(dt, this.cfg.maxCreditPerFrameMs);
  }

  /** Advance the hold timer by one frame. `reason` is null when the frame is valid. */
  private step(t: number, dt: number, reason: FormIssue | null): void {
    const cfg = this.cfg;
    const valid = reason === null;
    const credit = this.frameCredit(dt);
    const confirmed = this.validDebounce.update(valid, t);
    if (valid && !this.prevValid) this.runStartT = t;
    this.runCreditMs = valid ? (this.prevValid ? this.runCreditMs + credit : 0) : 0;
    this.prevValid = valid;
    // body_not_visible / unstable_tracking are reported by the base engine.
    if (reason && reason !== "body_not_visible" && reason !== "unstable_tracking") {
      this.flagIssue(reason);
    }

    if (this.phase !== "holding") {
      if (confirmed) {
        this.holdMs += this.runCreditMs;
        this.inGrace = false;
        this.pendingMs = 0;
        this.provisionalMs = 0;
        this.lastValidT = t;
        this.setPhase("holding", t);
        this.emit({ type: "hold_start", tMs: t });
      }
      return;
    }

    if (!this.inGrace) {
      if (valid) {
        this.holdMs += credit;
        this.lastValidT = t;
        if (this.provisionalMs > 0 && t - this.runStartT >= cfg.graceMs) {
          // Good form held long enough after the break: forgive it.
          this.holdMs += this.provisionalMs;
          this.provisionalMs = 0;
        }
        return;
      }
      // A new break. A previous break that was not yet forgiven stays uncredited.
      this.inGrace = true;
      this.pendingMs = 0;
      this.provisionalMs = 0;
    }

    this.pendingMs += credit;
    if (valid) {
      if (confirmed) {
        // Recovered within the grace window: no pause, and the break becomes provisional.
        this.provisionalMs = this.pendingMs;
        this.pendingMs = 0;
        this.inGrace = false;
        this.lastValidT = t;
      }
      return;
    }
    if (t - this.lastValidT > cfg.graceMs) {
      this.inGrace = false;
      this.pendingMs = 0;
      this.setPhase("paused", t);
      this.emit({ type: "hold_pause", reason, tMs: t });
    }
  }
}
