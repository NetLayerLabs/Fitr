/**
 * Glute-bridge engine (side view, lying on the back, knees bent).
 *
 * Primary signal: hip extension = shoulder-hip-knee angle, signed so that it keeps growing
 * past 180 when the hips go above the shoulder-knee line (an over-arched bridge still reads
 * as "up" instead of folding back towards a partial). ~130 = hips on the floor, 180 = knees,
 * hips and shoulders in one line. Rep = hips down -> bridge -> hips down:
 *  - hips down (start / end): extension < hipsDownMaxDeg (145);
 *  - bridge (phase 'down' = the far end of the range): extension > topMinDeg (165);
 *  - both debounced (>= 2 frames and >= 50 ms), One Euro smoothing on every angle.
 * Internally the shared RepCycle runs on (360 - extension), so "top" is hips down.
 *
 * Anti-cheat:
 *  - Posture gate: shoulders on the floor (shoulder raised above the hip by at most
 *    maxTorsoLiftDeg, 30) and knees bent (knee angle <= maxKneeAngleDeg, 140). Standing
 *    squats / hip hinges never start a set; losing the posture (debounced) cancels it
 *    (body_not_horizontal).
 *  - Hip lift: at the top the hip must be at least minHipRiseThighRatio (0.2) thigh lengths
 *    above the shoulder, else the rep is rejected with go_higher. Heel slides with the hips
 *    on the floor open the same angle but never lift the hip.
 *  - go_higher: rose past partialMinDeg (155) without reaching the line, then lowered.
 *    go_lower: from the top, lowered past 155 then bridged again without touching down.
 *  - too_fast: hips-down -> hips-down in < minRepMs (500; server median limit is 600 ms).
 *  - Standard machinery from engine/common.ts: visibility gating (shoulder, hip, knee,
 *    ankle), teleport freeze, frame-gap / lost-tracking abandonment.
 */
import { angleDeg, distance, offsetBelowLine } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { CyclicRepEngine, type Debouncer, type PoseContext, type RepThresholds } from "@/lib/pose/engine/common";
import { elevationAboveDeg } from "../situp/floorGeometry";
import type { GluteBridgeConfig } from "./config";

type BridgeCycleConfig = GluteBridgeConfig & RepThresholds;

function withCycle(cfg: GluteBridgeConfig): BridgeCycleConfig {
  return {
    ...cfg,
    upAngleDeg: 360 - cfg.hipsDownMaxDeg,
    downAngleDeg: 360 - cfg.topMinDeg,
    partialAngleDeg: 360 - cfg.partialMinDeg,
  };
}

/** shoulder-hip-knee, continued past 180 when the hip is above the shoulder-knee line. */
export function signedHipExtensionDeg(
  shoulder: { x: number; y: number },
  hip: { x: number; y: number },
  knee: { x: number; y: number },
): number {
  const a = angleDeg(shoulder, hip, knee);
  const below = offsetBelowLine(hip, shoulder, knee);
  if (!Number.isFinite(a) || !Number.isFinite(below)) return Number.NaN;
  return below >= 0 ? a : 360 - a;
}

export class GluteBridgeEngine extends CyclicRepEngine<BridgeCycleConfig> {
  private readonly hipFilter: OneEuroFilter;
  private readonly kneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly bodyFilter: OneEuroFilter;
  private readonly postureDebounce: Debouncer;
  /** Highest hip lift (thigh lengths above the shoulder) during the current top. */
  private topLift = Number.NEGATIVE_INFINITY;

  constructor(cfg: GluteBridgeConfig) {
    super("glute_bridge", withCycle(cfg), { required: ["shoulder", "hip", "knee", "ankle"] });
    this.hipFilter = this.newAngleFilter();
    this.kneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.bodyFilter = this.newAngleFilter();
    this.postureDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.hipFilter.reset();
    this.kneeFilter.reset();
    this.torsoFilter.reset();
    this.bodyFilter.reset();
    this.topLift = Number.NEGATIVE_INFINITY;
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

    const hipRaw = signedHipExtensionDeg(shoulder, hip, knee);
    const kneeRaw = angleDeg(hip, knee, ankle);
    const torsoRaw = elevationAboveDeg(hip, shoulder);
    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const thigh = distance(hip, knee);
    if (!Number.isFinite(hipRaw) || !Number.isFinite(kneeRaw) || !Number.isFinite(torsoRaw) || !(thigh > 0)) {
      this.resetDebouncers();
      return;
    }
    const extension = this.hipFilter.filter(hipRaw, t);
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const torsoLift = this.torsoFilter.filter(torsoRaw, t);
    const body = Number.isFinite(bodyRaw) ? this.bodyFilter.filter(bodyRaw, t) : Number.NaN;
    this.primaryAngle = extension;
    this.bodyLine = Number.isFinite(body) ? body : null;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const posture = torsoLift <= cfg.maxTorsoLiftDeg && kneeAngle <= cfg.maxKneeAngleDeg;
    const signal = 360 - extension;
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
        this.topLift = Number.NEGATIVE_INFINITY;
      }
      return;
    }

    if (lostPosture) {
      this.cancelSet(t);
      this.topLift = Number.NEGATIVE_INFINITY;
      this.flagIssue("body_not_horizontal");
      return;
    }
    if (!posture) this.flagIssue("body_not_horizontal");

    // Image y grows downwards: hip above the shoulder => shoulder.y - hip.y > 0.
    const lift = (shoulder.y - hip.y) / thigh;
    const event = this.cycle.step(t, signal, top, bottom);
    switch (event.type) {
      case "down":
      case "redip":
        if (event.type === "redip") this.rejectRep("go_lower", t);
        else this.setPhase("down", t);
        this.topLift = lift;
        break;
      case "partial":
        this.rejectRep("go_higher", t);
        break;
      case "complete":
        this.setPhase("up", t);
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (!(this.topLift >= cfg.minHipRiseThighRatio)) {
          this.rejectRep("go_higher", t);
        } else {
          this.countRep(t, event.durationMs, 360 - event.maxAngleDeg, 360 - event.minAngleDeg);
        }
        this.topLift = Number.NEGATIVE_INFINITY;
        return;
      default:
        break;
    }
    if (this.cycle.inBottom) {
      this.topLift = Math.max(this.topLift, lift);
      if (lift < cfg.minHipRiseThighRatio) this.flagIssue("go_higher");
    }
  }
}
