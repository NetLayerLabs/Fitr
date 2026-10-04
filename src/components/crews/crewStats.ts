/**
 * Crew page math over on-chain accounts of ONE crew pool: today's members, the crew streak and
 * the leaderboard. Pure: no network, no React.
 */
import type { Address } from "@solana/kit";
import { exerciseFromCode } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { attestDeadline, effectiveDeadlineOf, type DayConfig } from "@/lib/solana/vault/day";
import { CommitmentStatus, type Commitment, type DayState, type UserProfile } from "@/lib/solana/vault/generated";

/* ------------------------------------------------------------------------------------------ */
/* Today's members                                                                             */
/* ------------------------------------------------------------------------------------------ */

export type MemberStatus = "committed" | "verified" | "missed" | "revoked";

export interface CrewMemberToday {
  user: Address;
  status: MemberStatus;
  exercise: ExerciseKind | null;
  goalTarget: number;
  amount: bigint;
}

const MEMBER_ORDER: Record<MemberStatus, number> = { verified: 0, committed: 1, revoked: 2, missed: 3 };

/**
 * Status of every commitment of the day: verified (attested), committed (still open), missed (the
 * attest deadline passed without a verification) or revoked (verification withdrawn, refunded).
 * Sorted verified first, then by stake (largest first), then address.
 */
export function crewMembersToday(
  commitments: readonly Commitment[],
  dayState: DayState | null,
  cfg: DayConfig,
  nowSecs: number,
): CrewMemberToday[] {
  const deadline = dayState ? effectiveDeadlineOf(dayState, cfg, nowSecs) : null;
  const seen = new Set<Address>();
  const out: CrewMemberToday[] = [];
  for (const c of commitments) {
    if (seen.has(c.user)) continue;
    seen.add(c.user);
    let status: MemberStatus;
    if (c.status === CommitmentStatus.Completed) status = "verified";
    else if (c.status === CommitmentStatus.Revoked) status = "revoked";
    else {
      const d = deadline ?? attestDeadline(c.dayIndex, cfg);
      status = dayState?.finalized || nowSecs > d ? "missed" : "committed";
    }
    out.push({ user: c.user, status, exercise: exerciseFromCode(c.exercise), goalTarget: c.goalTarget, amount: c.amount });
  }
  return out.sort(
    (a, b) =>
      MEMBER_ORDER[a.status] - MEMBER_ORDER[b.status] ||
      (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0) ||
      (a.user < b.user ? -1 : a.user > b.user ? 1 : 0),
  );
}

export interface MemberCounts {
  committed: number;
  verified: number;
  missed: number;
  revoked: number;
  total: number;
}

export function countMembers(members: readonly Pick<CrewMemberToday, "status">[]): MemberCounts {
  const c: MemberCounts = { committed: 0, verified: 0, missed: 0, revoked: 0, total: members.length };
  for (const m of members) c[m.status] += 1;
  return c;
}

/* ------------------------------------------------------------------------------------------ */
/* Crew streak                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export type CrewDayOutcome =
  /** Someone committed and every committed member was verified. */
  | "all_in"
  /** At least one committed member missed (or was revoked). */
  | "broken"
  /** Nobody committed (or the day was voided / swept). */
  | "empty"
  /** Not everyone is verified yet, but the day can still be verified. */
  | "pending";

type CrewDayInput = Pick<
  DayState,
  "dayIndex" | "committedCount" | "completedCount" | "revokedCount" | "voided" | "finalized" | "attestDeadline"
> &
  Partial<Pick<DayState, "finalizeDelaySecs" | "pausedSecsBase">>;

export function crewDayOutcome(ds: CrewDayInput | undefined, cfg: DayConfig, nowSecs: number): CrewDayOutcome {
  if (!ds || ds.voided || ds.committedCount === 0) return "empty";
  if (ds.revokedCount === 0 && ds.completedCount >= ds.committedCount) return "all_in";
  if (!ds.finalized && nowSecs <= effectiveDeadlineOf(ds, cfg, nowSecs)) return "pending";
  return "broken";
}

