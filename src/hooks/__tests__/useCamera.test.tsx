// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCamera, type UseCameraOptions } from "../useCamera";

class FakeTrack extends EventTarget {
  stop = vi.fn(() => {
    this.readyState = "ended";
  });
  readyState: "live" | "ended" = "live";
}

class FakeStream {
  readonly tracks = [new FakeTrack()];
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks;
  }
  get stopped() {
    return this.tracks.every((t) => t.stop.mock.calls.length > 0);
  }
}

function domError(name: string) {
  return new DOMException(`${name} happened`, name);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let getUserMedia: ReturnType<typeof vi.fn>;
let streams: FakeStream[];
let playSpy: ReturnType<typeof vi.spyOn>;
let visibility: DocumentVisibilityState;

function makeVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(video, "videoHeight", { configurable: true, get: () => 480 });
  return video;
}

function setSecure(value: boolean) {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value });
}

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value });
}

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

/** Render the hook disabled, attach a <video>, then enable it (like a page that mounts the video first). */
function renderCamera(opts: Partial<UseCameraOptions> = {}, wrapper?: (p: { children: ReactNode }) => ReactNode) {
  const hook = renderHook((props: UseCameraOptions) => useCamera(props), {
    initialProps: { enabled: false, ...opts },
    wrapper,
  });
  const video = makeVideo();
  hook.result.current.videoRef.current = video;
  hook.rerender({ enabled: true, ...opts });
  return { ...hook, video };
}

beforeEach(() => {
  streams = [];
  getUserMedia = vi.fn(async () => {
    const s = new FakeStream();
    streams.push(s);
    return s as unknown as MediaStream;
  });
  setMediaDevices({ getUserMedia });
  setSecure(true);
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  playSpy = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  // Vitest runs without globals, so Testing Library cannot register its auto-cleanup.
  cleanup();
  vi.restoreAllMocks();
});

describe("useCamera status mapping", () => {
  it("is idle while disabled and never touches the camera", () => {
    const { result } = renderHook(() => useCamera({ enabled: false }));
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.dimensions).toBeNull();
    expect(result.current.facingMode).toBe("user");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("requests the camera and becomes ready", async () => {
    const { result, video } = renderCamera();
    expect(result.current.status).toBe("requesting");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false,
    });
    expect(video.srcObject).toBe(streams[0]);
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(playSpy).toHaveBeenCalled();
    expect(result.current.dimensions).toEqual({ width: 640, height: 480 });
    expect(result.current.error).toBeNull();
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "unavailable"],
    ["NotReadableError", "error"],
  ])("maps %s to %s", async (name, status) => {
    getUserMedia.mockRejectedValue(domError(name));
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe(status));
    expect(result.current.error).toEqual(expect.any(String));
    expect(result.current.dimensions).toBeNull();
  });

  it("is unavailable when the browser has no mediaDevices", async () => {
    setMediaDevices(undefined);
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
  });

  it("is insecure outside a secure context and does not call getUserMedia", async () => {
    setSecure(false);
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("insecure"));
    expect(result.current.error).toMatch(/HTTPS/);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("retries once without facingMode on OverconstrainedError", async () => {
    getUserMedia.mockRejectedValueOnce(domError("OverconstrainedError"));
    const { result } = renderCamera({ facingMode: "environment" });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[0][0].video.facingMode).toBe("environment");
    expect(getUserMedia.mock.calls[1][0].video).not.toHaveProperty("facingMode");
  });

  it("is unavailable when the facingMode-free retry also fails", async () => {
    getUserMedia.mockRejectedValue(domError("OverconstrainedError"));
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("unavailable"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("tolerates play() being aborted by a newer load", async () => {
    playSpy.mockRejectedValueOnce(domError("AbortError"));
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  it("reports an error and releases the camera when play() fails", async () => {
    playSpy.mockRejectedValueOnce(domError("NotSupportedError"));
    const { result, video } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(streams[0].stopped).toBe(true);
    expect(video.srcObject).toBeNull();
  });
});

describe("useCamera track lifecycle", () => {
  it("stops tracks on unmount", async () => {
    const { result, unmount, video } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(streams[0].stopped).toBe(false);
    unmount();
    expect(streams[0].stopped).toBe(true);
    expect(video.srcObject).toBeNull();
  });

  it("stops tracks when disabled", async () => {
    const { result, rerender } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    rerender({ enabled: false });
    expect(result.current.status).toBe("idle");
    expect(streams[0].stopped).toBe(true);
  });

  it("stops a stream that resolves after cancellation", async () => {
    const pending = deferred<MediaStream>();
    getUserMedia.mockReturnValueOnce(pending.promise);
    const { result, rerender, video } = renderCamera();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    rerender({ enabled: false });
    const late = new FakeStream();
    await act(async () => {
      pending.resolve(late as unknown as MediaStream);
      await pending.promise;
    });
    expect(late.stopped).toBe(true);
    expect(video.srcObject).not.toBe(late);
    expect(result.current.status).toBe("idle");
  });

  it("switches camera on toggleFacingMode and stops the old tracks", async () => {
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.toggleFacingMode());
    expect(result.current.facingMode).toBe("environment");
    expect(streams[0].stopped).toBe(true);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0].video.facingMode).toBe("environment");
    expect(streams[1].stopped).toBe(false);
  });

  it("pauses while the page is hidden and resumes when visible", async () => {
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    setVisibility("hidden");
    expect(result.current.status).toBe("idle");
    expect(streams[0].stopped).toBe(true);

    setVisibility("visible");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(streams[1].stopped).toBe(false);
  });

  it("reports an error when the track ends, and retry() reopens the camera", async () => {
    const { result } = renderCamera();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      streams[0].tracks[0].dispatchEvent(new Event("ended"));
    });
    expect(result.current.status).toBe("error");

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("leaves exactly one live stream under StrictMode", async () => {
    const { result, video } = renderCamera({}, ({ children }) => <StrictMode>{children}</StrictMode>);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const live = streams.filter((s) => !s.stopped);
    expect(live).toHaveLength(1);
    expect(video.srcObject).toBe(live[0]);
  });
});
