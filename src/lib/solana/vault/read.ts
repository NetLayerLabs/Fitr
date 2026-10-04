/**
 * One-shot reads of everything the Commit screen needs, in two RPC round trips:
 *   1. getAccountInfo(pool)            -> day geometry, stake/goal rails, require_sgt
 *   2. getMultipleAccounts([...])      -> profile, device lock, and (DayState, Commitment) for
 *                                         tomorrow, today and the last `days` days
 *
 * Only uses methods the /api/rpc allow-list permits (no getProgramAccounts). Pure apart from the
 * injected RPC: importable from client, server and tests.
 */
import {
  fetchEncodedAccount,
  fetchEncodedAccounts,
  type Address,
  type GetAccountInfoApi,
  type GetMultipleAccountsApi,
  type MaybeEncodedAccount,
  type ReadonlyUint8Array,
  type Rpc,
} from "@solana/kit";
import { getPoolAddresses, getDeviceLockAddress, vaultProgramAddress } from "./addresses";
import { dayConfigFromPool, dayIndexAt, withGlobalPause, type DayConfig } from "./day";
import {
  findCommitmentPda,
  findDayPda,
  findProfilePda,
  getCommitmentDecoder,
  getCommitmentDiscriminatorBytes,
  getDayStateDecoder,
  getDayStateDiscriminatorBytes,
  getDeviceLockDecoder,
  getDeviceLockDiscriminatorBytes,
  getPoolDecoder,
  getPoolDiscriminatorBytes,
  getUserProfileDecoder,
  getUserProfileDiscriminatorBytes,
  type Commitment,
  type DayState,
  type DeviceLock,
  type Pool,
  type UserProfile,
} from "./generated";

/** Past days scanned for unclaimed / unsettled commitments (besides today and tomorrow). */
export const DEFAULT_LOOKBACK_DAYS = 6;

export interface VaultEntry {
  day: number;
  commitment: Commitment | null;
  dayState: DayState | null;
}

export interface VaultSnapshot {
  pool: Pool;
  poolAddress: Address;
  vaultAddress: Address;
  programAddress: Address;
  cfg: DayConfig;
  /** Unix seconds the snapshot was computed for. */
  nowSecs: number;
  today: number;
  /** Newest first: today + 1, today, today − 1, … today − days. */
  entries: VaultEntry[];
  profile: UserProfile | null;
  /** The SGT's DeviceLock (only looked up when `sgtMint` was given). */
  deviceLock: DeviceLock | null;
}

export type VaultRpc = Rpc<GetAccountInfoApi & GetMultipleAccountsApi>;

export interface FetchVaultSnapshotParams {
  mint: Address;
  /** null: pool + DayStates only (no wallet connected). */
  user: Address | null;
  nowSecs: number;
  /** Past days to scan; default DEFAULT_LOOKBACK_DAYS. */
  days?: number;
  sgtMint?: Address | null;
  programAddress?: Address;
  abortSignal?: AbortSignal;
  /** Which pool: 0 (default) is the global pool, anything else a crew (anchor/SPEC.md §2.7). */
  crewId?: bigint;
}

function startsWith(data: ReadonlyUint8Array, prefix: ReadonlyUint8Array): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (data[i] !== prefix[i]) return false;
  return true;
}

/**
 * Decodes `acc` when it exists, is owned by the vault program, has the right discriminator and
 * size; null otherwise (a missing or foreign account is never trusted).
 */
export function decodeOwned<T>(
  acc: MaybeEncodedAccount,
  programAddress: Address,
  discriminator: ReadonlyUint8Array,
  decoder: { decode(bytes: ReadonlyUint8Array): T; fixedSize: number },
): T | null {
  if (!acc.exists) return null;
  if (acc.programAddress !== programAddress) return null;
  if (acc.data.length < decoder.fixedSize || !startsWith(acc.data, discriminator)) return null;
  try {
    return decoder.decode(acc.data);
  } catch {
    return null;
  }
}

/**
 * The pool for `mint` (global pool, or the crew `opts.crewId`), or null when it does not exist
 * (vault not deployed / initialised, or no such crew).
 */
export async function fetchPool(
  rpc: Rpc<GetAccountInfoApi>,
  mint: Address,
  opts: { programAddress?: Address; abortSignal?: AbortSignal; crewId?: bigint } = {},
): Promise<{ pool: Pool; poolAddress: Address; vaultAddress: Address } | null> {
  const programAddress = opts.programAddress ?? vaultProgramAddress();
  const crewId = opts.crewId ?? 0n;
  const { pool: poolAddress, vault: vaultAddress } = await getPoolAddresses(mint, programAddress, crewId);
  const acc = await fetchEncodedAccount(rpc, poolAddress, { abortSignal: opts.abortSignal, commitment: "confirmed" });
  const pool = decodeOwned(acc, programAddress, getPoolDiscriminatorBytes(), getPoolDecoder());
  // The PDA already binds (mint, crew_id); re-check the decoded fields anyway.
  if (!pool || pool.mint !== mint || pool.crewId !== crewId) return null;
  return { pool, poolAddress, vaultAddress };
}

