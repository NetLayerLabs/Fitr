// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadSessions, saveSession, type WorkoutSession } from "@/lib/storage/history";
import type { ExerciseKind } from "@/lib/pose/types";

type Commitment = {
  state: string;
  exercise?: ExerciseKind;
  goalTarget?: number;
  amountLabel?: string;
  deadlineMs?: number;
  claimableLabel?: string;
};

let commitment: Commitment | undefined = { state: "can_commit" };
vi.mock("@/hooks/useTodayCommitment", () => ({ useTodayCommitment: () => commitment }));

import TodayPage from "@/app/page";
import TodayHero from "../TodayHero";

function session(exercise: ExerciseKind, startedAt: number, reps: number): WorkoutSession {
  return {
    id: `${exercise}-${startedAt}`,
    exercise,
    startedAt,
    endedAt: startedAt + 60_000,
    goal: 10,
    goalMet: reps >= 10,
    summary: {
      exercise,
      reps,
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
  commitment = { state: "can_commit" };
});

afterEach(() => {
  cleanup();
});

function heroSection(): HTMLElement {
  const title = document.getElementById("today-hero-title");
  if (!title) throw new Error("no hero");
  return title.closest("section") as HTMLElement;
}

describe("TodayHero", () => {
  it.each(["no_wallet", "can_commit"])("%s shows the standing athlete as a decorative visual", (state) => {
    commitment = { state };
    render(<TodayHero />);
    const img = heroSection().querySelector("img");
    expect(img?.getAttribute("src")).toBe("/art/exercises/stand-man-sm.jpg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("keeps the other states photo-free", () => {
    commitment = { state: "committed", exercise: "pushup", goalTarget: 20 };
    render(<TodayHero />);
    expect(heroSection().querySelector("img")).toBeNull();
  });

  it("shows the commit CTA by default and when the hook gives nothing", () => {
    commitment = undefined;
    render(<TodayHero />);
    const link = within(heroSection()).getByRole("link", { name: /Commit/ });
    expect(link.getAttribute("href")).toBe("/commit");
  });

  it.each(["no_wallet", "can_commit", "missed"])("%s links to /commit", (state) => {
    commitment = { state };
    render(<TodayHero />);
    const links = within(heroSection()).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/commit"]);
  });

  it.each(["not_seeker", "vault_unavailable"])("%s offers free training instead", (state) => {
    commitment = { state };
    render(<TodayHero />);
    expect(within(heroSection()).getByRole("link").getAttribute("href")).toBe("/workouts");
  });

  it("shows the committed goal, time left, stake and a Start link", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 4, 12, 0, 0));
    try {
      commitment = {
        state: "committed",
        exercise: "pushup",
        goalTarget: 20,
        amountLabel: "50 SKR",
        deadlineMs: new Date(2026, 9, 4, 15, 12, 30).getTime(),
      };
      render(<TodayHero />);
      const section = heroSection();
      expect(within(section).getByRole("heading").textContent).toBe("20 push-ups");
      expect(section.textContent).toContain("3h 12m left");
      expect(section.textContent).toContain("50 SKR at stake");
      const start = within(section).getByRole("link", { name: /Start/ });
      expect(start.getAttribute("href")).toBe("/workout/pushup");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows verified on a lime card", () => {
    commitment = { state: "verified", exercise: "squat", goalTarget: 30 };
    render(<TodayHero />);
    const section = heroSection();
    expect(section.getAttribute("data-tone")).toBe("lime");
    expect(within(section).getByRole("heading").textContent).toContain("Goal verified");
  });

  it("shows the claimable amount and a Claim link", () => {
    commitment = { state: "claimable", claimableLabel: "57.5 SKR" };
    render(<TodayHero />);
    const section = heroSection();
    expect(section.textContent).toContain("57.5 SKR");
    expect(within(section).getByRole("link", { name: /Claim/ }).getAttribute("href")).toBe("/commit");
  });

  it("shows a withdrawn verification as refundable, not verified or forfeited", () => {
    commitment = { state: "revoked", exercise: "squat", goalTarget: 30 };
    render(<TodayHero />);
    const section = heroSection();
    expect(section.getAttribute("data-tone")).not.toBe("lime");
    expect(within(section).getByRole("heading").textContent).toContain("Verification withdrawn");
    expect(section.textContent).toContain("not forfeited");
    expect(within(section).getByRole("link", { name: /View details/ }).getAttribute("href")).toBe("/commit");
  });

  it("marks loading and verifying as busy", () => {
    commitment = { state: "loading" };
    const { unmount } = render(<TodayHero />);
    expect(heroSection().getAttribute("aria-busy")).toBe("true");
    unmount();
    commitment = { state: "verifying" };
    render(<TodayHero />);
    expect(heroSection().getAttribute("aria-busy")).toBe("true");
  });
});

describe("Today page", () => {
  it("lists only today's exercises and the three most recent for quick start", () => {
    const now = Date.now();
    saveSession(session("squat", now - 2 * 86_400_000, 12));
    saveSession(session("burpee", now - 60_000, 7));
    act(() => reloadSessions());
    render(<TodayPage />);

    const activity = screen.getByRole("region", { name: "Today's activity" });
    const rows = within(activity).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("Burpees");
    expect(rows[0].textContent).toContain("7 reps");

    const quick = screen.getByRole("region", { name: "Quick start" });
    const hrefs = within(quick)
      .getAllByRole("link")
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toEqual(["/workouts", "/workout/burpee", "/workout/squat", "/workout/pushup"]);
  });

  it("shows an empty state when nothing is logged today", () => {
    render(<TodayPage />);
    expect(screen.getByText("Nothing logged yet today.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
  });
});
