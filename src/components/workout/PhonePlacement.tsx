import { EXERCISES } from "@/lib/exercises";
import { FORM_GUIDES, placementSteps } from "@/lib/formGuide";
import { EXERCISE_MODULES } from "@/lib/pose/exercises/registry";
import { LM } from "@/lib/pose/landmarks";
import type { ExerciseKind, Landmark } from "@/lib/pose/types";
import styles from "./FormGuide.module.css";
import {
  MANNEQUIN_PALETTE,
  analyzeRig,
  buildFigure,
  partPath,
  svgPathOf,
  svgRims,
  type Figure,
} from "./mannequin";

export interface PhonePlacementProps {
  exercise: ExerciseKind;
}

/** "What your phone sees": the screen, and the box inside it the body is fitted into (viewBox units). */
const SCREEN = { x: 8, y: 16, w: 84, h: 140 };
const FLOOR_Y = 146;
const BODY = { left: 14, right: 86, top: 28, bottom: FLOOR_Y };

const BODY_POINTS = [
  LM.LEFT_EAR,
  LM.RIGHT_EAR,
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_INDEX,
  LM.RIGHT_INDEX,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
  LM.LEFT_KNEE,
  LM.RIGHT_KNEE,
  LM.LEFT_ANKLE,
  LM.RIGHT_ANKLE,
  LM.LEFT_HEEL,
  LM.RIGHT_HEEL,
  LM.LEFT_FOOT_INDEX,
  LM.RIGHT_FOOT_INDEX,
];

interface Pt {
  x: number;
  y: number;
}

/**
 * The exercise's own starting pose (first frame of its form-guide demo), fitted into the body
 * box with the lowest point on the floor line. Memoized per exercise.
 */
/**
 * Which demo frame shows the exercise best in a small diagram: the start (default), the bottom
 * of the rep (smallest judged angle, for exercises defined by their low position), or the
 * tallest frame (burpee starts mid-move).
 */
const POSE_FRAME: Partial<Record<ExerciseKind, "bottom" | "tallest">> = {
  squat: "bottom",
  lunge: "bottom",
  jump_squat: "bottom",
  burpee: "tallest",
};

function pickFrame(kind: ExerciseKind) {
  const demo = EXERCISE_MODULES[kind].demo;
  const frames = demo.frames();
  const mode = POSE_FRAME[kind];
  if (mode === "tallest") {
    let best = frames[0];
    let bestH = -Infinity;
    for (const f of frames) {
      const ys = f.landmarks.map((l) => l.y).filter(Number.isFinite);
      const hgt = Math.max(...ys) - Math.min(...ys);
      if (hgt > bestH) {
        bestH = hgt;
        best = f;
      }
    }
    return best;
  }
  if (mode === "bottom" && demo.judged) {
    const [a, b, c] = demo.judged.joints;
    let best = frames[0];
    let bestDeg = Infinity;
    for (const f of frames) {
      const A = f.landmarks[a],
        B = f.landmarks[b],
        C = f.landmarks[c];
      if (!A || !B || !C) continue;
      const ax = (A.x - B.x) * f.imageWidth,
        ay = (A.y - B.y) * f.imageHeight;
      const cx = (C.x - B.x) * f.imageWidth,
        cy = (C.y - B.y) * f.imageHeight;
      const deg = Math.acos(
        Math.max(
          -1,
          Math.min(
            1,
            (ax * cx + ay * cy) /
              (Math.hypot(ax, ay) * Math.hypot(cx, cy) || 1),
          ),
        ),
      );
      if (deg < bestDeg) {
        bestDeg = deg;
        best = f;
      }
    }
    return best;
  }
  return frames[0];
}

interface PlacedFigure {
  points: Map<number, Pt>;
  head: Pt;
  figure: Figure;
}

