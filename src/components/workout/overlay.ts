/**
 * Imperative skeleton overlay drawing. Called once per processed frame from the pose stream
 * callback; never touches React state.
 */
import { SIDE_JOINTS, SKELETON_EDGES, SKELETON_JOINTS } from "@/lib/pose/landmarks";
import type { EngineState, ExerciseKind, Landmark, PoseFrame } from "@/lib/pose/types";

export type FitMode = "cover" | "contain";

/**
 * Maps normalized, UNMIRRORED source-image coordinates to overlay (CSS pixel) coordinates,
 * reproducing exactly what the browser does for
 *   <video style="object-fit: cover | contain; object-position: 50% 50%">
 * inside a box of viewWidth x viewHeight CSS px.
 *
 * For a source image of sw x sh px (video intrinsic size) and a box of vw x vh:
 *   cover:   s = max(vw / sw, vh / sh)   image fills the box; the overflow is cropped
 *   contain: s = min(vw / sw, vh / sh)   whole image visible; letterbox/pillarbox bars
 * The scaled image is (sw * s) x (sh * s) and centered, so its top-left corner is at
 *   ox = (vw - sw * s) / 2,   oy = (vh - sh * s) / 2
 * (negative under cover = the cropped margin; positive under contain = the bar size).
 * A normalized landmark (nx, ny) in [0, 1] therefore lands at
 *   x = ox + nx * sw * s,   y = oy + ny * sh * s.
 *
 * Mirroring (front camera) is NOT part of this mapping: the video and the canvas live in one
 * wrapper with `transform: scaleX(-1)`, so both flip together and drawing stays unmirrored.
 */
export interface OverlayMapping {
  viewWidth: number;
  viewHeight: number;
  /** CSS px per source-image px. */
  scale: number;
  /** Position of the scaled image's top-left corner inside the view (CSS px). */
  offsetX: number;
  offsetY: number;
  /** Size of the scaled source image (CSS px). */
  contentWidth: number;
  contentHeight: number;
}

function positive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

/** Returns null when any size is missing (e.g. video metadata not loaded yet). */
export function computeMapping(
  sourceWidth: number,
  sourceHeight: number,
  viewWidth: number,
  viewHeight: number,
  fit: FitMode,
): OverlayMapping | null {
  if (!positive(sourceWidth) || !positive(sourceHeight) || !positive(viewWidth) || !positive(viewHeight)) {
    return null;
  }
  const sx = viewWidth / sourceWidth;
  const sy = viewHeight / sourceHeight;
  const scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
  const contentWidth = sourceWidth * scale;
  const contentHeight = sourceHeight * scale;
  return {
    viewWidth,
    viewHeight,
    scale,
    offsetX: (viewWidth - contentWidth) / 2,
    offsetY: (viewHeight - contentHeight) / 2,
    contentWidth,
    contentHeight,
  };
}

/** Normalized source coordinates -> overlay CSS px. */
export function mapPoint(mapping: OverlayMapping, nx: number, ny: number): { x: number; y: number } {
  return {
    x: mapping.offsetX + nx * mapping.contentWidth,
    y: mapping.offsetY + ny * mapping.contentHeight,
  };
}