/**
 * Pool + the user's vault state around today. Returns null when the pool account does not exist
 * (vault not deployed yet), which the UI shows as "Staking opens soon".
 */
export async function fetchVaultSnapshot(rpc: VaultRpc, p: FetchVaultSnapshotParams): Promise<VaultSnapshot | null> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const isCrew = (p.crewId ?? 0n) !== 0n;
  // A crew's windows also stretch (and its instructions stop) while the GLOBAL pool is paused.
  const [found, global] = await Promise.all([
    fetchPool(rpc, p.mint, { programAddress, abortSignal: p.abortSignal, crewId: p.crewId }),
    isCrew ? fetchPool(rpc, p.mint, { programAddress, abortSignal: p.abortSignal }).catch(() => null) : Promise.resolve(null),
  ]);
  if (!found) return null;
  const { pool, poolAddress, vaultAddress } = found;
  const cfg = global ? withGlobalPause(dayConfigFromPool(pool), global.pool, true) : dayConfigFromPool(pool);
  const today = dayIndexAt(p.nowSecs, cfg);
  const lookback = Math.max(0, Math.min(p.days ?? DEFAULT_LOOKBACK_DAYS, 30));

  const dayList: number[] = [];
  for (let d = today + 1; d >= Math.max(0, today - lookback); d--) dayList.push(d);

  const user = p.user;
  // Without a user the profile/commitment slots re-read the pool address (decoded as null).
  const [profile, deviceLockAddr, perDay] = await Promise.all([
    user ? findProfilePda({ pool: poolAddress, user }, { programAddress }).then(([a]) => a) : poolAddress,
    p.sgtMint ? getDeviceLockAddress(poolAddress, p.sgtMint, programAddress) : Promise.resolve(null),
    Promise.all(
      dayList.map(async (dayIndex) => {
        const [[day], commitment] = await Promise.all([
          findDayPda({ pool: poolAddress, dayIndex }, { programAddress }),
          user
            ? findCommitmentPda({ pool: poolAddress, user, dayIndex }, { programAddress }).then(([a]) => a)
            : Promise.resolve(poolAddress),
        ]);
        return { day, commitment };
      }),
    ),
  ]);

  const addresses: Address[] = [profile, ...perDay.flatMap((x) => [x.day, x.commitment])];
  if (deviceLockAddr) addresses.push(deviceLockAddr);
  const accounts = await fetchEncodedAccounts(rpc, addresses, { abortSignal: p.abortSignal, commitment: "confirmed" });

  const entries: VaultEntry[] = dayList.map((day, i) => {
    const dayAcc = accounts[1 + 2 * i];
    const commitmentAcc = accounts[2 + 2 * i];
    const dayState = decodeOwned(dayAcc, programAddress, getDayStateDiscriminatorBytes(), getDayStateDecoder());
    const commitment = decodeOwned(
      commitmentAcc,
      programAddress,
      getCommitmentDiscriminatorBytes(),
      getCommitmentDecoder(),
    );
    return {
      day,
      dayState: dayState && dayState.pool === poolAddress && dayState.dayIndex === day ? dayState : null,
      commitment:
        user && commitment && commitment.pool === poolAddress && commitment.user === user && commitment.dayIndex === day
          ? commitment
          : null,
    };
  });

  const userProfile = decodeOwned(accounts[0], programAddress, getUserProfileDiscriminatorBytes(), getUserProfileDecoder());
  const deviceLock = deviceLockAddr
    ? decodeOwned(accounts[accounts.length - 1], programAddress, getDeviceLockDiscriminatorBytes(), getDeviceLockDecoder())
    : null;

  return {
    pool,
    poolAddress,
    vaultAddress,
    programAddress,
    cfg,
    nowSecs: p.nowSecs,
    today,
    entries,
    profile: user && userProfile && userProfile.user === user ? userProfile : null,
    deviceLock: deviceLock && deviceLock.pool === poolAddress ? deviceLock : null,
  };
}

export function entryFor(snapshot: Pick<VaultSnapshot, "entries">, day: number): VaultEntry {
  return snapshot.entries.find((e) => e.day === day) ?? { day, commitment: null, dayState: null };
}
