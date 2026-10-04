import { describe, expect, it } from "vitest";
import { dayConfigFromPool } from "@/lib/solana/vault/day";
import { CommitmentStatus, Exercise } from "@/lib/solana/vault/generated";
import type { VaultEntry, VaultSnapshot } from "@/lib/solana/vault/read";
import { D0, T0, ZERO, makeCommitment, makeDayState, makePool } from "@/lib/solana/vault/__tests__/fixtures";
import {
  claimables,
  commitTargetDay,
  deriveTodayCommitment,
  fallbackPlan,
  pickSettlement,
  type TodayInputs,
} from "../plan";

const DAY = 86_400;
const pool = makePool();
const cfg = dayConfigFromPool(pool);

function snap(entries: Array<Partial<VaultEntry> & { day: number }>, nowSecs = T0 + 100): VaultSnapshot {
  const days = [D0 + 1, D0, D0 - 1, D0 - 2];
  return {
    pool,
    poolAddress: ZERO,
    vaultAddress: ZERO,
    programAddress: ZERO,
    cfg,
    nowSecs,
    today: D0,
    entries: days.map((day) => ({ day, commitment: null, dayState: null, ...entries.find((e) => e.day === day) })),
    profile: null,
    deviceLock: null,
  };
}

const completedYesterday = {
  day: D0 - 1,
  commitment: makeCommitment(D0 - 1, { status: CommitmentStatus.Completed, weight: 100_000_000n }),
  dayState: makeDayState(D0 - 1, { finalized: true, distributable: 95_000_000n }),
};
const missedTwoDaysAgo = {
  day: D0 - 2,
  commitment: makeCommitment(D0 - 2),
  dayState: makeDayState(D0 - 2, { finalized: true }),
};

describe("commit target day", () => {
  it("today before the cutoff, tomorrow after it, none when both are taken", () => {
    expect(commitTargetDay(snap([]), T0 + 100)).toBe(D0);
    expect(commitTargetDay(snap([]), T0 + 64_800)).toBe(D0 + 1);
    const today = { day: D0, commitment: makeCommitment(D0), dayState: makeDayState(D0) };
    expect(commitTargetDay(snap([today]), T0 + 100)).toBe(D0 + 1);
    const tomorrow = { day: D0 + 1, commitment: makeCommitment(D0 + 1), dayState: makeDayState(D0 + 1) };
    expect(commitTargetDay(snap([today, tomorrow]), T0 + 100)).toBeNull();
  });

  it("uses the live clock even when the snapshot is from yesterday", () => {
    expect(commitTargetDay(snap([]), T0 + DAY + 5)).toBe(D0 + 1);
  });
});

describe("settlement choice", () => {
  it("prefers the newest claim over a missed close-out", () => {
    const s = snap([completedYesterday, missedTwoDaysAgo]);
    expect(pickSettlement(s, T0 + 100)).toEqual({ day: D0 - 1, kind: "claim", needsFinalize: false });
    expect(pickSettlement(snap([missedTwoDaysAgo]), T0 + 100)).toEqual({ day: D0 - 2, kind: "close_missed", needsFinalize: false });
    expect(pickSettlement(snap([]), T0 + 100)).toBeNull();
  });

  it("claimables carry exact payouts after finalize", () => {
    expect(claimables(snap([completedYesterday]), T0 + 100)).toEqual([
      { day: D0 - 1, payout: { principal: 100_000_000n, bonus: 47_500_000n, exact: true } },
    ]);
  });

  it("fallbackPlan: drop finalize on 6010, drop the settlement on 6009/6011 when committing", () => {
    const settle = { day: D0 - 1, kind: "claim" as const, needsFinalize: true };
    expect(fallbackPlan({ settle, commit: true }, 6010)).toEqual({ settle: { ...settle, needsFinalize: false }, commit: true });
    expect(fallbackPlan({ settle, commit: true }, 6009)).toEqual({ settle: null, commit: true });
    expect(fallbackPlan({ settle: { ...settle, needsFinalize: false }, commit: true }, 6011)).toEqual({ settle: null, commit: true });
    expect(fallbackPlan({ settle, commit: false }, 6009)).toBeNull();
    expect(fallbackPlan({ settle, commit: true }, 6023)).toBeNull();
    expect(fallbackPlan({ settle: null, commit: true }, 6010)).toBeNull();
  });
});

