/**
 * Dip engine (side view): bench / chair dips (hands behind on the seat) and parallel-bar dips.
 *
 * Primary signal: elbow angle (shoulder-elbow-wrist). Rep = lockout -> depth -> lockout:
 *  - lockout ('up'): elbow > upAngleDeg (155) with the wrist under the shoulder
 *    (shoulder->wrist within maxLockoutArmFromVerticalDeg (35) of straight down: the hands
 *    press down on a support);
 *  - depth ('down'): elbow <= downAngleDeg (90);
 *  - both debounced (>= 2 frames and >= 50 ms), angles One Euro smoothed.
 *
 * Shoulder, elbow, wrist and hip must be visible on the tracked side. The legs are ignored on
 * purpose (bent, straight, on the floor or hanging are all fine).
 *
 * Anti-cheat / form gates:
 *  - hands pressing, not lifting: from lockout to lockout the forearm must keep pointing
 *    down (elbow->wrist within maxForearmFromVerticalDeg (45) of straight down, debounced).
 *    A standing biceps curl lifts the hand above that by ~135 deg of elbow, so the attempt is
 *    cancelled before it can even become a partial rep: standing arm curls count 0.
 *  - hands planted: the wrist may move at most maxWristDriftRatio (0.25) arm lengths in the
 *    image during a rep (static phone), else the attempt is cancelled.
 *  - the body lowers: the shoulder must drop by >= minShoulderDropRatio (0.3) arm lengths
 *    towards the hands between lockout and the bottom, else go_lower. Bending the elbows in
 *    place (the shoulder not moving) does not count.
 *  - torso upright-ish: a set only starts with the torso within maxTorsoLeanDeg (45) of
 *    vertical (chest_up otherwise); a rep that leaned further is rejected with chest_up;
 *    the torso staying past lyingTorsoDeg (65, e.g. push-ups) cancels the set.
 *  - too_fast: lockout -> lockout in < minRepMs (500). Server limits: HONEST 800 ms/rep,
 *    minMedianRepMs 600, 70 reps/min.
 *  - go_lower: dipped below partialAngleDeg (130) without reaching depth, then locked out.
 *  - extend_fully: rose above 130 from the bottom and re-dipped without locking out.
 *  - tracking: losing the body for > lostTimeoutMs or a frame gap abandons the rep; a joint
 *    teleport freezes counting for glitchFreezeMs (shared BaseEngine machinery).
 *
 * Known limit: a person standing at a counter with the hands on it and bending the knees
 * moves like an assisted bench dip; it is indistinguishable in 2D and counts as such.
 */
import { angleDeg, angleFromDownDeg, distance, segmentAngleFromVerticalDeg, type Point2 } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, type Debouncer, type PoseContext, type TrackedSide } from "@/lib/pose/engine/common";
import type { DipConfig } from "./config";

interface Anchor {
  side: TrackedSide;
  wristX: number;
  wristY: number;
  armLength: number;
  /** wrist.y - shoulder.y at lockout (image y-down: positive = shoulder above the wrist). */
  shoulderGap: number;
}

export class DipEngine extends CyclicRepEngine<DipConfig> {
  private readonly elbowFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly forearmFilter: OneEuroFilter;
  private readonly lyingDebounce: Debouncer;
  private readonly liftDebounce: Debouncer;
  private anchor: Anchor | null = null;
  private attemptMaxLean = Number.NEGATIVE_INFINITY;
  private attemptMinGap = Number.POSITIVE_INFINITY;