const figureCache = new Map<ExerciseKind, PlacedFigure>();
function figureFor(kind: ExerciseKind): PlacedFigure {
  const cached = figureCache.get(kind);
  if (cached) return cached;
  const frame = pickFrame(kind);
  const rig = analyzeRig([frame]);
  const w = frame.imageWidth;
  const h = frame.imageHeight;
  const raw = new Map<number, Pt>();
  for (const i of BODY_POINTS) {
    const lm: Landmark | undefined = frame.landmarks[i];
    if (lm && Number.isFinite(lm.x) && Number.isFinite(lm.y))
      raw.set(i, { x: lm.x * w, y: lm.y * h });
  }
  // The mannequin has volume: pad the joint box by the head / limb thickness before fitting.
  const pad = 0.26 * rig.scale;
  const sole = 0.045 * rig.scale;
  const xs = [...raw.values()].map((p) => p.x);
  const ys = [...raw.values()].map((p) => p.y);
  const minX = Math.min(...xs) - pad,
    maxX = Math.max(...xs) + pad,
    minY = Math.min(...ys) - pad,
    maxY = Math.max(...ys) + sole;
  const scale = Math.min(
    (BODY.right - BODY.left) / Math.max(1, maxX - minX),
    (BODY.bottom - BODY.top) / Math.max(1, maxY - minY),
  );
  const offX = BODY.left + (BODY.right - BODY.left - (maxX - minX) * scale) / 2;
  const points = new Map<number, Pt>();
  for (const [i, p] of raw)
    points.set(i, {
      x: offX + (p.x - minX) * scale,
      y: BODY.bottom - (maxY - p.y) * scale,
    });

  const ears = [points.get(LM.LEFT_EAR), points.get(LM.RIGHT_EAR)].filter(
    (p): p is Pt => !!p,
  );
  const head = ears.length
    ? {
        x: ears.reduce((s, p) => s + p.x, 0) / ears.length,
        y: ears.reduce((s, p) => s + p.y, 0) / ears.length,
      }
    : (points.get(LM.NOSE) ?? { x: BODY.left, y: BODY.top });
  const figure = buildFigure(
    (i) => points.get(i) ?? { x: NaN, y: NaN },
    rig.view,
    rig.scale * scale,
  );
  const result = { points, head, figure };
  figureCache.set(kind, result);
  return result;
}

const OUTLINE = MANNEQUIN_PALETTE.outline;

