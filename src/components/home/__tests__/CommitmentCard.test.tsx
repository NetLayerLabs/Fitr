// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reloadSessions, saveSession, type WorkoutSession } from "@/lib/storage/history";
import CommitmentCard from "../CommitmentCard";

function session(endedAt: number, id: string): WorkoutSession {
  return {
    id,
    exercise: "pushup",
    startedAt: endedAt - 60_000,
    endedAt,
    goal: 20,
    goalMet: true,
    summary: {
      exercise: "pushup",
      reps: 21,
      rejectedReps: 0,
      holdMs: 0,
      repDurationsMs: [],
      activeMs: 60_000,
      framesProcessed: 100,
      framesWithPose: 100,
      avgTrackingConfidence: 0.9,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  reloadSessions();
});

afterEach(() => {
  cleanup();
});

describe("CommitmentCard", () => {
  const streakText = () => screen.getByText("Current streak").parentElement?.querySelector("dd")?.textContent;

  it("pluralises the streak: 1 day, 2 days", () => {
    act(() => {
      saveSession(session(Date.now() - 1000, "a"));
    });
    const { unmount } = render(<CommitmentCard />);
    expect(streakText()).toBe("1 day");
    unmount();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    act(() => {
      saveSession(session(yesterday.getTime(), "b"));
    });
    render(<CommitmentCard />);
    expect(streakText()).toBe("2 days");
  });

  it("sends the user to the Commit tab, without internal milestone names", () => {
    render(<CommitmentCard />);
    expect(streakText()).toBe("0 days");
    const note = screen.getByText(/Nothing is staked until you sign/);
    expect(note.textContent).not.toMatch(/M2/);
    expect(screen.getByRole("link", { name: /^Commit t?SKR$/ }).getAttribute("href")).toBe("/commit");
    // No wallet connected: the card links to the wallet screen instead of connecting itself.
    expect(screen.getByRole("link", { name: /Connect wallet/ }).getAttribute("href")).toBe("/you");
  });
});
