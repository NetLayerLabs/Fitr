/**
 * Jump squat engine (side view).
 *
 * A rep = squat to depth (feet down) -> takeoff (both feet clearly off the floor) -> landing.
 * Plain squats never count.
 *
 * Signals (aspect-corrected image units): knee angle (hip-knee-ankle, One Euro smoothed) and
 * torso angle on the tracked side, plus vertical rises of the tracked ankle, the other
 * ankle, the tracked toe (foot index) and the hip above their *standing baselines*. The
 * baselines and the leg length (hip-knee + knee-ankle) are learned from frames where the
 * person stands with the feet down; rises are expressed in leg lengths, so the thresholds
 * do not depend on camera distance.
 *
 * Per frame:
 *  - standing: knee > upAngleDeg (160);
 *  - depth: knee < downAngleDeg (100) with the feet down (a tucked knee in the air is not a
 *    squat);
 *  - airborne: tracked ankle rose >= jumpMinLegRatio (0.15 leg lengths, ~13 cm for an
 *    average adult) AND the other ankle too (when its visibility >= 0.3) AND the hip rose
 *    >= hipRiseFraction (0.7) of that AND the toe rose >= toeMinLegRatio (0.06). When the
 *    toe is not visible the ankle threshold is raised noToeJumpMultiplier (1.25x) instead;
 *  - landed: tracked ankle back below landFraction (0.5) of the jump threshold.
 *  All transitions are debounced (>= 2 frames and >= 50 ms).
 *
 * Stages: top -> (depth) bottom -> (airborne) air -> (landed) counted, back to top. Landing
 * may flow straight into the next squat; standing up in between is not required.
 *
 * Anti-cheat:
 *  - 'ready' needs the person standing upright (torso within 30 deg of vertical); torso
 *    > 75 deg from vertical during a set (lying down) cancels it.
 *  - Plain squat: depth then standing back up with the feet down for standWithoutJumpMs
 *    (300 ms), or sinking into another squat without a takeoff => rejected, jump_higher.
 *  - Calf raise / rising onto the toes: the ankle and hip lift but the toe stays down, and
 *    the lift is smaller than a jump => not airborne.
 *  - Kicking one foot up: the other ankle and the hip do not rise => not airborne.
 *  - Hopping without squatting: airborne without depth => rejected on landing, go_lower.
 *    A dip below 140 that never reached depth, then standing (feet down) for 300 ms =>
 *    go_lower; knee bends within landingAbsorbMs (700 ms) of a landing are exempt.
 *  - too_fast: < minRepMs (600 ms) from the last standing / landing frame to landing.
 *    Server limits: HONEST_MS_PER_UNIT 900, minMedianRepMs 700, maxRepsPerMinute 60.
 *  - Tracking loss (> lostTimeoutMs), a frame gap or a glitch abandons the rep in progress
 *    (and the baselines, which must be re-learned standing).
 *
 * Limitation: a far-side ankle with low visibility is skipped; the hip rise and toe check
 * still have to pass.
 */
