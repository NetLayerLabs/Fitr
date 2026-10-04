import { describe, expect, it } from "vitest";
import {
  attestDeadline,
  canCommitAt,
  canFinalizeAt,
  effectiveDeadlineOf,
  finalizeAfterOf,
  pausedSecsTotal,
  commitDeadline,
  dayConfigFromPool,
  dayEnd,
  dayIndexAt,
  dayStart,
  DayMathError,
  toUnixSecs,
  isBlockedByPause,
  withGlobalPause,
  type DayConfig,
} from "../day";
import { D0, T0, makePool } from "./fixtures";

const cfg = (len: number, off = 0, cutoff = 0, grace = 0): DayConfig => ({
  dayLengthSecs: len,
  dayOffsetSecs: off,
  commitCutoffSecs: cutoff,
  attestGraceSecs: grace,
});
const DAY = 86_400;

describe("day math parity with math.rs golden values", () => {
  it("day_windows (24 h, offset 0)", () => {
    const c = cfg(DAY);
    expect(dayIndexAt(T0, c)).toBe(20_721);
    expect(dayStart(20_721, c)).toBe(T0);
    expect(dayEnd(20_721, c)).toBe(T0 + DAY);
    expect(dayIndexAt(T0 + DAY - 1, c)).toBe(20_721);
    expect(dayIndexAt(T0 + DAY, c)).toBe(20_722);
    expect(() => dayIndexAt(-1, c)).toThrow(DayMathError);
  });

  it("short days and offsets", () => {
    const c600 = cfg(600);
    expect(dayIndexAt(T0, c600)).toBe(2_983_824);
    expect(dayStart(2_983_824, c600)).toBe(T0);
    expect(dayEnd(2_983_824, c600)).toBe(1_790_295_000);
    expect(dayIndexAt(1_790_294_999, c600)).toBe(2_983_824);
    expect(dayIndexAt(1_790_295_000, c600)).toBe(2_983_825);

    const off = 5 * 3_600;
    const cOff = cfg(DAY, off);
    expect(dayIndexAt(T0 + off - 1, cOff)).toBe(20_720);
    expect(dayIndexAt(T0 + off, cOff)).toBe(20_721);
    expect(dayStart(20_721, cOff)).toBe(T0 + off);

    const c300 = cfg(300, 299);
    expect(dayIndexAt(299, c300)).toBe(0);
    expect(() => dayIndexAt(298, c300)).toThrow(DayMathError);
    expect(dayEnd(0, c300)).toBe(599);
    expect(() => dayIndexAt(0, cfg(0))).toThrow(DayMathError);
  });

  it("round trip: start(index(t)) <= t < end(index(t))", () => {
    for (const len of [300, 600, 3_600, DAY]) {
      for (const off of [0, Math.floor(len / 3), len - 1]) {
        const c = cfg(len, off);
        for (let t = 1_790_000_000; t < 1_790_000_000 + 3 * len; t += 97) {
          const d = dayIndexAt(t, c);
          expect(dayStart(d, c) <= t && t < dayEnd(d, c)).toBe(true);
        }
      }
    }
  });
});

