/**
 * "Verified on-chain" share card: everything shown on /s/<wallet>/<day> and its Open Graph image
 * comes from the on-chain Commitment + UserProfile (never from the URL), so a card can't be faked
 * by editing the link. Mapping is pure; `loadShareCard` reads the chain through an injected RPC.
 */
import {
  address,
  fetchEncodedAccounts,
  isAddress,
  type Address,
  type GetMultipleAccountsApi,
  type Rpc,
} from "@solana/kit";
import { EXERCISES } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { shortenAddress } from "@/lib/solana/format";
import { getPoolAddresses, getUserDayAddresses } from "@/lib/solana/vault/addresses";
import { dayConfigFromPool, dayStart } from "@/lib/solana/vault/day";
import {
  CommitmentStatus,
  getCommitmentDecoder,
  getCommitmentDiscriminatorBytes,
  getPoolDecoder,
  getPoolDiscriminatorBytes,
  getUserProfileDecoder,
  getUserProfileDiscriminatorBytes,
  type Commitment,
  type Pool,
  type UserProfile,
} from "@/lib/solana/vault/generated";
import { decodeOwned } from "@/lib/solana/vault/read";
import { challengeLabel, crewName, exerciseKindOf, skrPretty } from "./challenge";

export type ShareState =
  /** Attested complete (Commitment still open, or settled and the profile's day mask confirms it). */
  | "verified"
  /** Committed, workout not verified yet. */
  | "committed"
  /** The verification was revoked. */
  | "revoked"
  /** No record of this day for this wallet in this pool. */
  | "not_found";

export interface ShareCardData {
  state: ShareState;
  wallet: Address;
  walletShort: string;
  dayIndex: number;
  /** Pool address (global or crew). */
  pool: Address;
  isGlobalPool: boolean;
  crewName: string | null;
  /** null once the commitment was claimed (only the profile's day mask remains). */
  exercise: ExerciseKind | null;
  goal: number | null;
  /** Verified reps (or seconds held). */
  result: number | null;
  /** "30 push-ups" (the verified result, else the goal). */
  challenge: string | null;
  /** Stake label, e.g. "50 SKR". */
  stake: string | null;
  /** Consecutive completed days ending at `dayIndex` (null when unknown). */
  streak: number | null;
  bestStreak: number | null;
  /** UTC date the pool day started, "Oct 4, 2026". */
  dateLabel: string | null;
  /** Account to inspect on the explorer: the Commitment, else the UserProfile. */
  explorerAccount: Address | null;
  /** "Verified on-chain · 30 push-ups · Day streak 7". */
  headline: string;
}

const MASK_BITS = 64;

/**
 * Consecutive completed days ending at `day`, from the profile's 64-day completion mask
 * (bit i ⇔ day lastCompletedDay − i) plus `streakCarry` beyond it. null when `day` is out of reach.
 */
export function streakEndingAt(
  profile: Pick<UserProfile, "hasCompleted" | "lastCompletedDay" | "completedDaysMask" | "streakCarry">,
  day: number,
): number | null {
  if (!profile.hasCompleted || day > profile.lastCompletedDay) return 0;
  const i0 = profile.lastCompletedDay - day;
  if (i0 >= MASK_BITS) return null;
  const mask = BigInt.asUintN(64, profile.completedDaysMask);
  let n = 0;
  for (let i = i0; i < MASK_BITS; i++) {
    if (((mask >> BigInt(i)) & 1n) === 0n) return n;
    n++;
  }
  return n + profile.streakCarry;
}

/** Whether the profile's mask says `day` was completed (null when out of the mask's reach). */
export function dayCompleted(
  profile: Pick<UserProfile, "hasCompleted" | "lastCompletedDay" | "completedDaysMask">,
  day: number,
): boolean | null {
  if (!profile.hasCompleted || day > profile.lastCompletedDay) return false;
  const i = profile.lastCompletedDay - day;
  if (i >= MASK_BITS) return null;
  return ((BigInt.asUintN(64, profile.completedDaysMask) >> BigInt(i)) & 1n) === 1n;
}

