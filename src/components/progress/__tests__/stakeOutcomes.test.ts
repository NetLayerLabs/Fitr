import { describe, expect, it } from "vitest";
import { completedOnchain, stakeOutcomes } from "../stakeOutcomes";
import { localDayIndex } from "@/lib/storage/streak";

const cfg = { dayLengthSecs: 86_400, dayOffsetSecs: 0, commitCutoffSecs: 64_800, attestGraceSecs: 3_600, finalizeDelaySecs: 3_600 };
const DAY = 20_731;
const now = (DAY + 2) * 86_400 + 3_600; // two days later
const profile = (lastCompletedDay: number, mask: bigint) =>
  ({ hasCompleted: true, lastCompletedDay, completedDaysMask: mask, totalCommitted: 3, totalCompleted: 1, totalMissed: 1 }) as never;
const snap = (p: unknown) => ({ entries: [], cfg: cfg as never, profile: p as never });
const local = (day: number) => localDayIndex((day * 86_400 + 43_200) * 1000);
const stake = (day: number, amount = "25000000") => ({ day, crewId: "0", amount, owner: "Me", at: 0 });

describe("stakeOutcomes", () => {
  it("reads the completion mask relative to the last completed day", () => {
    const p = profile(DAY + 1, 0b11n);
    expect(completedOnchain(p, DAY + 1)).toBe(true);
    expect(completedOnchain(p, DAY)).toBe(true);
    expect(completedOnchain(p, DAY - 1)).toBe(false);
    expect(completedOnchain(null, DAY)).toBe(false);
  });

  it("a staked day that is not in the mask after it closed is missed, with the amount", () => {
    const out = stakeOutcomes(snap(profile(DAY + 1, 0b1n)), [stake(DAY)], "Me", now);
    expect(out.get(local(DAY))).toEqual({ kind: "missed", amount: 25_000_000n });
  });

  it("a staked day in the mask is verified; completed days without a stake record are verified too", () => {
    const out = stakeOutcomes(snap(profile(DAY + 1, 0b11n)), [stake(DAY)], "Me", now);
    expect(out.get(local(DAY))?.kind).toBe("verified");
    expect(out.get(local(DAY + 1))).toEqual({ kind: "verified", amount: 0n });
  });

  it("ignores other wallets and crew stakes; today's open stake stays open", () => {
    const today = DAY + 2;
    const out = stakeOutcomes(snap(null), [stake(DAY, "1"), { ...stake(DAY - 1), owner: "Other" }, { ...stake(DAY - 2), crewId: "7" }, stake(today)], "Me", now);
    expect(out.get(local(DAY))?.kind).toBe("missed");
    expect(out.has(local(DAY - 1))).toBe(false);
    expect(out.has(local(DAY - 2))).toBe(false);
    expect(out.get(local(today))?.kind).toBe("open");
  });
});
