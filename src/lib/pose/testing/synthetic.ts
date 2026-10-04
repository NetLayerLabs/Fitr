/**
 * Deterministic synthetic BlazePose skeletons for engine tests (and demos).
 *
 * Bodies are built in a side-view "world" (y up, units of body height, facing +x) from
 * high-level joint angles, then projected onto a camera frame of a given size and emitted as
 * normalized 33-point landmarks exactly like MediaPipe would (x, y in [0, 1] per axis, y
 * down). The near side gets high visibility and the far side lower visibility.
 *
 * Randomness only comes from a seeded mulberry32 PRNG, never Math.random, so every
 * sequence is reproducible.
 */
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import type { Landmark, PoseFrame } from "@/lib/pose/types";

// ---------------------------------------------------------------------------------------
// PRNG
// ---------------------------------------------------------------------------------------

/** mulberry32: tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform noise in [-amplitude, +amplitude]. */
function noise(rng: () => number, amplitude: number): number {
  return amplitude === 0 ? 0 : (rng() * 2 - 1) * amplitude;
}

// ---------------------------------------------------------------------------------------
// World-space skeletons
// ---------------------------------------------------------------------------------------

export interface Vec {
  x: number;
  y: number;
}

/** Segment lengths as fractions of standing height. */
export const PROPORTIONS = Object.freeze({
  upperArm: 0.186,
  forearm: 0.146,
  torso: 0.3,
  thigh: 0.245,
  shin: 0.25,
  neck: 0.13,
});

/** Near-side joints of a side-view body in world space (y up, facing +x). */
export interface SideSkeleton {
  shoulder: Vec;
  elbow: Vec;
  wrist: Vec;
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec;
  footIndex: Vec;
  /** Unit vector from the shoulders towards the head. */
  headDir: Vec;
  /** Unit vector the face points to. */
  faceDir: Vec;
  /** Unit vector the fingers point to. */
  handDir: Vec;
}

const DEG = Math.PI / 180;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const polar = (len: number, rad: number): Vec => ({ x: len * Math.cos(rad), y: len * Math.sin(rad) });
const lerp = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const unit = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};

/**
 * Perpendicular knee offset that bends a straight hip-ankle segment into a knee angle of
 * 180 - |bendDeg| (thigh length a, shin length b, knee kept at the same fraction of the way).
 */
function kneeOffsetFor(bendDeg: number, a: number, b: number): number {
  const target = Math.min(Math.abs(bendDeg), 170) * DEG;
  let lo = 0;
  let hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (Math.atan(mid / a) + Math.atan(mid / b) < target) lo = mid;
    else hi = mid;
  }
  return Math.sign(bendDeg) * lo;
}

/**
 * Hip, knee and ankle for a body lying roughly horizontally, feet towards -x, given the
 * shoulder, the ankle height above the floor and the hip bend.
 * hipBendDeg > 0 sags the hips towards the floor, < 0 pikes them up; the shoulder-hip-ankle
 * interior angle is 180 - |hipBendDeg|.
 * kneeBendDeg > 0 drops the knee towards the floor (hip and ankle stay put); the hip-knee-ankle
 * angle is 180 - |kneeBendDeg|.
 */
function horizontalBody(shoulder: Vec, ankleHeight: number, hipBendDeg: number, kneeBendDeg = 0) {
  const T = PROPORTIONS.torso;
  const G = PROPORTIONS.thigh + PROPORTIONS.shin;
  const interior = (180 - clamp(Math.abs(hipBendDeg), 0, 120)) * DEG;
  const L = Math.sqrt(T * T + G * G - 2 * T * G * Math.cos(interior));
  const dy = shoulder.y - ankleHeight;
  const dx = Math.sqrt(Math.max(L * L - dy * dy, 1e-6));
  const ankle = { x: shoulder.x - dx, y: ankleHeight };
  const phi = Math.atan2(ankle.y - shoulder.y, ankle.x - shoulder.x);
  const beta = Math.acos(clamp((T * T + L * L - G * G) / (2 * T * L), -1, 1));
  const sign = hipBendDeg >= 0 ? 1 : -1;
  const hip = add(shoulder, polar(T, phi + sign * beta));
  let knee = lerp(hip, ankle, PROPORTIONS.thigh / G);
  if (kneeBendDeg !== 0) {
    const dir = unit({ x: ankle.x - hip.x, y: ankle.y - hip.y });
    // Unit normal of the leg pointing towards the floor (world y is up).
    const normal = dir.x >= 0 ? { x: dir.y, y: -dir.x } : { x: -dir.y, y: dir.x };
    const h = kneeOffsetFor(kneeBendDeg, PROPORTIONS.thigh, PROPORTIONS.shin);
    knee = add(knee, scale(normal, h));
  }
  return {
    hip,
    knee,
    ankle,
    heel: { x: ankle.x - 0.05, y: ankle.y + 0.02 },
    footIndex: { x: ankle.x + 0.02, y: 0 },
    headDir: unit({ x: shoulder.x - hip.x, y: shoulder.y - hip.y }),
  };
}

