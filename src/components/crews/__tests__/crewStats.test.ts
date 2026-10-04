import { describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { CommitmentStatus, Exercise } from "@/lib/solana/vault/generated";
import { D0, T0, USER, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";
import {
  countMembers,
  crewDayOutcome,
  crewLeaderboard,
  crewMembersToday,
  crewStreak,
  liveStreak,
} from "../crewStats";
import { makeProfile } from "./fakeChain";

const A = USER;
const B = address("Vote111111111111111111111111111111111111111");
const C = address("Stake11111111111111111111111111111111111111");
const POOL = address("SysvarC1ock11111111111111111111111111111111");
const cfg = dayConfigFromPool(makePool());
const DAY = 86_400;
/** Mid-morning of day D0. */
const NOW = T0 + 3 * 3600;

const allIn = (day: number, n = 2) => makeDayState(day, { committedCount: n, completedCount: n, finalized: true }, POOL);
const broken = (day: number) => makeDayState(day, { committedCount: 3, completedCount: 2, finalized: true }, POOL);

describe("crewMembersToday", () => {
  it("maps statuses and sorts verified first, then by stake", () => {
    const list = crewMembersToday(
      [
        makeCommitment(D0, { user: A, amount: 10n }),
        makeCommitment(D0, { user: B, status: CommitmentStatus.Completed, amount: 5n }),
        makeCommitment(D0, { user: C, status: CommitmentStatus.Revoked, amount: 50n, exercise: Exercise.Plank }),
      ],
      makeDayState(D0, {}, POOL),
      cfg,
      NOW,
    );
    expect(list.map((m) => [m.user, m.status])).toEqual([
      [B, "verified"],
      [A, "committed"],
      [C, "revoked"],
    ]);
    expect(list[2].exercise).toBe("plank");
    expect(countMembers(list)).toEqual({ committed: 1, verified: 1, missed: 0, revoked: 1, total: 3 });
  });

  it("an open commitment is missed after the attest deadline (or once the day is finalized)", () => {
    const c = [makeCommitment(D0, { user: A })];
    const ds = makeDayState(D0, {}, POOL);
    const deadline = Number(ds.attestDeadline);
    expect(crewMembersToday(c, ds, cfg, deadline)[0].status).toBe("committed");
    expect(crewMembersToday(c, ds, cfg, deadline + 1)[0].status).toBe("missed");
    expect(crewMembersToday(c, { ...ds, finalized: true }, cfg, NOW)[0].status).toBe("missed");
    // Without a DayState the pool rule applies: day end + grace.
    expect(crewMembersToday(c, null, cfg, (D0 + 1) * DAY + 3_600 + 1)[0].status).toBe("missed");
  });

  it("deduplicates by user", () => {
    const list = crewMembersToday([makeCommitment(D0, { user: A }), makeCommitment(D0, { user: A })], null, cfg, NOW);
    expect(list).toHaveLength(1);
  });
});

describe("crewDayOutcome", () => {
  it("classifies a day", () => {
    expect(crewDayOutcome(undefined, cfg, NOW)).toBe("empty");
    expect(crewDayOutcome(makeDayState(D0, { committedCount: 0, completedCount: 0 }), cfg, NOW)).toBe("empty");
    expect(crewDayOutcome(makeDayState(D0, { voided: true }), cfg, NOW)).toBe("empty");
    expect(crewDayOutcome(allIn(D0 - 1), cfg, NOW)).toBe("all_in");
    expect(crewDayOutcome(broken(D0 - 1), cfg, NOW)).toBe("broken");
    // Today: 2 of 3 so far, the day is still open.
    expect(crewDayOutcome(makeDayState(D0, { committedCount: 3, completedCount: 2 }), cfg, NOW)).toBe("pending");
    // Revoked never counts as all in.
    expect(crewDayOutcome(makeDayState(D0 - 1, { committedCount: 2, completedCount: 2, revokedCount: 1, finalized: true }), cfg, NOW)).toBe("broken");
  });
});

describe("crewStreak", () => {
  it("counts back from yesterday while today is still open", () => {
    const days = [allIn(D0 - 1), allIn(D0 - 2), allIn(D0 - 3), broken(D0 - 4), allIn(D0 - 5), makeDayState(D0, { committedCount: 2, completedCount: 1 }, POOL)];
    expect(crewStreak(days, D0, cfg, NOW)).toEqual({ current: 3, best: 3, todayCounted: false });
  });

  it("includes today once everyone is in", () => {
    const days = [allIn(D0), allIn(D0 - 1)];
    expect(crewStreak(days, D0, cfg, NOW)).toEqual({ current: 2, best: 2, todayCounted: true });
  });

  it("an empty yesterday ends the run; an empty today does not", () => {
    expect(crewStreak([allIn(D0 - 2)], D0, cfg, NOW).current).toBe(0);
    expect(crewStreak([allIn(D0 - 1), allIn(D0 - 2)], D0, cfg, NOW).current).toBe(2);
  });

  it("yesterday inside its grace window is pending, not broken", () => {
    const early = D0 * DAY + 600; // 10 minutes into today: yesterday's grace (1 h) still runs
    const yesterday = makeDayState(D0 - 1, { committedCount: 2, completedCount: 1 }, POOL);
    expect(crewStreak([yesterday, allIn(D0 - 2)], D0, cfg, early).current).toBe(1);
    expect(crewStreak([{ ...yesterday, finalized: true }, allIn(D0 - 2)], D0, cfg, early).current).toBe(0);
  });

  it("best is the longest consecutive all-in run on record", () => {
    const days = [allIn(D0 - 10), allIn(D0 - 9), allIn(D0 - 8), allIn(D0 - 7), broken(D0 - 6), allIn(D0 - 1)];
    expect(crewStreak(days, D0, cfg, NOW)).toMatchObject({ current: 1, best: 4 });
    // A gap (swept / empty day) splits runs.
    expect(crewStreak([allIn(D0 - 5), allIn(D0 - 3)], D0, cfg, NOW).best).toBe(1);
  });

  it("is zero for a brand-new crew", () => {
    expect(crewStreak([], D0, cfg, NOW)).toEqual({ current: 0, best: 0, todayCounted: false });
  });
});

describe("crewLeaderboard", () => {
  it("ranks by verified days, then live streak, then bonus; ties share a rank", () => {
    const rows = crewLeaderboard(
      [
        makeProfile(POOL, A, { totalCompleted: 5, totalCommitted: 6, currentStreak: 2, hasCompleted: true, lastCompletedDay: D0 - 1, totalBonusEarned: 10n }),
        makeProfile(POOL, B, { totalCompleted: 7, totalCommitted: 7, currentStreak: 7, hasCompleted: true, lastCompletedDay: D0 - 5, bestStreak: 7 }),
        makeProfile(POOL, C, { totalCompleted: 5, totalCommitted: 5, currentStreak: 2, hasCompleted: true, lastCompletedDay: D0, totalBonusEarned: 10n }),
      ],
      D0,
    );
    expect(rows.map((r) => [r.user, r.rank, r.streak])).toEqual([
      [B, 1, 0], // old streak is no longer live
      ...([
        [A, 2, 2],
        [C, 2, 2],
      ].sort((x, y) => ((x[0] as string) < (y[0] as string) ? -1 : 1)) as Array<[string, number, number]>),
    ]);
    expect(rows[0]).toMatchObject({ completed: 7, bestStreak: 7, bonus: 0n });
  });

  it("deduplicates and handles members with nothing verified", () => {
    const rows = crewLeaderboard([makeProfile(POOL, A, { totalCommitted: 1, totalMissed: 1 }), makeProfile(POOL, A)], D0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ completed: 0, streak: 0, missed: 1, rank: 1 });
  });

  it("liveStreak keeps a streak alive through yesterday only", () => {
    const p = { hasCompleted: true, currentStreak: 4, lastCompletedDay: D0 - 1 };
    expect(liveStreak(p, D0)).toBe(4);
    expect(liveStreak({ ...p, lastCompletedDay: D0 }, D0)).toBe(4);
    expect(liveStreak({ ...p, lastCompletedDay: D0 - 2 }, D0)).toBe(0);
    expect(liveStreak({ ...p, hasCompleted: false }, D0)).toBe(0);
  });
});
