/**
 * Crews (anchor/SPEC.md §2.7): ids, names, invite links, getProgramAccounts filters and reads.
 *
 * A crew is its own Pool ["pool", mint, crew_id u64 LE] that copies the global pool's config at
 * creation, optionally with a fixed exercise (+ goal). Every Commitment / DayState / UserProfile
 * below it is seeded by the crew pool's address, so the existing readers work per crew.
 *
 * Pure apart from the injected RPC: importable from client, server and tests.
 */
import {
  fetchEncodedAccounts,
  getAddressEncoder,
  getBase58Decoder,
  getBase64Encoder,
  getU32Encoder,
  type Address,
  type Base58EncodedBytes,
  type Base64EncodedDataResponse,
  type GetMultipleAccountsApi,
  type GetProgramAccountsApi,
  type GetProgramAccountsDatasizeFilter,
  type GetProgramAccountsMemcmpFilter,
  type Instruction,
  type ReadonlyUint8Array,
  type Rpc,
  type TransactionSigner,
} from "@solana/kit";
import { exerciseFromCode, EXERCISE_CODE } from "@/lib/exercises";
import type { ExerciseKind } from "@/lib/pose/types";
import { COMMITMENT_OFFSETS, COMMITMENT_SIZE, getPoolAddresses, GLOBAL_CREW_ID, vaultProgramAddress } from "./addresses";
import {
  getCommitmentDecoder,
  getCommitmentDiscriminatorBytes,
  getCreateCrewInstructionAsync,
  getDayStateDecoder,
  getDayStateDiscriminatorBytes,
  getDayStateSize,
  getPoolDecoder,
  getPoolDiscriminatorBytes,
  getPoolSize,
  getUserProfileDecoder,
  getUserProfileDiscriminatorBytes,
  getUserProfileSize,
  type Commitment,
  type DayState,
  type Exercise,
  type Pool,
  type UserProfile,
} from "./generated";
import { dayConfigFromPool, dayIndexAt } from "./day";
import { decodeOwned } from "./read";

export { GLOBAL_CREW_ID };

/* ------------------------------------------------------------------------------------------ */
/* Ids                                                                                         */
/* ------------------------------------------------------------------------------------------ */

export const MAX_CREW_ID = (1n << 64n) - 1n;
/** Ids we generate stay below 2^53 so they survive any JSON / JS number round trip. */
export const GENERATED_CREW_ID_LIMIT = 1n << 53n;

/**
 * A crew id from a URL segment or text: canonical decimal, 1..=2^64-1, no sign, no leading zeros.
 * 0 is the global pool, never a crew.
 */
export function parseCrewId(raw: string | null | undefined): bigint | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!/^[1-9][0-9]{0,19}$/.test(s)) return null;
  const v = BigInt(s);
  return v >= 1n && v <= MAX_CREW_ID ? v : null;
}

