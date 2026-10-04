// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SESSIONS_STORAGE_KEY,
  loadSessions,
  reloadSessions,
  saveSession,
  type WorkoutSession,
} from "@/lib/storage/history";
import HistoryList from "../HistoryList";

let seq = 0;
function session(endedAt: number, overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  seq++;
  return {
    id: `h-${seq}`,
    exercise: "pushup",
    startedAt: endedAt - 60_000,
    endedAt,
    goal: 20,
    goalMet: true,
    summary: {
      exercise: "pushup",
      reps: 21,
      rejectedReps: 2,
      holdMs: 0,
      repDurationsMs: [],
      activeMs: 60_000,
      framesProcessed: 100,
      framesWithPose: 100,
      avgTrackingConfidence: 0.9,
    },
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  reloadSessions();
});

afterEach(() => {
  cleanup();
});

describe("HistoryList", () => {
  it("shows an empty state with a call to action", () => {
    render(<HistoryList />);
    expect(screen.getByRole("heading", { name: "No workouts yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start a workout/ }).getAttribute("href")).toBe("/");
  });

  it("groups sessions by local day with totals and a streak", () => {
    const now = Date.now();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    act(() => {
      saveSession(session(now - 1000));
      saveSession(session(yesterday.getTime()));
    });
    render(<HistoryList />);

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("21 push-ups")).toBeTruthy();
    expect(within(today).getByText(/2 not counted/)).toBeTruthy();
    expect(screen.getByRole("region", { name: "Yesterday" })).toBeTruthy();

    const streakTile = screen.getByText("Current streak").parentElement;
    expect(streakTile?.textContent).toMatch(/2\s*days/);
  });

  it("labels when a workout ended as a time of day, not a bare m:ss", () => {
    const endedAt = new Date();
    endedAt.setHours(1, 7, 0, 0);
    act(() => {
      saveSession(session(endedAt.getTime()));
    });
    render(<HistoryList />);

    const time = document.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(endedAt.toISOString());
    expect(time?.textContent).not.toBe("1:07");
    expect(time?.parentElement?.textContent).toMatch(/^at \S/);
  });

  it("clears history only after confirmation, keeping focus on the controls", () => {
    act(() => {
      saveSession(session(Date.now() - 1000));
    });
    render(<HistoryList />);

    fireEvent.click(screen.getByRole("button", { name: /Clear history/ }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(loadSessions()).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Clear history/ }));

    fireEvent.click(screen.getByRole("button", { name: /Clear history/ }));
    const question = screen.getByRole("group");
    expect(question.textContent).toMatch(/Delete this workout from this device\?/);
    expect(question.textContent).not.toMatch(/Delete all 1/);
    fireEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    expect(loadSessions()).toHaveLength(0);
    expect(localStorage.getItem(SESSIONS_STORAGE_KEY)).toBeNull();
    const empty = screen.getByRole("heading", { name: "No workouts yet" });
    expect(document.activeElement).toBe(empty);
  });

  it("names the count when deleting several workouts", () => {
    act(() => {
      saveSession(session(Date.now() - 1000));
      saveSession(session(Date.now() - 2000));
    });
    render(<HistoryList />);
    fireEvent.click(screen.getByRole("button", { name: /Clear history/ }));
    expect(screen.getByRole("group").textContent).toMatch(/Delete all 2 workouts from this device\?/);
    fireEvent.click(screen.getByRole("button", { name: /Delete all/ }));
    expect(loadSessions()).toHaveLength(0);
  });
});
