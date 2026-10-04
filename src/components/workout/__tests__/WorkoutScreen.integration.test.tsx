// @vitest-environment jsdom
/**
 * Cross-package integration: the REAL rep engine (src/lib/pose/engine), HUD tracker and storage,
 * driven through WorkoutScreen with synthetic landmark streams. Only the browser edges are
 * mocked (camera + MediaPipe stream + router), so this checks that the engine's contract and the
 * UI/storage code agree end to end: frames in -> HUD -> finished view -> saved session -> Today.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseFrame } from "@/lib/pose/types";
import {
  plankSequence,
  pushupSequence,
  pushupTimeline,
  squatSequence,
  standingArmCurlSequence,
} from "@/lib/pose/testing/synthetic";
import { loadSessions, reloadSessions } from "@/lib/storage/history";
import { resetGuidePrefsCache, setGuideHidden } from "@/lib/storage/guidePrefs";
import { todayProgress } from "@/lib/storage/streak";

const h = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  onFrame: null as null | ((frame: PoseFrame) => void),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace, back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/hooks/useCamera", () => ({
  useCamera: (opts: { enabled: boolean; facingMode?: string }) => ({
    videoRef: { current: null },
    status: opts.enabled ? "ready" : "idle",
    error: null,
    facingMode: opts.facingMode ?? "user",
    toggleFacingMode: () => {},
    dimensions: { width: 640, height: 480 },
    retry: () => {},
  }),
}));

vi.mock("@/hooks/usePoseStream", () => ({
  usePoseStream: (opts: { enabled: boolean; onFrame: (frame: PoseFrame) => void }) => {
    h.onFrame = opts.onFrame;
    return {
      status: opts.enabled ? "running" : "idle",
      error: null,
      failure: null,
      slow: false,
      fps: 30,
      delegate: "GPU",
      retry: () => {},
    };
  },
}));

import WorkoutScreen from "../WorkoutScreen";

function feed(frames: readonly PoseFrame[]): void {
  act(() => {
    for (const frame of frames) h.onFrame?.(frame);
  });
}

function startAndFeed(startLabel: RegExp, frames: readonly PoseFrame[]): void {
  fireEvent.click(screen.getByRole("button", { name: startLabel }));
  feed(frames);
  fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
}

beforeEach(() => {
  h.push.mockReset();
  h.replace.mockReset();
  h.onFrame = null;
  window.history.replaceState(null, "");
  localStorage.clear();
  reloadSessions();
  // These tests cover the workout itself; the form guide has its own tests.
  resetGuidePrefsCache();
  for (const kind of ["pushup", "squat", "plank"] as const) setGuideHidden(kind, true);
  // jsdom has no canvas backend; the overlay skips drawing without a 2D context.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("WorkoutScreen + real rep engine", () => {
  it("counts five synthetic push-ups, saves them, and they show up in today's progress", () => {
    render(<WorkoutScreen exercise="pushup" />);
    startAndFeed(/Start push-ups/, pushupSequence({ reps: 5, startMs: 1000 }));

    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Save & finish/ }));
    // The back-button guard entry is replaced rather than stacked on.
    expect(h.replace).toHaveBeenCalledWith("/");
    expect(h.push).not.toHaveBeenCalled();

    const [saved] = loadSessions();
    expect(saved.exercise).toBe("pushup");
    expect(saved.summary.reps).toBe(5);
    expect(saved.summary.rejectedReps).toBe(0);
    expect(saved.summary.repDurationsMs).toHaveLength(5);
    expect(saved.goalMet).toBe(false);
    expect(todayProgress(loadSessions(), Date.now()).pushup).toMatchObject({ value: 5, goal: 20, unit: "reps" });
  });

  it("does not count knee push-ups, and says why on the summary", () => {
    render(<WorkoutScreen exercise="pushup" />);
    // Real push-ups whose knees drop to the floor during every rep.
    const reps = [{}, {}, {}];
    const timeline = pushupTimeline({ reps });
    const kneeBendDeg = (t: number) =>
      timeline.reps.some((r) => t > r.startMs + 200 && t < r.endMs - 250) ? 35 : 0;
    startAndFeed(/Start push-ups/, pushupSequence({ reps, kneeBendDeg, startMs: 1000 }));

    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();
    expect(screen.getByText(/3 reps seen, none met the standard/)).toBeTruthy();
    expect(screen.getByText(/knees off the floor/)).toBeTruthy();
    expect(screen.queryByText(/whole body is in frame/)).toBeNull();
  });

  it("counts nothing while the phone lies on its side", () => {
    render(<WorkoutScreen exercise="plank" />);
    fireEvent.click(screen.getByRole("button", { name: /Start plank/ }));
    const event = Object.assign(new Event("deviceorientation"), { alpha: 0, beta: 0, gamma: 90 });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(screen.getAllByText(/Stand it upright in portrait/).length).toBeGreaterThan(0);
    feed(plankSequence({ durationMs: 8000, startMs: 1000 }));
    fireEvent.click(screen.getByRole("button", { name: /End workout/ }));
    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();
  });

  it("does not count arm curls while standing as push-ups", () => {
    render(<WorkoutScreen exercise="pushup" />);
    startAndFeed(/Start push-ups/, standingArmCurlSequence({ reps: 5, startMs: 1000 }));

    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
    expect(loadSessions()).toHaveLength(0);
  });

  it("counts synthetic squats", () => {
    render(<WorkoutScreen exercise="squat" />);
    startAndFeed(/Start squats/, squatSequence({ reps: 3, startMs: 1000 }));

    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Save & finish/ }));
    expect(loadSessions()[0].summary.reps).toBe(3);
  });

  it("times a synthetic plank hold", () => {
    render(<WorkoutScreen exercise="plank" />);
    startAndFeed(/Start plank/, plankSequence({ durationMs: 8000, startMs: 1000 }));

    expect(screen.getByRole("heading", { name: "Workout complete" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Save & finish/ }));
    const { summary } = loadSessions()[0];
    expect(summary.reps).toBe(0);
    expect(summary.holdMs).toBeGreaterThan(6000);
    expect(summary.holdMs).toBeLessThanOrEqual(8000);
    expect(todayProgress(loadSessions(), Date.now()).plank.unit).toBe("seconds");
  });
});
