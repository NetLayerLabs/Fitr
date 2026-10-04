/**
 * Mannequin renderer for the form-guide demos: turns BlazePose joint positions into a faceless,
 * softly shaded 3D-mannequin figure (tapered capsule limbs, a shaped torso, neck and an egg
 * head) for a canvas (GuideDemo) or an SVG (PhonePlacement).
 *
 * Everything here is pure geometry driven by the joint positions it is given, so the figure
 * moves exactly like the source frames. Sizes are tied to the body scale S (shoulder-midpoint
 * to hip-midpoint distance) so the proportions hold at any zoom. The path builders write to a
 * minimal `PathSink`, which a CanvasRenderingContext2D, a Path2D or `SvgPath` all satisfy.
 */
import { LM } from "@/lib/pose/landmarks";
import type { PoseFrame } from "@/lib/pose/types";

export interface Vec {
  x: number;
  y: number;
}

/** The subset of the canvas path API the builders use (no arcs, so SVG can mirror it). */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  closePath(): void;
}

export type View = "side" | "front";
export type Depth = "far" | "near";

/** A limb segment: circle A (radius ar) to circle B (radius br), sides joined by tangents. */
export interface Capsule {
  ax: number;
  ay: number;
  ar: number;
  bx: number;
  by: number;
  br: number;
  /** Outward bulge of the + / - side (px), peaking at bulgeT along the segment (muscle). */
  bulgeP: number;
  bulgeM: number;
  bulgeT: number;
}

export interface ChainPart {
  type: "chain";
  depth: Depth;
  caps: Capsule[];
}

/** A closed smooth outline (torso, head) through `pts`, centred on (cx, cy) with size r. */
export interface BlobPart {
  type: "blob";
  depth: Depth;
  pts: Vec[];
  cx: number;
  cy: number;
  r: number;
}

export type Part = ChainPart | BlobPart;

export interface Figure {
  /**
   * Parts back to front, in groups. A group shares one silhouette outline, so parts within it
   * blend into each other (legs into the pelvis, neck into torso and head) while separate groups
   * (an arm across the chest) keep a crisp edge.
   */
  groups: Part[][];
  /** Body scale S in output units. */
  scale: number;
}

/** Per-sequence facts: which way the body is filmed and its (stable) size. */
export interface Rig {
  view: View;
  /** Median torso length (shoulder mid -> hip mid) in source pixels. */
  scale: number;
}

/** Direction TO the key light: top-left, mostly from above. */
export const LIGHT: Readonly<Vec> = Object.freeze({ x: -0.5, y: -0.866 });

// --- proportions (multiples of S) -------------------------------------------------------------

const R = {
  upperArm: [0.112, 0.078],
  forearm: [0.077, 0.052],
  hand: [0.058, 0.044],
  thigh: [0.172, 0.1],
  shin: [0.096, 0.056],
  heelToe: [0.056, 0.038],
  ankle: [0.06, 0.055],
  neck: [0.08, 0.076],
} as const;

/** Side-view torso profile: [along spine from hip mid, across (+ = chest side)]. */
const TORSO_SIDE: ReadonlyArray<readonly [number, number]> = [
  [1.1, -0.03],
  [1.05, 0.1],
  [0.88, 0.2],
  [0.68, 0.215],
  [0.47, 0.16],
  [0.26, 0.155],
  [0.06, 0.145],
  [-0.1, 0.085],
  [-0.15, -0.03],
  [-0.08, -0.165],
  [0.12, -0.15],
  [0.33, -0.125],
  [0.6, -0.16],
  [0.88, -0.19],
  [1.05, -0.13],
];

/** Head profiles: [along the head axis from its centre, across (+ = face / left side)]. */
const HEAD_SIDE: ReadonlyArray<readonly [number, number]> = [
  [0.27, 0.0],
  [0.225, 0.125],
  [0.1, 0.19],
  [-0.05, 0.19],
  [-0.165, 0.135],
  [-0.215, 0.05],
  [-0.165, -0.06],
  [-0.06, -0.165],
  [0.1, -0.19],
  [0.22, -0.125],
];
const HEAD_FRONT: ReadonlyArray<readonly [number, number]> = [
  [0.27, 0.0],
  [0.215, 0.135],
  [0.06, 0.18],
  [-0.1, 0.155],
  [-0.2, 0.08],
  [-0.235, 0.0],
  [-0.2, -0.08],
  [-0.1, -0.155],
  [0.06, -0.18],
  [0.215, -0.135],
];

