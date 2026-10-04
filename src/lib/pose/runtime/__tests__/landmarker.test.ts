import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseResultLike } from "../convert";

const mp = vi.hoisted(() => ({
  createFromOptions: vi.fn(),
  forVisionTasks: vi.fn(async (base: string) => ({
    wasmLoaderPath: `${base}/vision_wasm_internal.js`,
    wasmBinaryPath: `${base}/vision_wasm_internal.wasm`,
  })),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mp.forVisionTasks },
  PoseLandmarker: { createFromOptions: mp.createFromOptions },
}));

type Landmarker = typeof import("../landmarker");
type PoseResult = PoseResultLike & { close: () => void };

function fakeLandmarker() {
  return {
    detectForVideo: vi.fn<(video: unknown, timestampMs: number) => PoseResult>(() => ({
      landmarks: [[{ x: 0.1, y: 0.2, z: 0, visibility: 0.9 }]],
      worldLandmarks: [],
      close: vi.fn(),
    })),
    close: vi.fn(),
  };
}

type CreateOptions = { baseOptions: { modelAssetPath: string; delegate: "GPU" | "CPU" } } & Record<string, unknown>;

function attempts(): string[] {
  return mp.createFromOptions.mock.calls.map((call) => {
    const [fileset, options] = call as [{ wasmLoaderPath: string }, CreateOptions];
    const where = fileset.wasmLoaderPath.startsWith("/mediapipe") ? "local" : "remote";
    return `${where}/${options.baseOptions.delegate}`;
  });
}

const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;

let fetchMock: ReturnType<typeof vi.fn>;
let lib: Landmarker;

