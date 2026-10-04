/**
 * Front-view synthetic skeletons: the counterpart of testing/synthetic.ts (side view only) for
 * exercises filmed square-on (jumping jacks, high knees, pull-ups).
 *
 * World space: x to the right of an UNMIRRORED camera image, y up, z towards the camera
 * negative (MediaPipe: smaller z = closer), units of standing body height. The person faces
 * the camera, so their anatomical LEFT side (LM.LEFT_*) is at +x, i.e. on the right of the
 * image, exactly like MediaPipe on a real front-facing photo.
 *
 * Poses are built from joint angles; both body sides are fully visible (0.95 by default).
 * Everything is deterministic: randomness only comes from a seeded mulberry32 PRNG.
 */
import { LANDMARK_COUNT, LM } from "@/lib/pose/landmarks";
import { mulberry32, PROPORTIONS } from "@/lib/pose/testing/synthetic";
import type { Landmark, PoseFrame } from "@/lib/pose/types";

const DEG = Math.PI / 180;

/** Half the distance between the shoulder landmarks / hip landmarks (body heights). */
export const FRONT_PROPORTIONS = Object.freeze({
  shoulderHalfWidth: 0.105,
  hipHalfWidth: 0.065,
  /** Height of the ankle landmark above the floor when standing. */
  ankleHeight: 0.08,
});

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Per-side joint angles. Angles are degrees; every field is optional. */
export interface FrontSideParams {
  /**
   * Upper-arm direction from the shoulder, measured from straight down and positive outward
   * (abduction): 0 = hanging, 90 = straight out to the side, 180 = straight overhead, more
   * than 180 = overhead and crossing towards the midline.
   */
  upperArmDeg?: number;
  /** Forearm direction, same convention (absolute, not relative to the upper arm). Default: upperArmDeg. */
  forearmDeg?: number;
  /** Leg abduction (sideways spread), 0 = straight down. */
  legSpreadDeg?: number;
  /** Thigh raised towards the camera (hip flexion): 0 = straight down, 90 = horizontal. */
  hipFlexDeg?: number;
  /** Knee flexion (the shin folds back from the thigh line): 0 = straight. */
  kneeFlexDeg?: number;
}

export interface FrontPoseParams {
  left?: FrontSideParams;
  right?: FrontSideParams;
  /** Both feet this far off the floor (a jump), body heights. */
  lift?: number;
  /** Torso leaning towards the camera, degrees (foreshortens the torso). */
  torsoLeanDeg?: number;
  /** Body rotation about the vertical axis: 0 = square-on, 90 = side-on to the camera. */
  turnDeg?: number;
  /** In-image rotation of the whole body about its hip centre, degrees (90 = lying on its side). */
  rollDeg?: number;
}

export interface FrontLimbs {
  shoulder: Vec3;
  elbow: Vec3;
  wrist: Vec3;
  pinky: Vec3;
  index: Vec3;
  thumb: Vec3;
  hip: Vec3;
  knee: Vec3;
  ankle: Vec3;
  heel: Vec3;
  footIndex: Vec3;
  eyeInner: Vec3;
  eye: Vec3;
  eyeOuter: Vec3;
  ear: Vec3;
  mouth: Vec3;
}

export interface FrontSkeleton {
  left: FrontLimbs;
  right: FrontLimbs;
  nose: Vec3;
  /** Rotation about the vertical axis the skeleton was built with (for visibility). */
  turnDeg: number;
}

const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale3 = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/** Unit limb direction from "angle from straight down, outward" in the frontal plane. */
function armDir(sign: number, deg: number): Vec3 {
  return v3(sign * Math.sin(deg * DEG), -Math.cos(deg * DEG), 0);
}

/** Unit leg-segment direction: flexion towards the camera, then sideways abduction. */
function legDir(sign: number, flexDeg: number, spreadDeg: number): Vec3 {
  const vertical = Math.cos(flexDeg * DEG);
  return v3(
    sign * Math.sin(spreadDeg * DEG) * vertical,
    -Math.cos(spreadDeg * DEG) * vertical,
    -Math.sin(flexDeg * DEG),
  );
}