// --- small vector helpers ---------------------------------------------------------------------

const v = (x: number, y: number): Vec => ({ x, y });
const lerp = (a: Vec, b: Vec, t: number): Vec => v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const mid = (a: Vec, b: Vec): Vec => lerp(a, b, 0.5);
const len = (x: number, y: number) => Math.hypot(x, y);
function unit(x: number, y: number, fx = 0, fy = -1): Vec {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? v(x / l, y / l) : v(fx, fy);
}
const finite = (p: Vec | undefined): p is Vec => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// --- rig --------------------------------------------------------------------------------------

/** View (side / front) and stable body scale for a sequence of frames, in source pixels. */
export function analyzeRig(frames: readonly PoseFrame[]): Rig {
  const torso: number[] = [];
  const ratio: number[] = [];
  for (const f of frames) {
    const l = f.landmarks;
    if (l.length <= LM.RIGHT_HIP) continue;
    const w = f.imageWidth || 1;
    const h = f.imageHeight || 1;
    const ls = l[LM.LEFT_SHOULDER], rs = l[LM.RIGHT_SHOULDER], lh = l[LM.LEFT_HIP], rh = l[LM.RIGHT_HIP];
    const t = len(((ls.x + rs.x - lh.x - rh.x) / 2) * w, ((ls.y + rs.y - lh.y - rh.y) / 2) * h);
    if (!(t > 0)) continue;
    torso.push(t);
    ratio.push(len((ls.x - rs.x) * w, (ls.y - rs.y) * h) / t);
  }
  const scale = median(torso) || 100;
  return { view: median(ratio) > 0.35 ? "front" : "side", scale };
}

// --- figure construction ----------------------------------------------------------------------

function capsule(a: Vec, b: Vec, ar: number, br: number, bulgeP = 0, bulgeM = 0, bulgeT = 0.4): Capsule {
  return { ax: a.x, ay: a.y, ar, bx: b.x, by: b.y, br, bulgeP, bulgeM, bulgeT };
}

/** Local frame helper: origin o, axis a (unit), across c (unit). */
function local(o: Vec, a: Vec, c: Vec, s: number, along: number, across: number): Vec {
  return v(o.x + (a.x * along + c.x * across) * s, o.y + (a.y * along + c.y * across) * s);
}

function profile(o: Vec, a: Vec, c: Vec, s: number, prof: ReadonlyArray<readonly [number, number]>): Vec[] {
  return prof.map(([al, ac]) => local(o, a, c, s, al, ac));
}

interface Side {
  shoulder: Vec;
  elbow: Vec;
  wrist: Vec;
  index: Vec;
  hip: Vec;
  knee: Vec;
  ankle: Vec;
  heel: Vec;
  toe: Vec;
}

function sideOf(p: (i: number) => Vec, left: boolean): Side {
  return left
    ? {
        shoulder: p(LM.LEFT_SHOULDER), elbow: p(LM.LEFT_ELBOW), wrist: p(LM.LEFT_WRIST), index: p(LM.LEFT_INDEX),
        hip: p(LM.LEFT_HIP), knee: p(LM.LEFT_KNEE), ankle: p(LM.LEFT_ANKLE), heel: p(LM.LEFT_HEEL), toe: p(LM.LEFT_FOOT_INDEX),
      }
    : {
        shoulder: p(LM.RIGHT_SHOULDER), elbow: p(LM.RIGHT_ELBOW), wrist: p(LM.RIGHT_WRIST), index: p(LM.RIGHT_INDEX),
        hip: p(LM.RIGHT_HIP), knee: p(LM.RIGHT_KNEE), ankle: p(LM.RIGHT_ANKLE), heel: p(LM.RIGHT_HEEL), toe: p(LM.RIGHT_FOOT_INDEX),
      };
}

function armChain(s: Side, S: number, depth: Depth): ChainPart {
  const caps: Capsule[] = [
    capsule(s.shoulder, s.elbow, R.upperArm[0] * S, R.upperArm[1] * S, 0.014 * S, 0.014 * S, 0.35),
    capsule(s.elbow, s.wrist, R.forearm[0] * S, R.forearm[1] * S, 0.012 * S, 0.012 * S, 0.28),
  ];
  if (finite(s.index)) {
    const handEnd = lerp(s.wrist, s.index, 0.9);
    caps.push(capsule(s.wrist, handEnd, R.hand[0] * S, R.hand[1] * S, 0.006 * S, 0.006 * S, 0.4));
  }
  return { type: "chain", depth, caps };
}

