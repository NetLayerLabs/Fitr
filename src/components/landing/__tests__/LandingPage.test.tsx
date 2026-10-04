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

  it("offers only the APK download, with the device note, and no way into the web app", () => {
    render(<LandingPage />);
    const downloads = screen.getAllByRole("link", { name: "Download for Android" });
    expect(downloads.length).toBeGreaterThanOrEqual(2);
    for (const a of downloads) expect(a.getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
    const navPill = screen.getByRole("link", { name: "Download the Android app" });
    expect(navPill.getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
    expect(navPill.textContent).toBe("Download");
    expect(screen.queryByRole("link", { name: /open (in browser|app)/i })).toBeNull();
    expect(screen.getAllByText("Seeker & Android 9+ · APK").length).toBeGreaterThanOrEqual(2);
  });

  it("only links to in-page anchors or absolute fitr.day URLs, never app.fitr.day", () => {
    const { container } = render(<LandingPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("#") || href.startsWith("https://fitr.day/")).toBe(true);
    }
    expect(container.innerHTML).not.toContain("https://app.fitr.day");
    expect(hrefs).toContain(LANDING_LINKS.privacy);
    expect(hrefs).toContain(LANDING_LINKS.verification);
    expect(hrefs).toContain(LANDING_LINKS.credits);
    expect(hrefs).toContain("https://fitr.day/pool");
    // Every in-page anchor resolves to an element on the page.
    for (const href of hrefs.filter((h) => h.startsWith("#"))) {
      expect(container.querySelector(href), href).not.toBeNull();
    }
  });

  it("links the public pool dashboard as Live pool stats", () => {
    render(<LandingPage />);
    const links = screen.getAllByRole("link", { name: /live pool stats/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const a of links) expect(a.getAttribute("href")).toBe("https://fitr.day/pool");
  });

  it("explains sideloading in three steps, including the Play Protect prompt", () => {
    render(<LandingPage />);
    const steps = within(screen.getByRole("list", { name: "Install on Seeker" })).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(steps[2].textContent).toMatch(/More details.*Install anyway/);
  });

  it("shows every exercise as a non-interactive card", () => {
    render(<LandingPage />);
    const section = screen.getByRole("region", { name: /exercises/i });
    expect(within(section).queryAllByRole("link")).toHaveLength(0);
    for (const info of EXERCISE_LIST) {
      expect(within(section).getByText(info.name)).toBeTruthy();
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
