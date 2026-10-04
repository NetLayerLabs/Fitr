/**
 * Wall sit engine (side view, timed hold). Reports 0 reps; credits holdMs.
 *
 * Shoulder, hip, knee and ankle must be visible on the tracked side.
 *
 * A frame is "valid" when (checked in this order, first failure is the reason):
 *  - the torso (shoulder-hip) is within maxTorsoFromVerticalDeg (25) of vertical, i.e. the
 *    back is upright against the wall, else keep_back_on_wall. This also rejects lying on
 *    the back with the legs at 90/90 and leaning forward into a free squat hold;
 *  - the knee angle (hip-knee-ankle) is within [minKneeDeg, maxKneeDeg] = [65, 115]:
 *    above => go_lower (half sit / standing), below => go_higher;
 *  - the thigh (hip-knee) is within maxThighFromHorizontalDeg (30) of horizontal, else
 *    go_lower when the hip is above the knee, go_higher when it has dropped below. Sitting
 *    on the floor with the knees up fails here.
 *
 * Timer: identical rules to the plank (engine/plank.ts):
 *  - 'holding' starts once validity is confirmed (>= 2 frames and >= 50 ms), crediting the
 *    debounce window retroactively; hold_start on every (re)start;
 *  - frames closer than maxFrameGapMs (500 ms) are credited in full, a frame after a longer
 *    stall at most maxCreditPerFrameMs (200 ms);
 *  - a break shorter than graceMs (500 ms) does not pause. Its time is held back, becomes
 *    provisional when form recovers within the window, and is credited only once the
 *    recovered run lasts graceMs; a longer break drops it, the phase becomes 'paused' and
 *    hold_pause(reason) is emitted;
 *  - 'searching' until the first hold starts, 'paused' after that.
 *
 * Limitation: in a 2D side view, sitting on a chair or bench looks the same as a wall sit
 * (upright back, 90 deg knees, level thighs) and cannot be told apart from pose alone.
 */
import { angleDeg, segmentAngleFromHorizontalDeg, segmentAngleFromVerticalDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { FormIssue } from "@/lib/pose/types";
import { BaseEngine, type Debouncer, type PoseContext } from "@/lib/pose/engine/common";
import type { WallSitConfig } from "./config";

export class WallSitEngine extends BaseEngine<WallSitConfig> {
  private readonly kneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly thighFilter: OneEuroFilter;
  private readonly validDebounce: Debouncer;
  private prevValid = false;
  private runCreditMs = 0;
  private runStartT = 0;
  private inGrace = false;
  private pendingMs = 0;
  private provisionalMs = 0;
  private lastValidT = 0;

  constructor(cfg: WallSitConfig) {
    super("wall_sit", cfg, { required: ["shoulder", "hip", "knee", "ankle"] });
    this.kneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.thighFilter = this.newAngleFilter();
    this.validDebounce = this.newDebouncer();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, dt, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const hip = p[j.hip];
    const knee = p[j.knee];
    const ankle = p[j.ankle];

    const kneeRaw = angleDeg(hip, knee, ankle);
    const torsoRaw = segmentAngleFromVerticalDeg(shoulder, hip);
    const thighRaw = segmentAngleFromHorizontalDeg(hip, knee);
    if (!Number.isFinite(kneeRaw) || !Number.isFinite(torsoRaw) || !Number.isFinite(thighRaw)) {
      this.step(t, dt, "unstable_tracking");
      return;
    }
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);
    const thigh = this.thighFilter.filter(thighRaw, t);
    this.primaryAngle = kneeAngle;
    this.bodyLine = null;

    let reason: FormIssue | null = null;
    if (ctx.frozen) reason = "unstable_tracking";
    else if (torso > cfg.maxTorsoFromVerticalDeg) reason = "keep_back_on_wall";
    else if (kneeAngle > cfg.maxKneeDeg) reason = "go_lower";
    else if (kneeAngle < cfg.minKneeDeg) reason = "go_higher";
    else if (thigh > cfg.maxThighFromHorizontalDeg) reason = hip.y < knee.y ? "go_lower" : "go_higher";
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
    this.kneeFilter.reset();
    this.torsoFilter.reset();
    this.thighFilter.reset();
  }

  private frameCredit(dt: number): number {
    if (!(dt > 0)) return 0;
    return dt <= this.cfg.maxFrameGapMs ? dt : Math.min(dt, this.cfg.maxCreditPerFrameMs);
  }

  /** Advance the hold timer by one frame (same rules as PlankEngine.step). */
  private step(t: number, dt: number, reason: FormIssue | null): void {
    const cfg = this.cfg;
    const valid = reason === null;
    const credit = this.frameCredit(dt);
    const confirmed = this.validDebounce.update(valid, t);
    if (valid && !this.prevValid) this.runStartT = t;
    this.runCreditMs = valid ? (this.prevValid ? this.runCreditMs + credit : 0) : 0;
    this.prevValid = valid;
    if (reason && reason !== "body_not_visible" && reason !== "unstable_tracking") this.flagIssue(reason);

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
          this.holdMs += this.provisionalMs;
          this.provisionalMs = 0;
        }
        return;
      }
      this.inGrace = true;
      this.pendingMs = 0;
      this.provisionalMs = 0;
    }

    this.pendingMs += credit;
    if (valid) {
      if (confirmed) {
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
