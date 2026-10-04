/**
 * Burpee engine (SIDE view; the more visible body side is read, like push-ups / squats).
 *
 * A burpee is counted only as a complete sequence, in order:
 *
 *   standing -> squat, hands down -> plank -> squat, hands down -> standing
 *
 * (the push-up in the plank and the jump / arms overhead at the end are optional).
 *
 * Positions (aspect-corrected 2D, One Euro smoothed angles):
 *  - standing: knee (hip-knee-ankle) >= standKneeDeg (155) and torso (shoulder-hip) within
 *    maxStandTorsoDeg (30) of vertical, debounced (>= 2 frames and >= 50 ms);
 *  - squat, hands down: knee <= crouchKneeDeg (120) with the wrist below the knee in the image
 *    (hands reaching the floor);
 *  - plank: shoulder->ankle line within plankMaxInclineDeg (30) of horizontal, body line
 *    (shoulder-hip-ankle) >= plankMinBodyLineDeg (150), legs straight (knee >=
 *    plankMinKneeDeg, 150) and the wrist under the shoulder (within
 *    plankMaxArmFromVerticalDeg, 50, of straight down), debounced.
 *
 * Phases: 'ready' once standing is confirmed, 'down' from the first squat, 'up' when the
 * sequence ends standing (counted or rejected).
 *
 * ANTI-CHEAT / rejections (the rep's duration runs from the last standing frame before the
 * squat to the confirmed stand):
 *  - Squat thrusts / squats with the hands down that never reach the plank: rejected with
 *    body_not_horizontal ("get down into position"). Squats with the hands up never start an
 *    attempt and count 0.
 *  - A plank attempt that was horizontal but with sagging / piked hips, on the knees or lying
 *    on the floor (for >= 250 ms) and never became a valid plank: rejected with hips_sagging /
 *    hips_piked / body_on_floor.
 *  - Standing up from the plank without the squat in between (not a burpee; in practice only a
 *    tracking miss): rejected with go_lower.
 *  - Push-ups or planks alone never count: the sequence has to start and end standing.
 *  - too_fast: standing -> standing in < minRepMs (1000 ms). The duration runs from the LAST
 *    straight-legged frame of the descent to the first confirmed stand of the rise (about
 *    0.85x the full movement plus 0-400 ms of smoothing lag), so this only catches sequences
 *    no human can do (well under ~1.2 s with a plank). The server's pace floors (1500 ms
 *    median, 30 reps/min) are stricter than this engine.
 *  - maxRepMs (6000 ms): an attempt still unfinished after this is abandoned without an event
 *    (phase back to 'searching'); stand up to start again. Stops "collect a squat now, a
 *    plank later, stand up later" sequences spread over a long rest.
 *  - Lost tracking (300 ms) or a frame gap abandons the attempt; a teleporting joint freezes
 *    counting (unstable_tracking).
 */
import {
  angleDeg,
  angleFromDownDeg,
  distance,
  offsetBelowLine,
  segmentAngleFromHorizontalDeg,
  segmentAngleFromVerticalDeg,
} from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import { BaseEngine, Debouncer, type PoseContext } from "@/lib/pose/engine/common";
import type { FormIssue } from "@/lib/pose/types";
import type { BurpeeConfig } from "./config";

/** Transitions pass through bent / tilted poses; only a plank fault held this long counts. */
const PLANK_ISSUE_MS = 250;

/** Where the current attempt has got to. */
type Stage = "standing" | "crouch" | "plank" | "crouch2";

export class BurpeeEngine extends BaseEngine<BurpeeConfig> {
  private readonly kneeFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly inclineFilter: OneEuroFilter;
  private readonly bodyFilter: OneEuroFilter;
  private readonly armFilter: OneEuroFilter;
  private readonly standDebounce: Debouncer;
  private readonly plankDebounce: Debouncer;
  /** A plank-form problem must persist this long before it is shown / used to reject. */
  private readonly plankIssueDebounce: Debouncer;

  private stage: Stage = "standing";
  private lastStandT = 0;
  private startT = 0;
  private minKnee = Number.POSITIVE_INFINITY;
  private maxKnee = Number.NEGATIVE_INFINITY;
  /** First plank-form problem seen while horizontal in this attempt (if no valid plank yet). */
  private plankIssue: FormIssue | null = null;

  constructor(cfg: BurpeeConfig) {
    super("burpee", cfg, { required: ["shoulder", "elbow", "wrist", "hip", "knee", "ankle"] });
    this.kneeFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.inclineFilter = this.newAngleFilter();
    this.bodyFilter = this.newAngleFilter();
    this.armFilter = this.newAngleFilter();
    this.standDebounce = this.newDebouncer();
    this.plankDebounce = this.newDebouncer();
    this.plankIssueDebounce = new Debouncer(cfg.debounceFrames, PLANK_ISSUE_MS);
  }