describe("windows", () => {
  const mainnet = dayConfigFromPool(makePool());

  it("reads the pool's bigint config", () => {
    expect(mainnet).toEqual({
      dayLengthSecs: DAY,
      dayOffsetSecs: 0,
      commitCutoffSecs: 64_800,
      attestGraceSecs: 3_600,
      finalizeDelaySecs: 0,
      pause: { paused: false, pausedSince: 0, totalPausedSecs: 0 },
    });
  });

  it("commit: today before the cutoff (exclusive), tomorrow always, never yesterday or d+2", () => {
    expect(commitDeadline(D0, mainnet)).toBe(T0 + 64_800);
    expect(canCommitAt(D0, mainnet, T0)).toBe(true);
    expect(canCommitAt(D0, mainnet, T0 + 64_799)).toBe(true);
    expect(canCommitAt(D0, mainnet, T0 + 64_800)).toBe(false);
    expect(canCommitAt(D0 + 1, mainnet, T0 + 80_000)).toBe(true);
    expect(canCommitAt(D0 - 1, mainnet, T0 + 10)).toBe(false);
    expect(canCommitAt(D0 + 2, mainnet, T0 + 10)).toBe(false);
    expect(canCommitAt(D0, mainnet, -5)).toBe(false);
  });

  it("attest deadline is inclusive; finalize strictly after it (or the DayState snapshot)", () => {
    expect(attestDeadline(D0, mainnet)).toBe(T0 + DAY + 3_600);
    expect(canFinalizeAt(D0, mainnet, T0 + DAY + 3_600)).toBe(false);
    expect(canFinalizeAt(D0, mainnet, T0 + DAY + 3_601)).toBe(true);
    expect(canFinalizeAt(D0, mainnet, T0 + DAY + 3_601, BigInt(T0 + DAY + 7_200))).toBe(false);
  });

  it("finalize waits for the day's review window, any pause extension, and never runs while paused", () => {
    const dl = T0 + DAY + 3_600;
    const ds = { attestDeadline: BigInt(dl), finalizeDelaySecs: 14_400n, pausedSecsBase: 100n };
    expect(finalizeAfterOf(ds, mainnet, dl)).toBe(dl + 14_400);
    expect(canFinalizeAt(D0, mainnet, dl + 14_400, ds)).toBe(false);
    expect(canFinalizeAt(D0, mainnet, dl + 14_401, ds)).toBe(true);
    // 600 s of pauses since the day was created (total 700, base 100) push everything back
    const after = dayConfigFromPool(makePool({ totalPausedSecs: 700n, finalizeDelaySecs: 14_400n }));
    expect(after.finalizeDelaySecs).toBe(14_400);
    expect(effectiveDeadlineOf(ds, after, dl)).toBe(dl + 600);
    expect(canFinalizeAt(D0, after, dl + 15_000, ds)).toBe(false);
    expect(canFinalizeAt(D0, after, dl + 15_001, ds)).toBe(true);
    // an ongoing pause blocks finalize and keeps extending the attest window
    const paused = dayConfigFromPool(makePool({ paused: true, pausedSince: BigInt(dl - 50), totalPausedSecs: 100n }));
    expect(pausedSecsTotal(paused, dl + 1_000)).toBe(1_150);
    expect(effectiveDeadlineOf(ds, paused, dl + 1_000)).toBe(dl + 1_050);
    expect(canFinalizeAt(D0, paused, dl + 100_000, ds)).toBe(false);
    // without a DayState, the pool's current delay applies
    expect(canFinalizeAt(D0, after, dl + 14_400)).toBe(false);
    expect(canFinalizeAt(D0, after, dl + 14_401)).toBe(true);
  });

  it("toUnixSecs floors milliseconds", () => {
    expect(toUnixSecs(1_790_294_400_999)).toBe(T0);
  });
});

describe("crew days and the global pause (SPEC §2.7, mirrors DayState::pause_extension)", () => {
  const ds = { attestDeadline: 1_000n, finalizeDelaySecs: 10n, pausedSecsBase: 0n, globalPausedSecsBase: 0n };
  const base = { ...cfg(DAY), pause: { paused: false, pausedSince: 0, totalPausedSecs: 0 } };

  it("adds global pause time to crew days only", () => {
    const g = { paused: true, pausedSince: 100n, totalPausedSecs: 0n };
    const crew = withGlobalPause(base, g, true);
    expect(effectiveDeadlineOf(ds, crew, 150)).toBe(1_050);
    expect(isBlockedByPause(crew)).toBe(true);
    expect(canFinalizeAt(0, crew, 10_000, ds)).toBe(false);
    // the global pool's own config is untouched
    expect(withGlobalPause(base, g, false)).toBe(base);
    expect(effectiveDeadlineOf(ds, base, 150)).toBe(1_000);
  });

  it("counts only global pauses after the day's snapshot, plus the crew's own", () => {
    const crew = withGlobalPause(
      { ...base, pause: { paused: false, pausedSince: 0, totalPausedSecs: 50 } },
      { paused: false, pausedSince: 0n, totalPausedSecs: 200n },
      true,
    );
    expect(effectiveDeadlineOf(ds, crew, 500)).toBe(1_250);
    expect(effectiveDeadlineOf({ ...ds, globalPausedSecsBase: 200n }, crew, 500)).toBe(1_050);
    expect(finalizeAfterOf(ds, crew, 500)).toBe(1_260);
    expect(canFinalizeAt(0, crew, 1_261, ds)).toBe(true);
  });
});
