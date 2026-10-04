// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseFrame } from "@/lib/pose/types";
import type { PoseDetector } from "@/lib/pose/runtime/landmarker";

const runtime = vi.hoisted(() => ({
  getSharedPoseDetector: vi.fn(),
  invalidateSharedPoseDetector: vi.fn(),
  discardPendingPoseDetector: vi.fn(),
}));
vi.mock("@/lib/pose/runtime/landmarker", () => ({
  getSharedPoseDetector: runtime.getSharedPoseDetector,
  invalidateSharedPoseDetector: runtime.invalidateSharedPoseDetector,
  discardPendingPoseDetector: runtime.discardPendingPoseDetector,
}));

import { LOAD_SLOW_MS, usePoseStream, type UsePoseStreamOptions } from "../usePoseStream";

type FrameCallback = (now: number, metadata: { presentedFrames: number; mediaTime: number }) => void;

/** A <video> whose frames the test presents by hand through requestVideoFrameCallback. */
function makeVideo(opts: { rvfc?: boolean } = {}) {
  const video = document.createElement("video");
  let readyState = 4;
  Object.defineProperty(video, "readyState", { configurable: true, get: () => readyState });
  Object.defineProperty(video, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(video, "videoHeight", { configurable: true, get: () => 480 });
  const pending = new Map<number, FrameCallback>();
  let nextId = 1;
  let presented = 0;
  const cancel = vi.fn((id: number) => pending.delete(id));
  if (opts.rvfc !== false) {
    Object.assign(video, {
      requestVideoFrameCallback: (cb: FrameCallback) => {
        const id = nextId++;
        pending.set(id, cb);
        return id;
      },
      cancelVideoFrameCallback: cancel,
    });
  }
  return {
    video,
    cancel,
    pendingCount: () => pending.size,
    setReadyState: (value: number) => {
      readyState = value;
    },
    /** Present one new frame to every registered callback. */
    present(repeatSameFrame = false) {
      if (!repeatSameFrame) presented++;
      const callbacks = [...pending.values()];
      pending.clear();
      act(() => callbacks.forEach((cb) => cb(performance.now(), { presentedFrames: presented, mediaTime: presented / 30 })));
    },
  };
}

function fakeDetector(): PoseDetector & { detect: ReturnType<typeof vi.fn> } {
  return {
    delegate: "GPU",
    model: "lite",
    detect: vi.fn((video: HTMLVideoElement, timestampMs: number): PoseFrame => ({
      timestampMs,
      landmarks: [],
      imageWidth: video.videoWidth,
      imageHeight: video.videoHeight,
    })),
    close: vi.fn(),
  };
}

function renderStream(props: Partial<UsePoseStreamOptions> & { video: HTMLVideoElement }, wrapper?: (p: { children: ReactNode }) => ReactNode) {
  const { video, ...initialProps } = props;
  const videoRef = { current: video };
  const onFrame = vi.fn();
  return renderHook((p: Partial<UsePoseStreamOptions>) => usePoseStream({ videoRef, enabled: true, onFrame, ...p }), {
    initialProps,
    wrapper,
  });
}

let detector: ReturnType<typeof fakeDetector>;

beforeEach(() => {
  detector = fakeDetector();
  runtime.getSharedPoseDetector.mockReset();
  runtime.getSharedPoseDetector.mockResolvedValue(detector);
  runtime.invalidateSharedPoseDetector.mockReset();
  runtime.discardPendingPoseDetector.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePoseStream", () => {
  it("is idle when disabled", () => {
    const { video } = makeVideo();
    const { result } = renderStream({ video, enabled: false });
    expect(result.current).toMatchObject({ status: "idle", error: null, failure: null, slow: false, fps: 0, delegate: null });
    expect(runtime.getSharedPoseDetector).not.toHaveBeenCalled();
  });

  it("loads the shared detector, then processes each new frame once", async () => {
    const cam = makeVideo();
    const onFrame = vi.fn();
    const { result } = renderStream({ video: cam.video, onFrame, model: "full" });
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(runtime.getSharedPoseDetector).toHaveBeenCalledWith("full");
    expect(result.current.delegate).toBe("GPU");

    cam.present();
    cam.present(true); // same frame again: skipped
    cam.present();
    expect(detector.detect).toHaveBeenCalledTimes(2);
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(onFrame.mock.calls[0][0]).toMatchObject({ imageWidth: 640, imageHeight: 480 });
  });

  it("skips frames until the video has data", async () => {
    const cam = makeVideo();
    const { result } = renderStream({ video: cam.video });
    await waitFor(() => expect(result.current.status).toBe("running"));
    cam.setReadyState(1);
    cam.present();
    expect(detector.detect).not.toHaveBeenCalled();
    cam.setReadyState(4);
    cam.present();
    expect(detector.detect).toHaveBeenCalledTimes(1);
  });

  it("always calls the latest onFrame without restarting the loop", async () => {
    const cam = makeVideo();
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderStream({ video: cam.video, onFrame: first });
    await waitFor(() => expect(result.current.status).toBe("running"));
    cam.present();
    rerender({ onFrame: second });
    cam.present();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(runtime.getSharedPoseDetector).toHaveBeenCalledTimes(1);
  });

  it("keeps running when onFrame throws", async () => {
    const cam = makeVideo();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const onFrame = vi.fn(() => {
      throw new Error("consumer bug");
    });
    const { result } = renderStream({ video: cam.video, onFrame });
    await waitFor(() => expect(result.current.status).toBe("running"));
    cam.present();
    cam.present();
    expect(onFrame).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("running");
  });

  it("tolerates transient detect failures", async () => {
    const cam = makeVideo();
    const { result } = renderStream({ video: cam.video });
    await waitFor(() => expect(result.current.status).toBe("running"));
    detector.detect.mockImplementationOnce(() => {
      throw new Error("hiccup");
    });
    for (let i = 0; i < 5; i++) cam.present();
    expect(result.current.status).toBe("running");
    expect(detector.detect).toHaveBeenCalledTimes(5);
    expect(runtime.invalidateSharedPoseDetector).not.toHaveBeenCalled();
  });

  it("drops a detector that keeps failing, reports a runtime error, and retry() loads a fresh one", async () => {
    const cam = makeVideo();
    const onFrame = vi.fn();
    const { result } = renderStream({ video: cam.video, onFrame });
    await waitFor(() => expect(result.current.status).toBe("running"));

    detector.detect.mockImplementation(() => {
      throw new Error("GL context lost");
    });
    for (let i = 0; i < 29; i++) cam.present();
    expect(result.current.status).toBe("running");
    cam.present();
    expect(result.current.status).toBe("error");
    expect(result.current.failure).toBe("runtime");
    expect(result.current.error).toMatch(/GL context lost/);
    expect(runtime.invalidateSharedPoseDetector).toHaveBeenCalledWith(detector, { gpuBroken: true });

    // The broken instance is no longer called.
    cam.present();
    expect(detector.detect).toHaveBeenCalledTimes(30);

    const fresh = fakeDetector();
    runtime.getSharedPoseDetector.mockResolvedValue(fresh);
    act(() => result.current.retry());
    expect(runtime.discardPendingPoseDetector).toHaveBeenCalledWith("lite");
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(runtime.getSharedPoseDetector).toHaveBeenCalledTimes(2);
    expect(result.current.failure).toBeNull();
    cam.present();
    expect(fresh.detect).toHaveBeenCalledTimes(1);
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it("flags a slow load and retry() abandons it for a fresh attempt", async () => {
    vi.useFakeTimers();
    runtime.getSharedPoseDetector.mockReturnValue(new Promise<PoseDetector>(() => {}));
    const cam = makeVideo();
    const { result } = renderStream({ video: cam.video });
    expect(result.current).toMatchObject({ status: "loading", slow: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOAD_SLOW_MS + 10);
    });
    expect(result.current).toMatchObject({ status: "loading", slow: true });

    runtime.getSharedPoseDetector.mockResolvedValue(detector);
    await act(async () => {
      result.current.retry();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(runtime.discardPendingPoseDetector).toHaveBeenCalledTimes(1);
    expect(runtime.getSharedPoseDetector).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ status: "running", slow: false });
  });

  it("surfaces a detector load failure", async () => {
    runtime.getSharedPoseDetector.mockRejectedValue(new Error("offline"));
    const cam = makeVideo();
    const { result } = renderStream({ video: cam.video });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("offline");
    expect(result.current.failure).toBe("load");
    expect(cam.pendingCount()).toBe(0);
  });

  it("cancels the frame callback when disabled and ignores a late detector", async () => {
    let resolveDetector!: (d: PoseDetector) => void;
    runtime.getSharedPoseDetector.mockReturnValue(new Promise<PoseDetector>((r) => (resolveDetector = r)));
    const cam = makeVideo();
    const { result, rerender } = renderStream({ video: cam.video });
    rerender({ enabled: false });
    await act(async () => resolveDetector(detector));
    expect(result.current.status).toBe("idle");
    expect(cam.pendingCount()).toBe(0);

    rerender({ enabled: true });
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(cam.pendingCount()).toBe(1);
    rerender({ enabled: false });
    expect(cam.cancel).toHaveBeenCalled();
    expect(cam.pendingCount()).toBe(0);
  });

  it("runs a single loop under StrictMode", async () => {
    const cam = makeVideo();
    const onFrame = vi.fn();
    const { result } = renderStream({ video: cam.video, onFrame }, ({ children }) => <StrictMode>{children}</StrictMode>);
    await waitFor(() => expect(result.current.status).toBe("running"));
    expect(cam.pendingCount()).toBe(1);
    cam.present();
    expect(onFrame).toHaveBeenCalledTimes(1);
  });

  it("falls back to requestAnimationFrame with currentTime de-duplication", async () => {
    const cam = makeVideo({ rvfc: false });
    let currentTime = 0;
    Object.defineProperty(cam.video, "currentTime", { configurable: true, get: () => currentTime });
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => rafCallbacks.push(cb));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const runRaf = () => act(() => rafCallbacks.splice(0).forEach((cb) => cb(performance.now())));

    const { result } = renderStream({ video: cam.video });
    await waitFor(() => expect(result.current.status).toBe("running"));
    runRaf();
    runRaf(); // currentTime unchanged
    currentTime = 0.033;
    runRaf();
    expect(detector.detect).toHaveBeenCalledTimes(2);
  });

  it("reports fps as an EMA, pushed on a timer rather than per frame", async () => {
    const cam = makeVideo();
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    let renders = 0;
    const videoRef = { current: cam.video };
    const { result } = renderHook(() => {
      renders++;
      return usePoseStream({ videoRef, enabled: true, onFrame: () => {} });
    });
    await waitFor(() => expect(result.current.status).toBe("running"));
    const rendersBefore = renders;
    for (let i = 0; i < 60; i++) {
      now += 1000 / 30;
      cam.present();
    }
    expect(renders - rendersBefore).toBeLessThan(5);
    await waitFor(() => expect(result.current.fps).toBe(30), { timeout: 2000 });
  });
});