beforeEach(async () => {
  vi.resetModules();
  mp.createFromOptions.mockReset();
  mp.forVisionTasks.mockClear();
  vi.stubGlobal("window", {});
  fetchMock = vi.fn(async () => new Response(null, { status: 200, headers: { "content-type": "application/octet-stream" } }));
  vi.stubGlobal("fetch", fetchMock);
  lib = await import("../landmarker");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("loadPoseDetector", () => {
  it("uses local assets and the GPU delegate when both work", async () => {
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    const detector = await lib.loadPoseDetector({ model: "full" });

    expect(detector.delegate).toBe("GPU");
    expect(detector.model).toBe("full");
    expect(attempts()).toEqual(["local/GPU"]);
    const options = mp.createFromOptions.mock.calls[0][1] as CreateOptions;
    expect(options).toMatchObject({
      baseOptions: { modelAssetPath: "/mediapipe/models/pose_landmarker_full.task", delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
      outputSegmentationMasks: false,
    });
    expect(fetchMock).toHaveBeenCalledWith("/mediapipe/models/pose_landmarker_full.task", expect.objectContaining({ method: "HEAD" }));
  });

  it("falls back to CPU, and skips GPU on later loads once it is known broken", async () => {
    mp.createFromOptions.mockImplementation(async (_fs: unknown, options: CreateOptions) => {
      if (options.baseOptions.delegate === "GPU") throw new Error("no WebGL2");
      return fakeLandmarker();
    });
    const first = await lib.loadPoseDetector();
    expect(first.delegate).toBe("CPU");
    expect(first.model).toBe("lite");
    expect(attempts()).toEqual(["local/GPU", "local/CPU"]);

    mp.createFromOptions.mockClear();
    await lib.loadPoseDetector({ model: "full" });
    expect(attempts()).toEqual(["local/CPU"]);
  });

  it("goes straight to the CDN when local assets are missing", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();

    expect(attempts()).toEqual(["remote/GPU"]);
    const [fileset, options] = mp.createFromOptions.mock.calls[0] as [{ wasmLoaderPath: string }, CreateOptions];
    expect(fileset.wasmLoaderPath).toBe("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm/vision_wasm_internal.js");
    expect(options.baseOptions.modelAssetPath).toContain("https://storage.googleapis.com/mediapipe-models/pose_landmarker/");
  });

  it("treats an HTML response as a missing local asset", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { "content-type": "text/html" } }));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector({ preferGpu: false });
    expect(attempts()).toEqual(["remote/CPU"]);
  });

  it("still tries local first when the probe cannot reach the network (offline + service worker)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["local/GPU"]);
  });

  it("does not let a stalled probe block the load: after the probe timeout local is tried", async () => {
    vi.useFakeTimers();
    const signals: (AbortSignal | undefined)[] = [];
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      signals.push(init?.signal ?? undefined);
      return new Promise<Response>(() => {}); // never settles (lie-fi)
    });
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    const loading = lib.loadPoseDetector();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mp.createFromOptions).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    const detector = await loading;
    expect(detector.delegate).toBe("GPU");
    expect(attempts()).toEqual(["local/GPU"]);
    // The stalled requests were aborted.
    expect(signals.length).toBe(2);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
  });

  it("reads each HEAD response's body to the end, so Chrome does not abort the finished request", async () => {
    const responses: Response[] = [];
    fetchMock.mockImplementation(async () => {
      // A body stream, like Chrome hands out even for HEAD (the empty string is not a null body).
      const res = new Response("", { status: 200, headers: { "content-type": "application/octet-stream" } });
      responses.push(res);
      return res;
    });
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["local/GPU"]);
    expect(responses).toHaveLength(2);
    expect(responses.every((res) => res.bodyUsed)).toBe(true);
  });

  it("still tries local first when the probe gets a server error (5xx says nothing about the file)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["local/GPU"]);
  });

  it("treats 410 like 404 (local copy missing)", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["remote/GPU"]);
  });

  it("skips the network probe for assets already in Cache Storage", async () => {
    const match = vi.fn(async () => new Response("cached"));
    vi.stubGlobal("caches", { match });
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(match).toHaveBeenCalledWith("/mediapipe/models/pose_landmarker_lite.task");
    expect(attempts()).toEqual(["local/GPU"]);
  });

  it("falls back to a HEAD probe when Cache Storage misses or throws", async () => {
    vi.stubGlobal("caches", { match: vi.fn(async () => undefined) });
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["remote/GPU"]);

    mp.createFromOptions.mockClear();
    vi.stubGlobal("caches", {
      match: vi.fn(async () => {
        throw new Error("SecurityError");
      }),
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 200, headers: { "content-type": "application/wasm" } }));
    await lib.loadPoseDetector();
    expect(attempts()).toEqual(["local/GPU"]);
  });

  it("tries local then remote, GPU then CPU, and reports every failure", async () => {
    mp.createFromOptions.mockRejectedValue(new Error("boom"));
    await expect(lib.loadPoseDetector()).rejects.toThrow(/local\/GPU: boom.*local\/CPU: boom.*remote\/GPU: boom.*remote\/CPU: boom/);
    expect(attempts()).toEqual(["local/GPU", "local/CPU", "remote/GPU", "remote/CPU"]);
  });

  it("refuses to run without a window (SSR)", async () => {
    vi.stubGlobal("window", undefined);
    await expect(lib.loadPoseDetector()).rejects.toThrow(/browser-only/);
    expect(mp.createFromOptions).not.toHaveBeenCalled();
  });
});

describe("PoseDetector", () => {
  it("forces strictly increasing timestamps and reports video size", async () => {
    const landmarker = fakeLandmarker();
    mp.createFromOptions.mockResolvedValue(landmarker);
    const detector = await lib.loadPoseDetector();

    const a = detector.detect(video, 100.4);
    const b = detector.detect(video, 100.4);
    const c = detector.detect(video, 50);
    expect([a.timestampMs, b.timestampMs, c.timestampMs]).toEqual([100, 101, 102]);
    expect(landmarker.detectForVideo.mock.calls.map((call) => call[1])).toEqual([100, 101, 102]);
    expect(a).toMatchObject({ imageWidth: 640, imageHeight: 480 });
    expect(a.landmarks).toEqual([{ x: 0.1, y: 0.2, z: 0, visibility: 0.9 }]);
  });

  it("guards use after close and closes the landmarker once", async () => {
    const landmarker = fakeLandmarker();
    mp.createFromOptions.mockResolvedValue(landmarker);
    const detector = await lib.loadPoseDetector();
    detector.close();
    detector.close();
    expect(landmarker.close).toHaveBeenCalledTimes(1);
    expect(() => detector.detect(video, 1)).toThrow(/after close/);
  });
});

