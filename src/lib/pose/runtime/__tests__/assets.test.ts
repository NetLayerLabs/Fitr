import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_POSE_MODEL,
  LOCAL_MODEL_BASE,
  LOCAL_WASM_BASE,
  MEDIAPIPE_TASKS_VISION_VERSION,
  POSE_MODEL_VARIANTS,
  REMOTE_MODEL_BASE,
  REMOTE_WASM_BASE,
  isPoseModelVariant,
  localModelPath,
  poseAssetSources,
  poseModelFileName,
  remoteModelUrl,
} from "../assets";

const ROOT = process.cwd();

describe("pose assets", () => {
  it("builds same-origin paths under /mediapipe", () => {
    expect(LOCAL_WASM_BASE).toBe("/mediapipe/wasm");
    expect(localModelPath("lite")).toBe("/mediapipe/models/pose_landmarker_lite.task");
    expect(localModelPath("full")).toBe("/mediapipe/models/pose_landmarker_full.task");
    expect(poseModelFileName("full")).toBe("pose_landmarker_full.task");
  });

  it("builds the official Google storage model URLs", () => {
    expect(remoteModelUrl("lite")).toBe(
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
    );
    expect(remoteModelUrl("full")).toBe(
      "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
    );
  });

  it("pins the CDN wasm to the installed @mediapipe/tasks-vision version", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(ROOT, "node_modules/@mediapipe/tasks-vision/package.json"), "utf8"),
    ) as { version: string };
    expect(MEDIAPIPE_TASKS_VISION_VERSION).toBe(pkg.version);
    expect(REMOTE_WASM_BASE).toBe(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${pkg.version}/wasm`);
  });

  it("lists local before remote for every variant", () => {
    for (const variant of POSE_MODEL_VARIANTS) {
      const [local, remote] = poseAssetSources(variant);
      expect(local).toEqual({ kind: "local", wasmBase: LOCAL_WASM_BASE, modelUrl: localModelPath(variant) });
      expect(remote).toEqual({ kind: "remote", wasmBase: REMOTE_WASM_BASE, modelUrl: remoteModelUrl(variant) });
    }
  });

  it("validates variants", () => {
    expect(DEFAULT_POSE_MODEL).toBe("lite");
    expect(isPoseModelVariant("lite")).toBe(true);
    expect(isPoseModelVariant("full")).toBe(true);
    expect(isPoseModelVariant("heavy")).toBe(false);
  });

  it("stays in sync with scripts/fetch-pose-assets.mjs", () => {
    const script = readFileSync(path.join(ROOT, "scripts/fetch-pose-assets.mjs"), "utf8");
    expect(script).toContain(`"${REMOTE_MODEL_BASE}"`);
    expect(script).toContain("/float16/1/pose_landmarker_");
    expect(script).toContain(`const MODEL_VARIANTS = ${JSON.stringify(POSE_MODEL_VARIANTS).replace(/,/g, ", ")}`);
    // Script output dirs are public/<LOCAL_*_BASE>.
    expect(LOCAL_WASM_BASE).toBe("/mediapipe/wasm");
    expect(LOCAL_MODEL_BASE).toBe("/mediapipe/models");
    expect(script).toContain('path.join(ROOT, "public", "mediapipe")');
    expect(script).toContain('path.join(OUT_DIR, "wasm")');
    expect(script).toContain('path.join(OUT_DIR, "models")');
  });
});