export interface PushupPoseParams {
  /** Interior elbow angle (shoulder-elbow-wrist), degrees. */
  elbowDeg: number;
  /** + sags the hips, - pikes them; 0 = straight body line. */
  hipBendDeg?: number;
  /** + drops the knees towards the floor; the knee angle is 180 - |kneeBendDeg|. */
  kneeBendDeg?: number;
}

/** Push-up / straight-arm plank: hands on the floor under the shoulder, toes on the floor. */
export function pushupSkeleton({ elbowDeg, hipBendDeg = 0, kneeBendDeg = 0 }: PushupPoseParams): SideSkeleton {
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  const e = clamp(elbowDeg, 15, 180) * DEG;
  const wrist = { x: 0, y: 0.03 };
  const d = Math.sqrt(u * u + f * f - 2 * u * f * Math.cos(e));
  const shoulder = { x: wrist.x, y: wrist.y + d };
  const gamma = Math.acos(clamp((f * f + d * d - u * u) / (2 * f * d), -1, 1));
  const elbow = { x: wrist.x - f * Math.sin(gamma), y: wrist.y + f * Math.cos(gamma) };
  const body = horizontalBody(shoulder, 0.07, hipBendDeg, kneeBendDeg);
  return {
    shoulder,
    elbow,
    wrist,
    ...body,
    faceDir: { x: 0, y: -1 },
    handDir: { x: 1, y: 0 },
  };
}

export type PlankStyle = "forearm" | "straight" | "prone";

export interface PlankPoseParams {
  /** forearm / straight-arm plank, or "prone" = lying flat on the floor (a cheat). */
  style?: PlankStyle;
  hipBendDeg?: number;
  /** + drops the knees towards the floor; the knee angle is 180 - |kneeBendDeg|. */
  kneeBendDeg?: number;
}

export function plankSkeleton({ style = "forearm", hipBendDeg = 0, kneeBendDeg = 0 }: PlankPoseParams): SideSkeleton {
  if (style === "straight") return pushupSkeleton({ elbowDeg: 176, hipBendDeg, kneeBendDeg });
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  if (style === "forearm") {
    const elbow = { x: 0, y: 0.04 };
    const wrist = { x: f, y: 0.03 };
    const shoulder = { x: 0, y: elbow.y + u };
    return {
      shoulder,
      elbow,
      wrist,
      ...horizontalBody(shoulder, 0.07, hipBendDeg, kneeBendDeg),
      faceDir: { x: 0, y: -1 },
      handDir: { x: 1, y: 0 },
    };
  }
  // Prone: lying on the floor, arms resting along the body.
  const shoulder = { x: 0, y: 0.1 };
  const elbow = { x: -u, y: 0.07 };
  const wrist = { x: -u - f, y: 0.06 };
  return {
    shoulder,
    elbow,
    wrist,
    ...horizontalBody(shoulder, 0.06, hipBendDeg),
    faceDir: { x: 0, y: -1 },
    handDir: { x: -1, y: 0 },
  };
}

export interface StandingPoseParams {
  /** Interior knee angle (hip-knee-ankle). 180 = straight legs. */
  kneeDeg?: number;
  /** Torso lean from vertical (forward), degrees. Default: 0.45 x knee flexion. */
  torsoLeanDeg?: number;
  /**
   * "forward": arms held straight out in front (squat).
   * "curl": upper arm hanging, forearm raised by `elbowDeg` (biceps curl).
   */
  arms?: "forward" | "curl";
  /** Interior elbow angle for arms = "curl". */
  elbowDeg?: number;
}

