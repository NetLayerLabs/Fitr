/**
 * Mountain-climber engine (side view, straight-arm or forearm plank).
 *
 * Each leg is tracked separately (anatomical left / right, so a side switch does not mix
 * them up) on its hip angle shoulder-hip-knee. A knee drive = leg back -> knee in -> leg back:
 *  - leg back: hip angle > upAngleDeg (150);
 *  - knee in (phase 'down'): hip angle < downAngleDeg (100);
 *  - both debounced per leg (>= 2 frames and >= 50 ms), One Euro smoothing per signal.
 * Every completed drive of either leg counts 1 (alternating legs is the normal pattern, but
 * alternation is not enforced: a run of drives with one leg still has to do the full range).
 *
 * Anti-cheat:
 *  - Plank gate (as in the plank / push-up engines): torso within maxTorsoFromHorizontalDeg
 *    (45) of horizontal, else body_not_horizontal (standing high knees count nothing); hands
 *    under the shoulders (shoulder->wrist within 50 deg of straight down), else body_on_floor
 *    (lying on the floor pulling the knees in, dead bugs). A set starts only from a confirmed
 *    plank with both legs back and straight; losing the plank (debounced) cancels it.
 *  - Planted leg: while a knee is in, the other leg must be seen straight (knee angle >=
 *    minStraightKneeDeg, 150) and the plank line shoulder-hip-ankle along it must stay
 *    > minBodyLineDeg (150). A drive with the hips piked up (downward-dog knee taps) is
 *    rejected with hips_piked, sagging with hips_sagging, and one where the other leg was
 *    never straight (knees on the floor) with body_on_floor.
 *  - Both legs must be tracked: the far leg needs visibility >= farLegVisibilityThreshold
 *    (0.3) on hip, knee and ankle, else nothing counts (body_not_visible) and after
 *    lostTimeoutMs the set is abandoned.
 *  - go_higher: knee closed past partialAngleDeg (135) but not to 100 (shuffling the feet).
 *    extend_fully: knee went back past 135 and was driven again without the leg reaching the
 *    plank.
 *  - too_fast: one leg's full drive (back -> in -> back) in < minRepMs (320 ms, measured from
 *    the last leg-back frame to the debounced return, so a 0.25 s flick reads ~0.3 s). Each
 *    leg cycles at most every 0.5 s even at the server's 240 drives/min ceiling, so honest
 *    pace stays well above it. Server limits: 180 ms median per rep, 240 per minute.
 *  - Piked hips also keep the legs from reading as "back" (the hip angle includes the pike),
 *    so downward-dog knee taps never complete a drive; hips_piked is flagged to say why.
 *  - Standard machinery from engine/common.ts: visibility gating of the near side (shoulder,
 *    wrist, hip, knee, ankle), teleport freeze, frame-gap / lost-tracking abandonment.
 */
import { SIDE_JOINTS } from "@/lib/pose/landmarks";
import {
  angleDeg,
  angleFromDownDeg,
  landmarkVisibility,
  offsetBelowLine,
  segmentAngleFromHorizontalDeg,
  type Point2,
} from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { BaseEngine, Debouncer, RepCycle, readPoseLandmarks, type PoseContext, type TrackedSide } from "@/lib/pose/engine/common";
import type { FormIssue, Landmark, PoseFrame, EngineUpdate } from "@/lib/pose/types";
import type { MountainClimberConfig } from "./config";

interface LegTrack {
  readonly cycle: RepCycle;
  readonly top: Debouncer;
  readonly bottom: Debouncer;
  readonly hipFilter: OneEuroFilter;
  readonly kneeFilter: OneEuroFilter;
  /** Worst plank line along the other leg while this knee is in (frames with that leg straight). */
  worstLine: number;
  worstIssue: FormIssue | null;
  /** The other leg was seen straight at least once while this knee was in. */
  sawPlanted: boolean;
}

interface LegReading {
  hipAngle: number;
  kneeAngle: number;
  hip: Point2;
  ankle: Point2;
}

const SIDES: readonly TrackedSide[] = ["left", "right"];

export class MountainClimberEngine extends BaseEngine<MountainClimberConfig> {
  private readonly legs: Record<TrackedSide, LegTrack>;
  private readonly torsoFilter: OneEuroFilter;
  private readonly postureDebounce: Debouncer;
  private landmarks: Landmark[] | null = null;
  private lastBothLegsT: number | null = null;

