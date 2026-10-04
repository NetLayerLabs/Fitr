/**
 * Shared base for FRONT-VIEW engines (jumping jacks, high knees; usable by pull-ups).
 *
 * BaseEngine (engine/common.ts) selects one body side and gates visibility on it. A front
 * view needs both sides, so this base additionally:
 *  - requires every `required` joint on the OTHER side to be visible as well;
 *  - requires the body to be square-on: shoulder width >= minShoulderWidthRatio x torso
 *    length (shoulder midpoint -> hip midpoint). Side-on, the two shoulders overlap and the
 *    ratio collapses towards 0. Real square-on bodies read about 0.7;
 *  - requires an upright torso (shoulder midpoint -> hip midpoint within
 *    maxTorsoFromVerticalDeg of vertical), so lying on the floor waving the limbs ("snow
 *    angels") never counts. Disable with maxTorsoFromVerticalDeg = 180 (e.g. hanging is
 *    still upright, so pull-ups keep it).
 * A frame failing these is treated like lost tracking: the debouncers reset (no transition can
 * complete) and the issue is flagged (face_camera, or chest_up when not upright); if it lasts
 * lostTimeoutMs the attempt is abandoned and the start position must be shown again.
 * The reported side is always "both" while a pose is tracked.
 */
import { SIDE_JOINTS } from "@/lib/pose/landmarks";
import { distance, minVisibility, segmentAngleFromVerticalDeg, type Point2 } from "@/lib/pose/geometry";
import { BaseEngine, readPoseLandmarks, type JointName, type PoseContext } from "@/lib/pose/engine/common";
import type { CommonEngineConfig } from "@/lib/pose/engine/commonConfig";
import type { EngineState, EngineUpdate, ExerciseKind, FormIssue, Landmark, PoseFrame } from "@/lib/pose/types";

import type { FrontViewConfig } from "./config";

export { FRONT_VIEW_DEFAULTS, type FrontViewConfig } from "./config";

export interface FrontJoints {
  shoulder: Point2;
  elbow: Point2;
  wrist: Point2;
  hip: Point2;
  knee: Point2;
  ankle: Point2;
}

/** One usable, square-on, upright front-view frame (aspect-corrected, y down). */
export interface FrontPose {
  t: number;
  dt: number;
  /** See PoseContext.frozen: update smoothing only, no transitions or counting. */
  frozen: boolean;
  /** Anatomical left / right (left appears on the right of an unmirrored image). */
  left: FrontJoints;
  right: FrontJoints;
  shoulderMid: Point2;
  hipMid: Point2;
  /** Shoulder midpoint -> hip midpoint distance (frame heights). */
  torsoLength: number;
  shoulderWidth: number;
  torsoFromVerticalDeg: number;
}

const mid = (a: Point2, b: Point2): Point2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function jointsOf(points: readonly Point2[], side: "left" | "right"): FrontJoints {
  const j = SIDE_JOINTS[side];
  return {
    shoulder: points[j.shoulder],
    elbow: points[j.elbow],
    wrist: points[j.wrist],
    hip: points[j.hip],
    knee: points[j.knee],
    ankle: points[j.ankle],
  };
}

export abstract class FrontEngine<C extends CommonEngineConfig & FrontViewConfig> extends BaseEngine<C> {
  private readonly requiredJoints: readonly JointName[];
  private frameLandmarks: Landmark[] | null = null;
  private viewBadSince: number | null = null;

  protected constructor(exercise: ExerciseKind, cfg: C, required: readonly JointName[]) {
    super(exercise, cfg, { required });
    this.requiredJoints = required;
  }

  // --- hooks for subclasses ---------------------------------------------------------------

  /** A usable, square-on, upright pose. */
  protected abstract onFrontPose(pose: FrontPose): void;
  /** Reset debouncers only (frames on either side of a bad frame are not consecutive). */
  protected abstract resetDebouncers(): void;
  /** Cancel any attempt, forget smoothing, set phase 'searching'. */
  protected abstract abandon(t: number): void;
  /** Reset all exercise-specific state. */
  protected abstract resetFront(): void;

  // --- RepEngine ----------------------------------------------------------------------------

  update(frame: PoseFrame): EngineUpdate {
    this.frameLandmarks = readPoseLandmarks(frame);
    return super.update(frame);
  }

  getState(): EngineState {
    const state = super.getState();
    if (state.side !== null) state.side = "both";
    return state;
  }

  // --- BaseEngine hooks ---------------------------------------------------------------------

  protected onPose(ctx: PoseContext): void {
    const { t, points } = ctx;
    const other = ctx.side === "left" ? "right" : "left";
    const lms = this.frameLandmarks;
    const otherIdx = this.requiredJoints.map((name) => SIDE_JOINTS[other][name]);
    if (!lms || minVisibility(lms, otherIdx) < this.cfg.visibilityThreshold) {
      // Only one side is visible: the person is side-on (or half out of frame).
      this.badView("face_camera", t);
      return;
    }
    const left = jointsOf(points, "left");
    const right = jointsOf(points, "right");
    const shoulderMid = mid(left.shoulder, right.shoulder);
    const hipMid = mid(left.hip, right.hip);
    const torsoLength = distance(shoulderMid, hipMid);
    const shoulderWidth = distance(left.shoulder, right.shoulder);
    const torsoFromVerticalDeg = segmentAngleFromVerticalDeg(shoulderMid, hipMid);
    if (!(torsoLength > 0) || !Number.isFinite(shoulderWidth) || !Number.isFinite(torsoFromVerticalDeg)) {
      this.badView("body_not_visible", t);
      return;
    }
    // Upright also needs the shoulders ABOVE the hips (image y down).
    const upright = torsoFromVerticalDeg <= this.cfg.maxTorsoFromVerticalDeg && shoulderMid.y < hipMid.y;
    if (this.cfg.maxTorsoFromVerticalDeg < 180 && !upright) {
      this.badView("chest_up", t);
      return;
    }
    if (shoulderWidth < this.cfg.minShoulderWidthRatio * torsoLength) {
      this.badView("face_camera", t);
      return;
    }
    this.viewBadSince = null;
    this.onFrontPose({
      t,
      dt: ctx.dt,
      frozen: ctx.frozen,
      left,
      right,
      shoulderMid,
      hipMid,
      torsoLength,
      shoulderWidth,
      torsoFromVerticalDeg,
    });
  }

  protected onGlitch(): void {
    this.resetDebouncers();
  }

  protected onLost(t: number, _dt: number, lostMs: number): void {
    this.resetDebouncers();
    if (lostMs >= this.cfg.lostTimeoutMs) this.abandon(t);
  }

  protected onGap(t: number): void {
    this.viewBadSince = null;
    this.abandon(t);
  }

  protected resetExercise(): void {
    this.frameLandmarks = null;
    this.viewBadSince = null;
    this.resetFront();
  }

  private badView(issue: FormIssue, t: number): void {
    this.flagIssue(issue);
    this.resetDebouncers();
    if (this.viewBadSince === null) this.viewBadSince = t;
    if (t - this.viewBadSince >= this.cfg.lostTimeoutMs && this.phase !== "searching") this.abandon(t);
  }
}