function legChain(s: Side, S0: number, depth: Depth, girth = 1): ChainPart {
  const S = S0 * girth;
  // Calf on the side away from the toes (side view); symmetric when the foot points at us.
  const fwdX = s.toe.x - s.heel.x, fwdY = s.toe.y - s.heel.y;
  const sx = s.ankle.x - s.knee.x, sy = s.ankle.y - s.knee.y;
  const nx = -sy, ny = sx; // + side normal of knee -> ankle (unnormalised)
  const footLen = len(fwdX, fwdY);
  let calfP = 0.012 * S, calfM = 0.012 * S;
  if (footLen > 0.1 * S) {
    const toesOnPlus = fwdX * nx + fwdY * ny > 0;
    calfP = toesOnPlus ? 0.004 * S : 0.026 * S;
    calfM = toesOnPlus ? 0.026 * S : 0.004 * S;
  }
  const caps: Capsule[] = [
    capsule(s.hip, s.knee, R.thigh[0] * S, R.thigh[1] * S, 0.012 * S, 0.012 * S, 0.32),
    capsule(s.knee, s.ankle, R.shin[0] * S, R.shin[1] * S, calfP, calfM, 0.3),
  ];
  if (finite(s.heel) && finite(s.toe)) {
    caps.push(capsule(s.ankle, lerp(s.heel, s.toe, 0.42), R.ankle[0] * S, R.ankle[1] * S));
    caps.push(capsule(s.heel, s.toe, R.heelToe[0] * S, R.heelToe[1] * S));
  }
  return { type: "chain", depth, caps };
}

/**
 * Builds the ordered parts (back to front) for one pose. `p(i)` returns landmark i in output
 * units; `S` is the body scale in the same units.
 */