  constructor(cfg: MountainClimberConfig) {
    super("mountain_climber", cfg, { required: ["shoulder", "wrist", "hip", "knee", "ankle"] });
    const leg = (): LegTrack => ({
      cycle: new RepCycle(cfg),
      top: this.newDebouncer(),
      bottom: this.newDebouncer(),
      hipFilter: this.newAngleFilter(),
      kneeFilter: this.newAngleFilter(),
      worstLine: Number.POSITIVE_INFINITY,
      worstIssue: null,
      sawPlanted: false,
    });
    this.legs = { left: leg(), right: leg() };
    this.torsoFilter = this.newAngleFilter();
    this.postureDebounce = this.newDebouncer();
  }

  override update(frame: PoseFrame): EngineUpdate {
    // Kept only for the far leg's visibility in onPose; never mutated.
    this.landmarks = readPoseLandmarks(frame);
    try {
      return super.update(frame);
    } finally {
      this.landmarks = null;
    }
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j, side } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const wrist = p[j.wrist];
    const nearHip = p[j.hip];
    const far: TrackedSide = side === "left" ? "right" : "left";

    if (!this.legVisible(far)) {
      this.resetDebouncers();
      this.flagIssue("body_not_visible");
      if (this.lastBothLegsT === null || t - this.lastBothLegsT >= cfg.lostTimeoutMs) this.abandon(t);
      return;
    }
    this.lastBothLegsT = t;

    const torsoRaw = segmentAngleFromHorizontalDeg(shoulder, nearHip);
    const armRaw = angleFromDownDeg(shoulder, wrist);
    const readings = {} as Record<TrackedSide, LegReading>;
    for (const s of SIDES) {
      const lj = SIDE_JOINTS[s];
      const hip = p[lj.hip];
      const knee = p[lj.knee];
      const ankle = p[lj.ankle];
      const hipRaw = hip && knee ? angleDeg(shoulder, hip, knee) : Number.NaN;
      const kneeRaw = hip && knee && ankle ? angleDeg(hip, knee, ankle) : Number.NaN;
      if (!Number.isFinite(hipRaw) || !Number.isFinite(kneeRaw)) {
        this.resetDebouncers();
        return;
      }
      const leg = this.legs[s];
      readings[s] = {
        hipAngle: leg.hipFilter.filter(hipRaw, t),
        kneeAngle: leg.kneeFilter.filter(kneeRaw, t),
        hip,
        ankle,
      };
    }
    if (!Number.isFinite(torsoRaw) || !Number.isFinite(armRaw)) {
      this.resetDebouncers();
      return;
    }
    const torso = this.torsoFilter.filter(torsoRaw, t);
    const nearLeg = readings[side];
    this.primaryAngle = Math.min(readings.left.hipAngle, readings.right.hipAngle);
    const nearLine = angleDeg(shoulder, nearLeg.hip, nearLeg.ankle);
    this.bodyLine = Number.isFinite(nearLine) ? nearLine : null;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const horizontal = torso <= cfg.maxTorsoFromHorizontalDeg;
    const armsUnder = armRaw <= cfg.maxArmFromVerticalDeg;
    const plank = horizontal && armsUnder;
    const posture: FormIssue | null = !horizontal ? "body_not_horizontal" : !armsUnder ? "body_on_floor" : null;
    const lostPlank = this.postureDebounce.update(!plank, t);
    const tops = {} as Record<TrackedSide, boolean>;
    const bottoms = {} as Record<TrackedSide, boolean>;
    for (const s of SIDES) {
      tops[s] = this.legs[s].top.update(readings[s].hipAngle > cfg.upAngleDeg, t);
      bottoms[s] = this.legs[s].bottom.update(readings[s].hipAngle < cfg.downAngleDeg, t);
    }

    if (this.phase === "searching") {
      if (posture) {
        this.flagIssue(posture);
        return;
      }
      const lineIssue = this.plankLineIssue(shoulder, nearLeg);
      if (lineIssue) {
        this.flagIssue(lineIssue);
        return;
      }
      const straight = SIDES.every((s) => readings[s].kneeAngle >= cfg.minStraightKneeDeg);
      if (!straight) {
        this.flagIssue("body_on_floor");
        return;
      }
      if (tops.left && tops.right) {
        this.setPhase("ready", t);
        for (const s of SIDES) {
          this.legs[s].cycle.begin(t, readings[s].hipAngle);
          this.clearBottom(this.legs[s]);
        }
      }
      return;
    }

    if (lostPlank) {
      this.cancelSet(t);
      if (posture) this.flagIssue(posture);
      return;
    }
    if (posture) this.flagIssue(posture);

