/**
 * High-knees engine (FRONT view, standing, both body sides; see ../front/engine.ts for the
 * square-on / upright view gates).
 *
 * Signal per leg: an estimate of hip flexion from the 2D knee height,
 *   lift = acos((knee.y - hip.y) / thighRef)      (0 = knee straight below the hip, 90 = at hip height)
 * In a front view a thigh raised towards the camera foreshortens, so the knee rises towards the
 * hip's height. thighRef is the longest 2D hip-knee distance of either leg (at any moment of real
 * high knees at least one leg is down): it follows a longer reading instantly and shrinks
 * towards a shorter one with a thighRefDecayMs (2 s) time constant, so walking closer or
 * further from the camera is tracked but a squat cannot shrink it within one rep. Smoothed with
 * the shared One Euro filter.
 *
 * Rep = one knee: down -> up -> down, each side counted separately (each knee = 1 rep):
 *  - up: lift >= upLiftDeg (65: knee within ~0.4 thigh lengths of hip height) while the OTHER
 *    knee is down (lift <= maxSupportLiftDeg, 40) and the knee is not swung out sideways
 *    (|knee.x - hip.x| <= maxKneeSideRatio (0.6) thigh lengths);
 *  - down: lift <= downLiftDeg (35);
 *  - debounced (>= 2 frames and >= 50 ms) per side.
 *
 * ANTI-CHEAT / rejections:
 *  - Square-on and upright gates (FrontEngine): side-on (face_camera) or lying down
 *    (chest_up) never counts.
 *  - Support leg: when both knees are raised together (front-view squat, tuck jump) neither
 *    side can be "up", and such attempts are dropped silently, so squats count 0.
 *  - go_higher: a knee lifted above partialLiftDeg (45) but not to upLiftDeg (marching).
 *  - too_fast: one knee's down -> down cycle in < minRepMs (250 ms, measured including ~60 ms
 *    of filter / debounce lag; an honest sprint pace measures ~300 ms; server floors: 150 ms
 *    median, 300 reps/min).
 *  - requireAlternating (default): a lift on the same side as the previous counted lift is not
 *    counted (no event): pumping one knee counts once, then nothing until the other knee is
 *    lifted.
 *  - Lost tracking (300 ms), a frame gap, or a sustained bad view abandons in-progress lifts;
 *    a teleporting joint freezes counting (unstable_tracking).
 */
import { distance } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { Debouncer, TrackedSide } from "@/lib/pose/engine/common";
import { FrontEngine, type FrontJoints, type FrontPose } from "../front/engine";
import type { HighKneesConfig } from "./config";

const RAD_TO_DEG = 180 / Math.PI;

interface KneeTrack {
  readonly filter: OneEuroFilter;
  readonly upDebounce: Debouncer;
  readonly downDebounce: Debouncer;
  /** Confirmed up, waiting to come down. */
  up: boolean;
  /** Lifted past partialLiftDeg (an attempt in progress). */
  attempt: boolean;
  /** Both knees were raised together during this attempt: not a knee lift. */
  invalid: boolean;
  lastDownT: number;
  startT: number;
  peak: number;
  low: number;
}

export class HighKneesEngine extends FrontEngine<HighKneesConfig> {
  private readonly knees: Record<TrackedSide, KneeTrack>;
  private thighRef = Number.NaN;
  private lastCounted: TrackedSide | null = null;

  constructor(cfg: HighKneesConfig) {
    super("high_knees", cfg, ["shoulder", "hip", "knee", "ankle"]);
    const track = (): KneeTrack => ({
      filter: this.newAngleFilter(),
      upDebounce: this.newDebouncer(),
      downDebounce: this.newDebouncer(),
      up: false,
      attempt: false,
      invalid: false,
      lastDownT: 0,
      startT: 0,
      peak: 0,
      low: 0,
    });
    this.knees = { left: track(), right: track() };
  }

  protected resetDebouncers(): void {
    for (const k of Object.values(this.knees)) {
      k.upDebounce.reset();
      k.downDebounce.reset();
    }
  }

  protected abandon(t: number): void {
    this.resetFront();
    this.primaryAngle = null;
    this.setPhase("searching", t);
  }

