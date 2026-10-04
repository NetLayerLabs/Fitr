import { describe, expect, it } from "vitest";
import { address } from "@solana/kit";
import { CommitmentStatus, Exercise, type UserProfile } from "@/lib/solana/vault/generated";
import { D0, makeCommitment, makePool } from "@/lib/solana/vault/__tests__/fixtures";
import { dayCompleted, loadShareCard, mapShareCard, parseShareParams, streakEndingAt } from "../shareCard";
import { FakeChain, makeProfile, MINT, PROGRAM, seedCommitment, seedPool, seedProfile, USER } from "./fakeChain";

const POOL = address("SysvarC1ock11111111111111111111111111111111");
const C_ADDR = address("SysvarRent111111111111111111111111111111111");
const P_ADDR = address("Vote111111111111111111111111111111111111111");

/** Bits for days (last - i) for each i in `back`. */
function mask(back: number[]): bigint {
  return back.reduce((m, i) => m | (1n << BigInt(i)), 0n);
}

function profile(over: Partial<UserProfile>): UserProfile {
  return { discriminator: new Uint8Array(8), pool: POOL, ...makeProfile(USER, over) } as UserProfile;
}

describe("streakEndingAt", () => {
  it("counts consecutive completed days ending at the day", () => {
    const p = profile({ hasCompleted: true, lastCompletedDay: 100, completedDaysMask: mask([0, 1, 2, 4]) });
    expect(streakEndingAt(p, 100)).toBe(3);
    expect(streakEndingAt(p, 99)).toBe(2);
    expect(streakEndingAt(p, 97)).toBe(0);
    expect(streakEndingAt(p, 96)).toBe(1);
    expect(streakEndingAt(p, 101)).toBe(0);
  });

  it("adds the carry when the run fills the mask, null beyond it", () => {
    const p = profile({ hasCompleted: true, lastCompletedDay: 200, completedDaysMask: (1n << 64n) - 1n, streakCarry: 10 });
    expect(streakEndingAt(p, 200)).toBe(74);
    expect(streakEndingAt(p, 190)).toBe(64);
    expect(streakEndingAt(p, 100)).toBeNull();
    expect(dayCompleted(p, 137)).toBe(true);
    expect(dayCompleted(p, 136)).toBeNull();
  });

  it("is 0 before any completion", () => {
    expect(streakEndingAt(profile({}), 5)).toBe(0);
  });
});

describe("mapShareCard", () => {
  const pool = makePool();
  const base = {
    wallet: USER,
    dayIndex: D0,
    poolAddress: POOL,
    pool,
    commitmentAddress: C_ADDR,
    profileAddress: P_ADDR,
  };

  it("verified commitment: result, stake, streak and the headline", () => {
    const card = mapShareCard({
      ...base,
      commitment: makeCommitment(D0, { status: CommitmentStatus.Completed, reps: 32, goalTarget: 30, amount: 50_000_000n }, POOL),
      profile: profile({ hasCompleted: true, lastCompletedDay: D0, completedDaysMask: mask([0, 1, 2, 3, 4, 5, 6]), bestStreak: 9 }),
    });
    expect(card.state).toBe("verified");
    expect(card.challenge).toBe("32 push-ups");
    expect(card.stake).toBe("50 SKR");
    expect(card.streak).toBe(7);
    expect(card.bestStreak).toBe(9);
    expect(card.headline).toBe("Verified on-chain · 32 push-ups · Day streak 7");
    expect(card.dateLabel).toBe("Sep 25, 2026");
    expect(card.explorerAccount).toBe(C_ADDR);
    expect(card.isGlobalPool).toBe(true);
  });

  it("committed / revoked commitments are not shown as verified", () => {
    const committed = mapShareCard({ ...base, commitment: makeCommitment(D0, { exercise: Exercise.Plank, goalTarget: 60 }, POOL), profile: null });
    expect(committed.state).toBe("committed");
    expect(committed.challenge).toBe("60 s plank");
    expect(committed.headline).toBe("Committed on-chain · 60 s plank");
    const revoked = mapShareCard({ ...base, commitment: makeCommitment(D0, { status: CommitmentStatus.Revoked }, POOL), profile: null });
    expect(revoked.state).toBe("revoked");
    expect(revoked.streak).toBeNull();
  });

  it("after claim (commitment closed) the profile mask still proves the day", () => {
    const card = mapShareCard({
      ...base,
      commitment: null,
      profile: profile({ hasCompleted: true, lastCompletedDay: D0 + 2, completedDaysMask: mask([2, 3]) }),
    });
    expect(card.state).toBe("verified");
    expect(card.challenge).toBeNull();
    expect(card.streak).toBe(2);
    expect(card.explorerAccount).toBe(P_ADDR);
    expect(card.headline).toBe("Verified on-chain · Day streak 2");
  });

  it("ignores another wallet's or another day's accounts", () => {
    const other = address("SysvarS1otHashes111111111111111111111111111");
    const card = mapShareCard({
      ...base,
      commitment: makeCommitment(D0, { user: other, status: CommitmentStatus.Completed }, POOL),
      profile: { ...profile({ hasCompleted: true, lastCompletedDay: D0, completedDaysMask: 1n }), user: other },
    });
    expect(card.state).toBe("not_found");
    expect(card.explorerAccount).toBeNull();
  });
});

describe("parseShareParams", () => {
  it("validates wallet and day", () => {
    expect(parseShareParams(USER, "20721")).toEqual({ wallet: USER, dayIndex: 20721 });
    expect(parseShareParams("nope", "1")).toBeNull();
    expect(parseShareParams(USER, "-1")).toBeNull();
    expect(parseShareParams(USER, "1.5")).toBeNull();
    expect(parseShareParams(USER, "99999999999")).toBeNull();
  });
});

describe("loadShareCard", () => {
  it("reads pool + commitment + profile from the chain", async () => {
    const chain = new FakeChain();
    const { pool } = await seedPool(chain);
    await seedCommitment(chain, pool, makeCommitment(D0, { status: CommitmentStatus.Completed, reps: 25 }, pool));
    await seedProfile(chain, pool, makeProfile(USER, { hasCompleted: true, lastCompletedDay: D0, completedDaysMask: 3n }));
    const r = await loadShareCard(chain.rpc(), { programAddress: PROGRAM, mint: MINT, wallet: USER, dayIndex: D0 });
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.card.headline).toBe("Verified on-chain · 25 push-ups · Day streak 2");
  });

  it("no_pool while the vault is not deployed", async () => {
    const r = await loadShareCard(new FakeChain().rpc(), { programAddress: PROGRAM, mint: MINT, wallet: USER, dayIndex: D0 });
    expect(r).toEqual({ kind: "no_pool" });
  });
});