export function buildFigure(p: (i: number) => Vec, view: View, S: number): Figure {
  const left = sideOf(p, true);
  const right = sideOf(p, false);
  const shoulderMid = mid(left.shoulder, right.shoulder);
  const hipMid = mid(left.hip, right.hip);
  const spine = unit(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
  const ears = [p(LM.LEFT_EAR), p(LM.RIGHT_EAR)].filter(finite);
  const nose = p(LM.NOSE);
  const earMid = ears.length === 2 ? mid(ears[0], ears[1]) : (ears[0] ?? nose);
  const headC = finite(nose) && finite(earMid) ? lerp(earMid, nose, 0.3) : local(shoulderMid, spine, spine, S, 0.5, 0);

  const neckBase = local(shoulderMid, spine, spine, S, 0.04, 0);
  const headUp = unit(headC.x - neckBase.x, headC.y - neckBase.y, spine.x, spine.y);
  const neck: ChainPart = {
    type: "chain",
    depth: "near",
    caps: [capsule(neckBase, lerp(neckBase, headC, 0.85), R.neck[0] * S, R.neck[1] * S)],
  };

  if (view === "front") {
    // Lateral axis pointing to the body's left side.
    let lat = v(-spine.y, spine.x);
    if (lat.x * (left.shoulder.x - right.shoulder.x) + lat.y * (left.shoulder.y - right.shoulder.y) < 0) lat = v(-lat.x, -lat.y);
    const down = v(-spine.x, -spine.y);
    const half = (sh: Vec, hp: Vec, sign: number): Vec[] => {
      const o = (pt: Vec, along: number, across: number) => local(pt, spine, lat, S, along, across * sign);
      const ws = Math.abs((sh.x - shoulderMid.x) * lat.x + (sh.y - shoulderMid.y) * lat.y) / S;
      const wh = Math.abs((hp.x - hipMid.x) * lat.x + (hp.y - hipMid.y) * lat.y) / S;
      const waist = Math.max(0.74 * ws, wh + 0.04);
      return [
        o(shoulderMid, 0.1, 0.12),
        o(sh, 0.085, -0.05),
        o(sh, -0.04, 0.075),
        o(lerp(shoulderMid, hipMid, 0.3), 0, Math.max(ws * 0.95, waist + 0.04)),
        o(lerp(shoulderMid, hipMid, 0.66), 0, waist),
        o(hp, 0.03, 0.12),
        o(hp, -0.1, 0.1),
        local(hipMid, down, lat, S, 0.2, 0.035 * sign),
      ];
    };
    const l = half(left.shoulder, left.hip, 1);
    const r = half(right.shoulder, right.hip, -1).reverse();
    const torsoPts = [...l, ...r];
    const torsoC = lerp(shoulderMid, hipMid, 0.45);
    const torso: BlobPart = { type: "blob", depth: "near", pts: torsoPts, cx: torsoC.x, cy: torsoC.y, r: 0.6 * S };
    const headAcross = v(-headUp.y, headUp.x);
    const head: BlobPart = { type: "blob", depth: "near", pts: profile(headC, headUp, headAcross, S, HEAD_FRONT), cx: headC.x, cy: headC.y, r: 0.24 * S };
    return {
      scale: S,
      groups: [
        [legChain(right, S, "near", 1.08), legChain(left, S, "near", 1.08), neck, torso, head],
        [armChain(right, S, "near")],
        [armChain(left, S, "near")],
      ],
    };
  }

  // Side view: chest direction = perpendicular to the spine on the face's side.
  let front = v(-spine.y, spine.x);
  const faceX = finite(nose) && finite(earMid) ? nose.x - earMid.x : 0;
  const faceY = finite(nose) && finite(earMid) ? nose.y - earMid.y : 0;
  let facing = front.x * faceX + front.y * faceY;
  if (Math.abs(facing) < 1e-6) facing = front.x * (left.toe.x - left.heel.x) + front.y * (left.toe.y - left.heel.y);
  if (facing < 0) front = v(-front.x, -front.y);
  const torsoC = local(hipMid, spine, front, S, 0.5, 0.02);
  const torso: BlobPart = { type: "blob", depth: "near", pts: profile(hipMid, spine, front, S, TORSO_SIDE), cx: torsoC.x, cy: torsoC.y, r: 0.6 * S };
  let headFace = v(-headUp.y, headUp.x);
  if (headFace.x * faceX + headFace.y * faceY < 0) headFace = v(-headFace.x, -headFace.y);
  const head: BlobPart = { type: "blob", depth: "near", pts: profile(headC, headUp, headFace, S, HEAD_SIDE), cx: headC.x, cy: headC.y, r: 0.24 * S };
  return {
    scale: S,
    // The near leg tucks under the pelvis (the torso's hip/glute covers the thigh top).
    groups: [
      [armChain(right, S, "far")],
      [legChain(right, S, "far")],
      [legChain(left, S, "near"), neck, torso, head],
      [armChain(left, S, "near")],
    ],
  };
}

// --- path builders ----------------------------------------------------------------------------

/** Arc of radius r around (cx, cy) from angle a0 to a1 (radians, either direction), as cubics. */
function arcPath(sink: PathSink, cx: number, cy: number, r: number, a0: number, a1: number) {
  const sweep = a1 - a0;
  const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4);
  let a = a0;
  for (let i = 0; i < n; i++) {
    const b = a + step;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    sink.bezierCurveTo(cx + r * (ca - k * sa), cy + r * (sa + k * ca), cx + r * (cb + k * sb), cy + r * (sb - k * cb), cx + r * cb, cy + r * sb);
    a = b;
  }
}

/** Shared capsule frame: axis angle, tangent half-angle, unit axis and normal. */
interface CapFrame {
  theta: number;
  alpha: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  d: number;
}

function capFrame(c: Capsule): CapFrame | null {
  const dx = c.bx - c.ax, dy = c.by - c.ay;
  const d = Math.hypot(dx, dy);
  if (d <= Math.abs(c.ar - c.br) + 1e-6) return null;
  const ux = dx / d, uy = dy / d;
  return { theta: Math.atan2(uy, ux), alpha: Math.acos((c.ar - c.br) / d), ux, uy, nx: -uy, ny: ux, d };
}