/** A random crew id in [1, 2^53). Collisions only make create_crew fail (the PDA is in use). */
export function randomCrewId(
  getRandomValues: (a: Uint32Array) => Uint32Array = (a) => globalThis.crypto.getRandomValues(a),
): bigint {
  for (;;) {
    const w = getRandomValues(new Uint32Array(2));
    const id = ((BigInt(w[0] & 0x1f_ffff) << 32n) | BigInt(w[1])) % GENERATED_CREW_ID_LIMIT;
    if (id !== 0n) return id;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Links                                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Public landing host (invite pages) and the app host (opened by the Android app's App Links). */
export const INVITE_ORIGIN = "https://fitr.day";
export const APP_ORIGIN = "https://app.fitr.day";

/** In-app crew page path. */
export function crewPath(crewId: bigint): string {
  return `/crew/${crewId.toString()}`;
}

/** Public invite path on fitr.day. */
export function crewInvitePath(crewId: bigint): string {
  return `/c/${crewId.toString()}`;
}

/** The link people share: https://fitr.day/c/<id> (opens the app via App Links when installed). */
export function crewInviteUrl(crewId: bigint): string {
  return `${INVITE_ORIGIN}${crewInvitePath(crewId)}`;
}

/** https://app.fitr.day/crew/<id>: "Open in Fitr" from the invite page. */
export function crewAppUrl(crewId: bigint): string {
  return `${APP_ORIGIN}${crewPath(crewId)}`;
}

const INVITE_HOSTS = new Set(["fitr.day", "www.fitr.day", "app.fitr.day"]);

/**
 * The crew id inside whatever a user pasted: a bare id, an invite link (fitr.day/c/<id>, with or
 * without scheme, query or hash), an app link (app.fitr.day/crew/<id>) or an in-app path
 * (/crew/<id>, /c/<id>). Links on other hosts are refused.
 */
export function parseInviteInput(input: string | null | undefined): bigint | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!text || text.length > 512) return null;
  const bare = parseCrewId(text);
  if (bare !== null) return bare;

  let path: string;
  if (text.startsWith("/")) {
    path = text;
  } else {
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!INVITE_HOSTS.has(url.hostname.toLowerCase())) return null;
    path = url.pathname;
  }
  const m = /^\/(?:c|crew)\/([^/?#]+)\/?(?:[?#].*)?$/.exec(path);
  return m ? parseCrewId(decodeURIComponent(m[1])) : null;
}

/* ------------------------------------------------------------------------------------------ */
/* Names                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export const CREW_NAME_BYTES = 32;

/**
 * Invisible / direction-changing characters: valid UTF-8 on-chain, but they can make a name read
 * as something else (e.g. a right-to-left override). Refused on create, stripped on display.
 */
const UNSAFE_NAME_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g;

/**
 * Why `name` cannot be a crew name, or null when it can. Mirrors state::is_valid_crew_name
 * (non-empty UTF-8 without NUL, at most 32 bytes); we also refuse names that are only whitespace
 * or contain control characters, and trim the ends.
 */
export function crewNameError(name: string): string | null {
  const t = name.trim();
  if (!t) return "Give your crew a name.";
  if (new RegExp(UNSAFE_NAME_CHARS.source).test(t)) return "Use letters, numbers and emoji only.";
  if (new TextEncoder().encode(t).length > CREW_NAME_BYTES) return "That name is too long (32 bytes max).";
  return null;
}

/** The on-chain [u8; 32] name: trimmed UTF-8, zero padded. Throws on an invalid name. */
export function encodeCrewName(name: string): Uint8Array {
  const err = crewNameError(name);
  if (err) throw new Error(err);
  const out = new Uint8Array(CREW_NAME_BYTES);
  out.set(new TextEncoder().encode(name.trim()));
  return out;
}

/**
 * The name stored on-chain (up to the first NUL) with invisible / direction-changing characters
 * removed, or "" when it is not valid UTF-8. Anyone can create a crew, so this is display-safe
 * text, never trusted for anything else.
 */
export function decodeCrewName(bytes: ReadonlyUint8Array): string {
  let len = bytes.indexOf(0);
  if (len < 0) len = bytes.length;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(0, len)).replace(UNSAFE_NAME_CHARS, "").trim();
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Crew info                                                                                   */
/* ------------------------------------------------------------------------------------------ */

export interface CrewInfo {
  crewId: bigint;
  poolAddress: Address;
  /** "" for the global pool. */
  name: string;
  creator: Address;
  /** The crew's fixed exercise, or null when members pick their own. */
  fixedExercise: ExerciseKind | null;
  /** The crew's fixed goal (reps / seconds), or null when members pick their own goal. */
  fixedGoal: number | null;
  requireSgt: boolean;
  paused: boolean;
}

export function crewInfoFromPool(pool: Pool, poolAddress: Address): CrewInfo {
  const fixedExercise = pool.hasFixedExercise ? exerciseFromCode(pool.fixedExercise) : null;
  return {
    crewId: pool.crewId,
    poolAddress,
    name: pool.crewId === GLOBAL_CREW_ID ? "" : decodeCrewName(pool.name),
    creator: pool.creator,
    fixedExercise,
    fixedGoal: fixedExercise && pool.fixedGoalTarget > 0 ? pool.fixedGoalTarget : null,
    requireSgt: pool.requireSgt,
    paused: pool.paused,
  };
}

/** A display name that is never empty. */
export function crewDisplayName(info: Pick<CrewInfo, "crewId" | "name">): string {
  if (info.crewId === GLOBAL_CREW_ID) return "Solo";
  return info.name || `Crew ${info.crewId.toString().slice(-4)}`;
}

/* ------------------------------------------------------------------------------------------ */
/* create_crew                                                                                 */
/* ------------------------------------------------------------------------------------------ */

export interface CreateCrewParams {
  creator: TransactionSigner;
  mint: Address;
  crewId: bigint;
  name: string;
  /** Fixed exercise for every member, or null to let members pick. */
  exercise: ExerciseKind | null;
  /** Fixed goal (needs `exercise`), or null. */
  goalTarget: number | null;
  programAddress?: Address;
}

/** Rent of the crew Pool + its vault token account (SPEC §2.7), never refunded. */
export const CREATE_CREW_RENT_LAMPORTS = 4_953_000n;
/** Measured 37,826 CU (SPEC §4); headroom for the simulation-sized limit to replace. */
export const CREATE_CREW_COMPUTE_UNITS = 60_000;

export async function buildCreateCrewIx(p: CreateCrewParams): Promise<Instruction> {
  if (p.crewId === GLOBAL_CREW_ID || p.crewId > MAX_CREW_ID || p.crewId < 0n) throw new Error("Invalid crew id");
  if (p.goalTarget !== null && p.exercise === null) throw new Error("A fixed goal needs a fixed exercise");
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const { pool, vault } = await getPoolAddresses(p.mint, programAddress, p.crewId);
  return getCreateCrewInstructionAsync(
    {
      creator: p.creator,
      mint: p.mint,
      pool,
      vault,
      crewId: p.crewId,
      name: encodeCrewName(p.name),
      exercise: p.exercise === null ? null : (EXERCISE_CODE[p.exercise] as Exercise),
      goalTarget: p.goalTarget,
    },
    { programAddress },
  );
}

/* ------------------------------------------------------------------------------------------ */
/* getProgramAccounts filters (offsets incl. discriminator, SPEC §2.1 / §2.4)                  */
/* ------------------------------------------------------------------------------------------ */

type Filter = GetProgramAccountsDatasizeFilter | GetProgramAccountsMemcmpFilter;

export const POOL_OFFSETS = { mint: 110, crewId: 412, creator: 420 } as const;
export const POOL_SIZE = 554;
export const DAY_STATE_OFFSETS = { pool: 12, dayIndex: 44 } as const;
export const USER_PROFILE_OFFSETS = { pool: 10, user: 42 } as const;
export const USER_PROFILE_SIZE = 153;

const b58 = getBase58Decoder();
const addr = getAddressEncoder();

function memcmp(offset: number, bytes: ReadonlyUint8Array): GetProgramAccountsMemcmpFilter {
  return { memcmp: { offset: BigInt(offset), bytes: b58.decode(bytes) as Base58EncodedBytes, encoding: "base58" } };
}

function size(n: number): GetProgramAccountsDatasizeFilter {
  return { dataSize: BigInt(n) };
}

/** Every crew `creator` made for `mint`. */
export function poolsByCreatorFilters(mint: Address, creator: Address): Filter[] {
  return [size(POOL_SIZE), memcmp(POOL_OFFSETS.mint, addr.encode(mint)), memcmp(POOL_OFFSETS.creator, addr.encode(creator))];
}

/** Every UserProfile of `pool`: everyone who ever committed in it. */
export function profilesOfPoolFilters(pool: Address): Filter[] {
  return [size(USER_PROFILE_SIZE), memcmp(USER_PROFILE_OFFSETS.pool, addr.encode(pool))];
}

/** Every UserProfile of `user`, in any pool: the pools (global and crews) they committed in. */
export function profilesOfUserFilters(user: Address): Filter[] {
  return [size(USER_PROFILE_SIZE), memcmp(USER_PROFILE_OFFSETS.user, addr.encode(user))];
}

/** Every live DayState of `pool` (swept days are gone). */
export function dayStatesOfPoolFilters(pool: Address): Filter[] {
  return [size(getDayStateSize()), memcmp(DAY_STATE_OFFSETS.pool, addr.encode(pool))];
}

/** Every open Commitment of `user` in any pool (claimed / closed ones no longer exist). */
export function commitmentsOfUserFilters(user: Address): Filter[] {
  return [size(COMMITMENT_SIZE), memcmp(COMMITMENT_OFFSETS.user, addr.encode(user))];
}

/** Commitments of `pool` for `dayIndex` (any user). */
export function commitmentsOfPoolDayFilters(pool: Address, dayIndex: number): Filter[] {
  return [
    size(COMMITMENT_SIZE),
    memcmp(COMMITMENT_OFFSETS.pool, addr.encode(pool)),
    memcmp(COMMITMENT_OFFSETS.dayIndex, getU32Encoder().encode(dayIndex)),
  ];
}

/* ------------------------------------------------------------------------------------------ */
/* Reads                                                                                       */
/* ------------------------------------------------------------------------------------------ */

export type CrewRpc = Rpc<GetProgramAccountsApi & GetMultipleAccountsApi>;

interface Decoder<T> {
  decode(bytes: ReadonlyUint8Array): T;
  fixedSize: number;
}

const b64 = getBase64Encoder();

/**
 * getProgramAccounts on the vault program, decoding every account that has the right owner,
 * discriminator and size (anything else is dropped, never trusted).
 */
export async function fetchProgramAccounts<T>(
  rpc: Rpc<GetProgramAccountsApi>,
  programAddress: Address,
  filters: Filter[],
  discriminator: ReadonlyUint8Array,
  decoder: Decoder<T>,
  abortSignal?: AbortSignal,
): Promise<Array<{ address: Address; data: T }>> {
  const rows = (await rpc
    .getProgramAccounts(programAddress, { encoding: "base64", commitment: "confirmed", filters })
    .send({ abortSignal })) as unknown as ReadonlyArray<{
    pubkey: Address;
    account: { data: Base64EncodedDataResponse; owner: Address };
  }>;
  const out: Array<{ address: Address; data: T }> = [];
  for (const row of rows) {
    if (row.account.owner !== programAddress) continue;
    const decoded = decodeBytes(b64.encode(row.account.data[0]), discriminator, decoder);
    if (decoded !== null) out.push({ address: row.pubkey, data: decoded });
  }
  return out;
}

function decodeBytes<T>(data: ReadonlyUint8Array, discriminator: ReadonlyUint8Array, decoder: Decoder<T>): T | null {
  if (data.length < decoder.fixedSize || data.length < discriminator.length) return null;
  for (let i = 0; i < discriminator.length; i++) if (data[i] !== discriminator[i]) return null;
  try {
    return decoder.decode(data);
  } catch {
    return null;
  }
}

/** Decoded pools at `addresses` that belong to `mint` (missing / foreign ones are dropped). */
export async function fetchPoolsAt(
  rpc: Rpc<GetMultipleAccountsApi>,
  addresses: readonly Address[],
  mint: Address,
  opts: { programAddress?: Address; abortSignal?: AbortSignal } = {},
): Promise<CrewInfo[]> {
  if (addresses.length === 0) return [];
  const programAddress = opts.programAddress ?? vaultProgramAddress();
  const out: CrewInfo[] = [];
  // getMultipleAccounts takes at most 100 addresses per call.
  for (let i = 0; i < addresses.length; i += 100) {
    const chunk = addresses.slice(i, i + 100);
    const accs = await fetchEncodedAccounts(rpc, chunk, { abortSignal: opts.abortSignal, commitment: "confirmed" });
    accs.forEach((acc, j) => {
      const pool = decodeOwned(acc, programAddress, getPoolDiscriminatorBytes(), getPoolDecoder());
      if (pool && pool.mint === mint) out.push(crewInfoFromPool(pool, chunk[j]));
    });
  }
  return out;
}

/**
 * The crews `user` belongs to: every crew pool where they have a UserProfile (they committed
 * there at least once) or that they created, plus `extraCrewIds` (e.g. invites they opened).
 * Crews that do not exist are dropped. The global pool is never included. Sorted by name.
 */
export async function fetchUserCrews(
  rpc: CrewRpc,
  p: { mint: Address; user: Address; extraCrewIds?: readonly bigint[]; programAddress?: Address; abortSignal?: AbortSignal },
): Promise<CrewInfo[]> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const [profiles, created, extra] = await Promise.all([
    fetchProgramAccounts(
      rpc,
      programAddress,
      profilesOfUserFilters(p.user),
      getUserProfileDiscriminatorBytes(),
      getUserProfileDecoder(),
      p.abortSignal,
    ),
    fetchProgramAccounts(
      rpc,
      programAddress,
      poolsByCreatorFilters(p.mint, p.user),
      getPoolDiscriminatorBytes(),
      getPoolDecoder(),
      p.abortSignal,
    ),
    Promise.all((p.extraCrewIds ?? []).filter((id) => id !== GLOBAL_CREW_ID).map((id) => getPoolAddresses(p.mint, programAddress, id))),
  ]);
  const byAddress = new Map<Address, CrewInfo>();
  for (const c of created) {
    if (c.data.mint === p.mint && c.data.crewId !== GLOBAL_CREW_ID && c.data.creator === p.user) {
      byAddress.set(c.address, crewInfoFromPool(c.data, c.address));
    }
  }
  const unknown = new Set<Address>();
  for (const pr of profiles) if (pr.data.user === p.user && !byAddress.has(pr.data.pool)) unknown.add(pr.data.pool);
  for (const e of extra) if (!byAddress.has(e.pool)) unknown.add(e.pool);
  const fetched = await fetchPoolsAt(rpc, [...unknown], p.mint, { programAddress, abortSignal: p.abortSignal });
  for (const c of fetched) if (c.crewId !== GLOBAL_CREW_ID) byAddress.set(c.poolAddress, c);
  return [...byAddress.values()].sort(
    (a, b) => crewDisplayName(a).localeCompare(crewDisplayName(b)) || (a.crewId < b.crewId ? -1 : a.crewId > b.crewId ? 1 : 0),
  );
}

export interface CrewBoardData {
  /** Commitments of the crew for `today` (one per member who committed). */
  today: Array<Commitment>;
  /** Every live DayState of the crew (unordered). */
  days: DayState[];
  /** Every member's UserProfile in the crew. */
  profiles: UserProfile[];
}

/** Everything the crew page needs below the pool itself: three getProgramAccounts calls. */
export async function fetchCrewBoard(
  rpc: Rpc<GetProgramAccountsApi>,
  p: { poolAddress: Address; today: number; programAddress?: Address; abortSignal?: AbortSignal },
): Promise<CrewBoardData> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const [today, days, profiles] = await Promise.all([
    fetchProgramAccounts(
      rpc,
      programAddress,
      commitmentsOfPoolDayFilters(p.poolAddress, p.today),
      getCommitmentDiscriminatorBytes(),
      getCommitmentDecoder(),
      p.abortSignal,
    ),
    fetchProgramAccounts(
      rpc,
      programAddress,
      dayStatesOfPoolFilters(p.poolAddress),
      getDayStateDiscriminatorBytes(),
      getDayStateDecoder(),
      p.abortSignal,
    ),
    fetchProgramAccounts(
      rpc,
      programAddress,
      profilesOfPoolFilters(p.poolAddress),
      getUserProfileDiscriminatorBytes(),
      getUserProfileDecoder(),
      p.abortSignal,
    ),
  ]);
  return {
    today: today.map((r) => r.data).filter((c) => c.pool === p.poolAddress && c.dayIndex === p.today),
    days: days.map((r) => r.data).filter((d) => d.pool === p.poolAddress),
    profiles: profiles.map((r) => r.data).filter((u) => u.pool === p.poolAddress),
  };
}