/** Standing / squatting body, feet flat, facing +x. */
export function standingSkeleton({
  kneeDeg = 178,
  torsoLeanDeg,
  arms = "forward",
  elbowDeg = 170,
}: StandingPoseParams): SideSkeleton {
  const k = clamp(kneeDeg, 30, 180);
  const flex = 180 - k;
  const ankle = { x: 0, y: 0.08 };
  const shinTilt = flex * 0.35 * DEG;
  const knee = add(ankle, { x: PROPORTIONS.shin * Math.sin(shinTilt), y: PROPORTIONS.shin * Math.cos(shinTilt) });
  const dirKA = Math.atan2(ankle.y - knee.y, ankle.x - knee.x);
  const hip = add(knee, polar(PROPORTIONS.thigh, dirKA - k * DEG));
  const lean = (torsoLeanDeg ?? flex * 0.45) * DEG;
  const headDir = { x: Math.sin(lean), y: Math.cos(lean) };
  const shoulder = add(hip, scale(headDir, PROPORTIONS.torso));
  let elbow: Vec;
  let wrist: Vec;
  let handDir: Vec;
  if (arms === "curl") {
    elbow = add(shoulder, { x: 0, y: -PROPORTIONS.upperArm });
    const lift = (180 - clamp(elbowDeg, 20, 180)) * DEG;
    handDir = { x: Math.sin(lift), y: -Math.cos(lift) };
    wrist = add(elbow, scale(handDir, PROPORTIONS.forearm));
  } else {
    handDir = { x: Math.cos(-10 * DEG), y: Math.sin(-10 * DEG) };
    elbow = add(shoulder, scale(handDir, PROPORTIONS.upperArm));
    wrist = add(elbow, scale(handDir, PROPORTIONS.forearm));
  }
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    heel: add(ankle, { x: -0.05, y: -0.05 }),
    footIndex: add(ankle, { x: 0.15, y: -0.06 }),
    headDir,
    faceDir: { x: Math.cos(lean), y: -Math.sin(lean) },
    handDir,
  };
}

/**
 * Lying flat on the floor with the upper arm reaching forward along the floor and the
 * forearm raising / lowering (elbow angle changes like a push-up's while the body never
 * leaves the floor): a cheat.
 */
export function proneArmWaveSkeleton({ elbowDeg = 170 }: { elbowDeg?: number }): SideSkeleton {
  const skeleton = plankSkeleton({ style: "prone" });
  const shoulder = skeleton.shoulder;
  const elbow = { x: shoulder.x + PROPORTIONS.upperArm, y: 0.07 };
  const e = clamp(elbowDeg, 20, 180) * DEG;
  const handDir = { x: Math.cos(Math.PI - e), y: Math.sin(Math.PI - e) };
  const wrist = add(elbow, scale(handDir, PROPORTIONS.forearm));
  return { ...skeleton, elbow, wrist, handDir, headDir: { x: 1, y: 0.1 } };
}

/**
 * Sitting upright on a chair, thigh horizontal, swinging the lower leg (seated knee
 * extension). The knee angle changes like a squat's but the hip never moves: a cheat.
 */
export function seatedSkeleton({ kneeDeg = 90 }: { kneeDeg?: number }): SideSkeleton {
  const hip = { x: -0.1, y: 0.33 };
  const knee = add(hip, { x: PROPORTIONS.thigh, y: 0 });
  const k = clamp(kneeDeg, 30, 180) * DEG;
  const ankle = add(knee, polar(PROPORTIONS.shin, Math.PI + k));
  const shoulder = add(hip, { x: 0, y: PROPORTIONS.torso });
  const handDir = { x: 0.3, y: -0.95 };
  const elbow = add(shoulder, scale(unit(handDir), PROPORTIONS.upperArm));
  const wrist = add(elbow, scale(unit(handDir), PROPORTIONS.forearm));
  const footDir = unit({ x: -(ankle.y - knee.y), y: ankle.x - knee.x });
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    heel: add(ankle, scale(footDir, -0.05)),
    footIndex: add(ankle, scale(footDir, 0.15)),
    headDir: { x: 0, y: 1 },
    faceDir: { x: 1, y: 0 },
    handDir: unit(handDir),
  };
}

