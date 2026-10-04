/**
 * Public pool dashboard (/pool): live stats aggregated from the vault's accounts.
 *
 * What the chain can and cannot tell us (honest labels on the page):
 * - Pools (global + crews) persist; their `outstanding` is the SKR held for open commitments and
 *   `reserve` is the sponsor reserve.
 * - UserProfiles persist: all-time commitment counts, completions, misses and the bonus each
 *   person was paid (SKR redistributed to people who showed up, including sponsor top-ups).
 * - DayStates are closed (swept) once every commitment of a day is settled, so day-level SKR
 *   totals (staked, sponsor draws) only cover days that still exist: "today" and recent days.
 *
 * `aggregateDashboard` is pure; `loadDashboard` reads the accounts with getProgramAccounts.
 */
import {
  getAddressEncoder,
  getBase58Decoder,
  getBase64Encoder,
  type Address,
  type Base58EncodedBytes,
  type GetProgramAccountsApi,
  type GetProgramAccountsDatasizeFilter,
  type GetProgramAccountsMemcmpFilter,
  type Rpc,
} from "@solana/kit";
import { shortenAddress } from "@/lib/solana/format";
import { getPoolAddresses } from "@/lib/solana/vault/addresses";
import { dayConfigFromPool, dayIndexAt } from "@/lib/solana/vault/day";
import {
  getDayStateDecoder,
  getDayStateDiscriminatorBytes,
  getDayStateSize,
  getPoolDecoder,
  getPoolDiscriminatorBytes,
  getPoolSize,
  getUserProfileDecoder,
  getUserProfileDiscriminatorBytes,
  getUserProfileSize,
  type DayState,
  type Pool,
  type UserProfile,
} from "@/lib/solana/vault/generated";
import { streakEndingAt } from "./shareCard";

/** Pool.mint byte offset (anchor/SPEC.md §2.4): getProgramAccounts filter for one mint's pools. */
export const POOL_MINT_OFFSET = 110;

export interface PoolEntry {
  address: Address;
  pool: Pool;
}

export interface DayRow {
  dayIndex: number;
  committed: number;
  completed: number;
  staked: bigint;
  sponsor: bigint;
  finalized: boolean;
}

export interface StreakRow {
  wallet: Address;
  walletShort: string;
  streak: number;
  best: number;
}

export interface DashboardStats {
  /** Unix seconds the stats were computed for. */
  asOfSecs: number;
  globalPool: Address;
  today: number;
  /** Crews (every pool except the global one). */
  crews: number;
  /** Today, every pool. */
  todayStaked: bigint;
  todayCommitted: number;
  todayCompleted: number;
  /** SKR the vaults hold right now for open commitments (all pools). */
  heldForOpenCommitments: bigint;
  /** All-time, from UserProfiles (all pools). */
  allTimeCommitments: number;
  allTimeCompleted: number;
  allTimeMissed: number;
  /** completed / (completed + missed), settled days only; null before anything settled. */
  completionRate: number | null;
  /** Bonus paid to people who showed up (forfeits after the fee, plus sponsor top-ups). */
  redistributed: bigint;
  /** Distinct wallets with a profile in any pool. */
  people: number;
  /** Sponsor reserve waiting to be added to future days (all pools). */
  sponsorReserve: bigint;
  /** Global pool: most added from the reserve to one day's bonus. */
  dailySponsorAmount: bigint;
  /** Sponsor SKR added to recent finalized days still on-chain (all pools). */
  recentSponsored: bigint;
  /** Global pool, newest first, at most 7. */
  recentDays: DayRow[];
  /** Global pool, live streaks, best first, at most 10. */
  topStreaks: StreakRow[];
  /** Global pool fields for the copy. */
  minStake: bigint;
  maxStake: bigint;
  feeBps: number;
  paused: boolean;
}

