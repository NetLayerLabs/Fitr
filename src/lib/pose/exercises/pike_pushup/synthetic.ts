/**
 * Deterministic synthetic pike push-ups (side view, floor layout) for tests and the demo.
 *
 * World space as in testing/synthetic.ts (y up, body-height units, facing +x). The hands are
 * planted at the origin, the feet planted behind at (ankleX, 0.07) with straight legs. The
 * hip sits on a circle around the ankle at `legDeg` above horizontal (the pike height); the
 * shoulder is solved so the arm (with the requested elbow angle) reaches the hand and the
 * torso keeps its length. Bending the elbows therefore lowers the head toward the hands
 * while the hips stay high, as in a real pike push-up.
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
const LEG = PROPORTIONS.thigh + PROPORTIONS.shin;

export interface PikePoseParams {
  /** Interior elbow angle (shoulder-elbow-wrist). */
  elbowDeg: number;
  /** Leg angle above horizontal around the ankle: higher = hips higher. Default 52. */
  legDeg?: number;
  /** Feet position behind the hands. Default -0.45. */
  ankleX?: number;
}

/** Intersections of two circles, or null when they do not meet. */
function circles(c1: Vec, r1: number, c2: Vec, r2: number): [Vec, Vec] | null {
  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 0) || d > r1 + r2 || d < Math.abs(r1 - r2)) return null;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(r1 * r1 - a * a, 0));
  const mx = c1.x + (a * dx) / d;
  const my = c1.y + (a * dy) / d;
  return [
    { x: mx + (h * dy) / d, y: my - (h * dx) / d },
    { x: mx - (h * dy) / d, y: my + (h * dx) / d },
  ];
}

const unit = (v: Vec): Vec => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};

export function pikeSkeleton({ elbowDeg, legDeg = 52, ankleX = -0.45 }: PikePoseParams): SideSkeleton {
  const u = PROPORTIONS.upperArm;
  const f = PROPORTIONS.forearm;
  const T = PROPORTIONS.torso;
  const e = Math.min(Math.max(elbowDeg, 20), 180) * DEG;
  let wrist: Vec = { x: 0, y: 0.03 };
  const ankle: Vec = { x: ankleX, y: 0.07 };
  const hip: Vec = { x: ankle.x + LEG * Math.cos(legDeg * DEG), y: ankle.y + LEG * Math.sin(legDeg * DEG) };
  const reach = Math.sqrt(u * u + f * f - 2 * u * f * Math.cos(e));
  const sols = circles(hip, T, wrist, reach);
  let shoulder: Vec;
  if (sols) {
    shoulder = sols[0].x >= sols[1].x ? sols[0] : sols[1];
  } else {
    // Out of reach: torso points at the hand and the hand follows the arm (hands lift).
    const dir = unit({ x: wrist.x - hip.x, y: wrist.y - hip.y });
    shoulder = { x: hip.x + dir.x * T, y: hip.y + dir.y * T };
    wrist = { x: shoulder.x + dir.x * reach, y: shoulder.y + dir.y * reach };
  }
  const elbowSols = circles(shoulder, u, wrist, f);
  // Elbows bend back towards the feet.
  const elbow = elbowSols
    ? elbowSols[0].x <= elbowSols[1].x
      ? elbowSols[0]
      : elbowSols[1]
    : { x: (shoulder.x + wrist.x) / 2, y: (shoulder.y + wrist.y) / 2 };
  const knee = {
    x: hip.x + (ankle.x - hip.x) * (PROPORTIONS.thigh / LEG),
    y: hip.y + (ankle.y - hip.y) * (PROPORTIONS.thigh / LEG),
  };
  const headDir = unit({ x: shoulder.x - hip.x, y: shoulder.y - hip.y });
  // Face looks back between the hands, towards the feet.
  const faceDir = headDir.y <= 0 ? unit({ x: headDir.y, y: -headDir.x }) : unit({ x: -headDir.y, y: headDir.x });
  return {
    shoulder,
    elbow,
    wrist,
    hip,
    knee,
    ankle,
    heel: { x: ankle.x - 0.05, y: ankle.y + 0.04 },
    footIndex: { x: ankle.x + 0.05, y: 0 },
    headDir,
    faceDir: faceDir.x <= 0 ? faceDir : { x: -faceDir.x, y: -faceDir.y },
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

/** Pike push-up timeline defaults: lockout 172, bottom 70, 1.6 s reps, 0.3 s pause on top. */
export function pikeTimeline(options: Partial<RepTimelineOptions> = {}): RepTimeline {
  return repTimeline({ reps: 5, topAngle: 172, bottomAngle: 70, repMs: 1600, holdMs: 300, ...options });
}

export interface PikeSequenceOptions extends SequenceOptions, Partial<RepTimelineOptions> {
  /** Pike height (see PikePoseParams.legDeg), constant or over relative time. */
  legDeg?: number | ((tMs: number) => number);
  ankleX?: number;
  profile?: AngleProfile;
}

export function pikeSequence(options: PikeSequenceOptions = {}): PoseFrame[] {
  const { fps = 30, startMs = 0, seed = 1, width = 640, height = 480, jitterDeg = 0, legDeg = 52, ankleX } = options;
  const profile = options.profile ?? pikeTimeline(options);
  const legAt = typeof legDeg === "function" ? legDeg : () => legDeg;
  const rng = mulberry32(seed);
  return frameOffsets(profile.durationMs, fps).map((offset) => ({
    timestampMs: startMs + offset,
    landmarks: renderLandmarks(
      pikeSkeleton({
        elbowDeg: profile.angleAt(offset) + noise(rng, jitterDeg),
        legDeg: legAt(offset) + noise(rng, jitterDeg / 2),
        ankleX,
      }),
      "floor",
      { ...options, width, height },
    ),
    imageWidth: width,
    imageHeight: height,
  }));
}
