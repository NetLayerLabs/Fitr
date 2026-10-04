import { describe, expect, it } from "vitest";
import { address, type Address } from "@solana/kit";
import { getDayStateDiscriminatorBytes, type UserProfile } from "@/lib/solana/vault/generated";
import { D0, makeDayState, makePool, T0 } from "@/lib/solana/vault/__tests__/fixtures";
import { aggregateDashboard, loadDashboard, POOL_MINT_OFFSET } from "../dashboard";
import { FakeChain, makeProfile, MINT, PROGRAM, seedDayState, seedPool, seedProfile, USER } from "./fakeChain";

const G = address("SysvarC1ock11111111111111111111111111111111");
const CREW = address("SysvarRent111111111111111111111111111111111");
const OTHER = address("Vote111111111111111111111111111111111111111");
const NOW = T0 + 3_600;

const prof = (user: Address, pool: Address, over: Partial<UserProfile>): UserProfile =>
  ({ discriminator: new Uint8Array(8), pool, ...makeProfile(user, over) }) as UserProfile;

describe("aggregateDashboard", () => {
  const globalPool = { address: G, pool: makePool({ outstanding: 300n, reserve: 50n, dailySponsorAmount: 10n }) };
  const crew = { address: CREW, pool: makePool({ crewId: 4n, outstanding: 100n, reserve: 5n }) };

  it("sums today, all-time, sponsor and crew numbers", () => {
    const s = aggregateDashboard({
      globalPool,
      pools: [globalPool, crew],
      dayStates: [
        makeDayState(D0, { totalStaked: 300n, committedCount: 3, completedCount: 1 }, G),
        makeDayState(D0, { totalStaked: 100n, committedCount: 1, completedCount: 1 }, CREW),
        makeDayState(D0 - 1, { finalized: true, sponsor: 10n, committedCount: 4, completedCount: 3 }, G),
        makeDayState(D0, { totalStaked: 999n }, OTHER), // unknown pool: ignored
      ],
      profiles: [
        prof(USER, G, { totalCommitted: 5, totalCompleted: 3, totalMissed: 1, totalBonusEarned: 70n, hasCompleted: true, lastCompletedDay: D0 - 1, completedDaysMask: 0b111n, bestStreak: 4 }),
        prof(OTHER, G, { totalCommitted: 2, totalCompleted: 1, totalMissed: 1, totalBonusEarned: 5n, hasCompleted: true, lastCompletedDay: D0 - 5, completedDaysMask: 1n, currentStreak: 1 }),
        prof(USER, CREW, { totalCommitted: 1, totalCompleted: 1, totalBonusEarned: 1n, hasCompleted: true, lastCompletedDay: D0, completedDaysMask: 1n }),
      ],
      nowSecs: NOW,
    });
    expect(s.today).toBe(D0);
    expect(s.crews).toBe(1);
    expect(s.todayStaked).toBe(400n);
    expect(s.todayCommitted).toBe(4);
    expect(s.todayCompleted).toBe(2);
    expect(s.heldForOpenCommitments).toBe(400n);
    expect(s.allTimeCommitments).toBe(8);
    expect(s.completionRate).toBeCloseTo(5 / 7);
    expect(s.redistributed).toBe(76n);
    expect(s.people).toBe(2);
    expect(s.sponsorReserve).toBe(55n);
    expect(s.dailySponsorAmount).toBe(10n);
    expect(s.recentSponsored).toBe(10n);
    expect(s.recentDays.map((d) => d.dayIndex)).toEqual([D0, D0 - 1]);
    // Only live streaks (done yesterday or today) in the global pool.
    expect(s.topStreaks).toEqual([{ wallet: USER, walletShort: "9WzD…AWWM", streak: 3, best: 4 }]);
    expect(s.asOfSecs).toBe(NOW);
  });

  it("has a null completion rate and empty lists before anything happened", () => {
    const s = aggregateDashboard({ globalPool, pools: [], dayStates: [], profiles: [], nowSecs: NOW });
    expect(s.completionRate).toBeNull();
    expect(s.recentDays).toEqual([]);
    expect(s.topStreaks).toEqual([]);
    expect(s.crews).toBe(0);
  });
});

describe("loadDashboard", () => {
  it("no_pool while the global pool does not exist", async () => {
    expect(await loadDashboard(new FakeChain().rpc(), { programAddress: PROGRAM, mint: MINT, nowSecs: NOW })).toEqual({ kind: "no_pool" });
  });

  it("reads pools (filtered by mint), day states and profiles", async () => {
    const chain = new FakeChain();
    const { pool } = await seedPool(chain, { outstanding: 7n });
    await seedPool(chain, { crewId: 2n });
    seedDayState(chain, OTHER, makeDayState(D0, { totalStaked: 42n, discriminator: getDayStateDiscriminatorBytes() }, pool));
    await seedProfile(chain, pool, makeProfile(USER, { totalCommitted: 1, totalCompleted: 1, totalBonusEarned: 3n }));
    const r = await loadDashboard(chain.rpc(), { programAddress: PROGRAM, mint: MINT, nowSecs: NOW });
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    expect(r.stats.crews).toBe(1);
    expect(r.stats.todayStaked).toBe(42n);
    expect(r.stats.redistributed).toBe(3n);
    expect(r.stats.heldForOpenCommitments).toBe(7n);
    const poolQuery = chain.gpaCalls[0] as { filters: Array<{ memcmp?: { offset: bigint } }> };
    expect(poolQuery.filters.some((f) => f.memcmp?.offset === BigInt(POOL_MINT_OFFSET))).toBe(true);
  });
});
