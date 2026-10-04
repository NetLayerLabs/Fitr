/**
 * Pike push-up engine (side view, body in an upside-down V).
 *
 * Primary signal: elbow angle (shoulder-elbow-wrist). Rep = lockout -> depth -> lockout:
 *  - lockout ('up'): elbow > upAngleDeg (155) with the wrist under the shoulder
 *    (shoulder->wrist within maxArmFromVerticalDeg (50) of straight down);
 *  - depth ('down'): elbow < downAngleDeg (100);
 *  - both debounced (>= 2 frames and >= 50 ms), angles One Euro smoothed.
 *
 * Shoulder, elbow, wrist, hip and ankle must all be visible on the tracked side (no
 * fallback: without the ankle the pike cannot be judged).
 *
 * Anti-cheat / form gates:
 *  - pike posture (keep_hips_high): hip angle (shoulder-hip-ankle) < maxHipAngleDeg (120) AND
 *    the hip above both the shoulder and the ankle in the image. A set only starts from a
 *    piked lockout, so regular push-ups (body line ~175) and standing arm bends count 0.
 *    A rep during which the hip angle rose above 120 is rejected with keep_hips_high; the
 *    hip angle staying above flatHipAngleDeg (145) or the hips dropping below the shoulders
 *    (debounced) cancels the set back to 'searching'.
 *  - hands planted: during a rep the wrist may move at most maxWristDriftRatio (0.15) body
 *    lengths relative to the ankle; otherwise the attempt is cancelled (keep_hips_high is
 *    not right here, so the cancelled attempt shows extend_fully: start again from lockout).
 *  - head travels toward the hands: the shoulder must drop by >= minShoulderDropRatio (0.15)
 *    arm lengths towards the wrist between lockout and the bottom, else go_lower.
 *  - too_fast: lockout -> lockout in < minRepMs (500). Server limits: HONEST 900 ms/rep,
 *    minMedianRepMs 700, 60 reps/min, so honest reps are never near this.
 *  - go_lower: dipped below partialAngleDeg (135) without reaching depth, then locked out.
 *  - extend_fully: rose above 135 from the bottom, then re-dipped without locking out.
 *  - tracking: losing the body for > lostTimeoutMs or a frame gap abandons the rep; a joint
 *    teleport freezes counting for glitchFreezeMs (shared BaseEngine machinery).
 */
import { angleDeg, angleFromDownDeg, distance, type Point2 } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, type Debouncer, type PoseContext, type TrackedSide } from "@/lib/pose/engine/common";
import type { PikePushupConfig } from "./config";

interface Anchor {
  side: TrackedSide;
  /** Wrist relative to the ankle at lockout. */
  dx: number;
  dy: number;
  bodyLength: number;
  armLength: number;
  /** wrist.y - shoulder.y at lockout (image y-down: positive = shoulder above the wrist). */
  shoulderGap: number;
}

export class PikePushupEngine extends CyclicRepEngine<PikePushupConfig> {
  private readonly elbowFilter: OneEuroFilter;
  private readonly hipFilter: OneEuroFilter;
  private readonly flatDebounce: Debouncer;
  private anchor: Anchor | null = null;
  /** Largest hip angle over the current attempt (since the last confirmed lockout). */
  private attemptMaxHip = Number.NEGATIVE_INFINITY;
  /** Smallest wrist-shoulder vertical gap over the current attempt. */
  private attemptMinGap = Number.POSITIVE_INFINITY;

  constructor(cfg: PikePushupConfig) {
    super("pike_pushup", cfg, { required: ["shoulder", "elbow", "wrist", "hip", "ankle"] });
    this.elbowFilter = this.newAngleFilter();
    this.hipFilter = this.newAngleFilter();
    this.flatDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.elbowFilter.reset();
    this.hipFilter.reset();
    this.flatDebounce.reset();
    this.clearAttempt();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const elbowPt = p[j.elbow];
    const wrist = p[j.wrist];
    const hip = p[j.hip];
    const ankle = p[j.ankle];

    const elbowRaw = angleDeg(shoulder, elbowPt, wrist);
    const hipRaw = angleDeg(shoulder, hip, ankle);
    const armFromDown = angleFromDownDeg(shoulder, wrist);
    if (!Number.isFinite(elbowRaw) || !Number.isFinite(hipRaw) || !Number.isFinite(armFromDown)) {
      this.resetDebouncers();
      return;
    }

    const elbow = this.elbowFilter.filter(elbowRaw, t);
    const hipAngle = this.hipFilter.filter(hipRaw, t);
    this.primaryAngle = elbow;
    this.bodyLine = hipAngle;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.flatDebounce.reset();
      return;
    }

