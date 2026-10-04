/**
 * Squat engine (side view recommended; a front view gives poor knee angles).
 *
 * Primary signal: knee angle (hip-knee-ankle). Rep = standing -> depth -> standing:
 *  - standing ('up'): knee > upAngleDeg (160);
 *  - depth ('down'): knee < downAngleDeg (95). Only the knee angle decides depth; "hip at or
 *    below knee height" is NOT used as an alternative, because in a 2D view hip height
 *    depends on camera tilt and distance while the knee angle does not;
 *  - both debounced (>= 2 frames and >= 50 ms).
 *
 * 'ready' additionally requires an upright torso (shoulder-hip within 30 deg of vertical),
 * so knee bends while lying or sitting can never start a set. A torso more than 75 deg from
 * vertical during a set (lying down) abandons it.
 *
 * Rejections: too_fast (< minRepMs = 500), go_lower (dipped below 140 without reaching
 * depth, OR reached knee depth while the hip dropped less than minHipDropShinRatio (0.3)
 * shin lengths below its standing height: blocks seated knee extensions / one-legged knee
 * bends), extend_fully (rose above 140 from the bottom and re-dipped without standing up).
 *
 * chest_up: torso more than 60 deg from vertical at the bottom. By default this is a warning
 * only (the rep still counts and chest_up is shown), because long-femured lifters
 * legitimately lean a lot; set rejectOnChestUp to reject such reps instead.
 */
import { angleDeg, distance, segmentAngleFromVerticalDeg } from "@/lib/pose/geometry";
import type { OneEuroFilter } from "@/lib/pose/filters";
import type { SquatConfig } from "./config";
import { CyclicRepEngine, type Debouncer, type PoseContext } from "./common";

export class SquatEngine extends CyclicRepEngine<SquatConfig> {
  private readonly kneeFilter: OneEuroFilter;
  private readonly bodyFilter: OneEuroFilter;
  private readonly torsoFilter: OneEuroFilter;
  private readonly lyingDebounce: Debouncer;
  private leanedAtBottom = false;
  /** Hip height (image y, frame heights) when last standing, and the shin length then. */
  private standingHipY = Number.NaN;
  private shinLength = Number.NaN;
  /** Lowest hip position (largest y) during the current bottom. */
  private bottomHipY = Number.NEGATIVE_INFINITY;

  constructor(cfg: SquatConfig) {
    super("squat", cfg, { required: ["shoulder", "hip", "knee", "ankle"] });
    this.kneeFilter = this.newAngleFilter();
    this.bodyFilter = this.newAngleFilter();
    this.torsoFilter = this.newAngleFilter();
    this.lyingDebounce = this.newDebouncer();
  }

  protected resetSignals(): void {
    this.kneeFilter.reset();
    this.bodyFilter.reset();
    this.torsoFilter.reset();
    this.lyingDebounce.reset();
    this.leanedAtBottom = false;
    this.standingHipY = Number.NaN;
    this.shinLength = Number.NaN;
    this.bottomHipY = Number.NEGATIVE_INFINITY;
  }

  protected onPose(ctx: PoseContext): void {
    const { t, points: p, joints: j } = ctx;
    const cfg = this.cfg;
    const shoulder = p[j.shoulder];
    const hip = p[j.hip];
    const knee = p[j.knee];
    const ankle = p[j.ankle];

    const kneeRaw = angleDeg(hip, knee, ankle);
    const bodyRaw = angleDeg(shoulder, hip, ankle);
    const torsoRaw = segmentAngleFromVerticalDeg(shoulder, hip);
    if (!Number.isFinite(kneeRaw) || !Number.isFinite(torsoRaw)) {
      this.resetDebouncers();
      return;
    }

    const kneeAngle = this.kneeFilter.filter(kneeRaw, t);
    const body = this.bodyFilter.filter(bodyRaw, t);
    const torso = this.torsoFilter.filter(torsoRaw, t);
    this.primaryAngle = kneeAngle;
    this.bodyLine = Number.isFinite(body) ? body : null;

    if (ctx.frozen) {
      this.resetDebouncers();
      this.lyingDebounce.reset();
      return;
    }

    const upright = torso <= cfg.maxStandingTorsoFromVerticalDeg;
    const standing = kneeAngle > cfg.upAngleDeg;
    const top = this.topDebounce.update(standing, t);
    const bottom = this.bottomDebounce.update(kneeAngle < cfg.downAngleDeg, t);
    const lying = this.lyingDebounce.update(torso > cfg.maxTorsoFromVerticalDeg, t);

    if (this.phase === "searching") {
      if (!upright) {
        this.flagIssue("chest_up");
      } else if (top) {
        this.setPhase("ready", t);
        this.cycle.begin(t, kneeAngle);
        this.leanedAtBottom = false;
        this.noteStanding(hip.y, distance(knee, ankle));
      } else if (!standing) {
        this.flagIssue("extend_fully");
      }
      return;
    }

    if (lying) {
      this.cancelSet(t);
      this.leanedAtBottom = false;
      this.flagIssue("chest_up");
      return;
    }

    if (!this.cycle.inBottom && standing) this.noteStanding(hip.y, distance(knee, ankle));
    const event = this.cycle.step(t, kneeAngle, top, bottom);
    switch (event.type) {
      case "down":
        this.setPhase("down", t);
        this.leanedAtBottom = false;
        this.bottomHipY = hip.y;
        break;
      case "redip":
        this.rejectRep("extend_fully", t);
        this.leanedAtBottom = false;
        this.bottomHipY = hip.y;
        break;
      case "partial":
        this.rejectRep("go_lower", t);
        break;
      case "complete": {
        this.setPhase("up", t);
        const hipDrop = this.bottomHipY - this.standingHipY;
        if (event.durationMs < cfg.minRepMs) {
          this.rejectRep("too_fast", t);
        } else if (!(hipDrop >= cfg.minHipDropShinRatio * this.shinLength)) {
          this.rejectRep("go_lower", t);
        } else if (this.leanedAtBottom && cfg.rejectOnChestUp) {
          this.rejectRep("chest_up", t);
        } else {
          this.countRep(t, event.durationMs, event.minAngleDeg, event.maxAngleDeg);
          if (this.leanedAtBottom) this.holdIssue("chest_up", t);
        }
        this.leanedAtBottom = false;
        this.bottomHipY = Number.NEGATIVE_INFINITY;
        return;
      }
      default:
        break;
    }
    if (this.cycle.inBottom) {
      this.bottomHipY = Math.max(this.bottomHipY, hip.y);
      if (torso > cfg.chestUpTorsoFromVerticalDeg) {
        this.leanedAtBottom = true;
        this.flagIssue("chest_up");
      }
    }
  }

  private noteStanding(hipY: number, shinLength: number): void {
    if (Number.isFinite(hipY) && shinLength > 0) {
      this.standingHipY = hipY;
      this.shinLength = shinLength;
    }
  }
}