function dateLabel(unixSecs: number): string {
  return new Date(unixSecs * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export interface ShareInputs {
  wallet: Address;
  dayIndex: number;
  poolAddress: Address;
  pool: Pick<
    Pool,
    "crewId" | "name" | "dayOffsetSecs" | "dayLengthSecs" | "commitCutoffSecs" | "attestGraceSecs"
  >;
  commitment: Commitment | null;
  commitmentAddress: Address;
  profile: UserProfile | null;
  profileAddress: Address;
  tokenLabel?: string;
}

/** Pure: on-chain accounts → what the card shows. */
export function mapShareCard(i: ShareInputs): ShareCardData {
  const c = i.commitment && i.commitment.user === i.wallet && i.commitment.dayIndex === i.dayIndex ? i.commitment : null;
  const p = i.profile && i.profile.user === i.wallet ? i.profile : null;
  const kind = c ? exerciseKindOf(c.exercise) : null;
  let state: ShareState = "not_found";
  if (c) {
    state =
      c.status === CommitmentStatus.Completed ? "verified" : c.status === CommitmentStatus.Revoked ? "revoked" : "committed";
  } else if (p && dayCompleted(p, i.dayIndex)) {
    state = "verified";
  }
  const goal = c ? c.goalTarget : null;
  const result = c && c.status === CommitmentStatus.Completed ? c.reps : null;
  const challenge = kind ? challengeLabel(kind, result ?? goal ?? 0) : null;
  const streak = p && state === "verified" ? streakEndingAt(p, i.dayIndex) : null;
  let start: number | null = null;
  try {
    start = dayStart(i.dayIndex, dayConfigFromPool(i.pool));
  } catch {
    start = null;
  }
  const parts: string[] = [];
  if (state === "verified") parts.push("Verified on-chain");
  else if (state === "committed") parts.push("Committed on-chain");
  else if (state === "revoked") parts.push("Not verified");
  else parts.push("No commitment found");
  if (challenge && state !== "not_found") parts.push(challenge);
  if (streak && streak > 0) parts.push(`Day streak ${streak}`);
  return {
    state,
    wallet: i.wallet,
    walletShort: shortenAddress(i.wallet),
    dayIndex: i.dayIndex,
    pool: i.poolAddress,
    isGlobalPool: i.pool.crewId === 0n,
    crewName: crewName(i.pool),
    exercise: kind,
    goal,
    result,
    challenge,
    stake: c ? `${skrPretty(c.amount)} ${i.tokenLabel ?? "SKR"}` : null,
    streak,
    bestStreak: p ? p.bestStreak : null,
    dateLabel: start !== null && Number.isFinite(start) ? dateLabel(start) : null,
    explorerAccount: c ? i.commitmentAddress : p ? i.profileAddress : null,
    headline: parts.join(" · "),
  };
}

export function exerciseUnit(kind: ExerciseKind | null): "reps" | "seconds" {
  return kind ? EXERCISES[kind].unit : "reps";
}

/** Route params → validated wallet/day, or null (the page answers 404). */
export function parseShareParams(wallet: string, day: string): { wallet: Address; dayIndex: number } | null {
  const w = decodeURIComponent(wallet).trim();
  if (!isAddress(w)) return null;
  if (!/^\d{1,10}$/.test(day)) return null;
  const d = Number(day);
  if (!Number.isSafeInteger(d) || d > 0xffff_ffff) return null;
  return { wallet: address(w), dayIndex: d };
}

export type ShareLoad = { kind: "ok"; card: ShareCardData } | { kind: "no_pool" };

/**
 * Reads pool + commitment + profile in one getMultipleAccounts. `poolParam` names a crew pool;
 * absent = the global pool. Accounts not owned by the vault program are ignored.
 */
export async function loadShareCard(
  rpc: Rpc<GetMultipleAccountsApi>,
  p: {
    programAddress: Address;
    mint: Address;
    wallet: Address;
    dayIndex: number;
    poolParam?: string | null;
    tokenLabel?: string;
  },
): Promise<ShareLoad> {
  const poolAddress =
    p.poolParam && isAddress(p.poolParam) ? address(p.poolParam) : (await getPoolAddresses(p.mint, p.programAddress)).pool;
  const { commitment, profile } = await getUserDayAddresses({
    pool: poolAddress,
    user: p.wallet,
    dayIndex: p.dayIndex,
    programAddress: p.programAddress,
  });
  const [poolAcc, cAcc, profAcc] = await fetchEncodedAccounts(rpc, [poolAddress, commitment, profile], { commitment: "confirmed" });
  const pool = decodeOwned(poolAcc, p.programAddress, getPoolDiscriminatorBytes(), getPoolDecoder());
  if (!pool || pool.mint !== p.mint) return { kind: "no_pool" };
  const c = decodeOwned(cAcc, p.programAddress, getCommitmentDiscriminatorBytes(), getCommitmentDecoder());
  const prof = decodeOwned(profAcc, p.programAddress, getUserProfileDiscriminatorBytes(), getUserProfileDecoder());
  return {
    kind: "ok",
    card: mapShareCard({
      wallet: p.wallet,
      dayIndex: p.dayIndex,
      poolAddress,
      pool,
      commitment: c && c.pool === poolAddress ? c : null,
      commitmentAddress: commitment,
      profile: prof && prof.pool === poolAddress ? prof : null,
      profileAddress: profile,
      tokenLabel: p.tokenLabel,
    }),
  };
}
