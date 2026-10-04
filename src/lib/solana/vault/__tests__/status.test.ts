import { describe, expect, it } from "vitest";
import { dayConfigFromPool } from "../day";
import { CommitmentStatus } from "../generated";
import {
  claimOpensAt,
  deriveUserDayStatus,
  effectiveAttestDeadline,
  estimatePayout,
  projectedDistributable,
  settlementFor,
  type StatusEntry,
} from "../status";
import { D0, T0, makeCommitment, makeDayState, makePool } from "./fixtures";

const cfg = dayConfigFromPool(makePool());
const DAY = 86_400;
const deadline = T0 + DAY + 3_600; // attest deadline of D0 (inclusive)

const committed = { status: CommitmentStatus.Committed };
const completed = { status: CommitmentStatus.Completed };
const revoked = { status: CommitmentStatus.Revoked };
const open = { finalized: false, voided: false, attestDeadline: BigInt(deadline) };
const fin = { ...open, finalized: true };
const voided = { ...open, voided: true };

const e = (commitment: StatusEntry["commitment"], dayState: StatusEntry["dayState"], day = D0): StatusEntry => ({
  day,
  commitment,
  dayState,
});

describe("deriveUserDayStatus table", () => {
  const cases: Array<[string, StatusEntry, number, string]> = [
    ["no commitment, before cutoff", e(null, null), T0 + 10, "can_commit"],
    ["no commitment, after cutoff, day running", e(null, null), T0 + 70_000, "commit_closed"],
    ["no commitment, tomorrow from today evening", e(null, null, D0 + 1), T0 + 70_000, "can_commit"],
    ["no commitment, day over", e(null, null), T0 + DAY, "resolved"],
    ["committed, window open", e(committed, open), T0 + 70_000, "committed"],
    ["committed, at the deadline (inclusive)", e(committed, open), deadline, "committed"],
    ["committed, after the deadline, not finalized", e(committed, open), deadline + 1, "missed"],
    ["committed, finalized", e(committed, fin), deadline + 50, "missed"],
    ["completed, before deadline", e(completed, open), T0 + 80_000, "completed_pending"],
    ["completed, after deadline, not finalized", e(completed, open), deadline + 1, "claimable"],
    ["completed, finalized", e(completed, fin), deadline + 100, "claimable"],
    ["committed, voided day", e(committed, voided), T0 + 100, "claimable"],
    ["revoked, before the deadline", e(revoked, open), T0 + 80_000, "revoked"],
    ["revoked, after the deadline", e(revoked, open), deadline + 1, "claimable"],
    ["revoked, finalized", e(revoked, fin), deadline + 1, "claimable"],
    ["revoked, voided day", e(revoked, voided), T0 + 100, "claimable"],
  ];
  it.each(cases)("%s", (_name, entry, now, want) => {
    expect(deriveUserDayStatus(entry, cfg, now)).toBe(want);
  });

  it("the DayState snapshot deadline wins over the pool's current grace", () => {
    const snap = { ...open, attestDeadline: BigInt(deadline + 1_000) };
    expect(deriveUserDayStatus(e(committed, snap), cfg, deadline + 500)).toBe("committed");
  });
});

describe("finalize review window and pauses", () => {
  const delayed = { ...open, finalizeDelaySecs: 7_200n, pausedSecsBase: 0n };
  it("a completed day is claimable only once finalize_day is possible", () => {
    expect(deriveUserDayStatus(e(completed, delayed), cfg, deadline + 1)).toBe("completed_pending");
    expect(deriveUserDayStatus(e(completed, delayed), cfg, deadline + 7_200)).toBe("completed_pending");
    expect(deriveUserDayStatus(e(completed, delayed), cfg, deadline + 7_201)).toBe("claimable");
    expect(claimOpensAt(e(completed, delayed), cfg)).toBe(deadline + 7_200);
  });

  it("a missed day shows as missed at the deadline but settles only after the review window", () => {
    expect(deriveUserDayStatus(e(committed, delayed), cfg, deadline + 1)).toBe("missed");
    expect(settlementFor(e(committed, delayed), cfg, deadline + 1)).toBeNull();
    expect(settlementFor(e(committed, delayed), cfg, deadline + 7_201)).toEqual({
      day: D0,
      kind: "close_missed",
      needsFinalize: true,
    });
  });

  it("a pause extends the attest window and blocks finalize", () => {
    const pausedCfg = dayConfigFromPool(makePool({ paused: true, pausedSince: BigInt(deadline - 100) }));
    // still verifiable 1 h after the nominal deadline: the pause pushed it back
    expect(deriveUserDayStatus(e(committed, open), pausedCfg, deadline + 3_600)).toBe("committed");
    expect(effectiveAttestDeadline(e(committed, open), pausedCfg, deadline + 3_600)).toBe(deadline + 3_700);
    expect(deriveUserDayStatus(e(completed, open), pausedCfg, deadline + 3_600)).toBe("completed_pending");
    expect(settlementFor(e(completed, open), pausedCfg, deadline + 3_600)).toBeNull();
    // after the pause: 500 s of extension remain
    const after = dayConfigFromPool(makePool({ totalPausedSecs: 500n }));
    expect(deriveUserDayStatus(e(committed, open), after, deadline + 500)).toBe("committed");
    expect(deriveUserDayStatus(e(committed, open), after, deadline + 501)).toBe("missed");
    expect(deriveUserDayStatus(e(completed, open), after, deadline + 501)).toBe("claimable");
  });
});

