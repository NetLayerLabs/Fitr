import { describe, expect, it } from "vitest";
import { formatClock, timeOfDayFormat } from "../format";

const EARLY = new Date(2026, 8, 26, 1, 7).getTime();
const AFTERNOON = new Date(2026, 8, 26, 13, 7).getTime();

describe("timeOfDayFormat", () => {
  it("keeps the day period on 12-hour clocks", () => {
    const format = timeOfDayFormat("en-US");
    expect(format.format(EARLY)).toMatch(/^1:07\sAM$/);
    expect(format.format(AFTERNOON)).toMatch(/^1:07\sPM$/);
  });

  it("uses a two-digit hour on 24-hour clocks, so a time never looks like an m:ss duration", () => {
    for (const locale of ["en-GB", "en-NG", "de-DE", "ja-JP", "es-ES"]) {
      const format = timeOfDayFormat(locale);
      expect(format.format(EARLY), locale).toBe("01:07");
      expect(format.format(AFTERNOON), locale).toBe("13:07");
      expect(format.format(EARLY), locale).not.toBe(formatClock(67_000));
    }
  });
});
