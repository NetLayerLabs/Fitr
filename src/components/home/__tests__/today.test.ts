import { describe, expect, it } from "vitest";
import nextConfig from "../../../../next.config";
import {
  formatTimeLeft,
  formatTodayDate,
  goalNoun,
  greetingFor,
  normalizeTodayState,
  spokenTimeLeft,
} from "../today";

const H = 3_600_000;
const M = 60_000;

describe("today helpers", () => {
  it("greets by hour", () => {
    expect(greetingFor(4)).toBe("Good evening");
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good afternoon");
    expect(greetingFor(18)).toBe("Good evening");
  });

  it("formats the date with weekday, day and month", () => {
    const text = formatTodayDate(new Date(2026, 9, 4, 12).getTime(), "en-GB");
    expect(text).toBe("Sunday 4 October");
  });

  it("formats time left", () => {
    expect(formatTimeLeft(3 * H + 12 * M + 30_000, 0)).toBe("3h 12m left");
    expect(formatTimeLeft(42 * M, 0)).toBe("42m left");
    expect(formatTimeLeft(30_000, 0)).toBe("<1m left");
    expect(formatTimeLeft(0, 0)).toBe("Deadline passed");
    expect(formatTimeLeft(-5, 0)).toBe("Deadline passed");
    expect(spokenTimeLeft(H + M, 0)).toBe("1 hour 1 minute left");
    expect(spokenTimeLeft(2 * H, 0)).toBe("2 hours left");
  });

  it("names the goal", () => {
    expect(goalNoun("Push-ups", "reps", 20)).toBe("push-ups");
    expect(goalNoun("Plank", "seconds", 60)).toBe("seconds of plank");
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