/** Build a front-facing skeleton from joint angles. */
export function frontSkeleton(params: FrontPoseParams = {}): FrontSkeleton {
  const { lift = 0, torsoLeanDeg = 0, turnDeg = 0, rollDeg = 0 } = params;
  const P = PROPORTIONS;
  const F = FRONT_PROPORTIONS;

  const legs = (["left", "right"] as const).map((side) => {
    const p = params[side] ?? {};
    const sign = side === "left" ? 1 : -1;
    const hipFlex = p.hipFlexDeg ?? 0;
    const spread = p.legSpreadDeg ?? 2;
    const thigh = scale3(legDir(sign, hipFlex, spread), P.thigh);
    const shin = scale3(legDir(sign, hipFlex - (p.kneeFlexDeg ?? 0), spread), P.shin);
    return { side, sign, thigh, shin, drop: -(thigh.y + shin.y) };
  });
  const hipY = F.ankleHeight + lift + Math.max(legs[0].drop, legs[1].drop);
  const hipMid = v3(0, hipY, 0);
  const torsoDir = v3(0, Math.cos(torsoLeanDeg * DEG), -Math.sin(torsoLeanDeg * DEG));
  const shoulderMid = add3(hipMid, scale3(torsoDir, P.torso));
  const nose = add3(add3(shoulderMid, scale3(torsoDir, P.neck)), v3(0, 0, -0.05));

  const build = (index: 0 | 1): FrontLimbs => {
    const { side, sign, thigh, shin } = legs[index];
    const p = params[side] ?? {};
    const upperDeg = p.upperArmDeg ?? 8;
    const foreDeg = p.forearmDeg ?? upperDeg;
    const shoulder = add3(shoulderMid, v3(sign * F.shoulderHalfWidth, 0, 0));
    const elbow = add3(shoulder, scale3(armDir(sign, upperDeg), P.upperArm));
    const fore = armDir(sign, foreDeg);
    const wrist = add3(elbow, scale3(fore, P.forearm));
    const hip = add3(hipMid, v3(sign * F.hipHalfWidth, 0, 0));
    const knee = add3(hip, thigh);
    const ankle = add3(knee, shin);
    const eye = add3(nose, v3(sign * 0.02, 0.02, 0.01));
    return {
      shoulder,
      elbow,
      wrist,
      pinky: add3(add3(wrist, scale3(fore, 0.07)), v3(sign * 0.012, 0, 0)),
      index: add3(wrist, scale3(fore, 0.08)),
      thumb: add3(add3(wrist, scale3(fore, 0.05)), v3(-sign * 0.012, 0, -0.01)),
      hip,
      knee,
      ankle,
      heel: add3(ankle, v3(0, -0.03, 0.04)),
      footIndex: add3(ankle, v3(sign * 0.02, -0.06, -0.1)),
      eyeInner: add3(eye, v3(-sign * 0.008, 0, 0)),
      eye,
      eyeOuter: add3(eye, v3(sign * 0.009, 0, 0.003)),
      ear: add3(nose, v3(sign * 0.05, 0.01, 0.05)),
      mouth: add3(nose, v3(sign * 0.015, -0.025, 0)),
    };
  };

  let skeleton: FrontSkeleton = { left: build(0), right: build(1), nose, turnDeg };

  // Rotation about the vertical axis through the hip centre (turning side-on), then an
  // in-image roll about the hip centre (lying down).
  const turn = turnDeg * DEG;
  const roll = rollDeg * DEG;
  if (turn !== 0 || roll !== 0) {
    const tf = (p: Vec3): Vec3 => {
      const x1 = p.x * Math.cos(turn) - p.z * Math.sin(turn);
      const z1 = p.x * Math.sin(turn) + p.z * Math.cos(turn);
      const dy = p.y - hipY;
      return v3(x1 * Math.cos(roll) - dy * Math.sin(roll), hipY + x1 * Math.sin(roll) + dy * Math.cos(roll), z1);
    };
    const mapLimbs = (l: FrontLimbs): FrontLimbs =>
      Object.fromEntries(Object.entries(l).map(([k, p]) => [k, tf(p as Vec3)])) as unknown as FrontLimbs;
    skeleton = { left: mapLimbs(skeleton.left), right: mapLimbs(skeleton.right), nose: tf(nose), turnDeg };
  }
  return skeleton;
}

// ---------------------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------------------

export interface FrontRenderOptions {
  width?: number;
  height?: number;
  /** Visibility of every landmark of a square-on body (default 0.95). */
  visibilityAll?: number;
  /** Mirror horizontally (a selfie preview); the anatomical sides stay the same landmarks. */
  mirror?: boolean;
  /** Per-landmark visibility overrides (landmark index -> visibility). */
  visibility?: Readonly<Record<number, number>>;
}