/** Whether a normalized point is actually visible in the view (i.e. not cropped by cover). */
export function isPointInView(mapping: OverlayMapping, nx: number, ny: number): boolean {
  const { x, y } = mapPoint(mapping, nx, ny);
  return x >= 0 && y >= 0 && x <= mapping.viewWidth && y <= mapping.viewHeight;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

export const OVERLAY_COLORS = {
  /** Lime accent (keep in sync with --accent in globals.css; canvas cannot read CSS vars cheaply per frame). */
  accent: "#C6F432",
  warning: "#FFB020",
  jointCore: "#0A0B0D",
  labelBg: "rgba(10, 11, 13, 0.82)",
} as const;

/** Joints/edges at or above this visibility are drawn at full strength. */
export const VISIBLE_THRESHOLD = 0.5;
/** Below this they are hidden; between the two they are drawn dimmed. */
export const DIM_THRESHOLD = 0.2;
const DIM_ALPHA = 0.3;

export interface DrawOptions {
  /** devicePixelRatio the canvas backing store was sized with (canvas.width = cssWidth * dpr). */
  dpr: number;
  /** True when the canvas is displayed mirrored via CSS; labels are counter-flipped to stay readable. */
  mirrored: boolean;
  /** Font family for labels (canvas cannot resolve CSS variables). */
  fontFamily?: string;
}

type JointName = keyof (typeof SIDE_JOINTS)["left"];

/** The joint each engine judges (highlighted on the live overlay). */
const PRIMARY_JOINT: Record<ExerciseKind, JointName> = {
  pushup: "elbow",
  squat: "knee",
  plank: "hip",
  lunge: "knee",
  situp: "hip",
  leg_raise: "hip",
  glute_bridge: "hip",
  wall_sit: "knee",
  pike_pushup: "elbow",
  jump_squat: "knee",
  pullup: "elbow",
  dip: "elbow",
  burpee: "hip",
  mountain_climber: "knee",
  jumping_jack: "shoulder",
  high_knees: "knee",
};

function visibilityOf(landmarks: readonly Landmark[], index: number): number {
  return landmarks[index]?.visibility ?? 0;
}

/**
 * Landmark index of the joint whose angle the engine is reading (elbow for push-ups, knee for
 * squats, hip for the plank body line) on the engine's active side. For side "both" the more
 * visible side is used. Null while the engine has no side (searching).
 */
export function primaryJointIndex(
  exercise: ExerciseKind,
  side: EngineState["side"],
  landmarks: readonly Landmark[],
): number | null {
  if (side === null || landmarks.length === 0) return null;
  const joint = PRIMARY_JOINT[exercise];
  if (side === "left" || side === "right") return SIDE_JOINTS[side][joint];
  const left = SIDE_JOINTS.left[joint];
  const right = SIDE_JOINTS.right[joint];
  return visibilityOf(landmarks, left) >= visibilityOf(landmarks, right) ? left : right;
}

function strokeSegments(
  ctx: CanvasRenderingContext2D,
  segments: ReadonlyArray<readonly [number, number, number, number]>,
) {
  if (segments.length === 0) return;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segments) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

function fillCircles(ctx: CanvasRenderingContext2D, points: ReadonlyArray<readonly [number, number]>, r: number) {
  if (points.length === 0) return;
  ctx.beginPath();
  for (const [x, y] of points) {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/**
 * Clears the canvas and draws the skeleton for one frame.
 * - edges (SKELETON_EDGES) and joints (SKELETON_JOINTS) in accent lime, amber while the
 *   engine reports form issues;
 * - landmarks with visibility < VISIBLE_THRESHOLD are dimmed, < DIM_THRESHOLD hidden;
 * - the primary joint on the active side gets a ring and its angle label (e.g. "87°");
 * - nothing but the clear happens when there is no pose or no mapping.
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  frame: PoseFrame,
  state: EngineState,
  mapping: OverlayMapping | null,
  opts: DrawOptions,
): void {
  const { canvas } = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const landmarks = frame.landmarks;
  if (!mapping || landmarks.length === 0) return;

  const dpr = positive(opts.dpr) ? opts.dpr : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const color = state.formIssues.length > 0 ? OVERLAY_COLORS.warning : OVERLAY_COLORS.accent;
  // Scale strokes with the view so the overlay reads the same on phones and desktops.
  const unit = Math.max(2, Math.min(mapping.viewWidth, mapping.viewHeight) / 130);

  const strong: Array<[number, number, number, number]> = [];
  const dim: Array<[number, number, number, number]> = [];
  for (const [a, b] of SKELETON_EDGES) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    const vis = Math.min(la.visibility, lb.visibility);
    if (vis < DIM_THRESHOLD) continue;
    const p = mapPoint(mapping, la.x, la.y);
    const q = mapPoint(mapping, lb.x, lb.y);
    (vis >= VISIBLE_THRESHOLD ? strong : dim).push([p.x, p.y, q.x, q.y]);
  }

  const strongJoints: Array<[number, number]> = [];
  const dimJoints: Array<[number, number]> = [];
  for (const index of SKELETON_JOINTS) {
    const lm = landmarks[index];
    if (!lm || lm.visibility < DIM_THRESHOLD) continue;
    const p = mapPoint(mapping, lm.x, lm.y);
    (lm.visibility >= VISIBLE_THRESHOLD ? strongJoints : dimJoints).push([p.x, p.y]);
  }

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Dimmed (low-visibility) parts first so strong ones draw on top.
  ctx.globalAlpha = DIM_ALPHA;
  ctx.lineWidth = unit * 0.75;
  strokeSegments(ctx, dim);
  fillCircles(ctx, dimJoints, unit * 1.1);

  // Cheap glow: a wide translucent pass under the core stroke (no shadowBlur per frame).
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = unit * 3.2;
  strokeSegments(ctx, strong);

  ctx.globalAlpha = 1;
  ctx.lineWidth = unit;
  strokeSegments(ctx, strong);
  fillCircles(ctx, strongJoints, unit * 1.5);
  ctx.fillStyle = OVERLAY_COLORS.jointCore;
  fillCircles(ctx, strongJoints, unit * 0.6);

  // Primary joint highlight + angle label.
  const primary = primaryJointIndex(state.exercise, state.side, landmarks);
  const lm = primary === null ? undefined : landmarks[primary];
  if (lm && lm.visibility >= DIM_THRESHOLD) {
    const { x, y } = mapPoint(mapping, lm.x, lm.y);
    const ringRadius = unit * 4.2;
    ctx.globalAlpha = lm.visibility >= VISIBLE_THRESHOLD ? 1 : DIM_ALPHA;
    ctx.strokeStyle = color;
    ctx.lineWidth = unit * 0.9;
    ctx.beginPath();
    ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    if (state.primaryAngleDeg !== null && Number.isFinite(state.primaryAngleDeg)) {
      drawAngleLabel(ctx, `${Math.round(state.primaryAngleDeg)}°`, x, y, ringRadius, unit, color, mapping, opts);
    }
  }

  ctx.globalAlpha = 1;
}

function drawAngleLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  jointX: number,
  jointY: number,
  ringRadius: number,
  unit: number,
  color: string,
  mapping: OverlayMapping,
  opts: DrawOptions,
) {
  const fontSize = Math.round(Math.max(14, unit * 5.5));
  ctx.font = `700 ${fontSize}px ${opts.fontFamily ?? "system-ui, sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padX = fontSize * 0.45;
  const w = ctx.measureText(text).width + padX * 2;
  const h = fontSize * 1.5;

  // Place the pill above-right of the joint (in on-screen terms), clamped inside the view.
  // With a mirrored display, "screen right" is canvas left.
  const dir = opts.mirrored ? -1 : 1;
  const margin = 4;
  let cx = jointX + dir * (ringRadius + w / 2 + unit);
  let cy = jointY - ringRadius - h / 2;
  cx = Math.min(Math.max(cx, w / 2 + margin), mapping.viewWidth - w / 2 - margin);
  cy = Math.min(Math.max(cy, h / 2 + margin), mapping.viewHeight - h / 2 - margin);

  ctx.save();
  ctx.translate(cx, cy);
  // Counter-flip so the text reads correctly after the wrapper's scaleX(-1).
  if (opts.mirrored) ctx.scale(-1, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = OVERLAY_COLORS.labelBg;
  roundedRectPath(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 1);
  ctx.restore();
}
