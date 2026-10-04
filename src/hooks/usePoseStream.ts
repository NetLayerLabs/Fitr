"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PoseFrame } from "@/lib/pose/types";
import { DEFAULT_POSE_MODEL, type PoseModelVariant } from "@/lib/pose/runtime/assets";
import {
  discardPendingPoseDetector,
  getSharedPoseDetector,
  invalidateSharedPoseDetector,
  type PoseDelegate,
  type PoseDetector,
} from "@/lib/pose/runtime/landmarker";

export type PoseStreamStatus = "idle" | "loading" | "running" | "error";

/** Why status is "error": the model never loaded, or a loaded detector stopped working. */
export type PoseStreamFailure = "load" | "runtime";

export interface UsePoseStreamOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Run the detector loop while true (typically: camera status === "ready"). */
  enabled: boolean;
  /**
   * Called once per processed video frame, outside React rendering. The latest function is
   * always used, so an inline callback does not restart the loop. Keep it cheap: feed the
   * rep engine / draw the overlay imperatively, and only setState when something changed.
   */
  onFrame: (frame: PoseFrame) => void;
  model?: PoseModelVariant;
}

export interface UsePoseStreamResult {
  status: PoseStreamStatus;
  error: string | null;
  /** Set while status is "error". */
  failure: PoseStreamFailure | null;
  /** True once loading has taken longer than LOAD_SLOW_MS (offer retry()). */
  slow: boolean;
  /** Processed frames per second (EMA), refreshed at most every FPS_PUSH_INTERVAL_MS. 0 when stalled. */
  fps: number;
  delegate: PoseDelegate | null;
  /**
   * Start over: a load that is still pending is abandoned and a fresh detector is requested
   * (a broken one was already dropped when the error was reported).
   */
  retry(): void;
}

/** How often fps is pushed into React state (never per frame). */
const FPS_PUSH_INTERVAL_MS = 500;
/** EMA weight of the newest frame interval. */
const FPS_EMA_ALPHA = 0.15;
/** A gap longer than this resets the EMA and reports 0 fps. */
const STALL_MS = 1000;
/**
 * detect() failures in a row before the detector is treated as broken (about one second at
 * 30 FPS): it is dropped from the shared cache and status turns "error" until retry().
 */
const MAX_CONSECUTIVE_ERRORS = 30;
/** Loading longer than this sets `slow`, so the UI can offer a retry. */
export const LOAD_SLOW_MS = 15_000;
/** HTMLMediaElement.HAVE_CURRENT_DATA */
const HAVE_CURRENT_DATA = 2;

interface StreamSession {
  model: PoseModelVariant;
  status: PoseStreamStatus;
  error: string | null;
  failure: PoseStreamFailure | null;
  slow: boolean;
  fps: number;
  delegate: PoseDelegate | null;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message || err.name : String(err);
}

/**
 * Feed camera frames through the shared MediaPipe pose detector.
 *
 * Uses video.requestVideoFrameCallback when available (one callback per decoded frame),
 * falling back to requestAnimationFrame with currentTime de-duplication. Each frame is
 * processed at most once; frames are skipped until the video has data and a size.
 * Timestamps come from performance.now(); the detector makes them strictly increasing.
 */