// ---------------------------------------------------------------------------------------
// Projection to MediaPipe-style landmarks
// ---------------------------------------------------------------------------------------

/** "floor": body lying along the floor (push-up, plank). "standing": upright (squat). */
export type CameraLayout = "floor" | "standing";

export interface RenderOptions {
  width?: number;
  height?: number;
  /** Which body side faces the camera (gets nearVisibility). */
  nearSide?: "left" | "right";
  nearVisibility?: number;
  farVisibility?: number;
  /** Mirror horizontally (body faces -x on screen instead of +x). */
  mirror?: boolean;
  /** Per-landmark visibility overrides (landmark index -> visibility). */
  visibility?: Readonly<Record<number, number>>;
}

interface Camera {
  scale: number;
  ox: number;
  oy: number;
  width: number;
  height: number;
  mirror: boolean;
}

function makeCamera(layout: CameraLayout, width: number, height: number, mirror: boolean): Camera {
  if (layout === "floor") {
    const s = Math.min((0.9 * width) / 1.1, (0.9 * height) / 0.5);
    return { scale: s, ox: width / 2 + 0.35 * s, oy: height / 2 + 0.2 * s, width, height, mirror };
  }
  const s = Math.min((0.85 * height) / 1.15, (0.85 * width) / 0.9);
  return { scale: s, ox: width / 2, oy: height / 2 + 0.55 * s, width, height, mirror };
}

const SIDE_INDEX = {
  left: {
    shoulder: LM.LEFT_SHOULDER,
    elbow: LM.LEFT_ELBOW,
    wrist: LM.LEFT_WRIST,
    pinky: LM.LEFT_PINKY,
    index: LM.LEFT_INDEX,
    thumb: LM.LEFT_THUMB,
    hip: LM.LEFT_HIP,
    knee: LM.LEFT_KNEE,
    ankle: LM.LEFT_ANKLE,
    heel: LM.LEFT_HEEL,
    footIndex: LM.LEFT_FOOT_INDEX,
    eyeInner: LM.LEFT_EYE_INNER,
    eye: LM.LEFT_EYE,
    eyeOuter: LM.LEFT_EYE_OUTER,
    ear: LM.LEFT_EAR,
    mouth: LM.MOUTH_LEFT,
  },
  right: {
    shoulder: LM.RIGHT_SHOULDER,
    elbow: LM.RIGHT_ELBOW,
    wrist: LM.RIGHT_WRIST,
    pinky: LM.RIGHT_PINKY,
    index: LM.RIGHT_INDEX,
    thumb: LM.RIGHT_THUMB,
    hip: LM.RIGHT_HIP,
    knee: LM.RIGHT_KNEE,
    ankle: LM.RIGHT_ANKLE,
    heel: LM.RIGHT_HEEL,
    footIndex: LM.RIGHT_FOOT_INDEX,
    eyeInner: LM.RIGHT_EYE_INNER,
    eye: LM.RIGHT_EYE,
    eyeOuter: LM.RIGHT_EYE_OUTER,
    ear: LM.RIGHT_EAR,
    mouth: LM.MOUTH_RIGHT,
  },
} as const;

/** World offset of far-side joints (they sit slightly behind / above the near side). */
const FAR_OFFSET: Vec = { x: 0.012, y: 0.01 };

