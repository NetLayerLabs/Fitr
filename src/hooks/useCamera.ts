"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unavailable" | "insecure" | "error";

export type CameraFacingMode = "user" | "environment";

export interface CameraDimensions {
  width: number;
  height: number;
}

export interface UseCameraOptions {
  /** Open the camera while true; tracks are stopped as soon as it turns false. */
  enabled: boolean;
  /** Initial camera. Changing this prop later switches camera too. Default "user". */
  facingMode?: CameraFacingMode;
}

export interface UseCameraResult {
  /** Attach to a <video> that stays mounted while `enabled` is true. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /**
   * idle: disabled, or paused because the page is hidden.
   * requesting: waiting for permission / the device / the first frame.
   */
  status: CameraStatus;
  /** User-facing explanation when status is denied / unavailable / insecure / error. */
  error: string | null;
  /** The requested camera (the browser may pick another if the device has only one). */
  facingMode: CameraFacingMode;
  toggleFacingMode(): void;
  /** Intrinsic video size once ready; follows orientation changes. */
  dimensions: CameraDimensions | null;
  /** Ask for the camera again (e.g. a "Try again" button after denied / error). */
  retry(): void;
}

type CameraFailure = Exclude<CameraStatus, "idle" | "requesting" | "ready">;

class CameraError extends Error {
  constructor(
    readonly status: CameraFailure,
    message: string,
  ) {
    super(message);
    this.name = "CameraError";
  }
}

const IDEAL_VIDEO: MediaTrackConstraints = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 30 },
};

/** Pause before the single retry of a NotReadableError (Android releases the previous camera slowly). */
const BUSY_RETRY_DELAY_MS = 400;

function errorName(err: unknown): string {
  if (typeof err === "object" && err !== null && "name" in err && typeof err.name === "string") return err.name;
  return "";
}

