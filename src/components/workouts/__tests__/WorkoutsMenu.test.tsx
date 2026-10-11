// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reloadSessions, saveSession, type WorkoutSession } from "@/lib/storage/history";
import type { ExerciseKind } from "@/lib/pose/types";

let search = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
  usePathname: () => "/workouts",
}));

import StartWorkout from "../StartWorkout";
import WorkoutCatalog from "../WorkoutCatalog";
import WorkoutCatalogRoute from "../WorkoutCatalogRoute";
import type { CatalogFilter } from "../catalog";

function session(exercise: ExerciseKind, startedAt: number): WorkoutSession {
  return {
    id: `${exercise}-${startedAt}`,
    exercise,
    startedAt,
    endedAt: startedAt + 60_000,
    goal: 10,
    goalMet: true,
    summary: {
      exercise,
      reps: 10,
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

const workoutLinks = (root: HTMLElement = document.body) =>
  within(root)
    .queryAllByRole("link")
    .filter((a) => /^\/workout\/[a-z_]+$/.test(a.getAttribute("href") ?? ""));

beforeEach(() => {
  localStorage.clear();
  reloadSessions();
  search = "";
});

afterEach(() => cleanup());

describe("StartWorkout (home)", () => {
  it("shows a carousel of all 16 by default and a browse link", () => {
    render(<StartWorkout />);
    const carousel = screen.getByRole("region", { name: /All workouts, 16/ });
    expect(carousel.tabIndex).toBe(0);
    expect(workoutLinks(carousel)).toHaveLength(16);
    expect(screen.getByRole("link", { name: /Browse all 16/ }).getAttribute("href")).toBe("/workouts");
  });

  it("filters the carousel with the chips (one pressed at a time)", () => {
    render(<StartWorkout />);
    const group = screen.getByRole("group", { name: "Workout category" });
    const back = within(group).getByRole("button", { name: "Back" });
    fireEvent.click(back);
    expect(back.getAttribute("aria-pressed")).toBe("true");
    expect(within(group).getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");

    const carousel = screen.getByRole("region", { name: /Back workouts, 1/ });
    const links = workoutLinks(carousel);
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual([
      "Pull-ups, 8 reps, needs a bar, front camera, advanced",
    ]);
    expect(within(carousel).getByRole("link", { name: /All Back/ }).getAttribute("href")).toBe("/workouts?c=pull");

    fireEvent.click(within(group).getByRole("button", { name: "Legs & Glutes" }));
    expect(workoutLinks(screen.getByRole("region", { name: /Legs & Glutes workouts/ }))).toHaveLength(5);
  });

  it("quick start falls back to push-ups, squats and plank", () => {
    render(<StartWorkout />);
    const list = screen.getByRole("list", { name: "Quick start" });
    expect(workoutLinks(list).map((a) => a.getAttribute("href"))).toEqual([
      "/workout/pushup",
      "/workout/squat",
      "/workout/plank",
    ]);
  });

  it("quick start uses the most recent exercises from history", () => {
    act(() => {
      saveSession(session("dip", Date.now() - 30_000));
      saveSession(session("pullup", Date.now() - 10_000));
    });
    render(<StartWorkout />);
    const list = screen.getByRole("list", { name: "Quick start" });
    expect(workoutLinks(list).map((a) => a.getAttribute("href"))).toEqual([
      "/workout/pullup",
      "/workout/dip",
      "/workout/pushup",
    ]);
  });
});

describe("WorkoutCatalog (/workouts)", () => {
  function renderCatalog(filter: CatalogFilter) {
    const onChange = vi.fn();
    render(<WorkoutCatalog filter={filter} onChange={onChange} />);
    return onChange;
  }

  it("renders every category as its own section, 16 cards in total, then the locked Fitr Pro teaser", () => {
    renderCatalog({ category: "all", noEquipment: false });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Chest & Arms", "Back", "Legs & Glutes", "Core", "Cardio", "Fitr ProComing soon"]);
    expect(workoutLinks()).toHaveLength(16);
    expect(screen.getByRole("button", { name: "All, 16 workouts" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Back, 1 workout" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Core, 4 workouts" })).toBeTruthy();
  });

  it("leaves the Fitr Pro teaser out of a single category", () => {
    renderCatalog({ category: "legs", noEquipment: false });
    expect(screen.queryByRole("heading", { name: /Fitr Pro/ })).toBeNull();
  });

  it("shows equipment and front-camera badges", () => {
    renderCatalog({ category: "all", noEquipment: false });
    const card = (kind: string) => document.querySelector<HTMLElement>(`a[data-kind="${kind}"]`)!;
    expect(card("pullup").textContent).toContain("Bar");
    expect(card("pullup").textContent).toContain("Front camera");
    expect(card("dip").textContent).toContain("Chair");
    expect(card("wall_sit").textContent).toContain("Wall");
    expect(card("wall_sit").textContent).toContain("60 s");
    expect(card("jumping_jack").textContent).toContain("Front camera");
    expect(card("pushup").querySelectorAll("[data-badge]")).toHaveLength(0);
    expect(document.querySelectorAll('[data-badge="camera"]')).toHaveLength(3);
    expect(document.querySelectorAll('[data-badge="equipment"]')).toHaveLength(3);
  });

  it("links each card to its workout with a full accessible name", () => {
    renderCatalog({ category: "all", noEquipment: false });
    const pull = screen.getByRole("link", { name: "Pull-ups, 8 reps, needs a bar, front camera, advanced" });
    expect(pull.getAttribute("href")).toBe("/workout/pullup");
    expect(screen.getByRole("link", { name: "Dips, 12 reps, needs a chair or bench, intermediate" })).toBeTruthy();
  });

  it("filters to one category", () => {
    const onChange = renderCatalog({ category: "legs", noEquipment: false });
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Legs & Glutes"]);
    expect(workoutLinks()).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: /^Cardio/ }));
    expect(onChange).toHaveBeenCalledWith({ category: "cardio", noEquipment: false });
  });

  it("no-equipment toggle hides gear and empties Back with a way out", () => {
    const onChange = renderCatalog({ category: "pull", noEquipment: true });
    const toggle = screen.getByRole("button", { name: "No equipment" });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(workoutLinks()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Show workouts with equipment" }));
    expect(onChange).toHaveBeenCalledWith({ category: "pull", noEquipment: false });
  });

  it("no-equipment in All omits empty categories", () => {
    renderCatalog({ category: "all", noEquipment: true });
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).not.toContain("Back");
    expect(workoutLinks()).toHaveLength(13);
  });
});

describe("WorkoutCatalogRoute", () => {
  it("reads ?c= and writes the filter back with replaceState", () => {
    search = "c=core";
    const replace = vi.spyOn(window.history, "replaceState");
    render(<WorkoutCatalogRoute />);
    expect(workoutLinks()).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "No equipment" }));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/workouts?c=core&eq=none");
    fireEvent.click(screen.getByRole("button", { name: /^All/ }));
    expect(replace).toHaveBeenLastCalledWith(null, "", "/workouts");
    replace.mockRestore();
  });

  it("treats an unknown category as All", () => {
    search = "c=deadlift";
    render(<WorkoutCatalogRoute />);
    expect(workoutLinks()).toHaveLength(16);
  });
});
