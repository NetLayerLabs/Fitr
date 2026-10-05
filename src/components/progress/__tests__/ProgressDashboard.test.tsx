// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { reloadSessions, saveSession, type WorkoutSession } from "@/lib/storage/history";
import type { ExerciseKind } from "@/lib/pose/types";
import ProgressDashboard from "../ProgressDashboard";

let seq = 0;
function session(
  endedAt: number,
  opts: { exercise?: ExerciseKind; reps?: number; holdMs?: number; goalMet?: boolean } = {},
): WorkoutSession {
  const exercise = opts.exercise ?? "pushup";
  seq++;
  return {
    id: `p-${seq}`,
    exercise,
    startedAt: endedAt - 60_000,
    endedAt,
    goal: 20,
    goalMet: opts.goalMet ?? true,
    summary: {
      exercise,
      reps: opts.reps ?? 21,
      rejectedReps: 0,
      holdMs: opts.holdMs ?? 0,
      repDurationsMs: [],
      activeMs: 60_000,
      framesProcessed: 100,
      framesWithPose: 100,
      avgTrackingConfidence: 0.9,
    },
  };
}

function daysAgo(n: number): number {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getTime() - 1000;
}

/** "earned" / "locked", from the award's title paragraph (title + screen-reader state). */
function award(title: string): string {
  const el = screen.getAllByText((_, node) => node?.tagName === "P" && node.textContent?.startsWith(`${title} (`) === true)[0];
  return /\((earned|locked)\)$/.exec(el.textContent ?? "")?.[1] ?? "?";
}

beforeEach(() => {
  localStorage.clear();
  reloadSessions();
});
afterEach(cleanup);

describe("ProgressDashboard", () => {
  it("renders zero stats, locked awards and the empty history with no workouts", () => {
    render(<ProgressDashboard />);
    expect(screen.getByText("Current streak").parentElement?.textContent).toMatch(/0\s*days/);
    expect(screen.getByRole("group", { name: "Total reps" }).textContent).toMatch(/0/);
    expect(screen.getByText(/0 of 10 earned/)).toBeTruthy();
    expect(award("First workout")).toBe("locked");
    expect(screen.getByRole("heading", { name: "No workouts yet" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Pick a workout/ }).getAttribute("href")).toBe("/workouts");
  });

  it("shows the streak, the lime calendar day, records, awards and history", () => {
    act(() => {
      saveSession(session(daysAgo(0), { reps: 30 }));
      saveSession(session(daysAgo(1), { reps: 25 }));
      saveSession(session(daysAgo(1), { exercise: "plank", holdMs: 75_000 }));
    });
    render(<ProgressDashboard />);

    expect(screen.getByText("Current streak").parentElement?.textContent).toMatch(/2\s*days/);
    expect(screen.getByRole("group", { name: "Total reps" }).textContent).toMatch(/55/);

    const calendar = screen.getByRole("table", { name: "Streak calendar" });
    // This month, Monday-first weeks (header + 4 to 6 weeks); yesterday shows only if it is this month too.
    const rows = within(calendar).getAllByRole("row").length;
    expect(rows).toBeGreaterThanOrEqual(5);
    expect(rows).toBeLessThanOrEqual(7);
    expect(calendar.querySelectorAll("[data-goal]").length).toBe(new Date().getDate() > 1 ? 2 : 1);
    expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", true);
    expect(within(calendar).getByText(/\(today\): goal met/)).toBeTruthy();

    const records = screen.getByRole("region", { name: "Personal records" });
    expect(within(records).getByText("Push-ups")).toBeTruthy();
    expect(within(records).getByText("30")).toBeTruthy();
    expect(within(records).getByText("1:15")).toBeTruthy();

    expect(award("First workout")).toBe("earned");
    expect(award("Plank minute")).toBe("earned");
    expect(award("3-day streak")).toBe("locked");

    // History sits under its own section; the duplicate summary tiles are hidden there.
    const history = screen.getByRole("region", { name: "History" });
    expect(within(history).getByRole("heading", { level: 3, name: "Today" })).toBeTruthy();
    expect(within(history).queryByText("Best streak")).toBeNull();
    expect(within(history).getByRole("button", { name: /Clear history/ })).toBeTruthy();
  });

  it("unlocks the onchain award from the optional prop", () => {
    render(<ProgressDashboard verifiedOnChainDays={1} />);
    expect(award("Verified onchain")).toBe("earned");
  });
});