    const hipsHigh = hip.y < shoulder.y && hip.y < ankle.y;
    const piked = hipsHigh && hipAngle < cfg.maxHipAngleDeg;
    const flat = !hipsHigh || hipAngle > cfg.flatHipAngleDeg;
    const armsUnder = armFromDown <= cfg.maxArmFromVerticalDeg;
    const lockedOut = elbow > cfg.upAngleDeg && armsUnder;
    const top = this.topDebounce.update(lockedOut && piked, t);
    const bottom = this.bottomDebounce.update(elbow < cfg.downAngleDeg, t);
    const wentFlat = this.flatDebounce.update(flat, t);

    if (this.phase === "searching") {
      if (!piked) {
        this.flagIssue("keep_hips_high");
        return;
      }
      if (!armsUnder) {
        this.flagIssue("body_on_floor");
        return;
      }
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, elbow);
        this.anchorAttempt(ctx.side, shoulder, elbowPt, wrist, hip, ankle, hipAngle);
      } else if (!lockedOut) {
        this.flagIssue("extend_fully");
      }
      return;
    }

    if (wentFlat) {
      // Body line went flat (a regular push-up) or the hips dropped: not a pike any more.
      this.abandonAttempt(t);
      this.flagIssue("keep_hips_high");
      return;
    }
    if (!piked) this.flagIssue("keep_hips_high");

    const atTop = top && !this.cycle.inBottom;
    if (!atTop && this.handsDrifted(ctx.side, wrist, ankle)) {
      this.abandonAttempt(t);
      this.flagIssue("extend_fully");
      return;
    }
    this.attemptMaxHip = Math.max(this.attemptMaxHip, hipAngle);
    this.attemptMinGap = Math.min(this.attemptMinGap, wrist.y - shoulder.y);

    const event = this.cycle.step(t, elbow, top, bottom);
    switch (event.type) {
      case "down":
        this.setPhase("down", t);
        break;
      case "redip":
        this.rejectRep("extend_fully", t);
        break;
      case "partial":
        this.rejectRep("go_lower", t);
        break;
      case "complete": {
        this.setPhase("up", t);
        const a = this.anchor;
        const drop = a ? a.shoulderGap - this.attemptMinGap : Number.NaN;
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (this.attemptMaxHip > cfg.maxHipAngleDeg) {
          this.rejectRep("keep_hips_high", t);
        } else if (!a || !(drop >= cfg.minShoulderDropRatio * a.armLength)) {
          this.rejectRep("go_lower", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        }
        break;
      }
      default:
        break;
    }
    if (top && !this.cycle.inBottom) {
      // At a confirmed lockout: the next attempt starts here.
      this.anchorAttempt(ctx.side, shoulder, elbowPt, wrist, hip, ankle, hipAngle);
    }
  }

  private abandonAttempt(t: number): void {
    this.cancelSet(t);
    this.clearAttempt();
  }

  private anchorAttempt(
    side: TrackedSide,
    shoulder: Point2,
    elbow: Point2,
    wrist: Point2,
    hip: Point2,
    ankle: Point2,
    hipAngle: number,
  ): void {
    const bodyLength = distance(shoulder, hip) + distance(hip, ankle);
    const armLength = distance(shoulder, elbow) + distance(elbow, wrist);
    this.attemptMaxHip = hipAngle;
    this.attemptMinGap = wrist.y - shoulder.y;
    this.anchor =
      bodyLength > 0 && Number.isFinite(bodyLength) && armLength > 0 && Number.isFinite(armLength)
        ? {
            side,
            dx: wrist.x - ankle.x,
            dy: wrist.y - ankle.y,
            bodyLength,
            armLength,
            shoulderGap: wrist.y - shoulder.y,
          }
        : null;
  }

  private handsDrifted(side: TrackedSide, wrist: Point2, ankle: Point2): boolean {
    const a = this.anchor;
    if (!a) return false;
    if (a.side !== side) {
      this.anchor = { ...a, side, dx: wrist.x - ankle.x, dy: wrist.y - ankle.y };
      return false;
    }
    const drift = Math.hypot(wrist.x - ankle.x - a.dx, wrist.y - ankle.y - a.dy);
    return drift > this.cfg.maxWristDriftRatio * a.bodyLength;
  }

  private clearAttempt(): void {
    this.anchor = null;
    this.attemptMaxHip = Number.NEGATIVE_INFINITY;
    this.attemptMinGap = Number.POSITIVE_INFINITY;
  }
}