  protected resetFront(): void {
    for (const k of Object.values(this.knees)) {
      k.filter.reset();
      k.upDebounce.reset();
      k.downDebounce.reset();
      this.clearKnee(k);
      k.lastDownT = 0;
    }
    this.thighRef = Number.NaN;
    this.lastCounted = null;
  }

  protected onFrontPose(pose: FrontPose): void {
    const { t, dt } = pose;
    const cfg = this.cfg;

    const thigh = Math.max(distance(pose.left.hip, pose.left.knee), distance(pose.right.hip, pose.right.knee));
    if (!(thigh > 0) || !Number.isFinite(thigh)) {
      this.resetDebouncers();
      return;
    }
    if (!Number.isFinite(this.thighRef) || thigh >= this.thighRef) this.thighRef = thigh;
    else this.thighRef -= (this.thighRef - thigh) * Math.min(1, dt / cfg.thighRefDecayMs);

    const leftLift = this.knees.left.filter.filter(this.liftRaw(pose.left), t);
    const rightLift = this.knees.right.filter.filter(this.liftRaw(pose.right), t);
    this.primaryAngle = Math.max(leftLift, rightLift);
    if (pose.frozen) {
      this.resetDebouncers();
      return;
    }

    const sides = [
      { side: "left" as const, lift: leftLift, other: rightLift, joints: pose.left },
      { side: "right" as const, lift: rightLift, other: leftLift, joints: pose.right },
    ];
    const status = sides.map(({ side, lift, other, joints }) => {
      const k = this.knees[side];
      const sideOk = Math.abs(joints.knee.x - joints.hip.x) <= cfg.maxKneeSideRatio * this.thighRef;
      const upRaw = lift >= cfg.upLiftDeg && sideOk && other <= cfg.maxSupportLiftDeg;
      const downRaw = lift <= cfg.downLiftDeg;
      return {
        side,
        lift,
        other,
        upRaw,
        downRaw,
        up: k.upDebounce.update(upRaw, t),
        down: k.downDebounce.update(downRaw, t),
      };
    });

    if (this.phase === "searching") {
      if (status.every((s) => s.down)) {
        this.setPhase("ready", t);
        for (const s of status) {
          this.clearKnee(this.knees[s.side]);
          this.knees[s.side].lastDownT = t;
        }
      }
      return;
    }

    for (const s of status) {
      const k = this.knees[s.side];
      if (!k.up) {
        if (s.downRaw) k.lastDownT = t;
        if (!k.attempt && s.lift > cfg.partialLiftDeg) {
          k.attempt = true;
          k.invalid = false;
          k.startT = k.lastDownT;
          k.peak = s.lift;
          k.low = s.lift;
        }
        if (k.attempt) {
          k.peak = Math.max(k.peak, s.lift);
          if (s.other > cfg.maxSupportLiftDeg) k.invalid = true;
        }
        if (s.up) {
          k.up = true;
          k.startT = k.lastDownT;
          k.peak = Math.max(k.attempt ? k.peak : s.lift, s.lift);
          k.low = Math.min(k.attempt ? k.low : s.lift, s.lift);
          k.attempt = true;
          this.setPhase("down", t);
        } else if (k.attempt && s.down) {
          if (!k.invalid) this.rejectRep("go_higher", t);
          this.clearKnee(k);
        }
        continue;
      }
      k.peak = Math.max(k.peak, s.lift);
      if (s.down) {
        const durationMs = t - k.startT;
        if (durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (!(cfg.requireAlternating && this.lastCounted === s.side)) {
          this.countRep(t, durationMs, Math.min(k.low, s.lift), k.peak);
          this.lastCounted = s.side;
        }
        this.clearKnee(k);
        k.lastDownT = t;
        this.setPhase(this.knees.left.up || this.knees.right.up ? "down" : "up", t);
      }
    }
  }

  /** Estimated hip flexion in degrees from the knee's height below the hip. */
  private liftRaw(j: FrontJoints): number {
    const ratio = (j.knee.y - j.hip.y) / this.thighRef;
    if (!Number.isFinite(ratio)) return Number.NaN;
    return Math.acos(Math.max(-1, Math.min(1, ratio))) * RAD_TO_DEG;
  }

  private clearKnee(k: KneeTrack): void {
    k.up = false;
    k.attempt = false;
    k.invalid = false;
    k.startT = 0;
    k.peak = 0;
    k.low = 0;
  }
}
