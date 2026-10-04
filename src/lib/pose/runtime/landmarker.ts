/**
 * MediaPipe PoseLandmarker wrapper. Browser only: call from effects or event handlers.
 *
 * `@mediapipe/tasks-vision` is imported dynamically inside loadPoseDetector, never at module
 * top level, so importing this file from a Server Component or during SSR is harmless.
 */
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseFrame } from "@/lib/pose/types";
import { DEFAULT_POSE_MODEL, poseAssetSources, type PoseAssetSource, type PoseModelVariant } from "./assets";
import { MonotonicClock, toPoseFrame } from "./convert";

export type PoseDelegate = "GPU" | "CPU";

export interface PoseDetector {
  readonly delegate: PoseDelegate;
  readonly model: PoseModelVariant;
  /**
   * Run the model on the current video frame. Timestamps are forced strictly increasing,
   * so callers may pass performance.now() directly. Throws after close().
   */
  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame;
  close(): void;
}

export interface LoadPoseDetectorOptions {
  model?: PoseModelVariant;
  /** Try the WebGL (GPU) delegate first. Default true; CPU is always the fallback. */
  preferGpu?: boolean;
}

/** Detection thresholds (MediaPipe defaults; the rep engine applies its own visibility gates). */
const MIN_POSE_DETECTION_CONFIDENCE = 0.5;
const MIN_POSE_PRESENCE_CONFIDENCE = 0.5;
const MIN_TRACKING_CONFIDENCE = 0.5;

/** How long a HEAD probe of a local asset may take before its answer counts as "unknown". */
const PROBE_TIMEOUT_MS = 2500;

/**
 * Set once the GPU delegate failed (at load while CPU worked, or at runtime), so later loads
 * skip the doomed GPU try.
 */
let gpuKnownBroken = false;

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  // Script load failures reject with a DOM Event, not an Error.
  if (typeof Event !== "undefined" && err instanceof Event) return `failed to load ${err.type === "error" ? "wasm loader script" : err.type}`;
  return String(err);
}

type ProbeResult = "present" | "missing" | "unknown";

/** True when Cache Storage (filled by the service worker) already holds the asset. */
async function inCacheStorage(url: string): Promise<boolean> {
  try {
    return typeof caches !== "undefined" && !!(await caches.match(url));
  } catch {
    // Cache Storage can be unavailable (blocked storage, some private modes).
    return false;
  }
}

/**
 * Read a response's (for HEAD: empty) body to the end. Chrome keeps even a HEAD response's body
 * stream open until something reads it, and tears an unread one down as net::ERR_ABORTED, which
 * shows up as a failed request in DevTools / CDP although the server answered 200.
 * Never rejects; the probe's answer never waits for it.
 */
function drainBody(res: Response): void {
  if (!res.body || res.bodyUsed) return;
  res.arrayBuffer().catch(() => undefined);
}

async function headProbe(url: string, signal: AbortSignal | undefined): Promise<ProbeResult> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store", signal });
    drainBody(res);
    if (res.ok) return (res.headers.get("content-type") ?? "").includes("text/html") ? "missing" : "present";
    // Only a definite "not here" rules the local copy out; 5xx etc. (a proxy during a redeploy)
    // says nothing about whether the file exists.
    return res.status === 404 || res.status === 410 ? "missing" : "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Probe a same-origin asset. An asset already in Cache Storage is "present" without touching
 * the network (the service worker serves the GET from there, but passes HEAD through to the
 * network). Otherwise a HEAD request; only a definite answer from the server ("missing":
 * 404 / 410, or an HTML error page) rules the local copy out. A network failure, a server
 * error, or no answer within PROBE_TIMEOUT_MS is "unknown", so a stalled connection can never
 * hold up a load that the cache could serve.
 */