/** Appends one closed capsule outline (tapered, optionally bulging) to the sink. */
export function capsulePath(sink: PathSink, c: Capsule) {
  const f = capFrame(c);
  if (!f) {
    // Degenerate (one circle inside the other): the bigger circle.
    const big = c.ar >= c.br ? { x: c.ax, y: c.ay, r: c.ar } : { x: c.bx, y: c.by, r: c.br };
    sink.moveTo(big.x + big.r, big.y);
    arcPath(sink, big.x, big.y, big.r, 0, Math.PI * 2);
    sink.closePath();
    return;
  }
  const aP = f.theta + f.alpha, aM = f.theta - f.alpha;
  const mpx = Math.cos(aP), mpy = Math.sin(aP), mmx = Math.cos(aM), mmy = Math.sin(aM);
  const p0x = c.ax + c.ar * mpx, p0y = c.ay + c.ar * mpy;
  const p1x = c.bx + c.br * mpx, p1y = c.by + c.br * mpy;
  const q0x = c.bx + c.br * mmx, q0y = c.by + c.br * mmy;
  const q1x = c.ax + c.ar * mmx, q1y = c.ay + c.ar * mmy;
  sink.moveTo(p0x, p0y);
  if (c.bulgeP > 0) {
    const t = c.bulgeT;
    sink.quadraticCurveTo(p0x + (p1x - p0x) * t + 2 * c.bulgeP * mpx, p0y + (p1y - p0y) * t + 2 * c.bulgeP * mpy, p1x, p1y);
  } else sink.lineTo(p1x, p1y);
  arcPath(sink, c.bx, c.by, c.br, aP, aM);
  if (c.bulgeM > 0) {
    const t = 1 - c.bulgeT;
    sink.quadraticCurveTo(q0x + (q1x - q0x) * t + 2 * c.bulgeM * mmx, q0y + (q1y - q0y) * t + 2 * c.bulgeM * mmy, q1x, q1y);
  } else sink.lineTo(q1x, q1y);
  arcPath(sink, c.ax, c.ay, c.ar, aM, aP - Math.PI * 2);
  sink.closePath();
}

/** Appends a closed Catmull-Rom curve through `pts`. */
export function smoothClosedPath(sink: PathSink, pts: readonly Vec[]) {
  const n = pts.length;
  if (n < 3) return;
  sink.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    sink.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
  sink.closePath();
}

export function partPath(sink: PathSink, part: Part) {
  if (part.type === "blob") smoothClosedPath(sink, part.pts);
  else for (const c of part.caps) capsulePath(sink, c);
}

export interface SideCurve {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  /** How squarely the side faces the light (-1..1). */
  facing: number;
}

/**
 * One side edge of a capsule (A to B) moved `inset` towards the axis, as a quadratic curve:
 * the side facing the light when `lit`, else the shadow side. Null when degenerate.
 */
export function capsuleSide(c: Capsule, lit: boolean, inset: number): SideCurve | null {
  const f = capFrame(c);
  if (!f) return null;
  const plusLit = f.nx * LIGHT.x + f.ny * LIGHT.y >= 0;
  const plus = lit === plusLit;
  const a = plus ? f.theta + f.alpha : f.theta - f.alpha;
  const mx = Math.cos(a), my = Math.sin(a);
  const bulge = plus ? c.bulgeP : c.bulgeM;
  const x0 = c.ax + (c.ar - inset) * mx, y0 = c.ay + (c.ar - inset) * my;
  const x1 = c.bx + (c.br - inset) * mx, y1 = c.by + (c.br - inset) * my;
  const t = c.bulgeT; // measured from A on both sides
  return { x0, y0, x1, y1, cx: x0 + (x1 - x0) * t + 2 * bulge * mx, cy: y0 + (y1 - y0) * t + 2 * bulge * my, facing: mx * LIGHT.x + my * LIGHT.y };
}

/**
 * The lit side edge of a capsule (inset by `inset`) for the rim highlight, with its strength
 * (0..1). Null when no side really faces the light or the capsule is degenerate.
 */
export function capsuleRim(c: Capsule, inset: number): (SideCurve & { strength: number }) | null {
  const side = capsuleSide(c, true, inset);
  if (!side || side.facing <= 0.05) return null;
  return { ...side, strength: Math.min(1, side.facing * 1.3) };
}

// --- canvas rendering -------------------------------------------------------------------------

export interface Tone {
  hi: string;
  base: string;
  shade: string;
}

export interface Palette {
  near: Tone;
  far: Tone;
  outline: string;
  rim: string;
  /** Rim opacity on near / far parts. */
  rimNear: number;
  rimFar: number;
}

export const MANNEQUIN_PALETTE: Readonly<Omit<Palette, "rim">> = Object.freeze({
  near: { hi: "#FCFDFD", base: "#E2E6EA", shade: "#8F98A2" },
  far: { hi: "#9AA1A9", base: "#78808A", shade: "#474D55" },
  outline: "rgba(5, 7, 9, 0.62)",
  rimNear: 0.95,
  rimFar: 0.4,
});

