/**
 * Synthetic side-view lunges (tests + form-guide demo).
 *
 * The shared renderer draws the far body side as an offset copy of the near side, which
 * cannot show a split stance. So each frame is rendered twice with the same camera: once
 * with the near side carrying leg A, once with the *other* side as the near side carrying
 * leg B, and the far leg's landmarks are taken from the second render (with far-side
 * visibility). Both legs are solved with two-link IK (thigh / shin lengths from PROPORTIONS,
 * knees bending forward, facing +x).
 *
 * Depth p in [0, 1]: 0 = standing with the feet together, 1 = the bottom of a full lunge
 * (front knee ~90 deg, shin vertical; back knee ~90 deg and just above the floor). The feet
 * move out as p grows, so a rep is "step out, drop, drive back".
 */
import { LM } from "@/lib/pose/landmarks";
import {
  keyframes,
  mulberry32,
  PROPORTIONS,
  renderLandmarks,
  repTimeline,
  type AngleProfile,
  type RenderOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { Landmark, PoseFrame } from "@/lib/pose/types";

const DEG = Math.PI / 180;
const THIGH = PROPORTIONS.thigh;
const SHIN = PROPORTIONS.shin;

/** World-space leg: hip, knee, ankle, heel, toe. */
export interface LegPose {
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec;
  footIndex: Vec;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const lerpV = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
const rotateAbout = (p: Vec, c: Vec, rad: number): Vec => {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const cs = Math.cos(rad);
  const sn = Math.sin(rad);
  return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
};

/** Two-link IK: knee for a hip and ankle, bending forward (+x). */
export function solveKnee(hip: Vec, ankle: Vec): Vec {
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(THIGH - SHIN) + 1e-6), THIGH + SHIN - 1e-6);
  const base = Math.atan2(dy, dx);
  const alpha = Math.acos((THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d));
  const k1 = add(hip, { x: THIGH * Math.cos(base + alpha), y: THIGH * Math.sin(base + alpha) });
  const k2 = add(hip, { x: THIGH * Math.cos(base - alpha), y: THIGH * Math.sin(base - alpha) });
  return k1.x >= k2.x ? k1 : k2;
}

/** Leg from hip + ankle via IK, with optional angular noise on the thigh and shin (degrees). */
export function legPose(hip: Vec, ankle: Vec, onToes: boolean, thighNoiseDeg = 0, shinNoiseDeg = 0): LegPose {
  let knee = solveKnee(hip, ankle);
  let a = ankle;
  if (thighNoiseDeg !== 0) {
    const k2 = rotateAbout(knee, hip, thighNoiseDeg * DEG);
    a = add(a, { x: k2.x - knee.x, y: k2.y - knee.y });
    knee = k2;
  }
  if (shinNoiseDeg !== 0) a = rotateAbout(a, knee, shinNoiseDeg * DEG);
  const heel = onToes ? add(a, { x: -0.04, y: -0.02 }) : add(a, { x: -0.05, y: -0.05 });
  const footIndex = onToes ? add(a, { x: 0.1, y: -a.y }) : add(a, { x: 0.15, y: -0.06 });
  return { hip, knee, ankle: a, heel, footIndex };
}

/** Standing ankle height above the world floor (as in standingSkeleton). */
export const ANKLE_Y = 0.08;
/** Hip height standing with near-straight (172 deg) knees and the feet 4 cm apart. */
const STAND_HIP_Y =
  ANKLE_Y + Math.sqrt(THIGH * THIGH + SHIN * SHIN - 2 * THIGH * SHIN * Math.cos(172 * DEG) - 0.02 * 0.02);
/** Bottom of a full lunge: hip height and the two ankle positions (hip at x = 0). */
const BOTTOM_HIP_Y = ANKLE_Y + SHIN;
const BOTTOM_FRONT_ANKLE: Vec = { x: THIGH, y: ANKLE_Y };
const BOTTOM_BACK_ANKLE: Vec = { x: -0.29, y: 0.115 };