async function probeLocalAsset(url: string): Promise<ProbeResult> {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ProbeResult>((resolve) => {
    timer = setTimeout(() => {
      controller?.abort();
      resolve("unknown");
    }, PROBE_TIMEOUT_MS);
  });
  const probe = (async (): Promise<ProbeResult> =>
    (await inCacheStorage(url)) ? "present" : headProbe(url, controller?.signal))();
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

class MediaPipePoseDetector implements PoseDetector {
  private readonly clock = new MonotonicClock();
  private closed = false;

  constructor(
    private readonly landmarker: PoseLandmarker,
    readonly delegate: PoseDelegate,
    readonly model: PoseModelVariant,
  ) {}

  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame {
    if (this.closed) throw new Error("PoseDetector.detect() called after close()");
    const ts = this.clock.next(timestampMs);
    const result = this.landmarker.detectForVideo(video, ts);
    try {
      return toPoseFrame(result, ts, video.videoWidth, video.videoHeight);
    } finally {
      // Frees segmentation masks if any (none requested); landmarks were already copied.
      result.close?.();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.landmarker.close();
    } catch {
      // Closing a landmarker whose GL context is gone can throw; nothing left to free.
    }
  }
}

/**
 * Create a new, caller-owned pose detector. The caller must close() it.
 * Tries same-origin assets first (skipped if a HEAD probe says they are missing), then the CDN;
 * for each source tries the GPU delegate, then CPU. Rejects with every attempt's error.
 */
export async function loadPoseDetector(opts: LoadPoseDetectorOptions = {}): Promise<PoseDetector> {
  if (typeof window === "undefined") {
    throw new Error("loadPoseDetector() is browser-only; call it from an effect or event handler.");
  }
  const model = opts.model ?? DEFAULT_POSE_MODEL;
  const delegates: PoseDelegate[] = opts.preferGpu === false || gpuKnownBroken ? ["CPU"] : ["GPU", "CPU"];

  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");

  const [local, remote] = poseAssetSources(model);
  const localFileset = await FilesetResolver.forVisionTasks(local.wasmBase);
  const probes = await Promise.all([probeLocalAsset(local.modelUrl), probeLocalAsset(localFileset.wasmLoaderPath)]);
  const localOk = !probes.includes("missing");
  const sources: PoseAssetSource[] = localOk ? [local, remote] : [remote];

  const failures: string[] = [];
  if (!localOk) failures.push(`local assets missing under ${local.wasmBase} or ${local.modelUrl}`);

  for (const source of sources) {
    const fileset = source === local ? localFileset : await FilesetResolver.forVisionTasks(source.wasmBase);
    let gpuFailed = false;
    for (const delegate of delegates) {
      try {
        const landmarker = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: source.modelUrl, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: MIN_POSE_DETECTION_CONFIDENCE,
          minPosePresenceConfidence: MIN_POSE_PRESENCE_CONFIDENCE,
          minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
          outputSegmentationMasks: false,
        });
        if (delegate === "CPU" && gpuFailed) gpuKnownBroken = true;
        return new MediaPipePoseDetector(landmarker, delegate, model);
      } catch (err) {
        if (delegate === "GPU") gpuFailed = true;
        failures.push(`${source.kind}/${delegate}: ${describeError(err)}`);
      }
    }
  }
  throw new Error(`Could not start pose tracking (${failures.join("; ")})`);
}

/**
 * Wrapper handed out by getSharedPoseDetector: close() is a no-op so one consumer can never
 * tear down the instance another consumer is still using; dispose() really closes it (see
 * invalidateSharedPoseDetector / closeSharedPoseDetectors).
 */
class SharedPoseDetector implements PoseDetector {
  constructor(private readonly inner: PoseDetector) {}

  get delegate(): PoseDelegate {
    return this.inner.delegate;
  }

  get model(): PoseModelVariant {
    return this.inner.model;
  }

  detect(video: HTMLVideoElement, timestampMs: number): PoseFrame {
    return this.inner.detect(video, timestampMs);
  }

  close(): void {
    // Intentionally a no-op: the instance is shared app-wide.
  }