const FRONT_INDEX = {
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

/**
 * Project a front skeleton to 33 normalized MediaPipe-style landmarks. Tall framing: the
 * floor sits near the bottom of the frame and raised hands / a jump stay in frame.
 * When the body is turned side-on (turnDeg), the side facing away loses visibility.
 */
export function renderFrontLandmarks(skeleton: FrontSkeleton, options: FrontRenderOptions = {}): Landmark[] {
  const { width = 640, height = 480, visibilityAll = 0.95, mirror = false, visibility = {} } = options;
  const s = Math.min((0.85 * height) / 1.35, (0.85 * width) / 1.0);
  const ox = width / 2;
  const oy = height / 2 + 0.62 * s;
  const project = (p: Vec3, vis: number): Landmark => {
    const x = (ox + p.x * s) / width;
    return { x: mirror ? 1 - x : x, y: (oy - p.y * s) / height, z: p.z, visibility: vis };
  };
  // Turning towards +turn moves the left side away from the camera.
  const away = Math.min(1, Math.abs(Math.sin(skeleton.turnDeg * DEG)));
  const faded = visibilityAll * (1 - 0.6 * away);
  const sideVis = {
    left: skeleton.turnDeg > 0 ? faded : visibilityAll,
    right: skeleton.turnDeg < 0 ? faded : visibilityAll,
  };
  const out: Landmark[] = new Array(LANDMARK_COUNT);
  for (const side of ["left", "right"] as const) {
    const idx = FRONT_INDEX[side];
    const limbs = skeleton[side];
    for (const key of Object.keys(idx) as (keyof typeof idx)[]) {
      out[idx[key]] = project(limbs[key], sideVis[side]);
    }
  }
  out[LM.NOSE] = project(skeleton.nose, visibilityAll);
  for (const [key, vis] of Object.entries(visibility)) {
    const i = Number(key);
    if (out[i]) out[i] = { ...out[i], visibility: vis };
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------------------

export interface FrontSequenceOptions extends FrontRenderOptions {
  fps?: number;
  /** Timestamp of the first frame. */
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise, in degrees, added to every joint angle of the pose. */
  jitterDeg?: number;
}

/** Frame timestamps (relative) at `fps`, rounded to whole ms like the live runtime. */
export function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

const SIDE_ANGLE_KEYS = ["upperArmDeg", "forearmDeg", "legSpreadDeg", "hipFlexDeg", "kneeFlexDeg"] as const;

/** Adds seeded uniform noise (+-jitterDeg) to every angle of the pose, in a fixed order. */
export function jitterFrontPose(pose: FrontPoseParams, rng: () => number, jitterDeg: number): FrontPoseParams {
  if (jitterDeg === 0) return pose;
  const n = () => (rng() * 2 - 1) * jitterDeg;
  const side = (p: FrontSideParams | undefined): FrontSideParams => {
    const base: FrontSideParams = { upperArmDeg: 8, legSpreadDeg: 2, hipFlexDeg: 0, kneeFlexDeg: 0, ...p };
    base.forearmDeg = p?.forearmDeg ?? base.upperArmDeg;
    const out: FrontSideParams = {};
    for (const key of SIDE_ANGLE_KEYS) out[key] = (base[key] ?? 0) + n();
    // Flexion cannot go negative in a real body.
    out.hipFlexDeg = Math.max(0, out.hipFlexDeg ?? 0);
    out.kneeFlexDeg = Math.max(0, out.kneeFlexDeg ?? 0);
    return out;
  };
  return {
    ...pose,
    left: side(pose.left),
    right: side(pose.right),
    torsoLeanDeg: (pose.torsoLeanDeg ?? 0) + n() / 2,
  };
}

/** Render `poseAt(relative ms)` for `durationMs` at `fps` into PoseFrames. */
export function frontSequence(
  durationMs: number,
  options: FrontSequenceOptions,
  poseAt: (tMs: number) => FrontPoseParams,
): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480, jitterDeg = 0 } = options;
  const rng = mulberry32(seed);
  return frameOffsets(durationMs, fps).map((offset) => ({
    timestampMs: startMs + offset,
    landmarks: renderFrontLandmarks(frontSkeleton(jitterFrontPose(poseAt(offset), rng, jitterDeg)), {
      ...options,
      width,
      height,
    }),
    imageWidth: width,
    imageHeight: height,
  }));
}