    let completed = false;
    for (const s of SIDES) {
      const leg = this.legs[s];
      const other = readings[s === "left" ? "right" : "left"];
      const event = leg.cycle.step(t, readings[s].hipAngle, tops[s], bottoms[s]);
      switch (event.type) {
        case "down":
          this.clearBottom(leg);
          break;
        case "redip":
          this.rejectRep("extend_fully", t);
          this.clearBottom(leg);
          break;
        case "partial":
          this.rejectRep("go_higher", t);
          break;
        case "complete":
          completed = true;
          if (event.durationMs < cfg.minRepMs) {
            this.rejectRep("too_fast", t);
          } else if (!leg.sawPlanted) {
            this.rejectRep("body_on_floor", t);
          } else if (leg.worstLine < cfg.minBodyLineDeg) {
            this.rejectRep(leg.worstIssue ?? "hips_piked", t);
          } else {
            this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
          }
          this.clearBottom(leg);
          break;
        default:
          break;
      }
      if (leg.cycle.inBottom) this.judgePlantedLeg(leg, shoulder, other);
    }

    if (this.legs.left.cycle.inBottom || this.legs.right.cycle.inBottom) {
      this.setPhase("down", t);
    } else {
      if (completed) this.setPhase("up", t);
      // Both legs back: the plank line itself (piked hips also keep the legs from reading
      // as "back", so drives cannot complete; this tells the user why).
      const lineIssue = this.plankLineIssue(shoulder, nearLeg);
      if (lineIssue) this.flagIssue(lineIssue);
    }
  }

  protected onGlitch(): void {
    this.resetDebouncers();
  }

  protected onLost(t: number, _dt: number, lostMs: number): void {
    this.resetDebouncers();
    if (lostMs >= this.cfg.lostTimeoutMs) this.abandon(t);
  }

  protected onGap(t: number): void {
    this.abandon(t);
  }

  protected resetExercise(): void {
    for (const s of SIDES) {
      this.legs[s].cycle.reset();
      this.clearBottom(this.legs[s]);
    }
    this.resetDebouncers();
    this.resetFilters();
    this.landmarks = null;
    this.lastBothLegsT = null;
  }

  /** While a knee is in: judge the plank along the other leg when it is back and straight. */
  private judgePlantedLeg(leg: LegTrack, shoulder: Point2, other: LegReading): void {
    const cfg = this.cfg;
    if (!(other.hipAngle >= cfg.upAngleDeg && other.kneeAngle >= cfg.minStraightKneeDeg)) return;
    const line = angleDeg(shoulder, other.hip, other.ankle);
    if (!Number.isFinite(line)) return;
    leg.sawPlanted = true;
    let issue: FormIssue | null = null;
    if (line < cfg.minBodyLineDeg) {
      issue = offsetBelowLine(other.hip, shoulder, other.ankle) > 0 ? "hips_sagging" : "hips_piked";
      this.flagIssue(issue);
    }
    if (line < leg.worstLine) {
      leg.worstLine = line;
      leg.worstIssue = issue;
    }
  }

  /** hips_piked / hips_sagging when a straight leg's plank line is below minBodyLineDeg. */
  private plankLineIssue(shoulder: Point2, leg: LegReading): FormIssue | null {
    if (leg.kneeAngle < this.cfg.minStraightKneeDeg) return null;
    const line = angleDeg(shoulder, leg.hip, leg.ankle);
    if (!(line < this.cfg.minBodyLineDeg)) return null;
    return offsetBelowLine(leg.hip, shoulder, leg.ankle) > 0 ? "hips_sagging" : "hips_piked";
  }

  private legVisible(side: TrackedSide): boolean {
    const lms = this.landmarks;
    if (!lms) return false;
    const lj = SIDE_JOINTS[side];
    const th = this.cfg.farLegVisibilityThreshold;
    return [lj.hip, lj.knee, lj.ankle].every((i) => landmarkVisibility(lms[i]) >= th);
  }

  private clearBottom(leg: LegTrack): void {
    leg.worstLine = Number.POSITIVE_INFINITY;
    leg.worstIssue = null;
    leg.sawPlanted = false;
  }

  private resetDebouncers(): void {
    for (const s of SIDES) {
      this.legs[s].top.reset();
      this.legs[s].bottom.reset();
    }
    this.postureDebounce.reset();
  }

  private resetFilters(): void {
    for (const s of SIDES) {
      this.legs[s].hipFilter.reset();
      this.legs[s].kneeFilter.reset();
    }
    this.torsoFilter.reset();
  }

  /** Cancel any drive in progress and go back to 'searching' (the plank must be shown again). */
  private cancelSet(t: number): void {
    for (const s of SIDES) {
      this.legs[s].cycle.reset();
      this.clearBottom(this.legs[s]);
    }
    this.resetDebouncers();
    this.setPhase("searching", t);
  }

  /** cancelSet() and forget smoothing state (tracking lost / frame gap). */
  private abandon(t: number): void {
    this.cancelSet(t);
    this.resetFilters();
    this.primaryAngle = null;
    this.bodyLine = null;
  }
}
