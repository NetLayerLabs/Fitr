/**
 * Push-up engine (side view).
 *
 * Primary signal: elbow angle (shoulder-elbow-wrist). Rep = lockout -> depth -> lockout:
 *  - lockout ('up'): elbow > upAngleDeg (155) with the wrist under the shoulder
 *    (shoulder->wrist within maxArmFromVerticalDeg of straight down);
 *  - depth ('down'): elbow < downAngleDeg (90);
 *  - both debounced (>= 2 frames and >= 50 ms).
 *
 * Shoulder, elbow, wrist, hip, knee and ankle must all be visible on the tracked side. There
 * is no shoulder-hip-knee fallback when the feet are out of frame: that would make knee
 * push-ups indistinguishable from real ones.
 *
 * Gates and rejections:
 *  - body_not_horizontal: the shoulder->ankle line is more than 35 deg from horizontal.
 *    Nothing counts; an in-progress rep is abandoned (so standing arm curls count 0). The
 *    whole-body line is used instead of the shoulder-hip segment because sagging hips tilt
 *    the torso and would otherwise hide hips_sagging.
 *  - body_on_floor: the wrist is not under the shoulder (lying on the floor waving the arms),
 *    or the legs are bent (knee angle < minKneeAngleDeg, 160: knee push-ups). A set only
 *    starts from a lockout with straight legs, and a rep during which the knee bent below the
 *    threshold is rejected with body_on_floor.
 *  - hands planted: while a rep is in progress the wrist must stay within maxWristDriftRatio
 *    (0.15) body lengths of where it was at lockout, measured relative to the ankle. If it
 *    moves further (the hands press through the air while the shoulder stays put: e.g. chest
 *    presses filmed by a phone lying on its side), the attempt is cancelled as
 *    body_not_horizontal. This check does not depend on which way the camera is held.
 *  - body line: shoulder-hip-ankle angle must stay > minBodyLineDeg (150) while at the
 *    bottom, else rep_rejected with hips_sagging (hip below the shoulder-ankle line, i.e.
 *    towards the floor) or hips_piked.
 *  - too_fast: lockout -> lockout in < minRepMs (400).
 *  - go_lower: dipped below partialAngleDeg (135) but never reached depth, then locked out.
 *  - extend_fully: from the bottom, rose above 135 but went back to depth without locking
 *    out; the aborted attempt is rejected and a new one starts.
 */
import {
  angleDeg,
  angleFromDownDeg,
  distance,
  offsetBelowLine,
  segmentAngleFromHorizontalDeg,
  type Point2,
} from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { FormIssue } from "@/lib/pose/types";
import type { PushupConfig } from "./config";
import { CyclicRepEngine, type Debouncer, type PoseContext, type TrackedSide } from "./common";

/** Wrist position relative to the ankle at the last lockout, to measure hand drift in a rep. */
interface HandAnchor {
  side: TrackedSide;
  dx: number;
  dy: number;
  bodyLength: number;
}

export class PushupEngine extends CyclicRepEngine<PushupConfig> {
  private readonly elbowFilter: OneEuroFilter;
  private readonly bodyFilter: OneEuroFilter;
  private readonly inclineFilter: OneEuroFilter;
  private readonly kneeFilter: OneEuroFilter;
  private readonly tiltDebounce: Debouncer;
  /** Worst (smallest) body line seen while at the bottom of the current attempt. */
  private bottomBodyLine = Number.POSITIVE_INFINITY;
  private bottomBodyIssue: FormIssue | null = null;
  /** Smallest knee angle since the last confirmed lockout (i.e. over the current attempt). */
  private attemptMinKnee = Number.POSITIVE_INFINITY;
  private handAnchor: HandAnchor | null = null;

  constructor(cfg: PushupConfig) {
    super("pushup", cfg, { required: ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] });
    this.elbowFilter = this.newAngleFilter();
    this.bodyFilter = this.newAngleFilter();
    this.inclineFilter = this.newAngleFilter();
    this.kneeFilter = this.newAngleFilter();
    this.tiltDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.elbowFilter.reset();
    this.bodyFilter.reset();
    this.inclineFilter.reset();
    this.kneeFilter.reset();
    this.tiltDebounce.reset();
    this.clearBottom();
    this.clearAttempt();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const elbowPt = p[j.elbow];
    const wrist = p[j.wrist];
    const hip = p[j.hip];
    const kneePt = p[j.knee];
    const ankle = p[j.ankle];

    const elbowRaw = angleDeg(shoulder, elbowPt, wrist);
    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const inclineRaw = segmentAngleFromHorizontalDeg(shoulder, ankle);
    const kneeRaw = angleDeg(hip, kneePt, ankle);
    const armFromDown = angleFromDownDeg(shoulder, wrist);
    if (
      !Number.isFinite(elbowRaw) ||
      !Number.isFinite(bodyRaw) ||
      !Number.isFinite(inclineRaw) ||
      !Number.isFinite(kneeRaw)
    ) {
      // Degenerate geometry (coincident joints): hold state.
      this.resetDebouncers();
      return;
    }

