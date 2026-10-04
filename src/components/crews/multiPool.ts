/**
 * A wallet can hold today's commitment in the global pool AND in any number of crews. These pure
 * helpers pick what the Today hero shows, list the day's commitments across pools, and choose
 * which pool a verified workout attests for. No network, no React.
 */
import type { ExerciseKind } from "@/lib/pose/types";
import type { TodayCommitment, TodayCommitmentState } from "@/components/stake/plan";

/** A pool's TodayCommitment tagged with its pool (crewId 0 = the global pool). */
export interface PoolTodayCommitment extends Omit<TodayCommitment, "crewId" | "crewName"> {
  crewId: bigint;
  /** "" for the global pool. */
  crewName: string;
}

/**
 * Lower = more urgent. An open goal beats everything (it can still be lost), then a workout being
 * verified, money waiting, a withdrawn verification, a miss, a verified day, and finally "you
 * could commit". Gate states (loading, no wallet...) only ever come from the global pool.
 */
export const TODAY_URGENCY: Readonly<Record<TodayCommitmentState, number>> = Object.freeze({
  committed: 0,
  verifying: 1,
  claimable: 2,
  revoked: 3,
  missed: 4,
  verified: 5,
  can_commit: 6,
  loading: 7,
  no_wallet: 8,
  not_seeker: 9,
  vault_unavailable: 10,
});

const GATE_STATES: ReadonlySet<TodayCommitmentState> = new Set(["loading", "no_wallet", "not_seeker", "vault_unavailable"]);

/**
 * The single commitment the Today hero shows. The global pool's state is the baseline (it alone
 * decides the gates); a crew wins only when it is strictly more urgent. Among equally urgent
 * crews the earliest deadline wins, then the lowest crew id (stable).
 */
export function mostUrgentToday(global: TodayCommitment, crews: readonly PoolTodayCommitment[]): PoolTodayCommitment {
  const { crewId: _c, crewName: _n, ...g } = global;
  void _c;
  void _n;
  let best: PoolTodayCommitment = { ...g, crewId: 0n, crewName: "" };
  if (GATE_STATES.has(global.state)) return best;
  for (const c of crews) {
    if (GATE_STATES.has(c.state)) continue;
    const a = TODAY_URGENCY[c.state];
    const b = TODAY_URGENCY[best.state];
    if (a < b) {
      best = c;
      continue;
    }
    if (a === b && best.crewId !== 0n) {
      const da = c.deadlineMs ?? Number.POSITIVE_INFINITY;
      const db = best.deadlineMs ?? Number.POSITIVE_INFINITY;
      if (da < db || (da === db && c.crewId < best.crewId)) best = c;
    }
  }
  return best;
}

/**
 * The commitments to list on the Commit tab: every pool's commitment for today (any state) or,
 * once today's window closed, for tomorrow. Most urgent first, then the global pool, then crews.
 */
export function commitmentsToday(all: readonly PoolTodayCommitment[]): PoolTodayCommitment[] {
  return all
    .filter((c) => c.exercise !== undefined && (c.forDay === "today" || c.forDay === "tomorrow"))
    .sort((a, b) => TODAY_URGENCY[a.state] - TODAY_URGENCY[b.state] || (a.crewId < b.crewId ? -1 : a.crewId > b.crewId ? 1 : 0));
}

/* ------------------------------------------------------------------------------------------ */
/* Which pool a workout verifies                                                               */
/* ------------------------------------------------------------------------------------------ */

export interface PoolStake {
  crewId: bigint;
  crewName: string;
  exercise: ExerciseKind;
  status: "committed" | "completed" | "revoked";
}

export interface WorkoutPoolChoice<T extends PoolStake> {
  /** The stake this workout attests for (or reports as already verified), else null. */
  chosen: T | null;
  /** Other open stakes for the same exercise the user can switch to. */
  alternatives: T[];
  /** No stake for this exercise, but an open one for another exercise. */
  otherExercise: ExerciseKind | null;
}

/**
 * The stake a workout of `exercise` should verify, among today's stakes in every pool:
 *  1. `preferredCrewId` (e.g. /workout/pushup?crew=<id> from the crew page) when it matches;
 *  2. else the first still-open stake for this exercise (global pool first, then crew id order);
 *  3. else an already verified one (the workout shows "verified today");
 *  4. else nothing, pointing at an open stake for another exercise if there is one.
 * Revoked stakes can never be verified again and are skipped.
 */
export function pickWorkoutPool<T extends PoolStake>(
  stakes: readonly T[],
  exercise: ExerciseKind,
  preferredCrewId: bigint | null = null,
): WorkoutPoolChoice<T> {
  const ordered = [...stakes].sort((a, b) => (a.crewId < b.crewId ? -1 : a.crewId > b.crewId ? 1 : 0));
  const same = ordered.filter((s) => s.exercise === exercise && s.status !== "revoked");
  const open = same.filter((s) => s.status === "committed");
  const preferred = preferredCrewId === null ? undefined : same.find((s) => s.crewId === preferredCrewId);
  const chosen = preferred ?? open[0] ?? same.find((s) => s.status === "completed") ?? null;
  if (chosen) {
    return { chosen, alternatives: open.filter((s) => s !== chosen), otherExercise: null };
  }
  const other = ordered.find((s) => s.status === "committed") ?? null;
  return { chosen: null, alternatives: [], otherExercise: other ? other.exercise : null };
}

/** `?crew=<id>` (or `crew=` in any query string) → crew id; null when absent or invalid. */
export function crewFromSearch(search: string | null | undefined): bigint | null {
  if (!search) return null;
  let raw: string | null;
  try {
    raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("crew");
  } catch {
    return null;
  }
  if (raw === null || !/^(0|[1-9][0-9]{0,19})$/.test(raw)) return null;
  const v = BigInt(raw);
  return v < 1n << 64n ? v : null;
}

/** /workout/<exercise>, with ?crew=<id> for a crew stake. */
export function workoutHrefFor(exercise: ExerciseKind, crewId: bigint | null | undefined): string {
  return crewId ? `/workout/${exercise}?crew=${crewId.toString()}` : `/workout/${exercise}`;
}
