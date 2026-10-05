"use client";

/**
 * Live vault state for the connected wallet (or just the pool when nothing is connected).
 * Reads through /api/rpc, refreshes every 30 s while the page is visible and right after any
 * stake/claim (notifyVaultChanged()).
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Address } from "@solana/kit";
import { tr } from "@/lib/i18n";
import { solanaConfig } from "@/lib/solana/config";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { fetchVaultSnapshot, type VaultSnapshot } from "@/lib/solana/vault/read";

export type VaultLoadStatus = "loading" | "ready" | "unavailable" | "error";

export interface VaultState {
  /** unavailable = no stake mint configured, or the pool account does not exist (not deployed). */
  status: VaultLoadStatus;
  snapshot: VaultSnapshot | null;
  error: string | null;
  refresh: () => void;
}

const POLL_MS = 30_000;

let vaultVersion = 0;
const listeners = new Set<() => void>();

/** Call after a stake/claim lands so every vault view refetches immediately. */
export function notifyVaultChanged(): void {
  vaultVersion += 1;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** Bumps on every notifyVaultChanged(); 0 during server rendering (also used by components/crews). */
export function useVaultVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => vaultVersion,
    () => 0,
  );
}

interface Settled {
  key: string;
  requestKey: string;
  snapshot: VaultSnapshot | null;
  missing: boolean;
  error: string | null;
}

/**
 * `opts.crewId` picks the pool: 0 / omitted is the global pool, anything else a crew
 * ("unavailable" when that crew does not exist).
 */
export function useVault(
  owner: Address | null,
  opts: { sgtMint?: Address | null; crewId?: bigint | null } = {},
): VaultState {
  const mint = solanaConfig.skrMint;
  const sgtMint = opts.sgtMint ?? null;
  const crewId = opts.crewId ?? 0n;
  const version = useVaultVersion();
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);

  const key = mint ? `${mint}:${owner ?? "-"}:${sgtMint ?? "-"}${crewId === 0n ? "" : `:crew${crewId}`}` : null;
  const requestKey = key === null ? null : `${key}#${version}#${tick}`;

  useEffect(() => {
    if (!mint || key === null || requestKey === null) return;
    const controller = new AbortController();
    fetchVaultSnapshot(getBrowserRpc(), {
      mint,
      user: owner,
      sgtMint,
      nowSecs: Math.floor(Date.now() / 1000),
      abortSignal: controller.signal,
      ...(crewId === 0n ? {} : { crewId }),
    }).then(
      (snapshot) => {
        if (controller.signal.aborted) return;
        setSettled({ key, requestKey, snapshot, missing: snapshot === null, error: null });
      },
      (err: unknown) => {
        if (controller.signal.aborted) return;
        setSettled((prev) => ({
          key,
          requestKey,
          snapshot: prev?.key === key ? prev.snapshot : null,
          missing: false,
          error: err instanceof Error && err.message ? err.message : tr("stake", "vaultReadFailed"),
        }));
      },
    );
    return () => controller.abort();
  }, [mint, owner, sgtMint, crewId, key, requestKey]);

  // Poll while visible; refetch when the tab comes back.
  useEffect(() => {
    if (key === null) return;
    const bump = () => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    };
    const id = setInterval(bump, POLL_MS);
    document.addEventListener("visibilitychange", bump);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", bump);
    };
  }, [key]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  if (key === null) return { status: "unavailable", snapshot: null, error: null, refresh };
  const current = settled?.key === key ? settled : null;
  if (current?.requestKey === requestKey) {
    if (current.error) return { status: current.snapshot ? "ready" : "error", snapshot: current.snapshot, error: current.error, refresh };
    if (current.missing) return { status: "unavailable", snapshot: null, error: null, refresh };
    return { status: "ready", snapshot: current.snapshot, error: null, refresh };
  }
  // Reloading the same key: keep showing the previous snapshot instead of flashing a spinner.
  if (current?.snapshot) return { status: "ready", snapshot: current.snapshot, error: null, refresh };
  if (current?.missing) return { status: "unavailable", snapshot: null, error: null, refresh };
  return { status: "loading", snapshot: null, error: null, refresh };
}