/** Sanity: the generated sizes match the frozen filter constants. */
export function crewLayoutSizesMatch(): boolean {
  return getPoolSize() === POOL_SIZE && getUserProfileSize() === USER_PROFILE_SIZE;
}

export interface PoolCommitment {
  crew: CrewInfo;
  commitment: Commitment;
}

/**
 * Today's commitment of `user` in every pool of `mint` (global and crews): one getProgramAccounts
 * over the user's open commitments, then their pools. "Today" is each pool's own day index.
 */
export async function fetchUserTodayCommitments(
  rpc: CrewRpc,
  p: { mint: Address; user: Address; nowSecs: number; programAddress?: Address; abortSignal?: AbortSignal },
): Promise<PoolCommitment[]> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const open = await fetchProgramAccounts(
    rpc,
    programAddress,
    commitmentsOfUserFilters(p.user),
    getCommitmentDiscriminatorBytes(),
    getCommitmentDecoder(),
    p.abortSignal,
  );
  const mine = open.map((r) => r.data).filter((c) => c.user === p.user);
  const poolAddrs = [...new Set(mine.map((c) => c.pool))];
  if (poolAddrs.length === 0) return [];
  const pools = new Map<Address, Pool>();
  for (let i = 0; i < poolAddrs.length; i += 100) {
    const chunk = poolAddrs.slice(i, i + 100);
    const accs = await fetchEncodedAccounts(rpc, chunk, { abortSignal: p.abortSignal, commitment: "confirmed" });
    accs.forEach((acc, j) => {
      const pool = decodeOwned(acc, programAddress, getPoolDiscriminatorBytes(), getPoolDecoder());
      if (pool && pool.mint === p.mint) pools.set(chunk[j], pool);
    });
  }
  const out: PoolCommitment[] = [];
  for (const c of mine) {
    const pool = pools.get(c.pool);
    if (!pool) continue;
    let today: number;
    try {
      today = dayIndexAt(p.nowSecs, dayConfigFromPool(pool));
    } catch {
      continue;
    }
    if (c.dayIndex === today) out.push({ crew: crewInfoFromPool(pool, c.pool), commitment: c });
  }
  return out.sort((a, b) => (a.crew.crewId < b.crew.crewId ? -1 : a.crew.crewId > b.crew.crewId ? 1 : 0));
}
