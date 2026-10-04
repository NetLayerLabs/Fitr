/**
 * Fitr app-icon artwork, rendered to PNG with `ImageResponse` (Satori + resvg).
 *
 * Server-only: imported by the icon routes (src/app/icon.tsx, src/app/apple-icon.tsx,
 * src/app/icons/[name]/route.tsx). Every icon is drawn from vector shapes, so no font
 * files are bundled and the output is deterministic at build time.
 *
 * Motif: a bold geometric "F" inside a rep-progress arc (a ring that is ~80% closed,
 * with a knob on its leading edge), lime #C6F432 on near-black #0A0B0D.
 */
import { ImageResponse } from "next/og";
import { BRAND_ACCENT, BRAND_ACCENT_RGB, BRAND_BACKGROUND } from "./iconSet";
import {
  ARC_END,
  ARC_PATH,
  F_BARS,
  KNOB_RADIUS,
  MARK_VIEWBOX,
  RING_RADIUS,
  RING_STROKE,
  RING_STROKE_SMALL,
  TRACK_OPACITY,
} from "./markGeometry";

const TRACK_COLOR = `rgba(${BRAND_ACCENT_RGB}, ${TRACK_OPACITY})`;

/**
 * - any:      manifest "any" icon, rounded tile on a transparent canvas.
 * - maskable: full-bleed background, artwork kept inside the central 80% safe zone
 *             (the mark's outermost point sits at 36.3% of the size from the center; the
 *             maskable spec guarantees a circle of radius 40%).
 * - apple:    full-bleed square; iOS applies its own corner mask.
 * - favicon:  tiny rounded tile with heavier strokes and no knob/track so it stays legible.
 */
export type IconVariant = "any" | "maskable" | "apple" | "favicon";

interface VariantSpec {
  /** Mark (100-unit viewBox) edge length as a fraction of the icon size. */
  markScale: number;
  /** Tile corner radius as a fraction of the size; null = full-bleed square. */
  tileRadius: number | null;
  ringStroke: number;
  showTrack: boolean;
  showKnob: boolean;
}

const VARIANTS: Record<IconVariant, VariantSpec> = {
  any: { markScale: 0.78, tileRadius: 0.22, ringStroke: RING_STROKE, showTrack: true, showKnob: true },
  maskable: { markScale: 0.78, tileRadius: null, ringStroke: RING_STROKE, showTrack: true, showKnob: true },
  apple: { markScale: 0.78, tileRadius: null, ringStroke: RING_STROKE, showTrack: true, showKnob: true },
  favicon: { markScale: 0.94, tileRadius: 0.22, ringStroke: RING_STROKE_SMALL, showTrack: false, showKnob: false },
};

// Geometry (100-unit viewBox) lives in markGeometry.ts, shared with the in-app FitrMark.
function FitrMark({ px, spec }: { px: number; spec: VariantSpec }) {
  return (
    <svg width={px} height={px} viewBox={MARK_VIEWBOX} xmlns="http://www.w3.org/2000/svg">
      {spec.showTrack ? (
        <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke={TRACK_COLOR} strokeWidth={spec.ringStroke} />
      ) : null}
      <path
        d={ARC_PATH}
        fill="none"
        stroke={BRAND_ACCENT}
        strokeWidth={spec.ringStroke}
        strokeLinecap="round"
      />
      {spec.showKnob ? <circle cx={ARC_END.x} cy={ARC_END.y} r={KNOB_RADIUS} fill={BRAND_ACCENT} /> : null}
      {/* Geometric "F": stem, top bar, middle bar (bounding box centered on 50,50). */}
      {F_BARS.map((bar, i) => (
        <rect key={i} {...bar} fill={BRAND_ACCENT} />
      ))}
    </svg>
  );
}

/** Renders the Fitr icon as a square PNG `ImageResponse` of `size` px. */
export function renderFitrIcon(size: number, variant: IconVariant): ImageResponse {
  const spec = VARIANTS[variant];
  const markPx = Math.round(size * spec.markScale);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND_BACKGROUND,
          borderRadius: spec.tileRadius === null ? 0 : Math.round(size * spec.tileRadius),
        }}
      >
        <FitrMark px={markPx} spec={spec} />
      </div>
    ),
    { width: size, height: size },
  );
}