/** The mannequin as SVG: per group a shared outline, then shaded fills and lime rim lines. */
function MannequinSvg({ figure, gradId }: { figure: Figure; gradId: string }) {
  const S = figure.scale;
  const outline = Math.max(0.9, 0.022 * S);
  const { near, far } = MANNEQUIN_PALETTE;
  return (
    <g>
      <defs>
        <linearGradient id={`${gradId}-near`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={near.hi} />
          <stop offset="0.45" stopColor={near.base} />
          <stop offset="1" stopColor={near.shade} />
        </linearGradient>
        <linearGradient id={`${gradId}-far`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor={far.hi} />
          <stop offset="1" stopColor={far.shade} />
        </linearGradient>
      </defs>
      {figure.groups.map((group, gi) => (
        <g key={gi}>
          <path
            d={svgPathOf((k) => group.forEach((part) => partPath(k, part)))}
            fill="none"
            stroke={OUTLINE}
            strokeWidth={outline * 2}
            strokeLinejoin="round"
          />
          {group.map((part, pi) => (
            <g key={pi}>
              <path
                d={svgPathOf((k) => partPath(k, part))}
                fill={`url(#${gradId}-${part.depth})`}
              />
              {part.type === "chain" &&
                svgRims(part, 0.6).map((rim, ri) => (
                  <path
                    key={ri}
                    d={rim.d}
                    fill="none"
                    style={{ stroke: "var(--accent)" }}
                    strokeWidth={0.9}
                    strokeLinecap="round"
                    opacity={rim.opacity * (part.depth === "far" ? 0.35 : 0.85)}
                  />
                ))}
            </g>
          ))}
        </g>
      ))}
    </g>
  );
}

/** Bird's-eye map: where the phone stands relative to you, which way you face, how far away. */
function TopDown({ exercise }: { exercise: ExerciseKind }) {
  const info = EXERCISES[exercise];
  const { layout, distance } = FORM_GUIDES[exercise].placement;
  const lying = layout === "floor";
  const front = info.camera === "front";
  // Mirror the map so you face the same way as in the phone's view.
  const { points, head } = figureFor(exercise);
  const nose = points.get(LM.NOSE);
  const facesRight = !front && !!nose && nose.x >= head.x;
  return (
    <svg
      className={styles.placementSvg}
      viewBox="0 0 160 170"
      aria-hidden="true"
    >
      {/* the camera's field of view */}
      <polygon points="80,128 18,20 142,20" className={styles.placementCone} />

      <g transform={facesRight ? "matrix(-1 0 0 1 160 0)" : undefined}>
        {/* equipment, behind you */}
        {info.equipment === "wall" && (
          <line
            x1="100"
            y1="24"
            x2="100"
            y2="76"
            className={styles.placementStand}
          />
        )}
        {info.equipment === "chair" && (
          <rect
            x="94"
            y="38"
            width="20"
            height="24"
            rx="3"
            className={styles.placementChair}
          />
        )}
        {info.equipment === "bar" && (
          <line
            x1="44"
            y1="46"
            x2="116"
            y2="46"
            className={styles.placementStand}
          />
        )}

        {lying ? (
          /* lying (or on hands and feet) along the mat, side-on to the phone */
          <g>
            <rect
              x="22"
              y="34"
              width="116"
              height="34"
              rx="6"
              className={styles.placementMat}
            />
            <rect
              x="84"
              y="44"
              width="46"
              height="6.5"
              rx="3.25"
              className={styles.placementLimb}
            />
            <rect
              x="84"
              y="51.5"
              width="46"
              height="6.5"
              rx="3.25"
              className={styles.placementLimb}
            />
            <rect
              x="42"
              y="41"
              width="46"
              height="20"
              rx="9"
              className={styles.placementTorso}
            />
            <circle cx="34" cy="51" r="7.5" className={styles.placementHead} />
          </g>
        ) : front ? (
          /* standing, facing the phone */
          <g>
            <ellipse
              cx="80"
              cy="50"
              rx="20"
              ry="8"
              className={styles.placementTorso}
            />
            <circle cx="80" cy="50" r="8.5" className={styles.placementHead} />
            <polygon
              points="80,63 76.5,58.5 83.5,58.5"
              className={styles.placementNose}
            />
          </g>
        ) : (
          /* standing side-on: one shoulder points at the phone */
          <g>
            <ellipse
              cx="80"
              cy="50"
              rx="8"
              ry="20"
              className={styles.placementTorso}
            />
            <circle cx="80" cy="50" r="8.5" className={styles.placementHead} />
            <polygon
              points="67,50 71.5,46.5 71.5,53.5"
              className={styles.placementNose}
            />
          </g>
        )}
      </g>
      <text
        x="80"
        y={lying ? 28 : 20}
        className={styles.placementYou}
        textAnchor="middle"
      >
        You
      </text>

      {/* distance */}
      <line
        x1="80"
        y1="122"
        x2="80"
        y2={lying ? 74 : 76}
        className={styles.placementSight}
      />
      <text x="86" y="104" className={styles.placementLabel}>
        {distance.replace(/^about /, "~")}
      </text>

      {/* the phone, lens towards you */}
      <rect
        x="71"
        y="126"
        width="18"
        height="30"
        rx="4"
        className={styles.placementPhone}
      />
      <circle cx="80" cy="131" r="2" className={styles.placementLens} />
    </svg>
  );
}

/** The phone's own view: a portrait screen with your whole body in frame. */
function CameraView({ exercise }: { exercise: ExerciseKind }) {
  const info = EXERCISES[exercise];
  const { points, head, figure } = figureFor(exercise);
  const wrists = [points.get(LM.LEFT_WRIST), points.get(LM.RIGHT_WRIST)].filter((p): p is Pt => !!p);
  const barY = info.equipment === "bar" && wrists.length ? Math.min(...wrists.map((p) => p.y)) : null;
  // The wall sits just behind the mannequin's back (the side away from the face).
  const back = [points.get(LM.LEFT_SHOULDER), points.get(LM.LEFT_HIP)].filter((p): p is Pt => !!p);
  const nose = points.get(LM.NOSE);
  const facesRight = !nose || nose.x >= head.x;
  const backDepth = 0.2 * figure.scale + 1;
  const wallX =
    info.equipment === "wall" && back.length
      ? facesRight
        ? Math.min(...back.map((p) => p.x)) - backDepth
        : Math.max(...back.map((p) => p.x)) + backDepth
      : null;
  const c = 7; // corner bracket length
  const { x, y, w, h } = SCREEN;
  const i = 4;
  return (
    <svg
      className={styles.placementSvg}
      viewBox="0 0 100 170"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="96"
        height="166"
        rx="14"
        className={styles.placementPhone}
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        className={styles.placementScreen}
      />
      <circle cx="50" cy="9" r="2" className={styles.placementLens} />
      <line
        x1={x}
        y1={FLOOR_Y}
        x2={x + w}
        y2={FLOOR_Y}
        className={styles.placementFloor}
      />
      {barY !== null && <line x1={x + 4} y1={barY} x2={x + w - 4} y2={barY} className={styles.placementStand} />}
      {wallX !== null && <line x1={wallX} y1={BODY.top} x2={wallX} y2={FLOOR_Y} className={styles.placementStand} />}
      <MannequinSvg figure={figure} gradId={`mq-${exercise}`} />
      <path
        d={`M${x + i} ${y + i + c}V${y + i}H${x + i + c} M${x + w - i - c} ${y + i}H${x + w - i}V${y + i + c} M${x + w - i} ${y + h - i - c}V${y + h - i}H${x + w - i - c} M${x + i + c} ${y + h - i}H${x + i}V${y + h - i - c}`}
        className={styles.placementBracket}
      />
    </svg>
  );
}

/** Where to put the phone: a map from above, the phone's own view, and numbered set-up steps. */
export default function PhonePlacement({ exercise }: PhonePlacementProps) {
  const steps = placementSteps(exercise);
  return (
    <div>
      <div className={styles.placementViews}>
        <figure className={styles.placementView}>
          <TopDown exercise={exercise} />
          <figcaption>From above</figcaption>
        </figure>
        <figure className={styles.placementView}>
          <CameraView exercise={exercise} />
          <figcaption>What your phone sees</figcaption>
        </figure>
      </div>
      <ol className={styles.placementSteps}>
        {steps.map((step, n) => (
          <li key={step}>
            <span className={styles.placementStepNo} aria-hidden="true">
              {n + 1}
            </span>
            <p>{step}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
