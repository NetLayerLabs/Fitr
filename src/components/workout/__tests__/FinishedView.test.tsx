// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExerciseKind, SessionSummary } from "@/lib/pose/types";
import FinishedView, { type FinishedResult } from "../FinishedView";

function result(exercise: ExerciseKind, summary: Partial<SessionSummary>): FinishedResult {
  return {
    id: "s1",
    startedAt: 0,
    endedAt: 60_000,
    goal: 20,
    goalMet: false,
    summary: {
      exercise,
      reps: 0,
      rejectedReps: 0,
      holdMs: 0,
      repDurationsMs: [],
      activeMs: 30_000,
      framesProcessed: 900,
      framesWithPose: 880,
      avgTrackingConfidence: 0.9,
      ...summary,
    },
  };
}

function renderView(exercise: ExerciseKind, summary: Partial<SessionSummary>) {
  const noop = vi.fn();
  return render(
    <FinishedView
      exercise={exercise}
      result={result(exercise, summary)}
      saveState="unsaved"
      onSaveAndFinish={noop}
      onSaveAndGoAgain={noop}
      onDiscard={noop}
      onRetry={noop}
      onGoHome={noop}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("FinishedView: nothing counted", () => {
  it("says how many reps were seen and what to fix when every rep was rejected", () => {
    renderView("pushup", { reps: 0, rejectedReps: 8 });
    expect(screen.getByRole("heading", { name: "Nothing counted" })).toBeTruthy();
    expect(screen.getByText(/8 reps seen, none met the standard/)).toBeTruthy();
    expect(screen.getByText(/elbows bend past 90°/)).toBeTruthy();
    expect(screen.queryByText(/whole body is in frame/)).toBeNull();
  });

  it("uses squat guidance for squats and the singular for one rep", () => {
    renderView("squat", { reps: 0, rejectedReps: 1 });
    expect(screen.getByText(/1 rep seen, none met the standard/)).toBeTruthy();
    expect(screen.getByText(/knees bend past 90°/)).toBeTruthy();
  });

  it("keeps the framing advice when no rep was even attempted", () => {
    renderView("pushup", { reps: 0, rejectedReps: 0 });
    expect(screen.getByText(/whole body is in/)).toBeTruthy();
    renderView("plank", { holdMs: 400 });
    expect(screen.getAllByText(/whole body is in/)).toHaveLength(2);
  });
});
