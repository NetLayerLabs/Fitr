"use client";

/**
 * Crew data hooks. All reads go through /api/rpc (getProgramAccounts is allowed there on the
 * vault program with memcmp filters). Results are shared between every mounted component through
 * a small keyed cache (Today hero, native sync and the Commit tab ask for the same data), polled
 * while the page is visible and refetched on notifyVaultChanged().
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Address } from "@solana/kit";
import { useVaultVersion } from "@/hooks/useVault";
import { tr } from "@/lib/i18n";
import { solanaConfig } from "@/lib/solana/config";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { fetchCrewBoard, fetchUserCrews, type CrewBoardData, type CrewInfo } from "@/lib/solana/vault/crews";
import { fetchVaultSnapshot, type VaultSnapshot } from "@/lib/solana/vault/read";

/* ------------------------------------------------------------------------------------------ */
/* Shared keyed query cache                                                                    */
/* ------------------------------------------------------------------------------------------ */

export interface QueryState<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | undefined;
  error: string | null;
}

interface Entry<T> {
  snap: QueryState<T>;
  at: number;
  version: number;
  inflight: Promise<void> | null;
  listeners: Set<() => void>;
}

const IDLE: QueryState<never> = Object.freeze({ status: "idle", data: undefined, error: null }) as QueryState<never>;
const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 64;

function entry<T>(key: string): Entry<T> {
  let e = store.get(key) as Entry<T> | undefined;
  if (!e) {
    if (store.size >= MAX_ENTRIES) {
      for (const [k, v] of store) {
        if (v.listeners.size === 0 && !v.inflight) {
          store.delete(k);
          if (store.size < MAX_ENTRIES) break;
        }
      }
    }
    e = { snap: IDLE, at: 0, version: -1, inflight: null, listeners: new Set() };
    store.set(key, e as Entry<unknown>);
  }
  return e;
}

function emit(e: Entry<unknown>) {
  e.listeners.forEach((l) => l());
}

function load<T>(key: string, fetcher: () => Promise<T>, version: number, maxAgeMs: number): void {
  const e = entry<T>(key);
  if (e.inflight) return;
  if (e.version === version && e.at > 0 && Date.now() - e.at < maxAgeMs) return;
  e.version = version;
  if (e.snap.status === "idle") {
    e.snap = { status: "loading", data: undefined, error: null };
    emit(e as Entry<unknown>);
  }
  e.inflight = fetcher().then(
    (data) => {
      e.snap = { status: "ready", data, error: null };
    },
    (err: unknown) => {
      const error = err instanceof Error && err.message ? err.message : tr("crews", "vaultReadError");
      // Keep the last good data on a failed refresh.
      e.snap = { status: e.snap.data === undefined ? "error" : "ready", data: e.snap.data, error };
    },
  );
  void e.inflight.finally(() => {
    e.inflight = null;
    e.at = Date.now();
    emit(e as Entry<unknown>);
  });
}

/** Tests only: forget every cached query. */
export function resetCrewQueries(): void {
  store.clear();
}

const POLL_MS = 30_000;
const MAX_AGE_MS = 15_000;