  // --- BaseEngine hooks ---------------------------------------------------------------------

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
    this.resetSignals();
    this.clearAttempt();
    this.lastStandT = 0;
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const wrist = p[j.wrist];
    const hip = p[j.hip];
    const knee = p[j.knee];
    const ankle = p[j.ankle];

    const kneeRaw = angleDeg(hip, knee, ankle);
    const torsoRaw = segmentAngleFromVerticalDeg(shoulder, hip);
    const inclineRaw = segmentAngleFromHorizontalDeg(shoulder, ankle);
    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const armRaw = angleFromDownDeg(shoulder, wrist);
    const shin = distance(knee, ankle);
    if (
      !Number.isFinite(kneeRaw) ||
      !Number.isFinite(torsoRaw) ||
      !Number.isFinite(inclineRaw) ||
      !Number.isFinite(bodyRaw) ||
      !Number.isFinite(armRaw) ||
      !(shin > 0)
    ) {
      this.resetDebouncers();
      return;
    }
    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);
    const incline = this.inclineFilter.filter(inclineRaw, t);
    const body = this.bodyFilter.filter(bodyRaw, t);
    const arm = this.armFilter.filter(armRaw, t);
    this.primaryAngle = kneeAngle;
    this.bodyLine = body;

    if (ctx.frozen) {
      this.resetDebouncers();
      return;
    }

    const standingRaw = kneeAngle >= cfg.standKneeDeg && torso <= cfg.maxStandTorsoDeg;
    const standing = this.standDebounce.update(standingRaw, t);
    const handsDown = wrist.y - knee.y >= cfg.minHandsBelowKneeShin * shin;
    const crouch = kneeAngle <= cfg.crouchKneeDeg && handsDown;
    const horizontal = incline <= cfg.plankMaxInclineDeg;
    const plankIssue: FormIssue | null = !horizontal
      ? null
      : body < cfg.plankMinBodyLineDeg
        ? offsetBelowLine(hip, shoulder, ankle) > 0
          ? "hips_sagging"
          : "hips_piked"
        : kneeAngle < cfg.plankMinKneeDeg || arm > cfg.plankMaxArmFromVerticalDeg
          ? "body_on_floor"
          : null;
    const plank = this.plankDebounce.update(horizontal && plankIssue === null, t);

    if (this.phase === "searching") {
      if (standing) {
        this.setPhase("ready", t);
        this.clearAttempt();
        this.lastStandT = t;
      }
      return;
    }

    if (this.stage === "standing") {
      if (standingRaw) this.lastStandT = t;
      if (crouch) {
        this.stage = "crouch";
        this.startT = this.lastStandT;
        this.minKnee = kneeAngle;
        this.maxKnee = kneeAngle;
        this.setPhase("down", t);
      }
      return;
    }

    this.minKnee = Math.min(this.minKnee, kneeAngle);
    this.maxKnee = Math.max(this.maxKnee, kneeAngle);
    if (t - this.startT > cfg.maxRepMs) {
      // Too slow to be one burpee: start again from standing.
      this.clearAttempt();
      this.resetDebouncers();
      this.setPhase("searching", t);
      return;
    }

    if (this.stage === "crouch") {
      if (this.plankIssueDebounce.update(plankIssue !== null, t) && plankIssue) {
        this.flagIssue(plankIssue);
        this.plankIssue ??= plankIssue;
      }
      if (plank) {
        this.stage = "plank";
        this.plankIssue = null;
      }
    } else if (this.stage === "plank") {
      if (crouch) this.stage = "crouch2";
    }

    if (standing) {
      const durationMs = t - this.startT;
      if (this.stage === "crouch2") {
        if (durationMs < cfg.minRepMs) this.rejectRep("too_fast", t);
        else this.countRep(t, durationMs, this.minKnee, this.maxKnee);
      } else if (this.stage === "plank") {
        this.rejectRep("go_lower", t);
      } else {
        this.rejectRep(this.plankIssue ?? "body_not_horizontal", t);
      }
      this.clearAttempt();
      this.lastStandT = t;
      this.setPhase("up", t);
    }
  }

  // --- internals ------------------------------------------------------------------------------

  private resetDebouncers(): void {
    this.standDebounce.reset();
    this.plankDebounce.reset();
    this.plankIssueDebounce.reset();
  }

  private resetSignals(): void {
    this.kneeFilter.reset();
    this.torsoFilter.reset();
    this.inclineFilter.reset();
    this.bodyFilter.reset();
    this.armFilter.reset();
    this.resetDebouncers();
  }

  private abandon(t: number): void {
    this.clearAttempt();
    this.resetSignals();
    this.primaryAngle = null;
    this.bodyLine = null;
    this.setPhase("searching", t);
  }

  private clearAttempt(): void {
    this.stage = "standing";
    this.startT = 0;
    this.minKnee = Number.POSITIVE_INFINITY;
    this.maxKnee = Number.NEGATIVE_INFINITY;
    this.plankIssue = null;
    this.plankIssueDebounce.reset();
  }
}