describe("getSharedPoseDetector", () => {
  it("memoizes per variant and ignores consumer close()", async () => {
    const landmarker = fakeLandmarker();
    mp.createFromOptions.mockResolvedValue(landmarker);

    const [a, b] = await Promise.all([lib.getSharedPoseDetector(), lib.getSharedPoseDetector("lite")]);
    expect(a).toBe(b);
    expect(mp.createFromOptions).toHaveBeenCalledTimes(1);

    a.close();
    expect(landmarker.close).not.toHaveBeenCalled();
    expect(b.detect(video, 5).timestampMs).toBe(5);

    const full = await lib.getSharedPoseDetector("full");
    expect(full).not.toBe(a);
    expect(full.model).toBe("full");
    expect(mp.createFromOptions).toHaveBeenCalledTimes(2);
  });

  it("forgets a failed load so the next call retries", async () => {
    mp.createFromOptions.mockRejectedValue(new Error("offline"));
    await expect(lib.getSharedPoseDetector()).rejects.toThrow(/offline/);

    mp.createFromOptions.mockReset();
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    const detector = await lib.getSharedPoseDetector();
    expect(detector.delegate).toBe("GPU");
  });

  it("invalidating a broken detector closes it and makes the next call load a fresh one on CPU", async () => {
    const broken = fakeLandmarker();
    mp.createFromOptions.mockResolvedValue(broken);
    const first = await lib.getSharedPoseDetector();
    expect(first.delegate).toBe("GPU");
    broken.detectForVideo.mockImplementation(() => {
      throw new Error("RuntimeError: Aborted()");
    });
    expect(() => first.detect(video, 1)).toThrow(/Aborted/);

    lib.invalidateSharedPoseDetector(first, { gpuBroken: true });
    expect(broken.close).toHaveBeenCalledTimes(1);

    const healthy = fakeLandmarker();
    mp.createFromOptions.mockClear();
    mp.createFromOptions.mockResolvedValue(healthy);
    const second = await lib.getSharedPoseDetector();
    expect(second).not.toBe(first);
    expect(attempts()).toEqual(["local/CPU"]);
    expect(second.detect(video, 2).landmarks).toHaveLength(1);
  });

  it("invalidating a stale detector never drops the newer one in the cache", async () => {
    mp.createFromOptions.mockImplementation(async () => fakeLandmarker());
    const first = await lib.getSharedPoseDetector();
    lib.invalidateSharedPoseDetector(first);
    const second = await lib.getSharedPoseDetector();
    lib.invalidateSharedPoseDetector(first);
    expect(await lib.getSharedPoseDetector()).toBe(second);
    expect(mp.createFromOptions).toHaveBeenCalledTimes(2);
  });

  it("a load stuck on the network can be discarded; the next call starts over", async () => {
    let finishFirst!: (value: unknown) => void;
    const stuck = fakeLandmarker();
    mp.createFromOptions.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
    const hung = lib.getSharedPoseDetector();
    await vi.waitFor(() => expect(mp.createFromOptions).toHaveBeenCalledTimes(1));
    expect(lib.getSharedPoseDetector()).toBe(hung);

    expect(lib.discardPendingPoseDetector("lite")).toBe(true);
    mp.createFromOptions.mockResolvedValue(fakeLandmarker());
    const fresh = await lib.getSharedPoseDetector();
    expect(fresh.delegate).toBe("GPU");

    // The abandoned load finishing later is closed, not leaked, and does not replace the fresh one.
    finishFirst(stuck);
    await expect(hung).rejects.toThrow(/abandoned/);
    expect(stuck.close).toHaveBeenCalledTimes(1);
    expect(await lib.getSharedPoseDetector()).toBe(fresh);
    // A finished detector is never discarded.
    expect(lib.discardPendingPoseDetector("lite")).toBe(false);
    expect(await lib.getSharedPoseDetector()).toBe(fresh);
  });

  it("closeSharedPoseDetectors really closes and resets the cache", async () => {
    const landmarker = fakeLandmarker();
    mp.createFromOptions.mockResolvedValue(landmarker);
    const first = await lib.getSharedPoseDetector();

    await lib.closeSharedPoseDetectors();
    expect(landmarker.close).toHaveBeenCalledTimes(1);
    expect(() => first.detect(video, 1)).toThrow(/after close/);

    const second = await lib.getSharedPoseDetector();
    expect(second).not.toBe(first);
  });
});
