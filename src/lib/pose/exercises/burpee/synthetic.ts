/**
 * Synthetic side-view burpees (tests and the form-guide demo), built from the shared side-view
 * skeletons in testing/synthetic.ts and rendered with the "standing" camera so the whole
 * movement (standing tall to lying in a plank) stays in one frame.
 *
 * A rep is a chain of key poses (stand -> crouch with hands down -> plank [-> push-up] ->
 * plank -> crouch -> jump -> stand); joint positions are cosine-interpolated between them.
 * Each key pose is rebuilt every frame with seeded angle noise, so `jitterDeg` behaves like
 * the other synthetic generators.
 */
import {
  mulberry32,
  PROPORTIONS,
  pushupSkeleton,
  renderLandmarks,
  standingSkeleton,
  type RenderOptions,
  type SideSkeleton,
  type Vec,
} from "@/lib/pose/testing/synthetic";
import type { PoseFrame } from "@/lib/pose/types";
import { frameOffsets } from "../front/skeleton";

const DEG = Math.PI / 180;

export type BurpeeKey = "stand" | "crouch" | "plank" | "pushup" | "jump";

export interface BurpeePoseOptions {
  /** Hip bend in the plank: + sags, - pikes. */
  plankHipBendDeg?: number;
  /** Knee bend in the plank: + drops the knees (a "knee plank"). */
  plankKneeBendDeg?: number;
  /** Knee angle at the bottom of the crouch. */
  crouchKneeDeg?: number;
}

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const ARM = PROPORTIONS.upperArm + PROPORTIONS.forearm;

/** Point the (straight) arm from the shoulder at `deg` (0 = straight down, + = forward). */
function withArm(s: SideSkeleton, deg: number): SideSkeleton {
  const dir = { x: Math.sin(deg * DEG), y: -Math.cos(deg * DEG) };
  const elbow = add(s.shoulder, scale(dir, PROPORTIONS.upperArm));
  const wrist = add(s.shoulder, scale(dir, ARM));
  return { ...s, elbow, wrist, handDir: dir };
}

function shift(s: SideSkeleton, d: Vec): SideSkeleton {
  const out = { ...s };
  for (const key of ["shoulder", "elbow", "wrist", "hip", "knee", "ankle", "heel", "footIndex"] as const) {
    out[key] = add(s[key], d);
  }
  return out;
}

/** Where the hands land in front of the feet (world x). */
const HANDS_X = 0.28;

/** One key pose of a burpee, with angle noise `n()` (degrees). */
export function burpeeKeyPose(key: BurpeeKey, opts: BurpeePoseOptions, n: () => number): SideSkeleton {
  switch (key) {
    case "stand":
      return withArm(standingSkeleton({ kneeDeg: 176 + n() / 2, torsoLeanDeg: 2 + n() }), 6 + n());
    case "jump":
      return shift(withArm(standingSkeleton({ kneeDeg: 176 + n() / 2, torsoLeanDeg: 0 + n() }), 140 + n()), {
        x: 0,
        y: 0.05,
      });
    case "crouch": {
      const s = standingSkeleton({ kneeDeg: (opts.crouchKneeDeg ?? 65) + n(), torsoLeanDeg: 60 + n() });
      return withArm(s, 15 + n());
    }
    case "plank":
    case "pushup": {
      const s = pushupSkeleton({
        elbowDeg: (key === "pushup" ? 80 : 172) + n(),
        hipBendDeg: (opts.plankHipBendDeg ?? 0) + n(),
        kneeBendDeg: Math.max(0, (opts.plankKneeBendDeg ?? 0) + n()),
      });
      return shift(s, { x: HANDS_X - s.wrist.x, y: 0 });
    }
  }
}