  dispose(): void {
    this.inner.close();
  }
}

interface SharedEntry {
  promise: Promise<SharedPoseDetector>;
  /** The loaded detector once the load succeeded. */
  value: SharedPoseDetector | null;
  settled: boolean;
  /** Dropped from the cache before the load finished: dispose the result when it arrives. */
  discarded: boolean;
}

const sharedDetectors = new Map<PoseModelVariant, SharedEntry>();

/**
 * App-wide detector for a model variant, loaded once (memoized per variant) and reused across
 * workouts so the ~10 MB wasm + model is not re-downloaded and re-initialised on navigation.
 *
 * Consumers never close the shared instance: its close() is a no-op. A rejected load is
 * forgotten, so the next call retries. A detector that stops working is dropped with
 * invalidateSharedPoseDetector(), a load that seems stuck with discardPendingPoseDetector();
 * closeSharedPoseDetectors() tears everything down. Timestamps stay strictly increasing across
 * consumers because the detector owns the clock.
 */
export function getSharedPoseDetector(model: PoseModelVariant = DEFAULT_POSE_MODEL): Promise<PoseDetector> {
  const cached = sharedDetectors.get(model);
  if (cached) return cached.promise;
  const entry: SharedEntry = {
    promise: Promise.resolve(null as unknown as SharedPoseDetector),
    value: null,
    settled: false,
    discarded: false,
  };
  entry.promise = loadPoseDetector({ model }).then(
    (inner) => {
      entry.settled = true;
      const shared = new SharedPoseDetector(inner);
      if (entry.discarded) {
        shared.dispose();
        throw new Error("Pose detector load was abandoned");
      }
      entry.value = shared;
      return shared;
    },
    (err: unknown) => {
      entry.settled = true;
      if (sharedDetectors.get(model) === entry) sharedDetectors.delete(model);
      throw err;
    },
  );
  // Consumers attach their own handlers; this only keeps an abandoned load from being reported
  // as an unhandled rejection.
  entry.promise.catch(() => undefined);
  sharedDetectors.set(model, entry);
  return entry.promise;
}

/**
 * Drop a shared detector that stopped working (e.g. detect() keeps throwing after the WebGL
 * context was lost or the wasm aborted) and close it, so the next getSharedPoseDetector()
 * loads a fresh one. With `gpuBroken` a failing GPU detector also makes later loads go
 * straight to the CPU delegate. A newer detector already in the cache is never dropped.
 */
export function invalidateSharedPoseDetector(detector: PoseDetector, opts: { gpuBroken?: boolean } = {}): void {
  if (opts.gpuBroken && detector.delegate === "GPU") gpuKnownBroken = true;
  const entry = sharedDetectors.get(detector.model);
  if (entry && entry.value === detector) sharedDetectors.delete(detector.model);
  if (detector instanceof SharedPoseDetector) detector.dispose();
  else detector.close();
}

/**
 * Forget a load that has not finished yet (e.g. stuck on a stalled network) so the next
 * getSharedPoseDetector() starts a fresh one; the old load is disposed if it ever completes.
 * A finished, working detector is kept. Returns whether a load was discarded.
 */
export function discardPendingPoseDetector(model: PoseModelVariant = DEFAULT_POSE_MODEL): boolean {
  const entry = sharedDetectors.get(model);
  if (!entry || entry.settled) return false;
  entry.discarded = true;
  sharedDetectors.delete(model);
  return true;
}

/**
 * Really close every shared detector (e.g. on a low-memory signal, or in tests).
 * Anyone still holding one gets errors from detect(), so call only when no workout is running.
 */
export async function closeSharedPoseDetectors(): Promise<void> {
  const entries = [...sharedDetectors.values()];
  sharedDetectors.clear();
  for (const entry of entries) entry.discarded = true;
  for (const result of await Promise.allSettled(entries.map((e) => e.promise))) {
    if (result.status === "fulfilled") result.value.dispose();
  }
}
