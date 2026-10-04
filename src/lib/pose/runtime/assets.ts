/**
 * Where the MediaPipe pose runtime loads its wasm and model files from.
 *
 * Local copies are staged into public/mediapipe/ by scripts/fetch-pose-assets.mjs
 * (predev / prebuild). Remote URLs are the fallback when a local file is missing.
 * Keep the remote URLs in sync with that script (assets.test.ts checks this).
 *
 * Pure constants and string helpers only: safe to import from server code.
 */

export type PoseModelVariant = "lite" | "full";

export const POSE_MODEL_VARIANTS: readonly PoseModelVariant[] = ["lite", "full"];

/** lite (~5.5 MB) keeps 30 FPS on mid-range phones; full (~9 MB) is more accurate but slower. */
export const DEFAULT_POSE_MODEL: PoseModelVariant = "lite";

export function isPoseModelVariant(value: string): value is PoseModelVariant {
  return (POSE_MODEL_VARIANTS as readonly string[]).includes(value);
}

/** Must equal the installed @mediapipe/tasks-vision version: the JS bundle and wasm must match. */
export const MEDIAPIPE_TASKS_VISION_VERSION = "1.0.1";

/** Same-origin wasm directory (public/mediapipe/wasm). */
export const LOCAL_WASM_BASE = "/mediapipe/wasm";

/** CDN wasm directory, pinned to the installed package version. */
export const REMOTE_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VISION_VERSION}/wasm`;

/** Same-origin model directory (public/mediapipe/models). */
export const LOCAL_MODEL_BASE = "/mediapipe/models";

/** Google storage model directory. Version "1" is pinned (identical bytes to "latest" today). */
export const REMOTE_MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";

export function poseModelFileName(variant: PoseModelVariant): string {
  return `pose_landmarker_${variant}.task`;
}

export function localModelPath(variant: PoseModelVariant): string {
  return `${LOCAL_MODEL_BASE}/${poseModelFileName(variant)}`;
}

export function remoteModelUrl(variant: PoseModelVariant): string {
  return `${REMOTE_MODEL_BASE}/pose_landmarker_${variant}/float16/1/${poseModelFileName(variant)}`;
}

export interface PoseAssetSource {
  kind: "local" | "remote";
  /** Directory holding vision_wasm_*_internal.{js,wasm}; passed to FilesetResolver.forVisionTasks. */
  wasmBase: string;
  /** URL of the .task model bundle. */
  modelUrl: string;
}

/** Asset sources in the order they should be tried: same-origin first, then CDN. */
export function poseAssetSources(variant: PoseModelVariant): PoseAssetSource[] {
  return [
    { kind: "local", wasmBase: LOCAL_WASM_BASE, modelUrl: localModelPath(variant) },
    { kind: "remote", wasmBase: REMOTE_WASM_BASE, modelUrl: remoteModelUrl(variant) },
  ];
}
