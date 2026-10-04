/**
 * Leg-raise engine (side view, lying on the back).
 *
 * Primary signal: hip angle shoulder-hip-ankle (180 = legs flat on the floor, 90 = legs
 * vertical). Rep = legs down -> legs up -> legs down:
 *  - legs down (start / end): hip angle > upAngleDeg (150, legs within ~30 deg of the floor);
 *  - legs up (phase 'down' = the far end of the range): hip angle < downAngleDeg (100);
 *  - both debounced (>= 2 frames and >= 50 ms), One Euro smoothing on every angle.
 *
 * Anti-cheat:
 *  - Back on the floor: the shoulder may not be raised above the hip by more than
 *    maxTorsoLiftDeg (30). A sit-up with flat legs closes the same hip angle and is blocked,
 *    as is anything standing (torso vertical). Losing it (debounced) cancels the set
 *    (body_not_horizontal); a set only starts lying flat with the legs down.
 *  - Straight legs: the knee angle must stay >= minKneeAngleDeg (145) over the whole rep,
 *    else the rep is rejected with extend_fully (bent-knee tucks / knee-to-chest).
 *  - go_higher: raised past partialAngleDeg (135) without reaching vertical, then lowered.
 *    go_lower: from the top, lowered past 135 then raised again without returning near the
 *    floor.
 *  - too_fast: legs-down -> legs-down in < minRepMs (700; server median limit is 800 ms).
 *  - Standard machinery from engine/common.ts: visibility gating (shoulder, hip, knee,
 *    ankle), teleport freeze, frame-gap / lost-tracking abandonment.
 */
import { angleDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, type Debouncer, type PoseContext } from "@/lib/pose/engine/common";
import { elevationAboveDeg } from "../situp/floorGeometry";
import type { LegRaiseConfig } from "./config";

export class LegRaiseEngine extends CyclicRepEngine<LegRaiseConfig> {
  private readonly hipFilter: OneEuroFilter;
  private readonly kneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly postureDebounce: Debouncer;
  /** Smallest knee angle since the last confirmed legs-down position. */
  private attemptMinKnee = Number.POSITIVE_INFINITY;

  constructor(cfg: LegRaiseConfig) {
    super("leg_raise", cfg, { required: ["shoulder", "hip", "knee", "ankle"] });
    this.hipFilter = this.newAngleFilter();
    this.kneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.postureDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.hipFilter.reset();
    this.kneeFilter.reset();
    this.torsoFilter.reset();
    this.attemptMinKnee = Number.POSITIVE_INFINITY;
  }

  protected resetDebouncers(): void {
    super.resetDebouncers();
    this.postureDebounce.reset();
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const hip = p[j.hip];
    const knee = p[j.knee];
    const ankle = p[j.ankle];

    const hipRaw = angleDeg(shoulder, hip, ankle);
    const kneeRaw = angleDeg(hip, knee, ankle);
    const torsoRaw = elevationAboveDeg(hip, shoulder);
    if (!Number.isFinite(hipRaw) || !Number.isFinite(kneeRaw) || !Number.isFinite(torsoRaw)) {
      this.resetDebouncers();
      return;
    }
    const hipAngle = this.hipFilter.filter(hipRaw, t);
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const torsoLift = this.torsoFilter.filter(torsoRaw, t);
    this.primaryAngle = hipAngle;
    this.bodyLine = hipAngle;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const backDown = torsoLift <= cfg.maxTorsoLiftDeg;
    const legsDown = hipAngle > cfg.upAngleDeg;
    const top = this.topDebounce.update(legsDown, t);
    const bottom = this.bottomDebounce.update(hipAngle < cfg.downAngleDeg, t);
    const lostPosture = this.postureDebounce.update(!backDown, t);

    if (this.phase === "searching") {
      if (!backDown) {
        this.flagIssue("body_not_horizontal");
        return;
      }
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, hipAngle);
        this.attemptMinKnee = kneeAngle;
      }
      return;
    }

    if (lostPosture) {
      this.cancelSet(t);
      this.attemptMinKnee = Number.POSITIVE_INFINITY;
      this.flagIssue("body_not_horizontal");
      return;
    }
    if (!backDown) this.flagIssue("body_not_horizontal");
    if (kneeAngle < cfg.minKneeAngleDeg) this.flagIssue("extend_fully");
    this.attemptMinKnee = Math.min(this.attemptMinKnee, kneeAngle);

    const event = this.cycle.step(t, hipAngle, top, bottom);
    switch (event.type) {
      case "down":
        this.setPhase("down", t);
        break;
      case "redip":
        this.rejectRep("go_lower", t);
        break;
      case "partial":
        this.rejectRep("go_higher", t);
        break;
      case "complete":
        this.setPhase("up", t);
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (this.attemptMinKnee < cfg.minKneeAngleDeg) {
          this.rejectRep("extend_fully", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
        }
        break;
      default:
        break;
    }
    // At a confirmed legs-down position the next attempt starts here.
    if (top && !this.cycle.inBottom) this.attemptMinKnee = kneeAngle;
  }
}