export interface LungePoseParams {
  /** 0 = standing, 1 = full-depth lunge. Values above 1 are clamped. */
  depth: number;
  /** Torso lean forward from vertical, degrees. */
  torsoLeanDeg?: number;
  /** Per-joint angular noise (degrees) for front thigh, front shin, back thigh, back shin. */
  noise?: readonly [number, number, number, number];
}

export interface LungeBody {
  /** Upper body + the near-side leg as a SideSkeleton (near leg = front or back, see below). */
  upper: Omit<SideSkeleton, "hip" | "knee" | "ankle" | "heel" | "footIndex">;
  front: LegPose;
  back: LegPose;
}

/** Hip, both legs and upper body for a lunge depth. */
export function lungeBody({ depth, torsoLeanDeg = 4, noise = [0, 0, 0, 0] }: LungePoseParams): LungeBody {
  const p = Math.min(Math.max(depth, 0), 1);
  const hip: Vec = { x: 0, y: STAND_HIP_Y + (BOTTOM_HIP_Y - STAND_HIP_Y) * p };
  // The feet travel out a little ahead of the drop, so the knees bend as the hip lowers.
  const spread = Math.min(1, p * 1.25);
  const frontAnkle = lerpV({ x: 0.02, y: ANKLE_Y }, BOTTOM_FRONT_ANKLE, spread);
  const backAnkle = lerpV({ x: -0.02, y: ANKLE_Y }, BOTTOM_BACK_ANKLE, spread);
  const front = legPose(hip, frontAnkle, false, noise[0], noise[1]);
  const back = legPose(hip, backAnkle, p > 0.15, noise[2], noise[3]);
  const lean = torsoLeanDeg * DEG;
  const headDir = { x: Math.sin(lean), y: Math.cos(lean) };
  const shoulder = add(hip, { x: headDir.x * PROPORTIONS.torso, y: headDir.y * PROPORTIONS.torso });
  const elbow = add(shoulder, { x: 0.02, y: -PROPORTIONS.upperArm });
  const wrist = add(elbow, { x: 0.02, y: -PROPORTIONS.forearm });
  return {
    upper: { shoulder, elbow, wrist, headDir, faceDir: { x: Math.cos(lean), y: -Math.sin(lean) }, handDir: { x: 0.1, y: -1 } },
    front,
    back,
  };
}

const LEG_INDEX = {
  left: [LM.LEFT_HIP, LM.LEFT_KNEE, LM.LEFT_ANKLE, LM.LEFT_HEEL, LM.LEFT_FOOT_INDEX],
  right: [LM.RIGHT_HIP, LM.RIGHT_KNEE, LM.RIGHT_ANKLE, LM.RIGHT_HEEL, LM.RIGHT_FOOT_INDEX],
} as const;

/**
 * Render a two-legged side view. `nearLeg` goes on the near (camera) side, `farLeg` on the
 * other side. Upper body as in renderLandmarks (far arm/shoulder offset slightly).
 */
export function renderTwoLegs(
  upper: LungeBody["upper"],
  nearLeg: LegPose,
  farLeg: LegPose,
  options: RenderOptions = {},
): Landmark[] {
  const nearSide = options.nearSide ?? "left";
  const farSide = nearSide === "left" ? "right" : "left";
  const farVisibility = options.farVisibility ?? 0.6;
  const a = renderLandmarks({ ...upper, ...nearLeg }, "standing", options);
  // Same camera, but the far leg is drawn as the "near" side so it is not offset.
  const b = renderLandmarks({ ...upper, ...farLeg }, "standing", { ...options, nearSide: farSide, visibility: {} });
  const out = [...a];
  for (const i of LEG_INDEX[farSide]) {
    const vis = options.visibility?.[i] ?? farVisibility;
    out[i] = { ...b[i], visibility: vis };
  }
  return out;
}

