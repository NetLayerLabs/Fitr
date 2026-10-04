/**
 * Fitr brand mark geometry: a bold geometric "F" inside a rep-progress ring (a ring ~80% closed,
 * with a knob on its leading edge), in a 100-unit viewBox centered on (50, 50).
 *
 * Single source for every place the mark is drawn: the in-app FitrMark icon,
 * the in-app FitrMark (components/icons/Icons.tsx) and the offline page. Pure constants, safe
 * to import from server and client code.
 */

export const MARK_VIEWBOX = "0 0 100 100";

export const RING_RADIUS = 40;
const ARC_START_DEG = -90; // 12 o'clock
const ARC_SWEEP_DEG = 290; // clockwise; leaves a gap before 12 o'clock
export const KNOB_RADIUS = 6.5;
/** Ring stroke for normal sizes, and the heavier one used when the mark is tiny. */
export const RING_STROKE = 7;
export const RING_STROKE_SMALL = 10;
/** Opacity of the full-circle track behind the arc. */
export const TRACK_OPACITY = 0.18;

function pointOnRing(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return {
    x: +(50 + RING_RADIUS * Math.cos(rad)).toFixed(3),
    y: +(50 + RING_RADIUS * Math.sin(rad)).toFixed(3),
  };
}

export const ARC_START = pointOnRing(ARC_START_DEG);
export const ARC_END = pointOnRing(ARC_START_DEG + ARC_SWEEP_DEG);
export const ARC_PATH =
  `M ${ARC_START.x} ${ARC_START.y} ` +
  `A ${RING_RADIUS} ${RING_RADIUS} 0 ${ARC_SWEEP_DEG > 180 ? 1 : 0} 1 ${ARC_END.x} ${ARC_END.y}`;

/** The "F": stem, top bar, middle bar (bounding box centered on 50,50). */
export const F_BARS: ReadonlyArray<{ x: number; y: number; width: number; height: number; rx: number }> = [
  { x: 34.5, y: 27, width: 13, height: 46, rx: 2.5 },
  { x: 34.5, y: 27, width: 31, height: 12, rx: 2.5 },
  { x: 34.5, y: 45, width: 25, height: 11, rx: 2.5 },
];