/** Project a world-space skeleton to 33 normalized landmarks for a camera frame. */
export function renderLandmarks(
  skeleton: SideSkeleton,
  layout: CameraLayout,
  options: RenderOptions = {},
): Landmark[] {
  const {
    width = 640,
    height = 480,
    nearSide = "left",
    nearVisibility = 0.98,
    farVisibility = 0.6,
    mirror = false,
    visibility = {},
  } = options;
  const cam = makeCamera(layout, width, height, mirror);
  const out: Landmark[] = new Array(LANDMARK_COUNT);

  const project = (p: Vec, z: number, vis: number): Landmark => {
    const px = cam.ox + p.x * cam.scale;
    const x = px / cam.width;
    return {
      x: cam.mirror ? 1 - x : x,
      y: (cam.oy - p.y * cam.scale) / cam.height,
      z,
      visibility: vis,
    };
  };

  const s = skeleton;
  const perpHand = { x: -s.handDir.y, y: s.handDir.x };
  const nose = add(add(s.shoulder, scale(s.headDir, PROPORTIONS.neck)), scale(s.faceDir, 0.04));
  const partsFor = (offset: Vec) => {
    const o = (p: Vec) => add(p, offset);
    const eye = add(nose, add(scale(s.headDir, 0.03), scale(s.faceDir, -0.01)));
    return {
      shoulder: o(s.shoulder),
      elbow: o(s.elbow),
      wrist: o(s.wrist),
      pinky: o(add(s.wrist, add(scale(s.handDir, 0.07), scale(perpHand, 0.012)))),
      index: o(add(s.wrist, scale(s.handDir, 0.08))),
      thumb: o(add(s.wrist, add(scale(s.handDir, 0.05), scale(perpHand, -0.012)))),
      hip: o(s.hip),
      knee: o(s.knee),
      ankle: o(s.ankle),
      heel: o(s.heel),
      footIndex: o(s.footIndex),
      eyeInner: o(add(eye, scale(s.faceDir, 0.005))),
      eye: o(eye),
      eyeOuter: o(add(eye, scale(s.faceDir, -0.008))),
      ear: o(add(add(s.shoulder, scale(s.headDir, PROPORTIONS.neck * 0.85)), scale(s.faceDir, -0.04))),
      mouth: o(add(nose, scale(s.headDir, -0.03))),
    };
  };

  const farSide = nearSide === "left" ? "right" : "left";
  const sides = [
    { side: nearSide, parts: partsFor({ x: 0, y: 0 }), z: 0, vis: nearVisibility },
    { side: farSide, parts: partsFor(FAR_OFFSET), z: 0.1, vis: farVisibility },
  ] as const;
  for (const { side, parts, z, vis } of sides) {
    const idx = SIDE_INDEX[side];
    for (const key of Object.keys(idx) as (keyof typeof idx)[]) {
      out[idx[key]] = project(parts[key], z, vis);
    }
  }
  out[LM.NOSE] = project(nose, 0, nearVisibility);

  for (const [key, vis] of Object.entries(visibility)) {
    const i = Number(key);
    if (out[i]) out[i] = { ...out[i], visibility: vis };
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Timelines
// ---------------------------------------------------------------------------------------

export interface RepSpec {
  topAngle?: number;
  bottomAngle?: number;
  /** Descent + ascent time (holds excluded). */
  repMs?: number;
  bottomHoldMs?: number;
  /** Pause at the top after this rep. */
  holdMs?: number;
}

export interface RepTimelineOptions {
  /** Number of identical reps, or one spec per rep (fields default to the options below). */
  reps: number | readonly RepSpec[];
  topAngle: number;
  bottomAngle: number;
  repMs: number;
  bottomHoldMs?: number;
  holdMs?: number;
  /** Time at the top before the first rep. */
  leadInMs?: number;
  /** Time at the top after the last rep. */
  leadOutMs?: number;
}

/** Times relative to the start of the sequence. */
export interface RepWindow {
  startMs: number;
  bottomStartMs: number;
  bottomEndMs: number;
  endMs: number;
}

export interface RepTimeline {
  durationMs: number;
  reps: RepWindow[];
  /** Primary angle at a time relative to the start of the sequence. */
  angleAt(tMs: number): number;
}

interface Segment {
  from: number;
  to: number;
  a0: number;
  a1: number;
}

/** Cosine-eased angle profile: lead-in at the top, then descend / hold / ascend / hold. */
export function repTimeline(options: RepTimelineOptions): RepTimeline {
  const { topAngle, bottomAngle, repMs, bottomHoldMs = 0, holdMs = 300, leadInMs = 1000, leadOutMs = 800 } =
    options;
  const specs: RepSpec[] =
    typeof options.reps === "number" ? Array.from({ length: options.reps }, () => ({})) : [...options.reps];
  const segments: Segment[] = [];
  const windows: RepWindow[] = [];
  let t = 0;
  let prevTop = specs[0]?.topAngle ?? topAngle;
  const push = (duration: number, a0: number, a1: number) => {
    if (duration > 0) segments.push({ from: t, to: t + duration, a0, a1 });
    t += duration;
  };
  push(leadInMs, prevTop, prevTop);
  for (const spec of specs) {
    const top = spec.topAngle ?? topAngle;
    const bottom = spec.bottomAngle ?? bottomAngle;
    const half = (spec.repMs ?? repMs) / 2;
    const start = t;
    push(0, prevTop, top);
    push(half, top, bottom);
    const bottomStart = t;
    push(spec.bottomHoldMs ?? bottomHoldMs, bottom, bottom);
    const bottomEnd = t;
    push(half, bottom, top);
    windows.push({ startMs: start, bottomStartMs: bottomStart, bottomEndMs: bottomEnd, endMs: t });
    push(spec.holdMs ?? holdMs, top, top);
    prevTop = top;
  }
  push(leadOutMs, prevTop, prevTop);
  const durationMs = t;
  const last = prevTop;

  return {
    durationMs,
    reps: windows,
    angleAt(tMs: number): number {
      for (const seg of segments) {
        if (tMs <= seg.to) {
          if (tMs <= seg.from) return seg.a0;
          const p = (tMs - seg.from) / (seg.to - seg.from);
          return seg.a0 + (seg.a1 - seg.a0) * (1 - Math.cos(Math.PI * p)) / 2;
        }
      }
      return last;
    },
  };
}

/**
 * Cosine-interpolated profile through [timeMs, value] keyframes (sorted by time).
 * Holds the first / last value outside the keyframe range.
 */
export function keyframes(points: ReadonlyArray<readonly [number, number]>): (tMs: number) => number {
  return (tMs: number) => {
    if (points.length === 0) return 0;
    if (tMs <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [t1, v1] = points[i];
      if (tMs <= t1) {
        const [t0, v0] = points[i - 1];
        if (t1 <= t0) return v1;
        const p = (tMs - t0) / (t1 - t0);
        return v0 + (v1 - v0) * (1 - Math.cos(Math.PI * p)) / 2;
      }
    }
    return points[points.length - 1][1];
  };
}

// ---------------------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------------------

export interface SequenceOptions extends RenderOptions {
  fps?: number;
  /** Timestamp of the first frame. */
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise, in degrees, added to every joint angle that drives the pose. */
  jitterDeg?: number;
}

/** Explicit primary-angle profile instead of a rep timeline. */
export interface AngleProfile {
  durationMs: number;
  angleAt(tMs: number): number;
}

/** Frame timestamps (relative) at `fps`, rounded to whole ms like the live runtime. */
function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

function renderSequence(
  durationMs: number,
  layout: CameraLayout,
  options: SequenceOptions,
  skeletonAt: (tMs: number, rng: () => number) => SideSkeleton,
): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480 } = options;
  const rng = mulberry32(seed);
  return frameOffsets(durationMs, fps).map((offset) => ({
    timestampMs: startMs + offset,
    landmarks: renderLandmarks(skeletonAt(offset, rng), layout, { ...options, width, height }),
    imageWidth: width,
    imageHeight: height,
  }));
}

