// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEvent, EngineState, PoseFrame, RepEngine, SessionSummary } from "@/lib/pose/types";
import { SESSIONS_STORAGE_KEY, reloadSessions } from "@/lib/storage/history";
import { resetGuidePrefsCache, setGuideHidden } from "@/lib/storage/guidePrefs";
import { resetPreferencesCache, setPreference } from "@/components/you/preferences";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  poseRetry: vi.fn(),
  cameraStatus: "ready" as string,
  cameraError: null as string | null,
  poseStatus: "running" as string,
  poseFailure: null as null | "load" | "runtime",
  poseError: null as string | null,
  poseSlow: false,
  onFrame: null as null | ((frame: PoseFrame) => void),
  lastCameraOpts: null as null | { enabled: boolean; facingMode?: string },
  reps: 0,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/hooks/useCamera", () => ({
  useCamera: (opts: { enabled: boolean; facingMode?: string }) => {
    h.lastCameraOpts = opts;
    return {
      videoRef: { current: null },
      status: opts.enabled ? h.cameraStatus : "idle",
      error: opts.enabled ? h.cameraError : null,
      facingMode: opts.facingMode ?? "user",
      toggleFacingMode: () => {},
      dimensions: { width: 640, height: 480 },
      retry: h.retry,
    };
  },
}));

vi.mock("@/hooks/usePoseStream", () => ({
  usePoseStream: (opts: { enabled: boolean; onFrame: (frame: PoseFrame) => void }) => {
    h.onFrame = opts.onFrame;
    const status = opts.enabled ? h.poseStatus : "idle";
    return {
      status,
      error: status === "error" ? h.poseError : null,
      failure: status === "error" ? h.poseFailure : null,
      slow: status === "loading" && h.poseSlow,
      fps: 29,
      delegate: "GPU",
      retry: h.poseRetry,
    };
  },
}));

vi.mock("@/lib/pose/engine", () => ({
  createRepEngine: (): RepEngine => {
    h.reps = 0;
    const state = (): EngineState => ({
      exercise: "pushup",
      phase: "up",
      reps: h.reps,
      rejectedReps: 0,
      holdMs: 0,
      primaryAngleDeg: 160,
      bodyLineDeg: 178,
      formIssues: [],
      trackingConfidence: 0.9,
      side: "left",
    });
    return {
      exercise: "pushup",
      update(frame) {
        h.reps += 1;
        const events: EngineEvent[] = [
          { type: "rep", repIndex: h.reps, durationMs: 1500, minAngleDeg: 80, maxAngleDeg: 165, tMs: frame.timestampMs },
        ];
        return { state: state(), events };
      },
      getState: state,
      summary: (): SessionSummary => ({
        exercise: "pushup",
        reps: h.reps,
        rejectedReps: 0,
        holdMs: 0,
        repDurationsMs: Array.from({ length: h.reps }, () => 1500),
        activeMs: 12_000,
        framesProcessed: 300,
        framesWithPose: 290,
        avgTrackingConfidence: 0.88,
      }),
      reset() {
        h.reps = 0;
      },
    };
  },
}));

import WorkoutScreen from "../WorkoutScreen";

function frame(t: number): PoseFrame {
  return { timestampMs: t, landmarks: [], imageWidth: 640, imageHeight: 480 };
}

