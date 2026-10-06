// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it } from "vitest";
import LandingCredits from "@/app/landing/credits/page";
import LandingPrivacy from "@/app/landing/privacy/page";
import LandingVerification from "@/app/landing/verification/page";
import nextConfig from "../../../../next.config";
import { LANDING_ROUTES } from "../links";

afterEach(cleanup);

const PAGES: ReadonlyArray<[string, ComponentType, string]> = [
  ["verification", LandingVerification, "How verification works"],
  ["privacy", LandingPrivacy, "Privacy"],
  ["credits", LandingCredits, "Credits & licenses"],
];

describe("public info pages", () => {
  it.each(PAGES)("%s renders the app page inside the landing shell", (_slug, Page, title) => {
    const { container } = render(<Page />);
    expect(container.querySelector('[data-page="landing"]')).not.toBeNull();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(title);
    // The download lives in the footer (the header has no Download button).
    expect(screen.getByRole("link", { name: "Android APK" }).getAttribute("href")).toBe("https://fitr.day/download/fitr.apk");
  });

  it.each(PAGES)("%s never links into app.fitr.day; site links are absolute fitr.day", (_slug, Page) => {
    const { container } = render(<Page />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(container.innerHTML).not.toContain("app.fitr.day");
    for (const href of hrefs) {
      expect(href.startsWith("https://"), href).toBe(true);
    }
    expect(hrefs).toContain("https://fitr.day/");
    expect(hrefs).toContain("https://fitr.day/#how");
  });

  it("maps every public path to an existing /landing route", () => {
    expect(LANDING_ROUTES).toEqual({
      "/": "/landing",
      "/verification": "/landing/verification",
      "/privacy": "/landing/privacy",
      "/credits": "/landing/credits",
    });
  });

  it("next.config rewrites every public path on fitr.day and www.fitr.day (and only there)", async () => {
    const rewrites = await nextConfig.rewrites!();
    if (Array.isArray(rewrites)) throw new Error("expected grouped rewrites");
    for (const host of ["fitr.day", "www.fitr.day"]) {
      for (const [source, destination] of Object.entries(LANDING_ROUTES)) {
        const rule = rewrites.beforeFiles?.find((r) => r.source === source && r.has?.some((h) => h.type === "host" && h.value === host));
        expect(rule?.destination, `${host}${source}`).toBe(destination);
      }
    }
    for (const r of rewrites.beforeFiles ?? []) expect(r.has?.length, r.source).toBeGreaterThan(0);
  });

  it("sends app screens on fitr.day back to the public site, never on other hosts", async () => {
    const redirects = await nextConfig.redirects!();
    const onHost = (host: string) => redirects.filter((r) => r.has?.some((h) => h.type === "host" && h.value === host));
    for (const host of ["fitr.day", "www.fitr.day"]) {
      const map = new Map(onHost(host).map((r) => [r.source, r.destination]));
      for (const app of ["/commit", "/workouts", "/workout/:path*", "/progress", "/you", "/crew/:path*"]) expect(map.get(app), app).toBe("/");
      expect(map.get("/you/privacy")).toBe("/privacy");
      // Public routes are never redirected.
      for (const pub of ["/", "/pool", "/s/:path*", "/c/:path*", "/actions.json", "/api/actions/:path*"]) expect(map.has(pub), pub).toBe(false);
    }
    expect(onHost("app.fitr.day")).toEqual([]);
  });
});