export interface PushupSequenceOptions extends SequenceOptions, Partial<RepTimelineOptions> {
  /** Constant hip bend: + sag, - pike. */
  hipBendDeg?: number;
  /** Knee bend in degrees (+ drops the knees), constant or as a function of relative time. */
  kneeBendDeg?: number | ((tMs: number) => number);
  /** Custom elbow profile; overrides the rep timeline options. */
  profile?: AngleProfile;
}

/** Push-up timeline defaults: lockout 170, bottom 70, 1.2 s reps with a 0.3 s top pause. */
export function pushupTimeline(options: Partial<RepTimelineOptions> = {}): RepTimeline {
  return repTimeline({ reps: 5, topAngle: 170, bottomAngle: 70, repMs: 1200, ...options });
}

export function pushupSequence(options: PushupSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0, hipBendDeg = 0, kneeBendDeg } = options;
  const profile = options.profile ?? pushupTimeline(options);
  const kneeAt = typeof kneeBendDeg === "function" ? kneeBendDeg : () => kneeBendDeg ?? 0;
  const jitterKnee = kneeBendDeg !== undefined;
  return renderSequence(profile.durationMs, "floor", options, (t, rng) =>
    pushupSkeleton({
      elbowDeg: profile.angleAt(t) + noise(rng, jitterDeg),
      hipBendDeg: hipBendDeg + noise(rng, jitterDeg),
      // Only draw knee noise when a knee bend was requested, so existing seeded sequences
      // stay byte-for-byte identical.
      kneeBendDeg: kneeAt(t) + (jitterKnee ? noise(rng, jitterDeg) : 0),
    }),
  );
}

