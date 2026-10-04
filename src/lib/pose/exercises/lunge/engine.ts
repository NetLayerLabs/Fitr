/**
 * Lunge engine (side view). Each lunge counts 1 rep, whichever leg leads, so alternating
 * lunges count every step.
 *
 * Signals: both knee angles (hip-knee-ankle, left and right, One Euro smoothed), knee and
 * ankle heights, and the torso angle. The tracked side (SideSelector, by visibility) must
 * show shoulder, hip, knee and ankle; the other leg's hip, knee and ankle must be at least
 * `otherLegVisibilityThreshold` (0.3) visible, since a lunge cannot be judged from one leg.
 *
 * Front leg: the leg whose knee is higher in the image (the back knee drops towards the
 * floor). It is reassigned only when the knee heights differ by more than
 * frontLegSwitchShinRatio (0.15) shin lengths, so it follows the leading leg rep by rep
 * (alternating lunges) without flip-flopping while standing. The front knee angle is the
 * primary angle.
 *
 * Rep = standing -> depth -> standing (RepCycle hysteresis on the front knee angle, both
 * transitions debounced >= 2 frames and >= 50 ms):
 *  - standing ('up'/'ready'): BOTH knees > upAngleDeg (160);
 *  - depth ('down'), all at once:
 *      front knee < downAngleDeg (100),
 *      back knee < backKneeDownDeg (125),
 *      back knee at most backKneeMaxHeightShinRatio (0.5) shin lengths above the front ankle
 *        (back knee close to the floor),
 *      front knee at least frontKneeMinHeightShinRatio (0.6) shin lengths above the front
 *        ankle (front shin upright, i.e. not kneeling on both knees).
 *
 * Anti-cheat:
 *  - 'ready' needs an upright torso (within 30 deg of vertical) and both legs straight, so
 *    lying / sitting knee bends never start a set; torso > 75 deg from vertical cancels it.
 *  - A squat bends both knees past 90 but keeps them level and high: the back-knee-low gate
 *    fails, so it is rejected as go_lower (front knee dipped below partialAngleDeg 140
 *    without depth).
 *  - Standing on one leg and curling the other heel up bends one knee a lot while the other
 *    stays straight: fails the back-knee angle gate, never reaches depth.
 *  - Kneeling on both knees fails the front-knee-height gate.
 *  - too_fast: < minRepMs (500 ms) top -> top. Server limits: HONEST_MS_PER_UNIT 800,
 *    minMedianRepMs 600, maxRepsPerMinute 70.
 *  - extend_fully: rose above 140 from the bottom and dropped back without standing up.
 *  - Tracking loss (> lostTimeoutMs, on either leg), a frame gap or a glitch abandons the
 *    in-progress lunge; the start position must be shown again.
 */