describe("deriveTodayCommitment (Today tab contract)", () => {
  const base: TodayInputs = {
    hasWallet: true,
    requireSgt: true,
    isSeeker: true,
    vault: "ready",
    snapshot: snap([]),
    nowSecs: T0 + 100,
    hasLocalGoalMet: () => false,
    formatAmount: (a) => `${a / 1_000_000n} SKR`,
  };

  it("gating states", () => {
    expect(deriveTodayCommitment({ ...base, hasWallet: false }).state).toBe("no_wallet");
    expect(deriveTodayCommitment({ ...base, isSeeker: false }).state).toBe("not_seeker");
    expect(deriveTodayCommitment({ ...base, requireSgt: false, isSeeker: false }).state).toBe("can_commit");
    expect(deriveTodayCommitment({ ...base, vault: "unavailable", snapshot: null }).state).toBe("vault_unavailable");
    expect(deriveTodayCommitment({ ...base, vault: "loading", snapshot: null }).state).toBe("loading");
    expect(deriveTodayCommitment({ ...base, vault: "error", snapshot: null }).state).toBe("vault_unavailable");
    expect(deriveTodayCommitment({ ...base, isSeeker: null }).state).toBe("loading");
  });

  it("can_commit carries the commit deadline", () => {
    expect(deriveTodayCommitment(base)).toEqual({ state: "can_commit", deadlineMs: (T0 + 64_800) * 1000 });
  });

  it("committed → verifying → verified for today's commitment", () => {
    const today = { day: D0, commitment: makeCommitment(D0, { exercise: Exercise.Plank, goalTarget: 90, amount: 25_000_000n }), dayState: makeDayState(D0) };
    const s = snap([today]);
    expect(deriveTodayCommitment({ ...base, snapshot: s })).toEqual({
      state: "committed",
      exercise: "plank",
      goalTarget: 90,
      amountLabel: "25 SKR",
      deadlineMs: (T0 + DAY) * 1000,
      claimableLabel: undefined,
      forDay: "today",
    });
    expect(deriveTodayCommitment({ ...base, snapshot: s, hasLocalGoalMet: (k, g) => k === "plank" && g === 90 }).state).toBe("verifying");
    const done = { ...today, commitment: { ...today.commitment, status: CommitmentStatus.Completed } };
    expect(deriveTodayCommitment({ ...base, snapshot: snap([done]) }).state).toBe("verified");
  });

  it("claimable when yesterday pays out and nothing is committed today", () => {
    expect(deriveTodayCommitment({ ...base, snapshot: snap([completedYesterday]) })).toEqual({
      state: "claimable",
      claimableLabel: "147 SKR",
    });
  });

  it("missed yesterday (not yet closed) when nothing is due today", () => {
    const missed = { day: D0 - 1, commitment: makeCommitment(D0 - 1, { amount: 5_000_000n }), dayState: makeDayState(D0 - 1) };
    // Within yesterday's 1 h attest grace it is not missed yet.
    expect(deriveTodayCommitment({ ...base, snapshot: snap([missed]) }).state).toBe("can_commit");
    expect(deriveTodayCommitment({ ...base, snapshot: snap([missed]), nowSecs: T0 + 3_601 })).toMatchObject({
      state: "missed",
      exercise: "pushup",
      amountLabel: "5 SKR",
    });
  });

  it("committed for tomorrow once today's window closed", () => {
    const tomorrow = { day: D0 + 1, commitment: makeCommitment(D0 + 1), dayState: makeDayState(D0 + 1) };
    const t = deriveTodayCommitment({ ...base, snapshot: snap([tomorrow]), nowSecs: T0 + 70_000 });
    expect(t).toMatchObject({ state: "committed", deadlineMs: (T0 + 2 * DAY) * 1000 });
  });

  it("revoked today is its own state, never 'verified'", () => {
    const today = {
      day: D0,
      commitment: makeCommitment(D0, { status: CommitmentStatus.Revoked, amount: 25_000_000n }),
      dayState: makeDayState(D0),
    };
    expect(deriveTodayCommitment({ ...base, snapshot: snap([today]) })).toMatchObject({
      state: "revoked",
      exercise: "pushup",
      amountLabel: "25 SKR",
    });
  });
});

describe("revoked commitments", () => {
  it("refund principal only (no bonus, never forfeited) once the day is final", () => {
    const revoked = {
      day: D0 - 1,
      commitment: makeCommitment(D0 - 1, { status: CommitmentStatus.Revoked, amount: 40_000_000n, weight: 40_000_000n }),
      dayState: makeDayState(D0 - 1, { finalized: true, distributable: 95_000_000n }),
    };
    expect(claimables(snap([revoked]), T0 + 100)).toEqual([
      { day: D0 - 1, payout: { principal: 40_000_000n, bonus: 0n, exact: true } },
    ]);
    expect(pickSettlement(snap([revoked]), T0 + 100)).toEqual({ day: D0 - 1, kind: "claim", needsFinalize: false });
  });
});