export interface SquatSequenceOptions extends SequenceOptions, Partial<RepTimelineOptions> {
  /** Torso lean from vertical as a function of the knee angle (default 0.45 x flexion). */
  torsoLeanAt?: (kneeDeg: number) => number;
  profile?: AngleProfile;
}

/** Squat timeline defaults: standing 175, bottom 70, 1.6 s reps with a 0.4 s pause on top. */
export function squatTimeline(options: Partial<RepTimelineOptions> = {}): RepTimeline {
  return repTimeline({ reps: 5, topAngle: 175, bottomAngle: 70, repMs: 1600, holdMs: 400, ...options });
}

export function squatSequence(options: SquatSequenceOptions = {}): PoseFrame[] {
  const { jitterDeg = 0, torsoLeanAt } = options;
  const profile = options.profile ?? squatTimeline(options);
  return renderSequence(profile.durationMs, "standing", options, (t, rng) => {
    const kneeDeg = profile.angleAt(t);
    const lean = torsoLeanAt ? torsoLeanAt(kneeDeg) : (180 - kneeDeg) * 0.45;
    return standingSkeleton({
      kneeDeg: kneeDeg + noise(rng, jitterDeg),
      torsoLeanDeg: lean + noise(rng, jitterDeg),
    });
  });
}

export interface StandingArmCurlOptions extends SequenceOptions, Partial<RepTimelineOptions> {}

/** Arms curling (elbow 170 -> 40 -> 170) while standing upright: must not count as push-ups. */
export function standingArmCurlSequence(options: StandingArmCurlOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  const timeline = repTimeline({ reps: 5, topAngle: 170, bottomAngle: 40, repMs: 1200, ...options });
  return renderSequence(timeline.durationMs, "standing", options, (t, rng) =>
    standingSkeleton({
      kneeDeg: 178 + noise(rng, jitterDeg / 2),
      torsoLeanDeg: noise(rng, jitterDeg),
      arms: "curl",
      elbowDeg: timeline.angleAt(t) + noise(rng, jitterDeg),
    }),
  );
}

/** Lying on the floor raising the forearms (elbow 170 -> 60): must NOT count as push-ups. */
export function proneArmWaveSequence(options: StandingArmCurlOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  const timeline = repTimeline({ reps: 5, topAngle: 170, bottomAngle: 60, repMs: 1200, ...options });
  return renderSequence(timeline.durationMs, "floor", options, (t, rng) =>
    proneArmWaveSkeleton({ elbowDeg: timeline.angleAt(t) + noise(rng, jitterDeg) }),
  );
}

/** Seated knee extensions (knee 90 -> 175 -> 90 ...): must NOT count as squats. */
export function seatedKneeExtensionSequence(options: StandingArmCurlOptions = {}): PoseFrame[] {
  const { jitterDeg = 0 } = options;
  // Starts extended (175), bends to 80 and extends again, like a squat's knee profile.
  const timeline = repTimeline({ reps: 5, topAngle: 175, bottomAngle: 80, repMs: 1600, holdMs: 400, ...options });
  return renderSequence(timeline.durationMs, "standing", options, (t, rng) =>
    seatedSkeleton({ kneeDeg: timeline.angleAt(t) + noise(rng, jitterDeg) }),
  );
}

export interface PlankSequenceOptions extends SequenceOptions {
  durationMs: number;
  style?: PlankStyle;
  /** Hip bend in degrees (+ sag, - pike), constant or as a function of relative time. */
  hipBendDeg?: number | ((tMs: number) => number);
  /** Knee bend in degrees (+ drops the knees), constant or as a function of relative time. */
  kneeBendDeg?: number | ((tMs: number) => number);
}