/** Shading bands per segment: which side, opacity per band, band widths (x mean radius). */
const BANDS: ReadonlyArray<{ lit: boolean; alpha: number; widths: readonly number[] }> = [
  { lit: false, alpha: 0.1, widths: [1.4, 1.2, 1.0, 0.82, 0.66, 0.5, 0.36, 0.22] },
  { lit: true, alpha: 0.16, widths: [0.8, 0.62, 0.46, 0.32, 0.18] },
];

const alphaCache = new Map<string, string>();
function withAlpha(color: string, alpha: number): string {
  const key = `${color}|${alpha}`;
  let out = alphaCache.get(key);
  if (out === undefined) {
    out = toRgba(color, alpha);
    if (alphaCache.size < 256) alphaCache.set(key, out);
  }
  return out;
}

function toRgba(color: string, alpha: number): string {
  const hex = color.trim();
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, (ch) => ch + ch) : m[1];
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  return color;
}

/**
 * Draws the figure onto the canvas. `px` is the size of one hairline in output pixels (used for
 * the outline and rim widths).
 */
export function drawFigure(ctx: CanvasRenderingContext2D, fig: Figure, palette: Palette, px: number) {
  const S = fig.scale;
  const outlineW = Math.max(1.2 * px, 0.011 * S);
  const rimW = Math.max(1.4 * px, 0.016 * S);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const group of fig.groups) {
    // Silhouette outline (only its outer half survives the fills), separating the groups.
    ctx.beginPath();
    for (const part of group) partPath(ctx, part);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = outlineW * 2;
    ctx.stroke();
    for (const part of group) drawPart(ctx, part, palette, rimW);
  }
  ctx.globalAlpha = 1;
}

