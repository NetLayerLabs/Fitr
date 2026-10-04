/**
 * Pure helpers that turn MediaPipe output into the app's PoseFrame contract.
 * No MediaPipe or browser imports: the input types are structural so tests can pass
 * plain objects and a real PoseLandmarkerResult is accepted as-is.
 */
import type { Landmark, PoseFrame } from "@/lib/pose/types";

/** Structural subset of MediaPipe's NormalizedLandmark / Landmark. */
export interface LandmarkLike {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/** Structural subset of MediaPipe's PoseLandmarkerResult. */
export interface PoseResultLike {
  landmarks?: ReadonlyArray<ReadonlyArray<LandmarkLike>>;
  worldLandmarks?: ReadonlyArray<ReadonlyArray<LandmarkLike>>;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function copyLandmarks(source: ReadonlyArray<LandmarkLike> | undefined): Landmark[] {
  if (!source || source.length === 0) return [];
  const out: Landmark[] = new Array(source.length);
  for (let i = 0; i < source.length; i++) {
    const lm = source[i];
    // A point without real coordinates is not a visible joint, whatever its visibility says:
    // zeroing x/y alone would turn it into a confident joint at the image corner.
    const located = Number.isFinite(lm?.x) && Number.isFinite(lm?.y);
    out[i] = {
      x: located ? lm.x : 0,
      y: located ? lm.y : 0,
      z: finiteOr(lm?.z, 0),
      // Missing or NaN visibility is treated as "not visible" so engines never trust it.
      visibility: located ? finiteOr(lm.visibility, 0) : 0,
    };
  }
  return out;
}

/**
 * Convert the first detected pose into a PoseFrame.
 * Every landmark is copied into a fresh plain object because MediaPipe may reuse its
 * result buffers on the next detect call. `landmarks` is [] when no pose was found;
 * `worldLandmarks` is only set when present.
 */
export function toPoseFrame(
  result: PoseResultLike | null | undefined,
  timestampMs: number,
  width: number,
  height: number,
): PoseFrame {
  const landmarks = copyLandmarks(result?.landmarks?.[0]);
  const frame: PoseFrame = {
    timestampMs,
    landmarks,
    imageWidth: width,
    imageHeight: height,
  };
  if (landmarks.length > 0) {
    const world = copyLandmarks(result?.worldLandmarks?.[0]);
    if (world.length > 0) frame.worldLandmarks = world;
  }
  return frame;
}

/**
 * Next strictly increasing integer-millisecond timestamp.
 * MediaPipe VIDEO mode throws if a timestamp does not increase, and it works in whole
 * microseconds internally, so timestamps are floored to whole ms and bumped by 1 ms when
 * `now` would not move forward (same-tick calls, coarse clocks, clock going backwards).
 */
export function nextTimestamp(last: number | null, now: number): number {
  const candidate = Number.isFinite(now) ? Math.floor(now) : Number.NEGATIVE_INFINITY;
  if (last === null || !Number.isFinite(last)) {
    return Number.isFinite(candidate) ? candidate : 0;
  }
  return candidate > last ? candidate : Math.floor(last) + 1;
}

/** Stateful wrapper around nextTimestamp. One clock per MediaPipe task instance. */
export class MonotonicClock {
  private last: number | null = null;

  /** Returns a timestamp strictly greater than every previous one from this clock. */
  next(now: number): number {
    const t = nextTimestamp(this.last, now);
    this.last = t;
    return t;
  }

  /** The last timestamp handed out, or null if none yet. */
  peek(): number | null {
    return this.last;
  }
}