    const elbow = this.elbowFilter.filter(elbowRaw, t);
    const body = this.bodyFilter.filter(bodyRaw, t);
    const incline = this.inclineFilter.filter(inclineRaw, t);
    const knee = this.kneeFilter.filter(kneeRaw, t);
    this.primaryAngle = elbow;
    this.bodyLine = body;

    const horizontal = incline <= cfg.maxBodyFromHorizontalDeg;
    const bodyIssue: FormIssue | null =
      body < cfg.minBodyLineDeg
        ? offsetBelowLine(hip, shoulder, ankle) > 0
          ? "hips_sagging"
          : "hips_piked"
        : null;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.tiltDebounce.reset();
      return;
    }

    const armsUnder = armFromDown <= cfg.maxArmFromVerticalDeg;
    const legsStraight = knee >= cfg.minKneeAngleDeg;
    const lockedOut = elbow > cfg.upAngleDeg && armsUnder;
    const top = this.topDebounce.update(lockedOut, t);
    const bottom = this.bottomDebounce.update(elbow < cfg.downAngleDeg, t);
    const tilted = this.tiltDebounce.update(!horizontal, t);

    if (this.phase === "searching") {
      if (!horizontal) {
        this.flagIssue("body_not_horizontal");
        return;
      }
      if (bodyIssue) this.flagIssue(bodyIssue);
      if (!armsUnder || !legsStraight) {
        // Lying on the floor (hands not under the shoulders) or on the knees.
        this.flagIssue("body_on_floor");
        return;
      }
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, elbow);
        this.clearBottom();
        this.anchorAttempt(ctx.side, wrist, ankle, shoulder, knee);
      } else if (!lockedOut) {
        this.flagIssue("extend_fully");
      }
      return;
    }

    if (tilted) {
      this.abandonAttempt(t);
      return;
    }
    if (bodyIssue) this.flagIssue(bodyIssue);
    if (!armsUnder || !legsStraight) this.flagIssue("body_on_floor");

    const atTop = top && !this.cycle.inBottom;
    if (!atTop && this.handsDrifted(ctx.side, wrist, ankle)) {
      // The hands moved instead of the body: not a push-up.
      this.abandonAttempt(t);
      return;
    }
    this.attemptMinKnee = Math.min(this.attemptMinKnee, knee);

    const event = this.cycle.step(t, elbow, top, bottom);
    switch (event.type) {
      case "down":
        this.setPhase("down", t);
        this.clearBottom();
        break;
      case "redip":
        this.rejectRep("extend_fully", t);
        this.clearBottom();
        break;
      case "partial":
        this.rejectRep("go_lower", t);
        break;
      case "complete": {
        this.setPhase("up", t);
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (this.attemptMinKnee < cfg.minKneeAngleDeg) {
          this.rejectRep("body_on_floor", t);
        } else if (this.bottomBodyLine < cfg.minBodyLineDeg) {
          this.rejectRep(this.bottomBodyIssue ?? "hips_sagging", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        }
        this.clearBottom();
        break;
      }
      default:
        break;
    }
    if (top && !this.cycle.inBottom) {
      // At a confirmed lockout: the next attempt starts from here.
      this.anchorAttempt(ctx.side, wrist, ankle, shoulder, knee);
    } else if (this.cycle.inBottom && body < this.bottomBodyLine) {
      this.bottomBodyLine = body;
      this.bottomBodyIssue = bodyIssue;
    }
  }

  /** Cancel the set (back to 'searching') because the pose stopped looking like a push-up. */
  private abandonAttempt(t: number): void {
    this.cancelSet(t);
    this.clearBottom();
    this.clearAttempt();
    this.flagIssue("body_not_horizontal");
  }

  private anchorAttempt(side: TrackedSide, wrist: Point2, ankle: Point2, shoulder: Point2, knee: number): void {
    this.attemptMinKnee = knee;
    const bodyLength = distance(shoulder, ankle);
    this.handAnchor =
      bodyLength > 0 && Number.isFinite(bodyLength)
        ? { side, dx: wrist.x - ankle.x, dy: wrist.y - ankle.y, bodyLength }
        : null;
  }

  /** True when the wrist moved (relative to the ankle) further than allowed since lockout. */
  private handsDrifted(side: TrackedSide, wrist: Point2, ankle: Point2): boolean {
    const anchor = this.handAnchor;
    if (!anchor) return false;
    if (anchor.side !== side) {
      // The other body side has its own offsets; re-anchor instead of comparing across sides.
      this.handAnchor = { ...anchor, side, dx: wrist.x - ankle.x, dy: wrist.y - ankle.y };
      return false;
    }
    const drift = Math.hypot(wrist.x - ankle.x - anchor.dx, wrist.y - ankle.y - anchor.dy);
    return drift > this.cfg.maxWristDriftRatio * anchor.bodyLength;
  }

  private clearBottom(): void {
    this.bottomBodyLine = Number.POSITIVE_INFINITY;
    this.bottomBodyIssue = null;
  }

  private clearAttempt(): void {
    this.attemptMinKnee = Number.POSITIVE_INFINITY;
    this.handAnchor = null;
  }
}
