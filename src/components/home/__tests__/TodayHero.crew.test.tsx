// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TodayCommitment } from "@/hooks/useTodayCommitment";

let commitment: TodayCommitment = { state: "can_commit" };
vi.mock("@/hooks/useTodayCommitment", () => ({ useTodayCommitment: () => commitment }));

import TodayHero from "../TodayHero";

afterEach(cleanup);

describe("TodayHero with a crew commitment", () => {
  it("names the crew and starts the workout for that crew", () => {
    commitment = { state: "committed", exercise: "squat", goalTarget: 30, amountLabel: "5 SKR", forDay: "today", crewId: "7", crewName: "Run Club" };
    render(<TodayHero />);
    expect(screen.getByText("Your goal · Run Club")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start/ }).getAttribute("href")).toBe("/workout/squat?crew=7");
  });

  it("claims on the crew page", () => {
    commitment = { state: "claimable", claimableLabel: "12 SKR", crewId: "7", crewName: "Run Club" };
    render(<TodayHero />);
    expect(screen.getByText("Ready to claim · Run Club")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Claim" }).getAttribute("href")).toBe("/crew/7");
  });

  it("the global pool keeps its links", () => {
    commitment = { state: "committed", exercise: "pushup", goalTarget: 20, forDay: "today" };
    render(<TodayHero />);
    expect(screen.getByText("Your goal")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Start/ }).getAttribute("href")).toBe("/workout/pushup");
  });

  it("a stake for tomorrow says when it counts and offers practice, not Start", () => {
    const tomorrowEnd = Date.UTC(2026, 9, 12, 0, 0);
    commitment = { state: "committed", exercise: "squat", goalTarget: 15, amountLabel: "5 SKR", forDay: "tomorrow", deadlineMs: tomorrowEnd };
    render(<TodayHero />);
    expect(screen.getByText("Tomorrow's goal")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Practice now/ }).getAttribute("href")).toBe("/workout/squat");
    expect(screen.queryByRole("link", { name: /^Start/ })).toBeNull();
    expect(screen.getByText(/^Counts from /)).toBeTruthy();
  });
});
