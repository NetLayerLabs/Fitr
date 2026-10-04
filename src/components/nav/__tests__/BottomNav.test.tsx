// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import BottomNav, { NAV_ITEMS, isBottomNavVisible, isNavItemActive } from "../BottomNav";

afterEach(() => {
  cleanup();
  pathname = "/";
});

function renderAt(path: string) {
  pathname = path;
  return render(<BottomNav />);
}

describe("BottomNav", () => {
  it("renders the five tabs in order with Commit in the centre", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Primary" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Today", "Workouts", "Commit", "Progress", "You"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["/", "/workouts", "/commit", "/progress", "/you"]);
    expect(NAV_ITEMS[2].primary).toBe(true);
    expect(NAV_ITEMS.filter((i) => i.primary)).toHaveLength(1);
  });

  it.each([
    ["/", "Today"],
    ["/workouts", "Workouts"],
    ["/commit", "Commit"],
    ["/progress", "Progress"],
    ["/you", "You"],
    ["/history", "Progress"],
    ["/wallet", "You"],
    ["/crew/123", "Commit"],
  ])("marks exactly one tab current at %s", (path, label) => {
    renderAt(path);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe(label);
  });

  it("is hidden on live workout screens", () => {
    const { container } = renderAt("/workout/pushup");
    expect(container.firstChild).toBeNull();
  });

  it("renders on /landing too (the landing page hides it with CSS, keeping hydration stable)", () => {
    expect(isBottomNavVisible("/landing")).toBe(true);
    expect(isBottomNavVisible("/")).toBe(true);
  });

  it("stays visible on an unknown /workout path (404)", () => {
    renderAt("/workout/nope");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
  });

  it("does not treat a prefix lookalike as active", () => {
    expect(isNavItemActive(NAV_ITEMS[1], "/workoutsx")).toBe(false);
    expect(isNavItemActive(NAV_ITEMS[0], "/progress")).toBe(false);
    expect(isNavItemActive(NAV_ITEMS[3], "/progress/week")).toBe(true);
  });
});