beforeEach(() => {
  h.cameraStatus = "ready";
  h.cameraError = null;
  h.poseStatus = "running";
  h.poseFailure = null;
  h.poseError = null;
  h.poseSlow = false;
  h.push.mockReset();
  h.replace.mockReset();
  h.retry.mockReset();
  h.poseRetry.mockReset();
  window.history.replaceState(null, "");
  localStorage.clear();
  resetPreferencesCache();
  reloadSessions();
  // These tests cover the workout itself; the form guide has its own tests.
  resetGuidePrefsCache();
  for (const kind of ["pushup", "squat", "plank"] as const) setGuideHidden(kind, true);
  // jsdom has no canvas backend; the overlay simply skips drawing without a 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkoutScreen form guide", () => {
  it("shows the guide first, then setup; the camera stays off", () => {
    setGuideHidden("pushup", false);
    render(<WorkoutScreen exercise="pushup" />);
    expect(screen.getByRole("heading", { level: 1, name: /push-up that counts/i })).toBeTruthy();
    expect(h.lastCameraOpts?.enabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("heading", { level: 1, name: "Push-ups" })).toBeTruthy();
    expect(h.lastCameraOpts?.enabled).toBe(false);
  });

  it("skips the guide once hidden, and it can be reopened from setup", () => {
    render(<WorkoutScreen exercise="pushup" />);
    expect(screen.getByRole("heading", { level: 1, name: "Push-ups" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /form guide/i }));
    expect(screen.getByRole("heading", { level: 1, name: /push-up that counts/i })).toBeTruthy();
    // The checkbox reflects the saved choice; unticking it brings the guide back next time.
    const box = screen.getByRole("checkbox", { name: /don't show this before push-ups again/i }) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(screen.getByRole("heading", { level: 1, name: "Push-ups" })).toBeTruthy();

    cleanup();
    render(<WorkoutScreen exercise="pushup" />);
    expect(screen.getByRole("heading", { level: 1, name: /push-up that counts/i })).toBeTruthy();
  });

  it("returning to setup later in the same visit does not show the guide again", async () => {
    setGuideHidden("pushup", false);
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    // Back while live with nothing counted returns to setup.
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByRole("heading", { level: 1, name: "Push-ups" })).toBeTruthy();
  });
});

describe("WorkoutScreen", () => {
  it("starts with setup tips and keeps the camera off until Start", () => {
    render(<WorkoutScreen exercise="pushup" />);
    expect(screen.getByRole("heading", { level: 1, name: "Push-ups" })).toBeTruthy();
    expect(screen.getByText(/whole body, from head to heels/)).toBeTruthy();
    expect(h.lastCameraOpts?.enabled).toBe(false);

    fireEvent.click(screen.getByRole("radio", { name: /Back/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(h.lastCameraOpts).toEqual({ enabled: true, facingMode: "environment" });
  });

  it("opens the camera chosen on the You tab", () => {
    setPreference("camera", "environment");
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(h.lastCameraOpts).toEqual({ enabled: true, facingMode: "environment" });
  });

  it("does not vibrate when haptics are turned off on the You tab", () => {
    vi.useFakeTimers();
    try {
      const vibrate = vi.fn();
      Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true, writable: true });
      setPreference("haptics", false);
      render(<WorkoutScreen exercise="pushup" />);
      fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
      act(() => h.onFrame?.(frame(1000)));
      for (let i = 0; i < 4; i++) act(() => vi.advanceTimersByTime(1000));
      expect(vibrate).not.toHaveBeenCalled();

      setPreference("haptics", true);
      cleanup();
      render(<WorkoutScreen exercise="pushup" />);
      fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
      act(() => h.onFrame?.(frame(1000)));
      for (let i = 0; i < 4; i++) act(() => vi.advanceTimersByTime(1000));
      expect(vibrate).toHaveBeenCalledWith(80);
    } finally {
      vi.useRealTimers();
    }
  });

  it("counts reps from engine updates, then saves and routes home", () => {
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(screen.getByRole("button", { name: /End workout/ })).toBeTruthy();

    act(() => h.onFrame?.(frame(1000)));
    act(() => h.onFrame?.(frame(3000)));
    expect(screen.getByText("2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Save & finish/ }));
    const stored = JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ exercise: "pushup", goal: 20, goalMet: false, summary: { reps: 2 } });
    // Replaces the back-button guard entry instead of stacking "/" on top of it.
    expect(h.replace).toHaveBeenCalledWith("/");
    expect(h.push).not.toHaveBeenCalled();
  });

  it("offers retry and recovery copy when the camera is blocked", () => {
    h.cameraStatus = "denied";
    h.cameraError = "Camera access was blocked. Allow the camera for this site in your browser settings, then try again.";
    render(<WorkoutScreen exercise="squat" />);
    fireEvent.click(screen.getByRole("button", { name: /Start squats/ }));
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/Camera access is blocked/);
    // One set of instructions (browser tab: the address-bar icon), not two.
    expect(alert.querySelectorAll("p")).toHaveLength(1);
    expect(alert.textContent).toMatch(/icon next to the address bar/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.retry).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("button", { name: /Start squats/ })).toBeTruthy();
  });

  it("points installed-app users to the phone's settings, not an address bar", () => {
    h.cameraStatus = "denied";
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: query === "(display-mode: standalone)", addEventListener() {}, removeEventListener() {} })),
    );
    try {
      render(<WorkoutScreen exercise="squat" />);
      fireEvent.click(screen.getByRole("button", { name: /Start squats/ }));
      const alert = screen.getByRole("alert");
      expect(alert.querySelectorAll("p")).toHaveLength(1);
      expect(alert.textContent).toMatch(/Settings/);
      expect(alert.textContent).not.toMatch(/address/);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not repeat the busy-camera advice", () => {
    h.cameraStatus = "error";
    h.cameraError = "The camera is busy. Close other apps using it and try again.";
    render(<WorkoutScreen exercise="squat" />);
    fireEvent.click(screen.getByRole("button", { name: /Start squats/ }));
    const alert = screen.getByRole("alert");
    expect(alert.querySelectorAll("p")).toHaveLength(1);
    expect(alert.textContent?.match(/[Cc]lose other apps/g)).toHaveLength(1);
  });

  it("retries pose tracking (not the camera) from the pose error panel", () => {
    h.poseStatus = "error";
    h.poseFailure = "runtime";
    h.poseError = "Pose tracking failed: RuntimeError: Aborted()";
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(screen.getByRole("heading", { name: "Pose tracking stopped" })).toBeTruthy();
    expect(screen.queryByText(/Check your connection/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.poseRetry).toHaveBeenCalledTimes(1);
    expect(h.retry).not.toHaveBeenCalled();
  });

  it("offers a retry when the model load is slow", () => {
    h.poseStatus = "loading";
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    cleanup();

    h.poseSlow = true;
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(screen.getByText(/taking longer than usual/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.poseRetry).toHaveBeenCalledTimes(1);
  });

  it("moves focus to each status panel and then to the live HUD; no aria-busy", () => {
    h.cameraStatus = "requesting";
    const { rerender } = render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Starting camera" }));
    expect(document.querySelector("[aria-busy]")).toBeNull();

    h.cameraStatus = "ready";
    h.poseStatus = "loading";
    rerender(<WorkoutScreen exercise="pushup" />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Loading pose model" }));

    h.poseStatus = "running";
    rerender(<WorkoutScreen exercise="pushup" />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: /Push-ups workout in progress/ }));
  });

  it("explains the HTTPS requirement on insecure origins", () => {
    h.cameraStatus = "insecure";
    render(<WorkoutScreen exercise="plank" />);
    fireEvent.click(screen.getByRole("button", { name: /Start plank/ }));
    expect(screen.getByRole("alert").textContent).toMatch(/HTTPS/);
  });

  it("shows a loading state while the pose model loads", () => {
    h.poseStatus = "loading";
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(screen.getByRole("status").textContent).toMatch(/Loading pose model/);
  });

  it("asks before a reload / tab close only while live", () => {
    render(<WorkoutScreen exercise="pushup" />);
    const setupEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(setupEvent);
    expect(setupEvent.defaultPrevented).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    const liveEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(liveEvent);
    expect(liveEvent.defaultPrevented).toBe(true);
  });

  it("does not offer to save an empty session", () => {
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });
});

