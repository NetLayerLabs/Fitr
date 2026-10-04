/**
 * Synthetic side-view jump squats (tests + form-guide demo).
 *
 * The body is the shared standingSkeleton (knee angle + torso lean) translated straight up
 * by a lift height (world units = body heights) while airborne. Per rep: descend to the
 * bottom, drive up until the legs are straight, fly (sine-shaped lift), land with soft knees
 * and stand back up.
 *
 * Cheat variants: `jumpHeight: 0` (plain squats), `calfRaise: true` (squat, then rise onto
 * the toes: ankle and hip lift but the toes stay on the floor), and `bottomKnee` above the
 * depth threshold (half squats with a jump).
 */
import {
  mulberry32,
  renderLandmarks,
  standingSkeleton,
  type RenderOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";

export interface JumpRepSpec {
  /** Knee angle at the bottom of the squat (default 75). */
  bottomKnee?: number;
  /** Peak lift of the whole body, body heights (default 0.11 ~ 20 cm). 0 = no jump. */
  jumpHeight?: number;
  /** Rise onto the toes instead of jumping (toes stay on the floor). */
  calfRaise?: boolean;
  /**
   * Time scale for the squat, drive and landing (1 = default, 0.3 = very fast). The flight
   * time is physics, not tempo: it always follows from the jump height (see flightMs).
   */
  speed?: number;
}

export interface JumpSquatSequenceOptions extends RenderOptions {
  fps?: number;
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise in degrees on the knee and torso angles. */
  jitterDeg?: number;
  /** Number of identical reps, or one spec per rep. Default 4. */
  reps?: number | readonly JumpRepSpec[];
  bottomKnee?: number;
  jumpHeight?: number;
  calfRaise?: boolean;
  /** Max body lift of a calf raise, body heights (default 0.035 ~ 6 cm). */
  calfLift?: number;
  /** Stand fully (true, default) between reps, or land straight into the next squat. */
  standBetween?: boolean;
  leadInMs?: number;
  leadOutMs?: number;
}

/** Standing knee angle. */
const STAND = 176;

interface Key {
  t: number;
  knee: number;
  lift: number;
}

/** Keyframe track for a set of reps: [time, knee angle, lift]. */
function buildTrack(o: JumpSquatSequenceOptions): { keys: Key[]; durationMs: number; calf: boolean[]; repStarts: number[] } {
  const specs: JumpRepSpec[] =
    typeof (o.reps ?? 4) === "number" ? Array.from({ length: (o.reps as number | undefined) ?? 4 }, () => ({})) : [...(o.reps as JumpRepSpec[])];
  const standBetween = o.standBetween ?? true;
  const keys: Key[] = [];
  const calf: boolean[] = [];
  const repStarts: number[] = [];
  let t = 0;
  const key = (dt: number, knee: number, lift: number) => {
    t += dt;
    keys.push({ t, knee, lift });
  };
  keys.push({ t: 0, knee: STAND, lift: 0 });
  key(o.leadInMs ?? 900, STAND, 0);
  specs.forEach((spec, i) => {
    const s = spec.speed ?? 1;
    const bottom = spec.bottomKnee ?? o.bottomKnee ?? 75;
    const h = spec.jumpHeight ?? o.jumpHeight ?? 0.11;
    const isCalf = spec.calfRaise ?? o.calfRaise ?? false;
    repStarts.push(t);
    calf.push(isCalf);
    const continuing = !standBetween && i > 0;
    if (!continuing) key(650 * s, bottom, 0); // descend
    key(120 * s, bottom, 0); // pause at the bottom
    key(260 * s, STAND, 0); // drive up, legs straight at takeoff
    if (h > 0) {
      // Flight: rise and fall, sampled as sine keyframes (see liftAt for the exact shape).
      key(flightMs(h), STAND, -h); // negative lift marks a flight segment with peak h
    } else {
      key(120 * s, STAND, 0);
    }
    if (!standBetween && i < specs.length - 1) {
      key(450 * s, bottom, 0); // land and sink straight into the next squat
    } else {
      key(220 * s, 140, 0); // soft landing
      key(330 * s, STAND, 0); // stand up
      key(350 * s, STAND, 0); // pause
    }
  });
  key(o.leadOutMs ?? 700, STAND, 0);
  return { keys, durationMs: t, calf, repStarts };
}

/** Ballistic flight time (ms) for a peak lift of h body heights, for a 1.75 m person. */
export function flightMs(h: number): number {
  return 2 * Math.sqrt((2 * h * 1.75) / 9.81) * 1000;
}

const ease = (p: number) => (1 - Math.cos(Math.PI * p)) / 2;

function sample(keys: Key[], t: number): { knee: number; lift: number } {
  if (t <= keys[0].t) return { knee: keys[0].knee, lift: 0 };
  for (let i = 1; i < keys.length; i++) {
    const k1 = keys[i];
    if (t <= k1.t) {
      const k0 = keys[i - 1];
      const p = k1.t > k0.t ? (t - k0.t) / (k1.t - k0.t) : 1;
      const knee = k0.knee + (k1.knee - k0.knee) * ease(p);
      const lift = k1.lift < 0 ? -k1.lift * Math.sin(Math.PI * p) : 0;
      return { knee, lift };
    }
  }
  return { knee: keys[keys.length - 1].knee, lift: 0 };
}

const up = (v: Vec, h: number): Vec => ({ x: v.x, y: v.y + h });

/** Translate a skeleton up by h; with `toesDown` the toe stays on the floor (calf raise). */
export function liftSkeleton(s: SideSkeleton, h: number, toesDown = false): SideSkeleton {
  if (h === 0) return s;
  return {
    ...s,
    shoulder: up(s.shoulder, h),
    elbow: up(s.elbow, h),
    wrist: up(s.wrist, h),
    hip: up(s.hip, h),
    knee: up(s.knee, h),
    ankle: up(s.ankle, h),
    heel: up(s.heel, h),
    footIndex: toesDown ? s.footIndex : up(s.footIndex, h),
  };
}

function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

export function jumpSquatSequence(options: JumpSquatSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, jitterDeg = 0, width = 640, height = 480 } = options;
  const { keys, durationMs, calf, repStarts } = buildTrack(options);
  const rng = mulberry32(seed);
  const n = () => (jitterDeg === 0 ? 0 : (rng() * 2 - 1) * jitterDeg);
  return frameOffsets(durationMs, fps).map((t) => {
    const { knee, lift } = sample(keys, t);
    let rep = 0;
    for (let i = 0; i < repStarts.length; i++) if (t >= repStarts[i]) rep = i;
    const isCalf = calf[rep] ?? false;
    // A calf raise lifts the body by at most calfLift (heels up, toes down).
    const h = isCalf ? Math.min(lift, options.calfLift ?? 0.035) : lift;
    const skeleton = liftSkeleton(
      standingSkeleton({ kneeDeg: knee + n(), torsoLeanDeg: (180 - knee) * 0.45 + n() }),
      h,
      isCalf,
    );
    return {
      timestampMs: startMs + t,
      landmarks: renderLandmarks(skeleton, "standing", { ...options, width, height }),
      imageWidth: width,
      imageHeight: height,
    };
  });
}
