// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CreditsPage from "@/app/you/credits/page";
import PrivacyPage from "@/app/you/privacy/page";
import VerificationPage from "@/app/you/verification/page";

// The pages read the language from the request cookie; tests render them in English.
vi.mock("@/lib/i18n/server", async () => {
  const { makeTranslator } = await import("@/lib/i18n");
  const { en } = await import("@/lib/i18n/messages");
  return { getT: async (ns: "you" | "exercises") => makeTranslator("en", en, ns) };
});

afterEach(cleanup);

describe("You info pages", () => {
  it("explains verification honestly", async () => {
    render(await VerificationPage());
    expect(screen.getByRole("heading", { level: 1, name: "How verification works" })).toBeTruthy();
    expect(document.body.textContent).toMatch(/cheat-resistant, not cheat-proof/);
    expect(document.body.textContent).toMatch(/live challenges/);
    expect(document.body.textContent).not.toMatch(/un-?cheatable/i);
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/you");
  });

  it("states that video never leaves the phone and skeleton points are sent only for stakes", async () => {
    render(await PrivacyPage());
    expect(document.body.textContent).toMatch(/Your camera video never leaves your phone/);
    expect(screen.getByRole("heading", { name: "Staked workouts" })).toBeTruthy();
    expect(document.body.textContent).toMatch(/skeleton points/);
  });

  it("lists open-source licenses", async () => {
    render(await CreditsPage());
    expect(screen.getByRole("link", { name: /MediaPipe/ })).toBeTruthy();
    expect(screen.getAllByText("Apache-2.0").length).toBeGreaterThan(0);
  });
});