import { LM } from "@/lib/pose/landmarks";
import { angleDeg, distance as dist, segmentAngleFromVerticalDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { EngineUpdate, Landmark, PoseFrame } from "@/lib/pose/types";
import { CyclicRepEngine, readPoseLandmarks, type Debouncer, type PoseContext } from "@/lib/pose/engine/common";
import type { LungeConfig } from "./config";

const LEGS = {
  left: { hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE },
  right: { hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE },
} as const;

type LegSide = keyof typeof LEGS;

function vis(lm: Landmark | undefined): number {
  const v = lm?.visibility;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export class LungeEngine extends CyclicRepEngine<LungeConfig> {
  private readonly leftKneeFilter: OneEuroFilter;
  private readonly rightKneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly lyingDebounce: Debouncer;
  /** Landmarks of the frame being processed (for the other leg's visibility). */
  private frameLandmarks: Landmark[] | null = null;
  private front: LegSide | null = null;
  private otherLegMissingSince: number | null = null;

  constructor(cfg: LungeConfig) {
    super("lunge", cfg, { required: ["shoulder", "hip", "knee", "ankle"] });
    this.leftKneeFilter = this.newAngleFilter();
    this.rightKneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.lyingDebounce = this.newDebouncer();
  }

  override update(frame: PoseFrame): EngineUpdate {
    this.frameLandmarks = readPoseLandmarks(frame);
    try {
      return super.update(frame);
    } finally {
      this.frameLandmarks = null;
    }
  }

  protected resetSignals(): void {
    this.leftKneeFilter.reset();
    this.rightKneeFilter.reset();
    this.torsoFilter.reset();
    this.lyingDebounce.reset();
    this.front = null;
    this.otherLegMissingSince = null;
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j, side } = ctx;
    const cfg = this.cfg;

    // The other leg must be visible enough too.
    const other = LEGS[side === "left" ? "right" : "left"];
    const lms = this.frameLandmarks;
    const otherVisible =
      !!lms &&
      Math.min(vis(lms[other.hip]), vis(lms[other.knee]), vis(lms[other.ankle])) >= cfg.otherLegVisibilityThreshold;
    if (!otherVisible) {
      this.resetDebouncers();
      if (this.otherLegMissingSince === null) this.otherLegMissingSince = t;
      if (t - this.otherLegMissingSince >= cfg.lostTimeoutMs) {
        this.flagIssue("body_not_visible");
        this.abandon(t);
        this.otherLegMissingSince = t - cfg.lostTimeoutMs;
      }
      return;
    }
    this.otherLegMissingSince = null;

    const leg = (s: LegSide) => ({ hip: p[LEGS[s].hip], knee: p[LEGS[s].knee], ankle: p[LEGS[s].ankle] });
    const L = leg("left");
    const R = leg("right");
    const leftRaw = angleDeg(L.hip, L.knee, L.ankle);
    const rightRaw = angleDeg(R.hip, R.knee, R.ankle);
    const torsoRaw = segmentAngleFromVerticalDeg(p[j.shoulder], p[j.hip]);
    if (!Number.isFinite(leftRaw) || !Number.isFinite(rightRaw) || !Number.isFinite(torsoRaw)) {
      this.resetDebouncers();
      return;
    }
    const leftKnee = this.leftKneeFilter.filter(leftRaw, t);
    const rightKnee = this.rightKneeFilter.filter(rightRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);

    // Front leg = the higher knee (smaller image y), with hysteresis.
    const shin = Math.max(dist(L.knee, L.ankle), dist(R.knee, R.ankle));
    if (!(shin > 0)) {
      this.resetDebouncers();
      return;
    }
    const diff = (R.knee.y - L.knee.y) / shin; // > 0: left knee higher
    if (diff > cfg.frontLegSwitchShinRatio) this.front = "left";
    else if (diff < -cfg.frontLegSwitchShinRatio) this.front = "right";
    const front: LegSide = this.front ?? (leftKnee <= rightKnee ? "left" : "right");
    const F = front === "left" ? L : R;
    const B = front === "left" ? R : L;
    const frontKnee = front === "left" ? leftKnee : rightKnee;
    const backKnee = front === "left" ? rightKnee : leftKnee;
    const frontShin = dist(F.knee, F.ankle);

    this.primaryAngle = frontKnee;
    this.bodyLine = null;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.lyingDebounce.reset();
      return;
    }

    const backKneeHeight = (F.ankle.y - B.knee.y) / frontShin;
    const frontKneeHeight = (F.ankle.y - F.knee.y) / frontShin;
    const standing = leftKnee > cfg.upAngleDeg && rightKnee > cfg.upAngleDeg;
    const atDepth =
      frontKnee < cfg.downAngleDeg &&
      backKnee < cfg.backKneeDownDeg &&
      backKneeHeight <= cfg.backKneeMaxHeightShinRatio &&
      frontKneeHeight >= cfg.frontKneeMinHeightShinRatio;
    const upright = torso <= cfg.maxStandingTorsoFromVerticalDeg;
    const top = this.topDebounce.update(standing, t);
    const bottom = this.bottomDebounce.update(atDepth, t);
    const lying = this.lyingDebounce.update(torso > cfg.maxTorsoFromVerticalDeg, t);

    if (this.phase === "searching") {
      if (!upright) this.flagIssue("chest_up");
      else if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, frontKnee);
      } else if (!standing) this.flagIssue("extend_fully");
      return;
    }

    if (lying) {
      this.cancelSet(t);
      this.flagIssue("chest_up");
      return;
    }

    // RepCycle tracks the front knee; "top" means both legs straight.
    const angle = standing ? Math.max(frontKnee, cfg.upAngleDeg) : Math.min(frontKnee, cfg.upAngleDeg - 1e-6);
    const event = this.cycle.step(t, angle, top, bottom);
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
      case "complete":
        this.setPhase("up", t);
        if (event.durationMs < cfg.minRepMs) this.rejectRep("too_fast", t);
        else this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        break;
      default:
        break;
    }
  }
}