export interface LungeSequenceOptions extends RenderOptions {
  fps?: number;
  startMs?: number;
  seed?: number;
  /** Uniform per-frame noise in degrees on each thigh / shin and the torso. */
  jitterDeg?: number;
  /** Number of lunges (default 4). */
  reps?: number;
  /** Peak depth per rep (1 = full lunge). Default 1. */
  depth?: number;
  /** Down + up time per lunge (ms). Default 1800. */
  repMs?: number;
  /** Pause at the bottom (ms). Default 150. */
  bottomHoldMs?: number;
  /** Standing pause between lunges (ms). Default 400. */
  holdMs?: number;
  leadInMs?: number;
  leadOutMs?: number;
  /**
   * Which leg leads each rep: "near" = the camera-side leg is in front, "far" = the other
   * leg. "alternate" (default) starts with the near leg.
   */
  frontLeg?: "near" | "far" | "alternate";
  /** Torso lean forward from vertical, degrees (constant). Default 4. */
  torsoLeanDeg?: number;
  /** Custom depth profile (overrides reps / depth / timing). */
  profile?: AngleProfile;
}

/** Frame timestamps (relative) at `fps`, rounded to whole ms like the live runtime. */
export function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

/** A set of lunges as PoseFrames. */
export function lungeSequence(options: LungeSequenceOptions = {}): PoseFrame[] {
  const {
    fps = 30,
    startMs = 0,
    seed = 1,
    jitterDeg = 0,
    reps = 4,
    depth = 1,
    repMs = 1800,
    bottomHoldMs = 150,
    holdMs = 400,
    leadInMs = 900,
    leadOutMs = 700,
    frontLeg = "alternate",
    torsoLeanDeg = 4,
    width = 640,
    height = 480,
  } = options;
  // repTimeline works on "angles"; use depth*100 as the profile value.
  const timeline =
    options.profile ??
    repTimeline({ reps, topAngle: 0, bottomAngle: depth * 100, repMs, bottomHoldMs, holdMs, leadInMs, leadOutMs });
  const windows = options.profile ? [] : (timeline as ReturnType<typeof repTimeline>).reps;
  const rng = mulberry32(seed);
  const n = () => (jitterDeg === 0 ? 0 : (rng() * 2 - 1) * jitterDeg);
  return frameOffsets(timeline.durationMs, fps).map((t) => {
    const d = timeline.angleAt(t) / 100;
    // Which rep are we in (for the leading leg)? Count windows started by now.
    let repIdx = 0;
    for (let i = 0; i < windows.length; i++) if (t >= windows[i].startMs) repIdx = i;
    const nearFront = frontLeg === "near" || (frontLeg === "alternate" && repIdx % 2 === 0);
    const body = lungeBody({ depth: d, torsoLeanDeg: torsoLeanDeg + n(), noise: [n(), n(), n(), n()] });
    const landmarks = renderTwoLegs(
      body.upper,
      nearFront ? body.front : body.back,
      nearFront ? body.back : body.front,
      { ...options, width, height },
    );
    return { timestampMs: startMs + t, landmarks, imageWidth: width, imageHeight: height };
  });
}

/**
 * Cheat: standing on one leg and curling the other heel up behind (knee 175 -> 60 -> 175).
 * One knee bends far past 90 but the body never drops into a lunge.
 */
export function standingLegCurlSequence(options: LungeSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, reps = 4, width = 640, height = 480 } = options;
  const timeline = repTimeline({ reps, topAngle: 172, bottomAngle: 55, repMs: 1600, holdMs: 400 });
  return frameOffsets(timeline.durationMs, fps).map((t) => {
    const body = lungeBody({ depth: 0 });
    const k = timeline.angleAt(t);
    // Curl leg: thigh slightly back of vertical, shin folded back by (180 - k).
    const hip = body.front.hip;
    const knee = add(hip, { x: 0.03, y: -THIGH });
    const shinDir = rotateAbout({ x: 0, y: -1 }, { x: 0, y: 0 }, -(180 - k) * DEG);
    const ankle = add(knee, { x: shinDir.x * SHIN, y: shinDir.y * SHIN });
    const curl: LegPose = { hip, knee, ankle, heel: add(ankle, { x: -0.04, y: 0 }), footIndex: add(ankle, { x: 0.08, y: -0.05 }) };
    const landmarks = renderTwoLegs(body.upper, body.front, curl, { ...options, width, height });
    return { timestampMs: startMs + t, landmarks, imageWidth: width, imageHeight: height };
  });
}

/** Keyframe helper re-exported for tests that build custom depth profiles. */
export { keyframes };