export function aggregateDashboard(p: {
  globalPool: PoolEntry;
  pools: readonly PoolEntry[];
  dayStates: readonly DayState[];
  profiles: readonly UserProfile[];
  nowSecs: number;
}): DashboardStats {
  const g = p.globalPool;
  const cfg = dayConfigFromPool(g.pool);
  let today = 0;
  try {
    today = dayIndexAt(p.nowSecs, cfg);
  } catch {
    today = 0;
  }
  const poolSet = new Map<string, PoolEntry>();
  for (const e of [g, ...p.pools]) poolSet.set(e.address, e);
  const pools = [...poolSet.values()];

  let todayStaked = 0n;
  let todayCommitted = 0;
  let todayCompleted = 0;
  let recentSponsored = 0n;
  const recentDays: DayRow[] = [];
  for (const d of p.dayStates) {
    if (!poolSet.has(d.pool)) continue;
    if (d.dayIndex === today) {
      todayStaked += d.totalStaked;
      todayCommitted += d.committedCount;
      todayCompleted += d.completedCount;
    }
    if (d.finalized) recentSponsored += d.sponsor;
    if (d.pool === g.address && d.dayIndex <= today) {
      recentDays.push({
        dayIndex: d.dayIndex,
        committed: d.committedCount,
        completed: d.completedCount,
        staked: d.totalStaked,
        sponsor: d.sponsor,
        finalized: d.finalized,
      });
    }
  }
  recentDays.sort((a, b) => b.dayIndex - a.dayIndex);

  let allTimeCommitments = 0;
  let allTimeCompleted = 0;
  let allTimeMissed = 0;
  let redistributed = 0n;
  const people = new Set<string>();
  const streaks: StreakRow[] = [];
  for (const pr of p.profiles) {
    if (!poolSet.has(pr.pool)) continue;
    allTimeCommitments += pr.totalCommitted;
    allTimeCompleted += pr.totalCompleted;
    allTimeMissed += pr.totalMissed;
    redistributed += pr.totalBonusEarned;
    people.add(pr.user);
    if (pr.pool === g.address && pr.hasCompleted && pr.lastCompletedDay >= today - 1) {
      const s = streakEndingAt(pr, pr.lastCompletedDay) ?? pr.currentStreak;
      if (s > 0) streaks.push({ wallet: pr.user, walletShort: shortenAddress(pr.user), streak: s, best: Math.max(pr.bestStreak, s) });
    }
  }
  streaks.sort((a, b) => b.streak - a.streak || b.best - a.best || a.wallet.localeCompare(b.wallet));
  const settled = allTimeCompleted + allTimeMissed;

  return {
    asOfSecs: p.nowSecs,
    globalPool: g.address,
    today,
    crews: pools.filter((e) => e.pool.crewId !== 0n).length,
    todayStaked,
    todayCommitted,
    todayCompleted,
    heldForOpenCommitments: pools.reduce((s, e) => s + e.pool.outstanding, 0n),
    allTimeCommitments,
    allTimeCompleted,
    allTimeMissed,
    completionRate: settled > 0 ? allTimeCompleted / settled : null,
    redistributed,
    people: people.size,
    sponsorReserve: pools.reduce((s, e) => s + e.pool.reserve, 0n),
    dailySponsorAmount: g.pool.dailySponsorAmount,
    recentSponsored,
    recentDays: recentDays.slice(0, 7),
    topStreaks: streaks.slice(0, 10),
    minStake: g.pool.minStake,
    maxStake: g.pool.maxStake,
    feeBps: g.pool.feeBps,
    paused: g.pool.paused,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Loading                                                                                     */
/* ------------------------------------------------------------------------------------------ */

const b58 = getBase58Decoder();
const b64 = getBase64Encoder();

function memcmp(offset: number, addr: Address): GetProgramAccountsMemcmpFilter {
  return {
    memcmp: {
      offset: BigInt(offset),
      bytes: b58.decode(getAddressEncoder().encode(addr)) as Base58EncodedBytes,
      encoding: "base58",
    },
  };
}

function startsWith(data: Uint8Array, prefix: ArrayLike<number>): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (data[i] !== prefix[i]) return false;
  return true;
}

type Gpa = Rpc<GetProgramAccountsApi>;

async function programAccounts<T>(
  rpc: Gpa,
  programAddress: Address,
  filters: Array<GetProgramAccountsDatasizeFilter | GetProgramAccountsMemcmpFilter>,
  disc: ArrayLike<number>,
  decode: (bytes: Uint8Array) => T,
): Promise<Array<{ address: Address; value: T }>> {
  const res = await rpc
    .getProgramAccounts(programAddress, { encoding: "base64", commitment: "confirmed", filters })
    .send();
  const out: Array<{ address: Address; value: T }> = [];
  for (const r of res) {
    if (r.account.owner !== programAddress) continue;
    const bytes = new Uint8Array(b64.encode(r.account.data[0]));
    if (!startsWith(bytes, disc)) continue;
    try {
      out.push({ address: r.pubkey, value: decode(bytes) });
    } catch {
      // Skip anything that does not decode.
    }
  }
  return out;
}

export type DashboardLoad = { kind: "ok"; stats: DashboardStats } | { kind: "no_pool" };

export async function loadDashboard(
  rpc: Gpa,
  p: { programAddress: Address; mint: Address; nowSecs: number },
): Promise<DashboardLoad> {
  const { pool: globalAddress } = await getPoolAddresses(p.mint, p.programAddress);
  const poolDecoder = getPoolDecoder();
  const pools = await programAccounts(
    rpc,
    p.programAddress,
    [{ dataSize: BigInt(getPoolSize()) }, memcmp(POOL_MINT_OFFSET, p.mint)],
    getPoolDiscriminatorBytes(),
    (b) => poolDecoder.decode(b),
  );
  const entries: PoolEntry[] = pools.filter((x) => x.value.mint === p.mint).map((x) => ({ address: x.address, pool: x.value }));
  const global = entries.find((e) => e.address === globalAddress);
  if (!global) return { kind: "no_pool" };

  const dayDecoder = getDayStateDecoder();
  const profileDecoder = getUserProfileDecoder();
  const [days, profiles] = await Promise.all([
    programAccounts(rpc, p.programAddress, [{ dataSize: BigInt(getDayStateSize()) }], getDayStateDiscriminatorBytes(), (b) =>
      dayDecoder.decode(b),
    ),
    programAccounts(
      rpc,
      p.programAddress,
      [{ dataSize: BigInt(getUserProfileSize()) }],
      getUserProfileDiscriminatorBytes(),
      (b) => profileDecoder.decode(b),
    ),
  ]);
  return {
    kind: "ok",
    stats: aggregateDashboard({
      globalPool: global,
      pools: entries,
      dayStates: days.map((d) => d.value),
      profiles: profiles.map((x) => x.value),
      nowSecs: p.nowSecs,
    }),
  };
}