describe("WorkoutScreen: back button", () => {
  async function pressBack() {
    await act(async () => {
      window.history.back();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  }
  const guarded = () => (window.history.state as Record<string, unknown> | null)?.fitrWorkoutGuard === true;

  it("pushes a guard entry when the workout goes live", () => {
    render(<WorkoutScreen exercise="pushup" />);
    expect(guarded()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(guarded()).toBe(true);
  });

  it("back while live ends the session and shows the summary to save", async () => {
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    await pressBack();
    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Save & finish/ })).toBeTruthy();
    // Guarded again: an unsaved workout cannot be lost with one more back.
    expect(guarded()).toBe(true);
    expect(h.push).not.toHaveBeenCalled();
  });

  it("back while live with nothing counted returns to setup", async () => {
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    await pressBack();
    expect(screen.getByRole("button", { name: /Start push-ups/ })).toBeTruthy();
    expect(guarded()).toBe(false);
  });

  it("back on an unsaved summary asks to discard; a second back closes the question", async () => {
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();

    await pressBack();
    const question = screen.getByRole("group", { name: /Discard this workout/ });
    expect(question).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep it" }));
    expect(guarded()).toBe(true);

    await pressBack();
    expect(screen.queryByRole("group", { name: /Discard this workout/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Discard" }));

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, discard/ }));
    expect(h.replace).toHaveBeenCalledWith("/");
    expect(localStorage.getItem(SESSIONS_STORAGE_KEY)).toBeNull();
  });

  it("after saving, back leaves normally (the guard entry is skipped)", async () => {
    const back = vi.spyOn(window.history, "back");
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    // "Save & go again" persists and starts again; end that empty session to reach a saved state.
    fireEvent.click(screen.getByRole("button", { name: /Save & go again/ }));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();

    await pressBack();
    // Our same-URL guard entry was popped with nothing to protect: keep going back.
    expect(back).toHaveBeenCalledTimes(2);
  });
});
