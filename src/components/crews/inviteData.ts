/**
 * Server-side read of a crew for the public invite page (fitr.day/c/<id>): the crew Pool, how many
 * members it has, and how many committed today. Reads Solana through the same upstream as the
 * /api/rpc proxy (Helius key server side, never sent to the browser), cached in memory briefly so
 * a link shared in a busy group chat does not hammer the RPC.
 */
import "server-only";
import { createSolanaRpc, fetchEncodedAccount, type Address } from "@solana/kit";
import { solanaConfig } from "@/lib/solana/config";
import { readHeliusApiKey } from "@/lib/solana/server/secrets";
import { upstreamRpcUrl } from "@/lib/solana/server/upstream";
import { getDayAddress, vaultProgramAddress } from "@/lib/solana/vault/addresses";
import {
  crewDisplayName,
  crewInfoFromPool,
  fetchProgramAccounts,
  profilesOfPoolFilters,
  type CrewInfo,
  type CrewRpc,
} from "@/lib/solana/vault/crews";
import { dayConfigFromPool, dayIndexAt } from "@/lib/solana/vault/day";
import {
  getDayStateDecoder,
  getDayStateDiscriminatorBytes,
  getUserProfileDecoder,
  getUserProfileDiscriminatorBytes,
} from "@/lib/solana/vault/generated";
import { decodeOwned, fetchPool } from "@/lib/solana/vault/read";
import type { GetAccountInfoApi, Rpc } from "@solana/kit";
import { challengeLabel } from "./labels";

export interface CrewInvite {
  crewId: bigint;
  name: string;
  info: CrewInfo;
  challenge: string;
  members: number;
  committedToday: number;
}

export type CrewInviteResult =
  | { kind: "found"; crew: CrewInvite }
  /** No such crew (or not for this mint). */
  | { kind: "missing" }
  /** Neither the crew nor the global pool exists yet: the vault has not opened. */
  | { kind: "no_pool" }
  /** The server cannot read Solana right now (not configured, RPC down). */
  | { kind: "unavailable" };

type InviteRpc = CrewRpc & Rpc<GetAccountInfoApi>;

/** Reads one crew. `rpc` is injectable for tests. */
export async function readCrewInvite(
  rpc: InviteRpc,
  crewId: bigint,
  opts: { mint: Address; programAddress?: Address; nowSecs: number },
): Promise<CrewInviteResult> {
  const programAddress = opts.programAddress ?? vaultProgramAddress();
  const found = await fetchPool(rpc, opts.mint, { programAddress, crewId });
  if (!found || found.pool.crewId === 0n) {
    // Tell "mistyped link" apart from "the vault is not open yet" (no global pool either).
    const global = crewId === 0n ? found : await fetchPool(rpc, opts.mint, { programAddress }).catch(() => undefined);
    return global === null ? { kind: "no_pool" } : { kind: "missing" };
  }
  const info = crewInfoFromPool(found.pool, found.poolAddress);

  let committedToday = 0;
  let members = 0;
  const [profiles, dayAcc] = await Promise.all([
    fetchProgramAccounts(
      rpc,
      programAddress,
      profilesOfPoolFilters(found.poolAddress),
      getUserProfileDiscriminatorBytes(),
      getUserProfileDecoder(),
    ).catch(() => null),
    (async () => {
      try {
        const today = dayIndexAt(opts.nowSecs, dayConfigFromPool(found.pool));
        return await fetchEncodedAccount(rpc, await getDayAddress(found.poolAddress, today, programAddress));
      } catch {
        return null;
      }
    })(),
  ]);
  if (profiles) members = profiles.filter((p) => p.data.pool === found.poolAddress).length;
  if (dayAcc) {
    const ds = decodeOwned(dayAcc, programAddress, getDayStateDiscriminatorBytes(), getDayStateDecoder());
    if (ds && ds.pool === found.poolAddress) committedToday = ds.committedCount;
  }
  return {
    kind: "found",
    crew: { crewId, name: crewDisplayName(info), info, challenge: challengeLabel(info), members, committedToday },
  };
}

const TTL_MS = 60_000;
const MAX_CACHE = 500;
const G = globalThis as typeof globalThis & {
  __fitrCrewInvites?: Map<string, { at: number; value: Promise<CrewInviteResult> }>;
};

/** The cached server read used by the page (and its metadata, which runs in the same request). */
export async function loadCrewInvite(crewId: bigint): Promise<CrewInviteResult> {
  const mint = solanaConfig.skrMint;
  if (!mint) return { kind: "unavailable" };
  const upstream = upstreamRpcUrl(solanaConfig.cluster, readHeliusApiKey(), process.env.NODE_ENV);
  if (!upstream) return { kind: "unavailable" };

  const cache = (G.__fitrCrewInvites ??= new Map());
  const key = crewId.toString();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  if (cache.size >= MAX_CACHE) {
    for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k);
    if (cache.size >= MAX_CACHE) cache.clear();
  }
  const rpc = createSolanaRpc(upstream) as unknown as InviteRpc;
  const value = readCrewInvite(rpc, crewId, { mint, nowSecs: Math.floor(now / 1000) }).catch(
    (): CrewInviteResult => ({ kind: "unavailable" }),
  );
  cache.set(key, { at: now, value });
  // Do not keep a failure for the whole TTL.
  void value.then((r) => {
    if (r.kind === "unavailable" && cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}
