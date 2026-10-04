/**
 * Sit-up engine (side view, lying on the floor).
 *
 * Primary signal: torso rise from the floor (riseFromFloorDeg(hip, shoulder, ankle)): 0 =
 * lying flat, 90 = upright, > 90 = chest over the knees. It is measured against the floor
 * direction pointing away from the feet, so it does not depend on which way the person faces
 * or on the camera being mirrored. Rep = lying -> sat up -> lying:
 *  - lying (start / end): rise < lyingMaxDeg (25);
 *  - sat up (phase 'down' = the far end of the range): rise > sitUpMinDeg (70);
 *  - both debounced (>= 2 frames and >= 50 ms), with One Euro smoothing on every angle.
 * Internally the shared RepCycle runs on (180 - rise), so "top" is lying flat.
 *
 * Anti-cheat:
 *  - Posture gate ("knees-up supine"): knees bent (knee angle <= maxKneeAngleDeg, 135), the
 *    knee clearly above the hip (>= 0.3 thigh lengths) and the hip on the floor next to the
 *    planted feet (<= 0.6 shin lengths above the ankle). Standing toe-touches, sitting on a
 *    chair and lying with straight legs never start a set; losing the posture (debounced)
 *    during a set cancels it (body_not_horizontal = "Get down into position").
 *  - A set only starts from a confirmed lying position, so rocking while sitting up (never
 *    lying back) counts nothing.
 *  - go_higher: rose above partialMinDeg (40) but not to sitUpMinDeg, then lay back (half
 *    crunch). go_lower: from sat up, lowered past 40 then sat up again without lying back.
 *  - too_fast: floor -> floor in < minRepMs (600; server median limit is 700 ms).
 *  - Standard machinery from engine/common.ts: visibility gating (shoulder, hip, knee and
 *    ankle on the tracked side), teleport freeze, frame-gap / lost-tracking abandonment.
 */
import { angleDeg, distance } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, type Debouncer, type PoseContext, type RepThresholds } from "@/lib/pose/engine/common";
import type { SitupConfig } from "./config";
import { riseFromFloorDeg } from "./floorGeometry";

type SitupCycleConfig = SitupConfig & RepThresholds;

function withCycle(cfg: SitupConfig): SitupCycleConfig {
  return {
    ...cfg,
    upAngleDeg: 180 - cfg.lyingMaxDeg,
    downAngleDeg: 180 - cfg.sitUpMinDeg,
    partialAngleDeg: 180 - cfg.partialMinDeg,
  };
}

export class SitupEngine extends CyclicRepEngine<SitupCycleConfig> {
  private readonly riseFilter: OneEuroFilter;
  private readonly kneeFilter: OneEuroFilter;
  private readonly bodyFilter: OneEuroFilter;
  private readonly postureDebounce: Debouncer;

  constructor(cfg: SitupConfig) {
    super("situp", withCycle(cfg), { required: ["shoulder", "hip", "knee", "ankle"] });
    this.riseFilter = this.newAngleFilter();
    this.kneeFilter = this.newAngleFilter();
    this.bodyFilter = this.newAngleFilter();
    this.postureDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.riseFilter.reset();
    this.kneeFilter.reset();
    this.bodyFilter.reset();
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

    const riseRaw = riseFromFloorDeg(hip, shoulder, ankle);
    const kneeRaw = angleDeg(hip, knee, ankle);
    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const thigh = distance(hip, knee);
    const shin = distance(knee, ankle);
    if (!Number.isFinite(riseRaw) || !Number.isFinite(kneeRaw) || !(thigh > 0) || !(shin > 0)) {
      this.resetDebouncers();
      return;
    }

    const rise = this.riseFilter.filter(riseRaw, t);
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const body = Number.isFinite(bodyRaw) ? this.bodyFilter.filter(bodyRaw, t) : Number.NaN;
    this.primaryAngle = rise;
    this.bodyLine = Number.isFinite(body) ? body : null;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const kneesUp = hip.y - knee.y >= cfg.minKneeAboveHipThighRatio * thigh;
    const hipsDown = ankle.y - hip.y <= cfg.maxHipAboveAnkleShinRatio * shin;
    const posture = kneesUp && hipsDown && kneeAngle <= cfg.maxKneeAngleDeg;
    const signal = 180 - rise;
    const top = this.topDebounce.update(signal > cfg.upAngleDeg, t);
    const bottom = this.bottomDebounce.update(signal < cfg.downAngleDeg, t);
    const lostPosture = this.postureDebounce.update(!posture, t);

    if (this.phase === "searching") {
      if (!posture) {
        this.flagIssue("body_not_horizontal");
        return;
      }
      if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, signal);
      }
      return;
    }

    if (lostPosture) {
      this.cancelSet(t);
      this.flagIssue("body_not_horizontal");
      return;
    }
    if (!posture) this.flagIssue("body_not_horizontal");

    const event = this.cycle.step(t, signal, top, bottom);
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
        } else {
          // Report in rise-from-floor degrees (the cycle runs on 180 - rise).
          this.countRep(t, event.durationMs, 180 - event.maxAngleDeg, 180 - event.minAngleDeg);
        }
        break;
      default:
        break;
    }
  }
}
