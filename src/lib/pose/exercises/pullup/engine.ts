/**
 * Pull-up engine (FRONT view: the phone faces the person hanging from the bar).
 *
 * The bar itself is not detected: the hands are on it, so the wrist line (mean wrist height)
 * is used as the bar. Both arms are read at once (side: "both"); every signal averages the
 * left and right arm.
 *
 * Primary signal: mean elbow angle (shoulder-elbow-wrist, both arms). Rep = hang -> top -> hang:
 *  - dead hang ('up' / ready): elbow > upAngleDeg (150) with both wrists above the nose and
 *    the shoulders (hands overhead on the bar);
 *  - top ('down' = the far end of the range): elbow < downAngleDeg (90) AND the chin over the
 *    bar: the mouth (nose if the mouth is not visible) at least minChinClearanceRatio (0)
 *    shoulder widths above the wrist line;
 *  - both debounced (>= 2 frames and >= 50 ms), angles One Euro smoothed.
 *
 * Both shoulders, elbows, wrists and hips plus the nose must be visible.
 *
 * Anti-cheat / form gates:
 *  - face the camera (face_camera): shoulder width / torso length >= minShoulderWidthRatio
 *    (0.4) and the shoulders above the hips (upright, hanging), else nothing is judged;
 *    a bad view for > lostTimeoutMs abandons the rep.
 *  - half reps (chin_over_bar): pulled below partialAngleDeg (130) but never got the chin
 *    over the bar, then hung again.
 *  - full extension (extend_fully): from the top, lowered past 130 then pulled again without
 *    reaching a dead hang; the aborted rep is rejected.
 *  - the body must rise: the shoulders must move up by >= minShoulderRiseRatio (0.4)
 *    shoulder widths between the hang and the top, else chin_over_bar.
 *  - hands on a fixed bar: the wrist line may move at most maxWristDriftRatio (0.35)
 *    shoulder widths during a rep (static phone), else the attempt is cancelled. Standing
 *    and pulling the arms down through the air brings the hands to the mouth (it would look
 *    like "chin over the bar") but moves the wrists and not the shoulders, so it counts 0.
 *  - kipping / swinging (too_fast): hang -> hang in < minRepMs (900). Server limits:
 *    HONEST 1200 ms/rep, minMedianRepMs 1000, 45 reps/min; a strict pull-up takes ~1.5-3 s.
 *  - tracking: losing the body for > lostTimeoutMs or a frame gap abandons the rep; a joint
 *    teleport freezes counting for glitchFreezeMs (shared BaseEngine machinery).
 *
 * Known limits: a kip done slower than minRepMs is not detected (the hip swing happens
 * towards the camera, so it is invisible in a front view); grip width is not judged.
 */
import { LM } from "@/lib/pose/landmarks";
import { angleDeg, distance, landmarkVisibility, minVisibility, type Point2 } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, readPoseLandmarks, type PoseContext } from "@/lib/pose/engine/common";
import type { EngineState, EngineUpdate, PoseFrame } from "@/lib/pose/types";
import type { PullupConfig } from "./config";

/** Landmarks a front-view pull-up needs on BOTH sides (plus the nose). */
const FRONT_REQUIRED: readonly number[] = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
];

interface Anchor {
  shoulderY: number;
  wrist: Point2;
  shoulderWidth: number;
}

