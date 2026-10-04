/**
 * Cached chain reads for the public pages (share card page + image, pool dashboard). A short
 * in-process TTL keeps crawlers and link unfurls from hammering the RPC; on an RPC error the last
 * good value is served (stale-if-error), else "unavailable". Server only.
 */
import "server-only";
import type { Address } from "@solana/kit";
import { loadDashboard, type DashboardLoad } from "./dashboard";
import { getPublicChain, type PublicChain } from "./server";
import { loadShareCard, type ShareLoad } from "./shareCard";

export type Loaded<T> = T | { kind: "unavailable" };

interface Entry<T> {
  at: number;
  value: T;
}

const SHARE_TTL_MS = 30_000;
export const DASHBOARD_TTL_MS = 60_000;
const MAX_ENTRIES = 2_000;

const G = globalThis as typeof globalThis & {
  __fitrPublicCache?: Map<string, Entry<unknown>>;
  __fitrPublicInflight?: Map<string, Promise<unknown>>;
};
const cache = (G.__fitrPublicCache ??= new Map());
const inflight = (G.__fitrPublicInflight ??= new Map());

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<Loaded<T>> {
  const now = Date.now();
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && now - hit.at < ttlMs) return hit.value;
  let p = inflight.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    inflight.set(key, p);
    p.finally(() => inflight.delete(key)).catch(() => {});
  }
  try {
    const value = await p;
    if (cache.size >= MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // Never log the error: transport errors can carry the upstream URL (Helius key).
    return hit ? hit.value : { kind: "unavailable" };
  }
}

export async function getShareCard(
  wallet: Address,
  dayIndex: number,
  poolParam: string | null,
  chain: PublicChain | null = getPublicChain(),
): Promise<Loaded<ShareLoad>> {
  if (!chain) return { kind: "unavailable" };
  return cached(`share|${wallet}|${dayIndex}|${poolParam ?? ""}`, SHARE_TTL_MS, () =>
    loadShareCard(chain.rpc, {
      programAddress: chain.programAddress,
      mint: chain.mint,
      wallet,
      dayIndex,
      poolParam,
      tokenLabel: chain.tokenLabel,
    }),
  );
}

export async function getDashboard(chain: PublicChain | null = getPublicChain()): Promise<Loaded<DashboardLoad>> {
  if (!chain) return { kind: "unavailable" };
  return cached("dashboard", DASHBOARD_TTL_MS, () =>
    loadDashboard(chain.rpc, { programAddress: chain.programAddress, mint: chain.mint, nowSecs: Math.floor(Date.now() / 1000) }),
  );
}
