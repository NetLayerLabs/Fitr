/**
 * Deterministic synthetic dips (side view, standing layout) for tests and the demo.
 *
 * World space as in testing/synthetic.ts (y up, body-height units, facing +x). The hand is
 * planted on the support at a fixed point; the forearm stays near vertical (tilting back a
 * little as the elbow travels back), the upper arm rotates with the elbow angle, so the
 * shoulder lowers towards the hand and moves slightly forward, as in a real dip.
 *  - "bench": hands behind on a chair seat, knees bent, feet on the floor in front.
 *  - "bars": hands on parallel bars, knees bent, feet hanging behind.
 */
import {
  mulberry32,
  PROPORTIONS,
  renderLandmarks,
  repTimeline,
  type AngleProfile,
  type RepTimeline,
  type RepTimelineOptions,
  type SequenceOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";

const DEG = Math.PI / 180;

export type DipStyle = "bench" | "bars";

export interface DipPoseParams {
  /** Interior elbow angle (shoulder-elbow-wrist). */
  elbowDeg: number;
  style?: DipStyle;
  /** Torso lean from vertical (forward). Default 8 deg at lockout rising to ~23 deg at 80 deg elbow. */
  leanDeg?: number;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });

/** 0 at lockout (175) .. 1 at an 80 degree elbow. */
function depthProgress(elbowDeg: number): number {
  return Math.min(Math.max((175 - elbowDeg) / 95, 0), 1);
}

function kneeBetween(hip: Vec, ankle: Vec): Vec {
  const a = PROPORTIONS.thigh;
  const b = PROPORTIONS.shin;
  const dx = ankle.x - hip.x;
  const dy = ankle.y - hip.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 0) || d >= a + b) return add(hip, scale({ x: dx, y: dy }, a / (a + b)));
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(a * a - along * along, 0));
  const mx = hip.x + (along * dx) / d;
  const my = hip.y + (along * dy) / d;
  const k1 = { x: mx + (h * dy) / d, y: my - (h * dx) / d };
  const k2 = { x: mx - (h * dy) / d, y: my + (h * dx) / d };
  // Knees up.
  return k1.y >= k2.y ? k1 : k2;
}

export function dipSkeleton({ elbowDeg, style = "bench", leanDeg }: DipPoseParams): SideSkeleton {
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  const T = PROPORTIONS.torso;
  const e = Math.min(Math.max(elbowDeg, 30), 180) * DEG;
  const p = depthProgress(elbowDeg);
  const wrist: Vec = style === "bench" ? { x: 0, y: 0.3 } : { x: 0, y: 0.72 };
  const tilt = (5 + 10 * p) * DEG;
  const elbow = add(wrist, { x: -f * Math.sin(tilt), y: f * Math.cos(tilt) });
  // Direction elbow -> wrist, rotated counter-clockwise by the elbow angle = elbow -> shoulder.
  const dx = Math.sin(tilt);
  const dy = -Math.cos(tilt);
  const up = { x: dx * Math.cos(e) - dy * Math.sin(e), y: dx * Math.sin(e) + dy * Math.cos(e) };
  const shoulder = add(elbow, scale(up, u));
  const lean = (leanDeg ?? 8 + 15 * p) * DEG;
  const headDir = { x: Math.sin(lean), y: Math.cos(lean) };
  const hip = add(shoulder, scale(headDir, -T));
  let knee: Vec;
  let ankle: Vec;
  let heel: Vec;
  let footIndex: Vec;
  if (style === "bench") {
    ankle = { x: 0.42, y: 0.08 };
    knee = kneeBetween(hip, ankle);
    heel = { x: ankle.x - 0.04, y: 0.02 };
    footIndex = { x: ankle.x + 0.13, y: 0.0 };
  } else {
    knee = add(hip, { x: PROPORTIONS.thigh * Math.sin(15 * DEG), y: -PROPORTIONS.thigh * Math.cos(15 * DEG) });
    ankle = add(knee, { x: -PROPORTIONS.shin * Math.sin(60 * DEG), y: -PROPORTIONS.shin * Math.cos(60 * DEG) });
    heel = add(ankle, { x: -0.03, y: 0.03 });
    footIndex = add(ankle, { x: -0.1, y: -0.06 });
  }
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    heel,
    footIndex,
    headDir,
    faceDir: { x: Math.cos(lean), y: -Math.sin(lean) },
    handDir: { x: 1, y: 0 },
  };
}

function noise(rng: () => number, amplitude: number): number {
  return amplitude === 0 ? 0 : (rng() * 2 - 1) * amplitude;
}

function frameOffsets(durationMs: number, fps: number): number[] {
  const step = 1000 / fps;
  const out: number[] = [];
  for (let i = 0; i * step <= durationMs + 1e-9; i++) out.push(Math.round(i * step));
  return out;
}

/** Dip timeline defaults: lockout 172, bottom 75, 1.4 s reps, 0.3 s pause on top. */
export function dipTimeline(options: Partial<RepTimelineOptions> = {}): RepTimeline {
  return repTimeline({ reps: 5, topAngle: 172, bottomAngle: 75, repMs: 1400, holdMs: 300, ...options });
}

export interface DipSequenceOptions extends SequenceOptions, Partial<RepTimelineOptions> {
  style?: DipStyle;
  /** Torso lean override (degrees from vertical), constant or over relative time. */
  leanDeg?: number | ((tMs: number) => number);
  profile?: AngleProfile;
}

export function dipSequence(options: DipSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480, jitterDeg = 0, style, leanDeg } = options;
  const profile = options.profile ?? dipTimeline(options);
  const leanAt = typeof leanDeg === "function" ? leanDeg : () => leanDeg;
  const rng = mulberry32(seed);
  return frameOffsets(profile.durationMs, fps).map((offset) => {
    const elbowDeg = profile.angleAt(offset) + noise(rng, jitterDeg);
    const leanJitter = noise(rng, jitterDeg);
    const lean = leanAt(offset);
    return {
      timestampMs: startMs + offset,
      landmarks: renderLandmarks(
        dipSkeleton({
          elbowDeg,
          style,
          leanDeg: (lean ?? 8 + 15 * depthProgress(elbowDeg)) + leanJitter,
        }),
        "standing",
        { ...options, width, height },
      ),
      imageWidth: width,
      imageHeight: height,
    };
  });
}
