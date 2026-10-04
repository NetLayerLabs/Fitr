// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EXERCISE_LIST } from "@/lib/exercises";
import LandingPage from "../LandingPage";
import { LANDING_LINKS } from "../links";

afterEach(cleanup);

describe("LandingPage", () => {
  it("marks its root for the full-width frame rule and has exactly one h1", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector('[data-page="landing"]')).not.toBeNull();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe("Put your word on the line.");
  });

  it("offers the APK download and the browser app, with the device note", () => {
    render(<LandingPage />);
    const downloads = screen.getAllByRole("link", { name: "Download for Android" });
    expect(downloads.length).toBeGreaterThanOrEqual(2);
    for (const a of downloads) expect(a.getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
    for (const a of screen.getAllByRole("link", { name: "Open in browser" })) {
      expect(a.getAttribute("href")).toBe("https://app.fitr.day");
    }
    expect(screen.getAllByText("Seeker & Android 9+ · APK").length).toBeGreaterThanOrEqual(2);
  });

  it("only links to in-page anchors or absolute fitr.day / app.fitr.day URLs", () => {
    const { container } = render(<LandingPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("#") || href.startsWith("https://app.fitr.day") || href.startsWith("https://fitr.day/")).toBe(true);
    }
    expect(hrefs).toContain(LANDING_LINKS.privacy);
    expect(hrefs).toContain(LANDING_LINKS.verification);
  });

  it("shows every exercise as a card linking into the app", () => {
    render(<LandingPage />);
    const section = screen.getByRole("region", { name: /exercises/i });
    for (const info of EXERCISE_LIST) {
      const link = within(section).getByRole("link", { name: new RegExp(info.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link.getAttribute("href")).toBe(`https://app.fitr.day/workout/${info.kind}`);
    }
  });

  it("uses root-relative art/brand images and gives every image an alt attribute", () => {
    const { container } = render(<LandingPage />);
    const imgs = Array.from(container.querySelectorAll("img"));
    expect(imgs.length).toBeGreaterThan(EXERCISE_LIST.length);
    for (const img of imgs) {
      expect(img.hasAttribute("alt")).toBe(true);
      expect(img.getAttribute("src")).toMatch(/^\/(art|brand)\//);
    }
  });

  it("never claims to be un-cheatable or move-to-earn", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/un-?cheatable|cheat-?proof/i);
    expect(text).toMatch(/cheat-resistant/i);
    expect(text).toMatch(/isn't move-to-earn/i);
  });
});