export function usePoseStream(opts: UsePoseStreamOptions): UsePoseStreamResult {
  const { videoRef, enabled, onFrame, model = DEFAULT_POSE_MODEL } = opts;

  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const [session, setSession] = useState<StreamSession | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    // Done here (an event handler), not in the effect, so StrictMode's double effect run cannot
    // abandon the fresh load it just started.
    discardPendingPoseDetector(model);
    setAttempt((n) => n + 1);
  }, [model]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let detector: PoseDetector | null = null;
    let cancelScheduled: (() => void) | null = null;
    let scheduledOn: HTMLVideoElement | null = null;
    let fpsTimer: ReturnType<typeof setInterval> | null = null;
    let slowTimer: ReturnType<typeof setTimeout> | null = null;

    let lastFrameId: number | null = null;
    let lastProcessedAt: number | null = null;
    let emaIntervalMs: number | null = null;
    let pushedFps = 0;
    let consecutiveErrors = 0;
    let reportedCallbackError = false;

    const update = (patch: Partial<StreamSession>) => {
      setSession((prev) => (prev && prev.model === model ? { ...prev, ...patch } : prev));
    };

    const processFrame = (video: HTMLVideoElement, frameId: number) => {
      if (!detector || video.readyState < HAVE_CURRENT_DATA) return;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      if (frameId === lastFrameId) return;
      lastFrameId = frameId;

      const now = performance.now();
      let frame: PoseFrame;
      try {
        frame = detector.detect(video, now);
      } catch (err) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // Persistent failure (lost GPU context, aborted wasm...): this instance will not
          // recover. Drop it from the shared cache so retry() loads a fresh one (on CPU if the
          // GPU one broke), and stop calling it.
          invalidateSharedPoseDetector(detector, { gpuBroken: true });
          detector = null;
          update({ status: "error", error: `Pose tracking failed: ${describeError(err)}`, failure: "runtime", fps: 0 });
        }
        return;
      }
      consecutiveErrors = 0;

      if (lastProcessedAt !== null) {
        const dt = now - lastProcessedAt;
        if (dt > 0 && dt < STALL_MS) {
          emaIntervalMs = emaIntervalMs === null ? dt : emaIntervalMs + FPS_EMA_ALPHA * (dt - emaIntervalMs);
        } else {
          emaIntervalMs = null;
        }
      }
      lastProcessedAt = now;

      try {
        onFrameRef.current(frame);
      } catch (err) {
        // A consumer bug must not kill tracking; report it once per session.
        if (!reportedCallbackError) {
          reportedCallbackError = true;
          console.error("usePoseStream: onFrame threw", err);
        }
      }
    };

    const schedule = () => {
      if (cancelled) return;
      const video = videoRef.current;
      scheduledOn = video;
      if (video && typeof video.requestVideoFrameCallback === "function") {
        const id = video.requestVideoFrameCallback((_now, metadata) => {
          cancelScheduled = null;
          processFrame(video, metadata.presentedFrames);
          schedule();
        });
        cancelScheduled = () => video.cancelVideoFrameCallback(id);
      } else {
        const id = requestAnimationFrame(() => {
          cancelScheduled = null;
          const current = videoRef.current;
          if (current) processFrame(current, current.currentTime);
          schedule();
        });
        cancelScheduled = () => cancelAnimationFrame(id);
      }
    };

    const tick = () => {
      if (cancelled) return;
      // rVFC is bound to one element: re-arm if the <video> was swapped or appeared.
      if (videoRef.current !== scheduledOn) {
        cancelScheduled?.();
        cancelScheduled = null;
        schedule();
      }
      const live = lastProcessedAt !== null && performance.now() - lastProcessedAt <= STALL_MS;
      const fps = live && emaIntervalMs !== null ? Math.round(1000 / emaIntervalMs) : 0;
      if (fps !== pushedFps) {
        pushedFps = fps;
        update({ fps });
      }
    };

    slowTimer = setTimeout(() => {
      slowTimer = null;
      if (cancelled) return;
      setSession((prev) =>
        prev ?? { model, status: "loading", error: null, failure: null, slow: true, fps: 0, delegate: null },
      );
    }, LOAD_SLOW_MS);
    const clearSlowTimer = () => {
      if (slowTimer !== null) clearTimeout(slowTimer);
      slowTimer = null;
    };

    getSharedPoseDetector(model).then(
      (loaded) => {
        if (cancelled) return;
        clearSlowTimer();
        detector = loaded;
        setSession({ model, status: "running", error: null, failure: null, slow: false, fps: 0, delegate: loaded.delegate });
        schedule();
        fpsTimer = setInterval(tick, FPS_PUSH_INTERVAL_MS);
      },
      (err: unknown) => {
        if (cancelled) return;
        clearSlowTimer();
        setSession({ model, status: "error", error: describeError(err), failure: "load", slow: false, fps: 0, delegate: null });
      },
    );

    return () => {
      cancelled = true;
      cancelScheduled?.();
      cancelScheduled = null;
      if (fpsTimer !== null) clearInterval(fpsTimer);
      clearSlowTimer();
      detector = null;
      setSession(null);
    };
  }, [enabled, model, videoRef, attempt]);

  const current = enabled && session?.model === model ? session : null;
  const status: PoseStreamStatus = !enabled ? "idle" : (current?.status ?? "loading");
  return {
    status,
    error: current?.error ?? null,
    failure: status === "error" ? (current?.failure ?? null) : null,
    slow: status === "loading" && (current?.slow ?? false),
    fps: current?.fps ?? 0,
    delegate: current?.delegate ?? null,
    retry,
  };
}