const mid = (a: Point2, b: Point2): Point2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export class PullupEngine extends CyclicRepEngine<PullupConfig> {
  private readonly leftElbowFilter: OneEuroFilter;
  private readonly rightElbowFilter: OneEuroFilter;
  /** Both sides + nose visible on the frame being processed (set in update()). */
  private bothVisible = false;
  private mouthVisible = false;
  /** Last time the pose was usable as a front view. */
  private lastFrontT: number | null = null;
  private anchor: Anchor | null = null;
  /** Highest shoulder position (smallest image y) during the current attempt. */
  private attemptMinShoulderY = Number.POSITIVE_INFINITY;

  constructor(cfg: PullupConfig) {
    super("pullup", cfg, { required: ["shoulder", "elbow", "wrist", "hip"] });
    this.leftElbowFilter = this.newAngleFilter();
    this.rightElbowFilter = this.newAngleFilter();
  }

  override update(frame: PoseFrame): EngineUpdate {
    const lms = readPoseLandmarks(frame);
    const threshold = this.cfg.visibilityThreshold;
    this.bothVisible = !!lms && minVisibility(lms, FRONT_REQUIRED) >= threshold;
    this.mouthVisible =
      !!lms &&
      landmarkVisibility(lms[LM.MOUTH_LEFT]) >= threshold &&
      landmarkVisibility(lms[LM.MOUTH_RIGHT]) >= threshold;
    return super.update(frame);
  }

  /** A front-view engine reads both arms: side is "both" whenever a body is tracked. */
  override getState(): EngineState {
    const state = super.getState();
    return state.side === null ? state : { ...state, side: "both" };
  }

  protected resetSignals(): void {
    this.leftElbowFilter.reset();
    this.rightElbowFilter.reset();
    this.clearAttempt();
  }

  protected override resetExercise(): void {
    super.resetExercise();
    this.bothVisible = false;
    this.mouthVisible = false;
    this.lastFrontT = null;
  }

  protected onPose(ctx: PoseContext): void {
    const { t, dt, points: p } = ctx;
    const cfg = this.cfg;
    const ls = p[LM.LEFT_SHOULDER];
    const rs = p[LM.RIGHT_SHOULDER];
    const le = p[LM.LEFT_ELBOW];
    const re = p[LM.RIGHT_ELBOW];
    const lw = p[LM.LEFT_WRIST];
    const rw = p[LM.RIGHT_WRIST];
    const nose = p[LM.NOSE];

    const shoulderMid = mid(ls, rs);
    const shoulderWidth = distance(ls, rs);
    const hipMid = mid(p[LM.LEFT_HIP], p[LM.RIGHT_HIP]);
    const torso = distance(shoulderMid, hipMid);
    // Square-on to the camera, and upright (shoulders above the hips: hanging, not lying down).
    const facing =
      this.bothVisible &&
      shoulderWidth > 0 &&
      shoulderWidth >= cfg.minShoulderWidthRatio * torso &&
      shoulderMid.y < hipMid.y;
    const leftRaw = angleDeg(ls, le, lw);
    const rightRaw = angleDeg(rs, re, rw);
    if (!facing || !Number.isFinite(leftRaw) || !Number.isFinite(rightRaw) || !Number.isFinite(nose.y)) {
      // Not a usable front view: same handling as lost tracking, but asks to face the camera.
      this.flagIssue("face_camera");
      const since = this.lastFrontT ?? t;
      if (this.lastFrontT === null) this.lastFrontT = t;
      this.onLost(t, dt, t - since);
      return;
    }
    this.lastFrontT = t;

    const left = this.leftElbowFilter.filter(leftRaw, t);
    const right = this.rightElbowFilter.filter(rightRaw, t);
    const elbow = (left + right) / 2;
    this.primaryAngle = elbow;
    this.bodyLine = null;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const wristLine = mid(lw, rw);
    const mouth = this.mouthVisible ? mid(p[LM.MOUTH_LEFT], p[LM.MOUTH_RIGHT]) : nose;
    const chinClearance = (wristLine.y - mouth.y) / shoulderWidth;
    const handsOverhead = lw.y < nose.y && rw.y < nose.y && lw.y < ls.y && rw.y < rs.y;
    const hanging = elbow > cfg.upAngleDeg && handsOverhead;
    const chinOver = chinClearance >= cfg.minChinClearanceRatio;
    const top = this.topDebounce.update(hanging, t);
    const bottom = this.bottomDebounce.update(elbow < cfg.downAngleDeg && chinOver, t);

    if (this.phase === "searching") {
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, elbow);
        this.anchorAttempt(shoulderMid.y, wristLine, shoulderWidth);
      } else if (!hanging) {
        this.flagIssue("extend_fully");
      }
      return;
    }

    const atTop = top && !this.cycle.inBottom;
    if (!atTop && this.handsDrifted(wristLine)) {
      // The hands moved: not hanging from a fixed bar.
      this.cancelSet(t);
      this.clearAttempt();
      this.flagIssue("extend_fully");
      return;
    }
    this.attemptMinShoulderY = Math.min(this.attemptMinShoulderY, shoulderMid.y);

    const event = this.cycle.step(t, elbow, top, bottom);
    switch (event.type) {
      case "down":
        this.setPhase("down", t);
        break;
      case "redip":
        this.rejectRep("extend_fully", t);
        break;
      case "partial":
        this.rejectRep("chin_over_bar", t);
        break;
      case "complete": {
        this.setPhase("up", t);
        const a = this.anchor;
        const rise = a ? a.shoulderY - this.attemptMinShoulderY : Number.NaN;
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (!a || !(rise >= cfg.minShoulderRiseRatio * a.shoulderWidth)) {
          this.rejectRep("chin_over_bar", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        }
        break;
      }
      default:
        break;
    }
    if (top && !this.cycle.inBottom) this.anchorAttempt(shoulderMid.y, wristLine, shoulderWidth);
  }

  private anchorAttempt(shoulderY: number, wrist: Point2, shoulderWidth: number): void {
    this.attemptMinShoulderY = shoulderY;
    this.anchor =
      Number.isFinite(shoulderY) && shoulderWidth > 0 && Number.isFinite(shoulderWidth)
        ? { shoulderY, wrist, shoulderWidth }
        : null;
  }

  private handsDrifted(wrist: Point2): boolean {
    const a = this.anchor;
    if (!a) return false;
    return distance(wrist, a.wrist) > this.cfg.maxWristDriftRatio * a.shoulderWidth;
  }

  private clearAttempt(): void {
    this.anchor = null;
    this.attemptMinShoulderY = Number.POSITIVE_INFINITY;
  }
}