describe("settlementFor", () => {
  it("claim, with finalize bundled only when the day is not finalized/voided", () => {
    expect(settlementFor(e(completed, open), cfg, deadline + 1)).toEqual({ day: D0, kind: "claim", needsFinalize: true });
    expect(settlementFor(e(completed, fin), cfg, deadline + 1)).toEqual({ day: D0, kind: "claim", needsFinalize: false });
    expect(settlementFor(e(committed, voided), cfg, T0)).toEqual({ day: D0, kind: "claim", needsFinalize: false });
  });

  it("close_missed for a missed day, nothing for live ones", () => {
    expect(settlementFor(e(committed, fin), cfg, deadline + 1)).toEqual({ day: D0, kind: "close_missed", needsFinalize: false });
    expect(settlementFor(e(committed, open), cfg, T0 + 10)).toBeNull();
    expect(settlementFor(e(null, null), cfg, T0 + 10)).toBeNull();
  });
});

describe("payouts mirror math.rs (worked example: 3 × 100 SKR, 2 complete, 5% fee)", () => {
  const ds = makeDayState(D0);
  it("projected distributable = slashed − fee (+ sponsor ≤ reserve)", () => {
    expect(projectedDistributable(ds)).toBe(95_000_000n);
    // the sponsor draw is capped by the day's snapshot, not the pool's current setting
    expect(projectedDistributable(ds, { dailySponsorAmount: 50n, reserve: 40n })).toBe(95_000_000n);
    expect(projectedDistributable({ ...ds, sponsorCap: 50n }, { dailySponsorAmount: 0n, reserve: 40n })).toBe(95_000_040n);
    expect(projectedDistributable({ ...ds, sponsorCap: 30n }, { dailySponsorAmount: 0n, reserve: 40n })).toBe(95_000_030n);
    expect(projectedDistributable({ ...ds, completedCount: 0 })).toBe(0n);
  });

  it("each completer receives 147.5 SKR", () => {
    const c = makeCommitment(D0, { status: CommitmentStatus.Completed, weight: 100_000_000n });
    expect(estimatePayout({ commitment: c, dayState: ds })).toEqual({ principal: 100_000_000n, bonus: 47_500_000n, exact: false });
    const finalized = { ...ds, finalized: true, distributable: 95_000_000n };
    expect(estimatePayout({ commitment: c, dayState: finalized })).toEqual({
      principal: 100_000_000n,
      bonus: 47_500_000n,
      exact: true,
    });
  });

  it("voided → principal only; missed → nothing", () => {
    const c = makeCommitment(D0);
    expect(estimatePayout({ commitment: c, dayState: { ...ds, voided: true } })).toEqual({
      principal: 100_000_000n,
      bonus: 0n,
      exact: true,
    });
    expect(estimatePayout({ commitment: c, dayState: ds })).toBeNull();
  });

  it("revoked stake is refunded, never forfeited", () => {
    // 300 staked, 100 completed, 100 revoked, 100 missed: only 100 is slashed
    const d = { ...ds, completedCount: 1, completedStake: 100_000_000n, revokedStake: 100_000_000n };
    expect(projectedDistributable(d)).toBe(95_000_000n);
    const all = { ...ds, completedCount: 2, completedStake: 200_000_000n, revokedStake: 100_000_000n };
    expect(projectedDistributable(all)).toBe(0n);
    const r = makeCommitment(D0, { status: CommitmentStatus.Revoked });
    expect(estimatePayout({ commitment: r, dayState: d })).toEqual({ principal: 100_000_000n, bonus: 0n, exact: true });
  });

  it("bonus floors like the program", () => {
    const c = makeCommitment(D0, { status: CommitmentStatus.Completed, weight: 1n });
    const d = { ...ds, finalized: true, distributable: 10n, completedWeight: 3n };
    expect(estimatePayout({ commitment: c, dayState: d })?.bonus).toBe(3n);
  });
});