  constructor(cfg: DipConfig) {
    super("dip", cfg, { required: ["shoulder", "elbow", "wrist", "hip"] });
    this.elbowFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.forearmFilter = this.newAngleFilter();
    this.lyingDebounce = this.newDebouncer();
    this.liftDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.elbowFilter.reset();
    this.torsoFilter.reset();
    this.forearmFilter.reset();
    this.lyingDebounce.reset();
    this.liftDebounce.reset();
    this.clearAttempt();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const elbowPt = p[j.elbow];
    const wrist = p[j.wrist];
    const hip = p[j.hip];

    const elbowRaw = angleDeg(shoulder, elbowPt, wrist);
    const torsoRaw = segmentAngleFromVerticalDeg(shoulder, hip);
    const forearmRaw = angleFromDownDeg(elbowPt, wrist);
    const armFromDown = angleFromDownDeg(shoulder, wrist);
    if (
      !Number.isFinite(elbowRaw) ||
      !Number.isFinite(torsoRaw) ||
      !Number.isFinite(forearmRaw) ||
      !Number.isFinite(armFromDown)
    ) {
      this.resetDebouncers();
      return;
    }

    const elbow = this.elbowFilter.filter(elbowRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);
    const forearm = this.forearmFilter.filter(forearmRaw, t);
    this.primaryAngle = elbow;
    // No body-line angle: the legs are not judged (and need not be visible) for dips.
    this.bodyLine = null;
    // The hip must be below the shoulder (not upside down / lying head-down).
    const uprightTorso = hip.y > shoulder.y;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.lyingDebounce.reset();
      this.liftDebounce.reset();
      return;
    }

    const upright = uprightTorso && torso <= cfg.maxTorsoLeanDeg;
    const pressing = armFromDown <= cfg.maxLockoutArmFromVerticalDeg;
    const lockedOut = elbow > cfg.upAngleDeg && pressing;
    const top = this.topDebounce.update(lockedOut && upright, t);
    const bottom = this.bottomDebounce.update(elbow <= cfg.downAngleDeg, t);
    const lying = this.lyingDebounce.update(!uprightTorso || torso > cfg.lyingTorsoDeg, t);
    const lifting = this.liftDebounce.update(forearm > cfg.maxForearmFromVerticalDeg, t);

    if (this.phase === "searching") {
      if (!upright) {
        this.flagIssue("chest_up");
        return;
      }
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, elbow);
        this.anchorAttempt(ctx.side, shoulder, elbowPt, wrist, torso);
      } else if (!lockedOut) {
        this.flagIssue("extend_fully");
      }
      return;
    }

    if (lying) {
      this.abandonAttempt(t);
      this.flagIssue("chest_up");
      return;
    }
    const atTop = top && !this.cycle.inBottom;
    if (!atTop && (lifting || this.handsDrifted(ctx.side, wrist))) {
      // The hand lifted or moved: not pressing on a support.
      this.abandonAttempt(t);
      return;
    }
    if (torso > cfg.maxTorsoLeanDeg) this.flagIssue("chest_up");
    this.attemptMaxLean = Math.max(this.attemptMaxLean, torso);
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
        } else if (!a || !(drop >= cfg.minShoulderDropRatio * a.armLength)) {
          this.rejectRep("go_lower", t);
        } else if (this.attemptMaxLean > cfg.maxTorsoLeanDeg) {
          this.rejectRep("chest_up", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        }
        break;
      }
      default:
        break;
    }
    if (top && !this.cycle.inBottom) this.anchorAttempt(ctx.side, shoulder, elbowPt, wrist, torso);
  }

  private abandonAttempt(t: number): void {
    this.cancelSet(t);
    this.liftDebounce.reset();
    this.clearAttempt();
  }

  private anchorAttempt(side: TrackedSide, shoulder: Point2, elbow: Point2, wrist: Point2, torso: number): void {
    const armLength = distance(shoulder, elbow) + distance(elbow, wrist);
    this.attemptMaxLean = torso;
    this.attemptMinGap = wrist.y - shoulder.y;
    this.anchor =
      armLength > 0 && Number.isFinite(armLength)
        ? { side, wristX: wrist.x, wristY: wrist.y, armLength, shoulderGap: wrist.y - shoulder.y }
        : null;
  }

  private handsDrifted(side: TrackedSide, wrist: Point2): boolean {
    const a = this.anchor;
    if (!a) return false;
    if (a.side !== side) {
      this.anchor = { ...a, side, wristX: wrist.x, wristY: wrist.y };
      return false;
    }
    return Math.hypot(wrist.x - a.wristX, wrist.y - a.wristY) > this.cfg.maxWristDriftRatio * a.armLength;
  }

  private clearAttempt(): void {
    this.anchor = null;
    this.attemptMaxLean = Number.NEGATIVE_INFINITY;
    this.attemptMinGap = Number.POSITIVE_INFINITY;
  }
}
