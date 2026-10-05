import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";
import { makeTranslator } from "@/lib/i18n";
import { en } from "@/lib/i18n/messages";
import {
  formatTimeLeft,
  formatTodayDate,
  goalAmount,
  goalNoun,
  goalParts,
  greetingFor,
  normalizeTodayState,
  spokenAmount,
  spokenTimeLeft,
} from "../today";

const t = makeTranslator("en", en, "today");
const tx = makeTranslator("en", en, "exercises");

const H = 3_600_000;
const M = 60_000;

describe("today helpers", () => {
  it("greets by hour", () => {
    expect(greetingFor(t, 4)).toBe("Good evening");
    expect(greetingFor(t, 5)).toBe("Good morning");
    expect(greetingFor(t, 11)).toBe("Good morning");
    expect(greetingFor(t, 12)).toBe("Good afternoon");
    expect(greetingFor(t, 17)).toBe("Good afternoon");
    expect(greetingFor(t, 18)).toBe("Good evening");
  });

  it("formats the date with weekday, day and month", () => {
    const text = formatTodayDate(new Date(2026, 9, 4, 12).getTime(), "en-GB");
    expect(text).toBe("Sunday 4 October");
  });

  it("formats time left", () => {
    expect(formatTimeLeft(t, 3 * H + 12 * M + 30_000, 0)).toBe("3h 12m left");
    expect(formatTimeLeft(t, 42 * M, 0)).toBe("42m left");
    expect(formatTimeLeft(t, 30_000, 0)).toBe("<1m left");
    expect(formatTimeLeft(t, 0, 0)).toBe("Deadline passed");
    expect(formatTimeLeft(t, -5, 0)).toBe("Deadline passed");
    expect(spokenTimeLeft(t, H + M, 0)).toBe("1 hour 1 minute left");
    expect(spokenTimeLeft(t, 2 * H, 0)).toBe("2 hours left");
  });

  it("names the goal", () => {
    expect(goalNoun("Push-ups", "reps", 20)).toBe("push-ups");
    expect(goalNoun("Plank", "seconds", 60)).toBe("seconds of plank");
    expect(goalParts(tx, "pushup", 20)).toEqual(["", " push-ups"]);
    expect(goalParts(tx, "plank", 45)).toEqual(["", " seconds of plank"]);
  });

  it("formats amounts in an exercise unit", () => {
    expect(goalAmount(t, 1, "reps")).toBe("1 rep");
    expect(goalAmount(t, 20, "reps")).toBe("20 reps");
    expect(goalAmount(t, 60, "seconds")).toBe("60 s");
    expect(spokenAmount(t, 12.7, "reps")).toBe("12 reps");
    expect(spokenAmount(t, 65, "seconds")).toBe("1 minute 5 seconds");
    expect(spokenAmount(t, 0, "seconds")).toBe("0 seconds");
  });

  it("falls back to can_commit for unknown states", () => {
    expect(normalizeTodayState(undefined)).toBe("can_commit");
    expect(normalizeTodayState("bogus")).toBe("can_commit");
    expect(normalizeTodayState("verified")).toBe("verified");
  });
});

describe("legacy tab redirects", () => {
  it("permanently redirects /history and /wallet", async () => {
    const redirects = await nextConfig.redirects!();
    const map = Object.fromEntries(
      (redirects as Array<{ source: string; destination: string; permanent?: boolean }>).map((r) => [
        r.source,
        [r.destination, r.permanent],
      ]),
    );
    expect(map["/history"]).toEqual(["/progress", true]);
    expect(map["/wallet"]).toEqual(["/you", true]);
  });

  it("keeps the existing security headers", async () => {
    const headers = await nextConfig.headers!();
    expect(headers.some((h) => h.source === "/sw.js")).toBe(true);
  });
});