function lerpSkeleton(a: SideSkeleton, b: SideSkeleton, w: number): SideSkeleton {
  const l = (p: Vec, q: Vec): Vec => ({ x: p.x + (q.x - p.x) * w, y: p.y + (q.y - p.y) * w });
  const u = (p: Vec, q: Vec): Vec => {
    const v = l(p, q);
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
  };
  return {
    shoulder: l(a.shoulder, b.shoulder),
    elbow: l(a.elbow, b.elbow),
    wrist: l(a.wrist, b.wrist),
    hip: l(a.hip, b.hip),
    knee: l(a.knee, b.knee),
    ankle: l(a.ankle, b.ankle),
    heel: l(a.heel, b.heel),
    footIndex: l(a.footIndex, b.footIndex),
    headDir: u(a.headDir, b.headDir),
    faceDir: u(a.faceDir, b.faceDir),
    handDir: u(a.handDir, b.handDir),
  };
}

export interface BurpeeSequenceOptions extends RenderOptions, BurpeePoseOptions {
  reps?: number;
  /** Standing -> standing time of one rep. */
  repMs?: number;
  /** Standing pause after each rep. */
  holdMs?: number;
  leadInMs?: number;
  leadOutMs?: number;
  /** Lower to the floor for a push-up in the plank. */
  pushup?: boolean;
  /** Finish with a jump (arms up); otherwise just stand up. */
  jump?: boolean;
  /** Squat thrust without kicking back to a plank (a cheat / partial). */
  skipPlank?: boolean;
  /** Stay down this long in the plank (extra, e.g. to exceed the max duration). */
  plankHoldMs?: number;
  fps?: number;
  startMs?: number;
  seed?: number;
  jitterDeg?: number;
}

/**
 * Burpees. Defaults: 3 s per rep (stand, hands down at 18%, plank 34-62%, crouch 76%, jump
 * 90%), 500 ms standing between reps.
 */
export function burpeeSequence(options: BurpeeSequenceOptions = {}): PoseFrame[] {
  const {
    reps = 5,
    repMs = 3000,
    holdMs = 500,
    leadInMs = 1000,
    leadOutMs = 800,
    pushup = false,
    jump = true,
    skipPlank = false,
    plankHoldMs = 0,
    fps = 30,
    startMs = 0,
    seed = 1,
    jitterDeg = 0,
    width = 640,
    height = 480,
  } = options;
  const keys: [number, BurpeeKey][] = [[0, "stand"]];
  let t = leadInMs;
  for (let i = 0; i < reps; i++) {
    const at = (f: number) => t + f * repMs;
    const floor: BurpeeKey = skipPlank ? "crouch" : "plank";
    keys.push([t, "stand"], [at(0.18), "crouch"], [at(0.34), floor]);
    if (pushup && !skipPlank) keys.push([at(0.48), "pushup"]);
    keys.push([at(0.62) + plankHoldMs, floor]);
    t += plankHoldMs;
    keys.push([at(0.76), "crouch"]);
    if (jump) keys.push([at(0.9), "jump"]);
    keys.push([at(1), "stand"]);
    t += repMs + holdMs;
    keys.push([t, "stand"]);
  }
  const durationMs = t + leadOutMs;
  keys.push([durationMs, "stand"]);

  const rng = mulberry32(seed);
  const n = () => (jitterDeg === 0 ? 0 : (rng() * 2 - 1) * jitterDeg);
  return frameOffsets(durationMs, fps).map((offset) => {
    let i = keys.findIndex(([kt]) => kt >= offset);
    if (i <= 0) i = 1;
    const [t0, k0] = keys[i - 1];
    const [t1, k1] = keys[i];
    const p = t1 > t0 ? Math.min(1, Math.max(0, (offset - t0) / (t1 - t0))) : 1;
    const w = (1 - Math.cos(Math.PI * p)) / 2;
    const a = burpeeKeyPose(k0, options, n);
    const skeleton = k0 === k1 ? a : lerpSkeleton(a, burpeeKeyPose(k1, options, n), w);
    return {
      timestampMs: startMs + offset,
      landmarks: renderLandmarks(skeleton, "standing", { ...options, width, height }),
      imageWidth: width,
      imageHeight: height,
    };
  });
}