export function plankSequence(options: PlankSequenceOptions): PoseFrame[] {
  const { durationMs, style = "forearm", hipBendDeg = 0, kneeBendDeg, jitterDeg = 0 } = options;
  const bendAt = typeof hipBendDeg === "function" ? hipBendDeg : () => hipBendDeg;
  const kneeAt = typeof kneeBendDeg === "function" ? kneeBendDeg : () => kneeBendDeg ?? 0;
  const jitterKnee = kneeBendDeg !== undefined;
  return renderSequence(durationMs, "floor", options, (t, rng) =>
    plankSkeleton({
      style,
      hipBendDeg: bendAt(t) + noise(rng, jitterDeg),
      // Knee noise only when requested, so existing seeded sequences are unchanged.
      kneeBendDeg: kneeAt(t) + (jitterKnee ? noise(rng, jitterDeg) : 0),
    }),
  );
}

// ---------------------------------------------------------------------------------------
// Modifiers (all return new arrays; input frames are never mutated)
// ---------------------------------------------------------------------------------------

const inWindow = (t: number, fromMs: number, toMs: number) => t >= fromMs && t < toMs;

/**
 * Tracking dropout for frames with fromMs <= timestamp < toMs (absolute timestamps).
 * "empty": no pose detected (landmarks = []). "lowVisibility": landmarks present but every
 * visibility is 0.1.
 */
export function withDropout(
  frames: readonly PoseFrame[],
  fromMs: number,
  toMs: number,
  mode: "empty" | "lowVisibility" = "empty",
): PoseFrame[] {
  return frames.map((f) => {
    if (!inWindow(f.timestampMs, fromMs, toMs)) return f;
    if (mode === "empty") return { ...f, landmarks: [] };
    return { ...f, landmarks: f.landmarks.map((lm) => ({ ...lm, visibility: 0.1 })) };
  });
}

/** Removes frames with fromMs <= timestamp < toMs (camera stall / frame gap). */
export function withGap(frames: readonly PoseFrame[], fromMs: number, toMs: number): PoseFrame[] {
  return frames.filter((f) => !inWindow(f.timestampMs, fromMs, toMs));
}

export interface TeleportOptions {
  /** Glitch length. Default 0 = only the first frame at or after atMs. */
  durationMs?: number;
  /** Landmarks to displace. Default: both elbows. */
  joints?: readonly number[];
  /** Displacement in normalized units. Default (0.3, 0.3). */
  dx?: number;
  dy?: number;
}

/** A tracking glitch: some joints jump far away for one frame (or `durationMs`). */
export function withTeleport(frames: readonly PoseFrame[], atMs: number, options: TeleportOptions = {}): PoseFrame[] {
  const { durationMs = 0, joints = [LM.LEFT_ELBOW, LM.RIGHT_ELBOW], dx = 0.3, dy = 0.3 } = options;
  const first = frames.find((f) => f.timestampMs >= atMs);
  if (!first) return [...frames];
  const end = Math.max(first.timestampMs + 1, atMs + durationMs);
  const set = new Set(joints);
  return frames.map((f) => {
    if (!inWindow(f.timestampMs, first.timestampMs, end) || f.landmarks.length === 0) return f;
    return {
      ...f,
      landmarks: f.landmarks.map((lm, i) => (set.has(i) ? { ...lm, x: lm.x + dx, y: lm.y + dy } : lm)),
    };
  });
}

export interface JitterOptions {
  /** Uniform positional noise amplitude in normalized units (e.g. 0.003 ~ 2 px at 640). */
  amplitude: number;
  seed?: number;
}

/** Independent seeded positional noise on every landmark of every frame. */
export function withJitter(frames: readonly PoseFrame[], { amplitude, seed = 7 }: JitterOptions): PoseFrame[] {
  const rng = mulberry32(seed);
  return frames.map((f) => ({
    ...f,
    landmarks: f.landmarks.map((lm) => ({
      ...lm,
      x: lm.x + noise(rng, amplitude),
      y: lm.y + noise(rng, amplitude),
    })),
  }));
}
