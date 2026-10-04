// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EngineEvent, EngineState, PoseFrame, RepEngine, SessionSummary } from "@/lib/pose/types";
import { reloadSessions } from "@/lib/storage/history";
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


const native = {
  version: vi.fn(() => "1.1.0+3"),
  speak: vi.fn(),
  stopSpeaking: vi.fn(),
  notificationPermission: vi.fn(() => "default"),
  requestNotificationPermission: vi.fn(),
  scheduleReminders: vi.fn(),
  cancelReminders: vi.fn(),
  updateWidget: vi.fn(),
};

const spoken = () => native.speak.mock.calls.map((c) => c[0] as string);

describe("WorkoutScreen voice coach", () => {
  beforeEach(() => {
    for (const fn of Object.values(native)) fn.mockClear();
    window.FitrNative = native;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete window.FitrNative;
  });

  it("is silent on setup, speaks from Start (goal, countdown, reps) and stops on End", () => {
    render(<WorkoutScreen exercise="pushup" />);
    expect(native.speak).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    expect(native.speak).toHaveBeenCalledWith("Let's go. 20 push-ups.", false);

    // First tracked frame starts the 3-2-1 countdown; the mock engine counts a rep per frame.
    act(() => h.onFrame?.(frame(1000)));
    for (let i = 0; i < 4; i++) {
      act(() => vi.advanceTimersByTime(1000));
      act(() => h.onFrame?.(frame(2000 + i * 1000)));
    }
    const said = spoken();
    // "3" and "2" fell inside the intro here (no model loading delay in tests): never talked over.
    expect(said.slice(0, 3)).toEqual(["Let's go. 20 push-ups.", "1", "Go."]);
    // Rep counts follow once the countdown is done.
    act(() => vi.advanceTimersByTime(1500));
    act(() => h.onFrame?.(frame(8000)));
    expect(spoken().at(-1)).toMatch(/^\d+/);
    expect(native.speak.mock.calls.every((c) => c[1] === false)).toBe(true);

    native.speak.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(native.stopSpeaking).toHaveBeenCalled();
    expect(native.speak).not.toHaveBeenCalled();
  });

  it("stays quiet when the voice coach is off on the You tab", () => {
    setPreference("voiceCoach", false);
    render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    act(() => h.onFrame?.(frame(1000)));
    for (let i = 0; i < 5; i++) {
      act(() => vi.advanceTimersByTime(1000));
      act(() => h.onFrame?.(frame(2000 + i * 1000)));
    }
    expect(native.speak).not.toHaveBeenCalled();
  });

  it("stops speaking when the app goes to the background and on unmount", () => {
    const { unmount } = render(<WorkoutScreen exercise="pushup" />);
    fireEvent.click(screen.getByRole("button", { name: /Start push-ups/ }));
    native.stopSpeaking.mockClear();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(native.stopSpeaking).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    unmount();
    expect(native.stopSpeaking).toHaveBeenCalledTimes(2);
  });
});