export interface CrewStreak {
  /** Consecutive days, ending today or yesterday, where everyone who committed was verified. */
  current: number;
  /** Longest such run among the days still on-chain. */
  best: number;
  /** Today counts already (everyone who committed is verified). */
  todayCounted: boolean;
}

/**
 * The crew streak: consecutive days on which at least one member committed and every committed
 * member was verified. Today (and yesterday, while it can still be verified) never break it:
 * an open day only counts once everyone is in. Days whose DayState was swept are unknown and
 * end the run, so the value is a lower bound once old days are cleaned up.
 */
export function crewStreak(
  days: readonly CrewDayInput[],
  today: number,
  cfg: DayConfig,
  nowSecs: number,
): CrewStreak {
  const byDay = new Map<number, CrewDayInput>();
  for (const d of days) byDay.set(d.dayIndex, d);

  let current = 0;
  let todayCounted = false;
  for (let d = today, first = true; d >= 0; d--, first = false) {
    const o = crewDayOutcome(byDay.get(d), cfg, nowSecs);
    if (o === "all_in") {
      current++;
      if (first) todayCounted = true;
      continue;
    }
    // Today (and a day still inside its verification window) may still turn green.
    if (o === "pending" || (first && o === "empty")) continue;
    break;
  }

  let best = current;
  let run = 0;
  let prev: number | null = null;
  for (const d of [...byDay.keys()].sort((a, b) => a - b)) {
    const all = crewDayOutcome(byDay.get(d), cfg, nowSecs) === "all_in";
    run = all ? (prev !== null && d === prev + 1 && run > 0 ? run + 1 : 1) : 0;
    prev = d;
    if (run > best) best = run;
  }
  return { current, best, todayCounted };
}

/* ------------------------------------------------------------------------------------------ */
/* Leaderboard                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export interface LeaderboardRow {
  user: Address;
  /** Days verified in this crew. */
  completed: number;
  /** Days committed in this crew. */
  committed: number;
  missed: number;
  /** Live streak: 0 once a day was skipped since the last verified day. */
  streak: number;
  bestStreak: number;
  /** Total bonus paid out from no-shows' forfeits (base units), on top of the returned stakes. */
  bonus: bigint;
  rank: number;
}

/** The on-chain streak, or 0 when the member's last verified day is older than yesterday. */
export function liveStreak(p: Pick<UserProfile, "hasCompleted" | "lastCompletedDay" | "currentStreak">, today: number): number {
  if (!p.hasCompleted) return 0;
  return p.lastCompletedDay >= today - 1 ? p.currentStreak : 0;
}

/**
 * One row per member (UserProfile of the crew pool): most verified days first, then the live
 * streak, then the bonus, then address. Equal (completed, streak, bonus) share a rank.
 */
export function crewLeaderboard(profiles: readonly UserProfile[], today: number): LeaderboardRow[] {
  const seen = new Set<Address>();
  const rows: Omit<LeaderboardRow, "rank">[] = [];
  for (const p of profiles) {
    if (seen.has(p.user)) continue;
    seen.add(p.user);
    rows.push({
      user: p.user,
      completed: p.totalCompleted,
      committed: p.totalCommitted,
      missed: p.totalMissed,
      streak: liveStreak(p, today),
      bestStreak: p.bestStreak,
      bonus: p.totalBonusEarned,
    });
  }
  rows.sort(
    (a, b) =>
      b.completed - a.completed ||
      b.streak - a.streak ||
      (a.bonus > b.bonus ? -1 : a.bonus < b.bonus ? 1 : 0) ||
      (a.user < b.user ? -1 : a.user > b.user ? 1 : 0),
  );
  const out: LeaderboardRow[] = [];
  rows.forEach((r, i) => {
    const prev = out[i - 1];
    const tie = prev && prev.completed === r.completed && prev.streak === r.streak && prev.bonus === r.bonus;
    out.push({ ...r, rank: tie ? prev.rank : i + 1 });
  });
  return out;
}