import { LM } from "@/lib/pose/landmarks";
import { angleDeg, distance, segmentAngleFromVerticalDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { EngineUpdate, Landmark, PoseFrame } from "@/lib/pose/types";
import { CyclicRepEngine, readPoseLandmarks, type Debouncer, type PoseContext } from "@/lib/pose/engine/common";
import type { JumpSquatConfig } from "./config";

type Stage = "top" | "bottom" | "air";

const OTHER = {
  left: { ankle: LM.RIGHT_ANKLE, toe: LM.LEFT_FOOT_INDEX },
  right: { ankle: LM.LEFT_ANKLE, toe: LM.RIGHT_FOOT_INDEX },
} as const;

function vis(lm: Landmark | undefined): number {
  const v = lm?.visibility;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Exponential moving average; NaN start takes the sample as is. */
function ema(prev: number, sample: number, k: number): number {
  return Number.isFinite(prev) ? prev + (sample - prev) * k : sample;
}

export class JumpSquatEngine extends CyclicRepEngine<JumpSquatConfig> {
  private readonly kneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly lyingDebounce: Debouncer;
  private readonly airDebounce: Debouncer;
  private readonly landDebounce: Debouncer;
  private frameLandmarks: Landmark[] | null = null;

  // Standing baselines (image y, frame heights) and leg length.
  private legLength = Number.NaN;
  private baseAnkleY = Number.NaN;
  private baseOtherAnkleY = Number.NaN;
  private baseToeY = Number.NaN;
  private baseHipY = Number.NaN;

  // Rep stage.
  private stage: Stage = "top";
  private squatted = false;
  private partialDip = false;
  /** Time of the last landing (shock-absorption window), or null. */
  private landedT: number | null = null;
  /** Top stage: standing with the feet down continuously since, or null. */
  private topSince: number | null = null;
  private lastTopT = 0;
  private startT = 0;
  private minKnee = Number.POSITIVE_INFINITY;
  private maxKnee = Number.NEGATIVE_INFINITY;
  /** Bottom stage: knee went back above upAngleDeg (since when, feet down), or null. */
  private standingSince: number | null = null;
  private rose = false;
  private riseT = 0;

  constructor(cfg: JumpSquatConfig) {
    super("jump_squat", cfg, { required: ["shoulder", "hip", "knee", "ankle"] });
    this.kneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.lyingDebounce = this.newDebouncer();
    this.airDebounce = this.newDebouncer();
    this.landDebounce = this.newDebouncer();
  }

  override update(frame: PoseFrame): EngineUpdate {
    this.frameLandmarks = readPoseLandmarks(frame);
    try {
      return super.update(frame);
    } finally {
      this.frameLandmarks = null;
    }
  }

  protected override resetDebouncers(): void {
    super.resetDebouncers();
    this.airDebounce.reset();
    this.landDebounce.reset();
  }

  protected override cancelSet(t: number): void {
    super.cancelSet(t);
    this.resetStage(t);
  }

  protected resetSignals(): void {
    this.kneeFilter.reset();
    this.torsoFilter.reset();
    this.lyingDebounce.reset();
    this.legLength = Number.NaN;
    this.baseAnkleY = Number.NaN;
    this.baseOtherAnkleY = Number.NaN;
    this.baseToeY = Number.NaN;
    this.baseHipY = Number.NaN;
    this.resetStage(0);
  }

  private resetStage(t: number): void {
    this.stage = "top";
    this.squatted = false;
    this.partialDip = false;
    this.landedT = null;
    this.topSince = null;
    this.lastTopT = t;
    this.startT = t;
    this.minKnee = Number.POSITIVE_INFINITY;
    this.maxKnee = Number.NEGATIVE_INFINITY;
    this.standingSince = null;
    this.rose = false;
    this.riseT = 0;
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j, side } = ctx;
    const cfg = this.cfg;
    const hip = p[j.hip];
    const knee = p[j.knee];
    const ankle = p[j.ankle];

    const kneeRaw = angleDeg(hip, knee, ankle);
    const torsoRaw = segmentAngleFromVerticalDeg(p[j.shoulder], hip);
    if (!Number.isFinite(kneeRaw) || !Number.isFinite(torsoRaw)) {
      this.resetDebouncers();
      return;
    }
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);
    this.primaryAngle = kneeAngle;
    this.bodyLine = null;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.lyingDebounce.reset();
      return;
    }

    const lms = this.frameLandmarks;
    const thr = cfg.extraJointVisibilityThreshold;
    const otherIdx = OTHER[side];
    const otherAnkle = lms && vis(lms[otherIdx.ankle]) >= thr ? p[otherIdx.ankle] : null;
    const toe = lms && vis(lms[otherIdx.toe]) >= thr ? p[otherIdx.toe] : null;

    const standing = kneeAngle > cfg.upAngleDeg;
    const upright = torso <= cfg.maxStandingTorsoFromVerticalDeg;

    // --- jump measurements (in leg lengths) ---
    const L = this.legLength;
    const jumpTh = cfg.jumpMinLegRatio;
    const rise = (base: number, y: number) => (base - y) / L;
    const ankleRise = Number.isFinite(L) ? rise(this.baseAnkleY, ankle.y) : Number.NaN;
    const grounded = !(ankleRise >= jumpTh * cfg.landFraction);
    let airborneNow = false;
    const toeKnown = !!toe && Number.isFinite(this.baseToeY);
    // Without a visible toe a calf raise cannot be ruled out directly: demand a higher lift.
    const ankleTh = toeKnown ? jumpTh : jumpTh * cfg.noToeJumpMultiplier;
    if (Number.isFinite(ankleRise) && ankleRise >= ankleTh) {
      const hipOk = rise(this.baseHipY, hip.y) >= jumpTh * cfg.hipRiseFraction;
      const otherOk =
        !otherAnkle || !Number.isFinite(this.baseOtherAnkleY) || rise(this.baseOtherAnkleY, otherAnkle.y) >= ankleTh;
      const toeOk = !toeKnown || rise(this.baseToeY, toe.y) >= cfg.toeMinLegRatio;
      airborneNow = hipOk && otherOk && toeOk;
    }

    // Learn baselines while standing with the feet down (not mid-jump).
    const learn = () => {
      const legNow = distance(hip, knee) + distance(knee, ankle);
      if (!(legNow > 0)) return;
      const k = Number.isFinite(this.legLength) ? 0.3 : 1;
      this.legLength = ema(this.legLength, legNow, k);
      this.baseAnkleY = ema(this.baseAnkleY, ankle.y, k);
      this.baseHipY = ema(this.baseHipY, hip.y, k);
      if (otherAnkle) this.baseOtherAnkleY = ema(this.baseOtherAnkleY, otherAnkle.y, Number.isFinite(this.baseOtherAnkleY) ? 0.3 : 1);
      if (toe) this.baseToeY = ema(this.baseToeY, toe.y, Number.isFinite(this.baseToeY) ? 0.3 : 1);
    };

    const top = this.topDebounce.update(standing && grounded, t);
    const lying = this.lyingDebounce.update(torso > cfg.maxTorsoFromVerticalDeg, t);

    if (this.phase === "searching") {
      if (!upright) this.flagIssue("chest_up");
      else if (top) {
        this.setPhase("ready", t);
        this.resetStage(t);
        this.legLength = Number.NaN;
        learn();
      } else if (!standing) this.flagIssue("extend_fully");
      return;
    }

    if (lying) {
      this.cancelSet(t);
      this.flagIssue("chest_up");
      return;
    }

    const bottom = this.bottomDebounce.update(kneeAngle < cfg.downAngleDeg && grounded, t);
    const air = this.airDebounce.update(airborneNow, t);
    const landed = this.landDebounce.update(grounded, t);

    switch (this.stage) {
      case "top": {
        if (standing && grounded) {
          this.lastTopT = t;
          if (this.topSince === null) this.topSince = t;
          if (!airborneNow && Math.abs(ankleRise) < jumpTh * 0.3) learn();
        } else {
          this.topSince = null;
        }
        // Knee bends right after a landing are shock absorption, not partial squats.
        const absorbing = this.landedT !== null && t - this.landedT < cfg.landingAbsorbMs;
        if (kneeAngle < cfg.partialAngleDeg && !absorbing) this.partialDip = true;
        if (bottom) {
          this.enterBottom(t, kneeAngle, this.lastTopT);
        } else if (air) {
          // Took off without squatting first.
          this.stage = "air";
          this.squatted = false;
          this.partialDip = false;
          this.setPhase("up", t);
          this.maxKnee = kneeAngle;
        } else if (this.partialDip && this.topSince !== null && t - this.topSince >= cfg.standWithoutJumpMs) {
          // Dipped, never reached depth, and stood back up (no takeoff either).
          this.partialDip = false;
          this.rejectRep("go_lower", t);
        }
        break;
      }
      case "bottom": {
        this.minKnee = Math.min(this.minKnee, kneeAngle);
        this.maxKnee = Math.max(this.maxKnee, kneeAngle);
        if (air) {
          this.stage = "air";
          this.squatted = true;
          this.standingSince = null;
          this.setPhase("up", t);
          break;
        }
        if (standing && grounded) {
          if (this.standingSince === null) this.standingSince = t;
          if (!this.rose) {
            this.rose = true;
            this.riseT = t;
          }
          if (t - this.standingSince >= cfg.standWithoutJumpMs) {
            // Stood back up without leaving the floor: a plain squat.
            this.rejectRep("jump_higher", t);
            this.stage = "top";
            this.partialDip = false;
            this.lastTopT = t;
            this.setPhase("up", t);
          }
          break;
        }
        this.standingSince = null;
        if (this.rose && bottom) {
          // Straightened up and sank into another squat without a takeoff.
          this.rejectRep("jump_higher", t);
          this.enterBottom(t, kneeAngle, this.riseT);
        }
        break;
      }
      case "air": {
        this.maxKnee = Math.max(this.maxKnee, kneeAngle);
        if (landed) {
          if (!this.squatted) {
            this.rejectRep("go_lower", t);
          } else {
            const durationMs = t - this.startT;
            if (durationMs < cfg.minRepMs) this.rejectRep("too_fast", t);
            else this.countRep(t, durationMs, this.minKnee, this.maxKnee);
          }
          this.stage = "top";
          this.squatted = false;
          this.partialDip = false;
          this.landedT = t;
          this.topSince = null;
          this.lastTopT = t;
          this.minKnee = Number.POSITIVE_INFINITY;
          this.maxKnee = Number.NEGATIVE_INFINITY;
        }
        break;
      }
    }
  }

  private enterBottom(t: number, kneeAngle: number, startT: number): void {
    this.stage = "bottom";
    this.partialDip = false;
    this.startT = startT;
    this.minKnee = kneeAngle;
    this.maxKnee = kneeAngle;
    this.standingSince = null;
    this.rose = false;
    this.setPhase("down", t);
  }
}