function drawPart(ctx: CanvasRenderingContext2D, part: Part, palette: Palette, rimW: number) {
  const tone = part.depth === "far" ? palette.far : palette.near;
  const rimAlpha = part.depth === "far" ? palette.rimFar : palette.rimNear;
  const rimClear = withAlpha(palette.rim, 0);
  ctx.beginPath();
  partPath(ctx, part);

  if (part.type === "blob") {
    const g = ctx.createRadialGradient(part.cx + LIGHT.x * part.r * 0.5, part.cy + LIGHT.y * part.r * 0.5, part.r * 0.05, part.cx, part.cy, part.r * 1.45);
    g.addColorStop(0, tone.hi);
    g.addColorStop(0.42, tone.base);
    g.addColorStop(1, tone.shade);
    ctx.fillStyle = g;
    ctx.globalAlpha = 1;
    ctx.fill();
    // Rim: an inner band along the lit edge, fading towards the centre.
    const rim = ctx.createLinearGradient(part.cx + LIGHT.x * part.r, part.cy + LIGHT.y * part.r, part.cx + LIGHT.x * part.r * 0.1, part.cy + LIGHT.y * part.r * 0.1);
    rim.addColorStop(0, palette.rim);
    rim.addColorStop(0.45, withAlpha(palette.rim, 0.55));
    rim.addColorStop(1, rimClear);
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = rimAlpha;
    ctx.strokeStyle = rim;
    ctx.lineWidth = rimW * 2;
    ctx.stroke();
    ctx.restore();
    return;
  }

  // One flat fill for the whole limb (no seams at the joints), then soft cylindrical shading:
  // stacked translucent bands along each segment's shadow and lit sides, fading at the ends.
  ctx.fillStyle = tone.base;
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.lineCap = "butt";
  for (const c of part.caps) {
    const r = (c.ar + c.br) / 2;
    for (const { lit, alpha, widths } of BANDS) {
      const end = capsuleSide(c, lit, 0);
      if (!end) continue;
      const solid = lit ? tone.hi : tone.shade;
      const soft = withAlpha(solid, 0.4);
      const g = ctx.createLinearGradient(end.x0, end.y0, end.x1, end.y1);
      g.addColorStop(0, soft);
      g.addColorStop(0.22, solid);
      g.addColorStop(0.78, solid);
      g.addColorStop(1, soft);
      ctx.strokeStyle = g;
      ctx.globalAlpha = alpha;
      for (const k of widths) {
        const width = k * r;
        const band = capsuleSide(c, lit, width / 2);
        if (!band) continue;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(band.x0, band.y0);
        ctx.quadraticCurveTo(band.cx, band.cy, band.x1, band.y1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  ctx.lineCap = "round";
  for (const c of part.caps) {
    const rim = capsuleRim(c, rimW * 0.5);
    if (!rim) continue;
    const g = ctx.createLinearGradient(rim.x0, rim.y0, rim.x1, rim.y1);
    g.addColorStop(0, rimClear);
    g.addColorStop(0.18, palette.rim);
    g.addColorStop(0.82, palette.rim);
    g.addColorStop(1, rimClear);
    ctx.globalAlpha = rimAlpha * rim.strength;
    ctx.strokeStyle = g;
    ctx.lineWidth = rimW;
    ctx.beginPath();
    ctx.moveTo(rim.x0, rim.y0);
    ctx.quadraticCurveTo(rim.cx, rim.cy, rim.x1, rim.y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/**
 * Soft contact shadow on the floor under the body parts that touch (or nearly touch) it. Points
 * fade out with height above the floor, so a jump lifts the shadow away.
 */
export function drawContactShadow(ctx: CanvasRenderingContext2D, points: readonly Vec[], floorY: number, S: number) {
  let minX = Infinity, maxX = -Infinity, weight = 0;
  for (const p of points) {
    if (!finite(p)) continue;
    const w = 1 - (floorY - p.y) / (0.55 * S);
    if (w <= 0.05) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    weight = Math.max(weight, Math.min(1, w));
  }
  if (weight <= 0) return;
  const cx = (minX + maxX) / 2;
  const rx = (maxX - minX) / 2 + 0.22 * S;
  const ry = 0.06 * S;
  ctx.save();
  ctx.translate(cx, floorY);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0, 0, 0, ${0.55 * weight})`);
  g.addColorStop(0.6, `rgba(0, 0, 0, ${0.3 * weight})`);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  arcPath(ctx, 0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- SVG --------------------------------------------------------------------------------------

/** A PathSink that records an SVG path `d` string. */
export class SvgPath implements PathSink {
  private parts: string[] = [];
  private static f(n: number) {
    return (Math.round(n * 10) / 10).toString();
  }
  moveTo(x: number, y: number) {
    this.parts.push(`M${SvgPath.f(x)} ${SvgPath.f(y)}`);
  }
  lineTo(x: number, y: number) {
    this.parts.push(`L${SvgPath.f(x)} ${SvgPath.f(y)}`);
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.parts.push(`Q${SvgPath.f(cx)} ${SvgPath.f(cy)} ${SvgPath.f(x)} ${SvgPath.f(y)}`);
  }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number) {
    this.parts.push(`C${SvgPath.f(a)} ${SvgPath.f(b)} ${SvgPath.f(c)} ${SvgPath.f(d)} ${SvgPath.f(x)} ${SvgPath.f(y)}`);
  }
  closePath() {
    this.parts.push("Z");
  }
  toString() {
    return this.parts.join("");
  }
}

export function svgPathOf(build: (sink: PathSink) => void): string {
  const s = new SvgPath();
  build(s);
  return s.toString();
}

/** The SVG rim strokes (lit capsule sides) of a chain, as path strings with an opacity. */
export function svgRims(part: ChainPart, inset: number): { d: string; opacity: number }[] {
  const out: { d: string; opacity: number }[] = [];
  for (const c of part.caps) {
    const r = capsuleRim(c, inset);
    if (!r || r.strength < 0.3) continue;
    // Trim the ends (they fade out on the canvas) so joints stay clean.
    const a = 0.16, b = 0.84;
    const pt = (t: number) => {
      const u = 1 - t;
      return v(u * u * r.x0 + 2 * u * t * r.cx + t * t * r.x1, u * u * r.y0 + 2 * u * t * r.cy + t * t * r.y1);
    };
    const s = pt(a), m = pt(0.5), e = pt(b);
    // Quadratic through s, m, e: control = 2m - (s+e)/2.
    out.push({
      d: svgPathOf((k) => {
        k.moveTo(s.x, s.y);
        k.quadraticCurveTo(2 * m.x - (s.x + e.x) / 2, 2 * m.y - (s.y + e.y) / 2, e.x, e.y);
      }),
      opacity: r.strength,
    });
  }
  return out;
}