/** Map a getUserMedia / play() failure to a status and a message the UI can show as-is. */
export function classifyCameraError(err: unknown): { status: CameraFailure; message: string } {
  if (err instanceof CameraError) return { status: err.status, message: err.message };
  switch (errorName(err)) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return {
        status: "denied",
        message: "Camera access was blocked. Allow the camera for this site in your browser settings, then try again.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return { status: "unavailable", message: "No usable camera was found on this device." };
    case "NotReadableError":
    case "TrackStartError":
      return { status: "error", message: "The camera is busy. Close other apps using it and try again." };
    default: {
      const detail = err instanceof Error && err.message ? `: ${err.message}` : "";
      return { status: "error", message: `Could not start the camera${detail}` };
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openCameraStream(facingMode: CameraFacingMode, isCancelled: () => boolean): Promise<MediaStream> {
  if (window.isSecureContext === false) {
    throw new CameraError("insecure", "The camera only works over HTTPS. Open Fitr from a secure (https://) address.");
  }
  const mediaDevices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!mediaDevices || typeof mediaDevices.getUserMedia !== "function") {
    throw new CameraError("unavailable", "This browser cannot access a camera.");
  }
  try {
    return await mediaDevices.getUserMedia({ video: { ...IDEAL_VIDEO, facingMode }, audio: false });
  } catch (err) {
    const name = errorName(err);
    if (isCancelled()) throw err;
    if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
      // Some devices reject a facingMode they do not have; take whatever camera exists.
      return mediaDevices.getUserMedia({ video: { ...IDEAL_VIDEO }, audio: false });
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      await delay(BUSY_RETRY_DELAY_MS);
      if (isCancelled()) throw err;
      return mediaDevices.getUserMedia({ video: { ...IDEAL_VIDEO, facingMode }, audio: false });
    }
    throw err;
  }
}

function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function readDimensions(video: HTMLVideoElement): CameraDimensions | null {
  return video.videoWidth > 0 && video.videoHeight > 0 ? { width: video.videoWidth, height: video.videoHeight } : null;
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const getPageVisible = () => document.visibilityState !== "hidden";
const getServerPageVisible = () => true;

interface CameraSession {
  /** Which request this result belongs to: `${facingMode}:${attempt}`. */
  key: string;
  status: CameraStatus;
  error: string | null;
  dimensions: CameraDimensions | null;
}

/**
 * Own the device camera for a <video> element.
 *
 * - Safe under StrictMode: each effect run has its own cancellation flag, a stream that
 *   resolves after cancellation is stopped immediately, and runs are serialized so a new
 *   request waits for the previous one to settle (phones cannot open two cameras at once).
 * - Tracks are stopped on disable, unmount, facing-mode change, retry, and while the page
 *   is hidden (the camera light goes off in the background; it reopens on return).
 */
export function useCamera(opts: UseCameraOptions): UseCameraResult {
  const { enabled } = opts;
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [facingMode, setFacingMode] = useState<CameraFacingMode>(opts.facingMode ?? "user");
  const [facingProp, setFacingProp] = useState(opts.facingMode);
  if (opts.facingMode !== facingProp) {
    // Prop changed: adopt it (React's "adjust state on prop change" pattern, no effect needed).
    setFacingProp(opts.facingMode);
    if (opts.facingMode) setFacingMode(opts.facingMode);
  }

  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<CameraSession | null>(null);
  const visible = useSyncExternalStore(subscribeVisibility, getPageVisible, getServerPageVisible);

  /** Settles when the previous effect run has released (or never got) its stream. */
  const previousRunRef = useRef<Promise<void>>(Promise.resolve());

  const active = enabled && visible;
  const key = `${facingMode}:${attempt}`;

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;
    const isCancelled = () => cancelled;

    const onDimensions = () => {
      if (cancelled || !video) return;
      const dimensions = readDimensions(video);
      if (!dimensions) return;
      setSession((prev) =>
        prev && prev.key === key && (prev.dimensions?.width !== dimensions.width || prev.dimensions?.height !== dimensions.height)
          ? { ...prev, dimensions }
          : prev,
      );
    };

    const teardown = () => {
      if (video) {
        video.removeEventListener("loadedmetadata", onDimensions);
        video.removeEventListener("resize", onDimensions);
        if (stream && video.srcObject === stream) video.srcObject = null;
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.removeEventListener("ended", onTrackEnded));
        stopStream(stream);
      }
      stream = null;
      video = null;
    };

    // Device unplugged, permission revoked, or another app took the camera.
    function onTrackEnded() {
      if (cancelled) return;
      teardown();
      setSession({ key, status: "error", error: "The camera stopped. Try again.", dimensions: null });
    }

    const previousRun = previousRunRef.current;
    const run = (async () => {
      try {
        await previousRun;
        if (cancelled) return;

        const opened = await openCameraStream(facingMode, isCancelled);
        if (cancelled) {
          stopStream(opened);
          return;
        }
        stream = opened;

        const el = videoRef.current;
        if (!el) throw new CameraError("error", "Camera preview is not mounted.");
        video = el;
        el.muted = true;
        el.playsInline = true;
        el.autoplay = true;
        el.setAttribute("playsinline", "");
        el.addEventListener("loadedmetadata", onDimensions);
        el.addEventListener("resize", onDimensions);
        opened.getTracks().forEach((track) => track.addEventListener("ended", onTrackEnded));
        el.srcObject = opened;

        try {
          await el.play();
        } catch (err) {
          // AbortError: play() was interrupted by a newer load (srcObject swap). autoplay
          // still starts the stream, so it is not a failure for the current run.
          if (cancelled) return;
          if (errorName(err) !== "AbortError") throw err;
        }
        if (cancelled) return;
        setSession({ key, status: "ready", error: null, dimensions: readDimensions(el) });
      } catch (err) {
        if (cancelled) return;
        teardown();
        const { status, message } = classifyCameraError(err);
        setSession({ key, status, error: message, dimensions: null });
      }
    })();
    previousRunRef.current = run;

    return () => {
      cancelled = true;
      teardown();
      setSession(null);
    };
  }, [active, facingMode, key]);

  const toggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  }, []);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  const current = active && session?.key === key ? session : null;
  return {
    videoRef,
    status: !active ? "idle" : (current?.status ?? "requesting"),
    error: current?.error ?? null,
    facingMode,
    toggleFacingMode,
    dimensions: current?.dimensions ?? null,
    retry,
  };
}
