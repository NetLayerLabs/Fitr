#!/usr/bin/env node
/**
 * Stage MediaPipe pose assets under public/mediapipe/ so the app can serve them same-origin
 * (offline-capable PWA, no third-party CDN at runtime). Runs from predev / prebuild / assets:pose.
 *
 *   public/mediapipe/wasm/    <- copied from node_modules/@mediapipe/tasks-vision/wasm/
 *   public/mediapipe/models/  <- pose_landmarker_{lite,full}.task downloaded from Google storage
 *
 * Idempotent: wasm files are skipped when size + mtime already match the installed package;
 * models are skipped when present. Downloads go to a temp file and are renamed into place.
 *
 * This script must never fail the build: every problem is a WARN and the process exits 0.
 * The runtime (src/lib/pose/runtime/landmarker.ts) falls back to the remote URLs when a
 * local asset is missing. Keep the URLs below in sync with src/lib/pose/runtime/assets.ts
 * (assets.test.ts checks this).
 *
 * Env: FITR_SKIP_POSE_MODELS=1 skips the model downloads (e.g. offline CI).
 */
import { copyFile, mkdir, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG_DIR = path.join(ROOT, "node_modules", "@mediapipe", "tasks-vision");
const WASM_SRC = path.join(PKG_DIR, "wasm");
const OUT_DIR = path.join(ROOT, "public", "mediapipe");
const WASM_OUT = path.join(OUT_DIR, "wasm");
const MODELS_OUT = path.join(OUT_DIR, "models");

const MODEL_BASE_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
const MODEL_VARIANTS = ["lite", "full"];
const DOWNLOAD_TIMEOUT_MS = 120_000;
/** Real .task files are several MB; anything tiny is an error page, not a model. */
const MIN_MODEL_BYTES = 1_000_000;

const TAG = "[pose-assets]";
const log = (msg) => console.log(`${TAG} ${msg}`);
const warn = (msg) => console.warn(`${TAG} WARN ${msg}`);

function modelUrl(variant) {
  return `${MODEL_BASE_URL}/pose_landmarker_${variant}/float16/1/pose_landmarker_${variant}.task`;
}

function mb(bytes) {
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

async function statOrNull(file) {
  try {
    return await stat(file);
  } catch {
    return null;
  }
}

async function copyWasm() {
  let entries;
  try {
    entries = (await readdir(WASM_SRC, { withFileTypes: true })).filter((e) => e.isFile());
  } catch {
    warn(`${path.relative(ROOT, WASM_SRC)} not found (is @mediapipe/tasks-vision installed?); runtime will use the CDN`);
    return;
  }
  await mkdir(WASM_OUT, { recursive: true });
  let copied = 0;
  let skipped = 0;
  for (const entry of entries) {
    const src = path.join(WASM_SRC, entry.name);
    const dest = path.join(WASM_OUT, entry.name);
    const [s, d] = await Promise.all([stat(src), statOrNull(dest)]);
    // Size alone would miss a same-size package upgrade, so the copy carries the source mtime.
    if (d && d.size === s.size && Math.trunc(d.mtimeMs / 1000) === Math.trunc(s.mtimeMs / 1000)) {
      skipped++;
      continue;
    }
    const tmp = `${dest}.tmp-${process.pid}`;
    await copyFile(src, tmp);
    await utimes(tmp, s.atime, s.mtime);
    await rename(tmp, dest);
    copied++;
  }
  log(`wasm: ${copied} copied, ${skipped} up to date -> public/mediapipe/wasm`);
}

async function downloadModel(variant) {
  const name = `pose_landmarker_${variant}.task`;
  const dest = path.join(MODELS_OUT, name);
  const existing = await statOrNull(dest);
  if (existing && existing.size >= MIN_MODEL_BYTES) {
    log(`model: ${name} present (${mb(existing.size)})`);
    return;
  }
  const url = modelUrl(variant);
  const tmp = `${dest}.download-${process.pid}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const expected = Number(res.headers.get("content-length"));
    if (Number.isFinite(expected) && expected > 0 && buf.length !== expected) {
      throw new Error(`truncated (${buf.length}/${expected} bytes)`);
    }
    if (buf.length < MIN_MODEL_BYTES) throw new Error(`unexpectedly small (${buf.length} bytes)`);
    await writeFile(tmp, buf);
    await rename(tmp, dest);
    log(`model: ${name} downloaded (${mb(buf.length)})`);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    const reason = err instanceof Error ? err.message : String(err);
    warn(`could not download ${name} (${reason}); runtime will fetch ${url}`);
  }
}

async function downloadModels() {
  if (process.env.FITR_SKIP_POSE_MODELS === "1") {
    log("model: download skipped (FITR_SKIP_POSE_MODELS=1)");
    return;
  }
  await mkdir(MODELS_OUT, { recursive: true });
  await Promise.all(MODEL_VARIANTS.map(downloadModel));
}

async function main() {
  try {
    await copyWasm();
  } catch (err) {
    warn(`wasm copy failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    await downloadModels();
  } catch (err) {
    warn(`model download failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

main()
  .catch((err) => warn(`unexpected error: ${err instanceof Error ? err.message : String(err)}`))
  .finally(() => {
    process.exitCode = 0;
  });