/** A shared, polled query. `key` null = disabled (returns idle). */
export function useSharedQuery<T>(key: string | null, fetcher: () => Promise<T>, pollMs = POLL_MS): QueryState<T> & { refresh: () => void } {
  const version = useVaultVersion();
  const subscribe = useCallback(
    (l: () => void) => {
      if (key === null) return () => {};
      const e = entry<T>(key);
      e.listeners.add(l);
      return () => {
        e.listeners.delete(l);
      };
    },
    [key],
  );
  const snap = useSyncExternalStore(
    subscribe,
    () => (key === null ? (IDLE as QueryState<T>) : entry<T>(key).snap),
    () => IDLE as QueryState<T>,
  );

  useEffect(() => {
    if (key === null) return;
    load(key, fetcher, version, MAX_AGE_MS);
    // fetcher is derived from key: a new key means a new fetcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  useEffect(() => {
    if (key === null) return;
    const bump = () => {
      if (document.visibilityState === "visible") load(key, fetcher, version, pollMs - 1000);
    };
    const id = setInterval(bump, pollMs);
    document.addEventListener("visibilitychange", bump);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, pollMs]);

  const refresh = useCallback(() => {
    if (key === null) return;
    const e = entry<T>(key);
    e.at = 0;
    load(key, fetcher, version, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return { ...snap, refresh };
}

/* ------------------------------------------------------------------------------------------ */
/* Remembered crews (invites opened on this device, crews created here)                        */
/* ------------------------------------------------------------------------------------------ */

const REMEMBER_KEY = "fitr.crews.v1";
const MAX_REMEMBERED = 24;
const rememberListeners = new Set<() => void>();

function readRemembered(): string {
  try {
    return typeof window === "undefined" ? "" : (window.localStorage.getItem(REMEMBER_KEY) ?? "");
  } catch {
    return "";
  }
}

export function rememberedCrewIds(raw = readRemembered()): bigint[] {
  const out: bigint[] = [];
  for (const part of raw.split(",")) {
    if (/^[1-9][0-9]{0,19}$/.test(part)) {
      const v = BigInt(part);
      if (v < 1n << 64n && !out.includes(v)) out.push(v);
    }
  }
  return out.slice(0, MAX_REMEMBERED);
}

/** Remembers a crew on this device so it is listed before the user commits in it. */
export function rememberCrew(crewId: bigint): void {
  if (crewId <= 0n) return;
  const ids = rememberedCrewIds();
  if (ids[0] === crewId) return;
  const next = [crewId, ...ids.filter((x) => x !== crewId)].slice(0, MAX_REMEMBERED);
  try {
    window.localStorage.setItem(REMEMBER_KEY, next.join(","));
  } catch {
    // Private mode: the crew is still found once the user commits in it.
  }
  rememberListeners.forEach((l) => l());
}

export function forgetCrew(crewId: bigint): void {
  const next = rememberedCrewIds().filter((x) => x !== crewId);
  try {
    window.localStorage.setItem(REMEMBER_KEY, next.join(","));
  } catch {
    // ignore
  }
  rememberListeners.forEach((l) => l());
}

function useRememberedRaw(): string {
  return useSyncExternalStore(
    (l) => {
      rememberListeners.add(l);
      const onStorage = (ev: StorageEvent) => {
        if (ev.key === REMEMBER_KEY) l();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        rememberListeners.delete(l);
        window.removeEventListener("storage", onStorage);
      };
    },
    readRemembered,
    () => "",
  );
}

/* ------------------------------------------------------------------------------------------ */
/* Hooks                                                                                       */
/* ------------------------------------------------------------------------------------------ */

/** Ids (decimal strings) of crews their creator deleted from the app; see lib/crews/closeMessage.ts. */
export function useClosedCrews(): Set<string> {
  const q = useSharedQuery("closed-crews", async () => {
    const res = await fetch("/api/crews/closed", { cache: "no-store" });
    if (!res.ok) throw new Error(`closed crews: ${res.status}`);
    const body = (await res.json()) as { closed?: unknown };
    return Array.isArray(body.closed) ? body.closed.filter((x): x is string => typeof x === "string") : [];
  });
  return useMemo(() => new Set(q.data ?? []), [q.data]);
}

/** Re-reads the closed-crews list now (after this device deleted a crew). */
export function refreshClosedCrews(): void {
  store.delete("closed-crews");
}

/** The crews `owner` belongs to (committed in, created, or opened on this device). */
export function useMyCrews(owner: Address | null): QueryState<CrewInfo[]> & { refresh: () => void } {
  const mint = solanaConfig.skrMint;
  const raw = useRememberedRaw();
  const extra = useMemo(() => rememberedCrewIds(raw), [raw]);
  const key = mint && owner ? `crews:${mint}:${owner}:${extra.join(",")}` : null;
  return useSharedQuery(key, () =>
    fetchUserCrews(getBrowserRpc(), { mint: mint!, user: owner!, extraCrewIds: extra }),
  );
}

/** Vault snapshots of several crews for `owner` (null entries: crew not found). */
export function useCrewVaults(
  owner: Address | null,
  crewIds: readonly bigint[],
  sgtMint: Address | null,
): QueryState<Map<string, VaultSnapshot | null>> & { refresh: () => void } {
  const mint = solanaConfig.skrMint;
  const ids = crewIds.filter((id) => id !== 0n).map((id) => id.toString());
  const key = mint && owner && ids.length > 0 ? `vaults:${mint}:${owner}:${sgtMint ?? "-"}:${ids.join(",")}` : null;
  return useSharedQuery(key, async () => {
    const rpc = getBrowserRpc();
    const nowSecs = Math.floor(Date.now() / 1000);
    const snaps = await Promise.all(
      ids.map((id) => fetchVaultSnapshot(rpc, { mint: mint!, user: owner, sgtMint, nowSecs, crewId: BigInt(id) })),
    );
    return new Map(ids.map((id, i) => [id, snaps[i]]));
  });
}

/** Today's commitments, live DayStates and member profiles of one crew pool. */
export function useCrewBoard(
  poolAddress: Address | null,
  today: number | null,
): QueryState<CrewBoardData> & { refresh: () => void } {
  const key = poolAddress && today !== null ? `board:${poolAddress}:${today}` : null;
  return useSharedQuery(key, () => fetchCrewBoard(getBrowserRpc(), { poolAddress: poolAddress!, today: today! }));
}

