"use client";

/**
 * Today's $SKR commitment, summarised for the Today screen (contract shared with the Today tab):
 * { state, exercise?, goalTarget?, amountLabel?, deadlineMs?, claimableLabel? }.
 *
 * Multi-pool: a wallet may also hold commitments in crews. useTodayCommitments() returns every
 * pool's summary; useTodayCommitment() the single most urgent one (the global pool decides the
 * gates; a crew wins only when it is strictly more urgent, and then carries crewId / crewName).
 */
import { failedVerificationEndTimes } from "@/lib/storage/verifyFailures";
import { useCallback, useMemo } from "react";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Address } from "@solana/kit";
import { useSeekerStatus, useSelectedWallet } from "@/components/wallet/hooks";
import { deriveTodayCommitment, type TodayCommitment, type TodayInputs } from "@/components/stake/plan";
import { mostUrgentToday, type PoolTodayCommitment } from "@/components/crews/multiPool";
import { useCrewVaults, useMyCrews } from "@/components/crews/useCrews";
import type { ExerciseKind } from "@/lib/pose/types";
import { solanaConfig } from "@/lib/solana/config";
import { formatSkr } from "@/lib/solana/format";
import { crewDisplayName } from "@/lib/solana/vault/crews";
import type { AsyncState, SeekerStatus } from "@/lib/solana/types";
import { useNow, useSessions } from "./useSessions";
import { useVault, type VaultState } from "./useVault";

export type { TodayCommitment, TodayCommitmentState } from "@/components/stake/plan";
export type { PoolTodayCommitment } from "@/components/crews/multiPool";

const formatAmount = (a: bigint) => formatSkr(a, { maxFractionDigits: 2 });

export interface TodayCommitments {
  /** The most urgent commitment across pools (what the Today hero shows). */
  primary: TodayCommitment;
  /** The global pool first, then every crew the wallet belongs to (crews with no pool are skipped). */
  pools: PoolTodayCommitment[];
}

/** How long a just-finished workout shows as "Verifying" on the Today card. */
export const VERIFYING_WINDOW_MS = 3 * 60_000;

export function useTodayCommitments(): TodayCommitments {
  const { owner } = useSelectedWallet();
  const seeker = useSeekerStatus(owner);
  const vault = useVault(owner, { sgtMint: seeker.data?.sgtMint ?? null });
  return usePoolsToday(owner, vault, seeker);
}

/**
 * The multi-pool summary on top of an already loaded global vault (so a screen that has one does
 * not read it twice): loads the wallet's crews and their snapshots, derives each pool's state.
 */
export function usePoolsToday(
  owner: Address | null,
  vault: Pick<VaultState, "status" | "snapshot">,
  seeker: Pick<AsyncState<SeekerStatus>, "status" | "data">,
): TodayCommitments {
  const tc = useT("crews");
  const sgtMint = seeker.data?.sgtMint ?? null;
  const crews = useMyCrews(vault.snapshot ? owner : null);
  const crewList = useMemo(() => crews.data ?? [], [crews.data]);
  const crewIds = useMemo(() => crewList.map((c) => c.crewId), [crewList]);
  const crewVaults = useCrewVaults(vault.snapshot ? owner : null, crewIds, sgtMint);
  const sessions = useSessions();
  const nowMs = useNow();

  // "Verifying" means: a workout that met the goal just ended and its verification may still be
  // landing. It takes seconds, so after VERIFYING_WINDOW_MS (or once the server rejected that
  // workout) the card goes back to the open stake with its Start button.
  const hasLocalGoalMet = useCallback(
    (exercise: ExerciseKind, goal: number, startMs: number, endMs: number) => {
      const failed = failedVerificationEndTimes();
      return sessions.some(
        (s) =>
          s.exercise === exercise &&
          s.endedAt >= startMs &&
          s.endedAt < endMs &&
          s.endedAt >= nowMs - VERIFYING_WINDOW_MS &&
          !failed.has(s.endedAt) &&
          (exercise === "plank" || exercise === "wall_sit"
            ? Math.floor(s.summary.holdMs / 1000) >= goal
            : s.summary.reps >= goal),
      );
    },
    [sessions, nowMs],
  );

  if (!owner) {
    const primary: TodayCommitment = { state: "no_wallet" };
    return { primary, pools: [{ ...primary, crewId: 0n, crewName: "" }] };
  }
  const requireSgt = vault.snapshot ? vault.snapshot.pool.requireSgt : solanaConfig.cluster === "mainnet" ? true : null;
  const base: Omit<TodayInputs, "vault" | "snapshot"> = {
    hasWallet: true,
    requireSgt,
    isSeeker: seeker.status === "ready" && seeker.data ? seeker.data.isSeeker : null,
    nowSecs: Math.floor(nowMs / 1000),
    hasLocalGoalMet,
    formatAmount,
  };
  const global = deriveTodayCommitment({ ...base, vault: vault.status, snapshot: vault.snapshot });
  const pools: PoolTodayCommitment[] = [{ ...global, crewId: 0n, crewName: "" }];
  for (const crew of crewList) {
    const snap = crewVaults.data?.get(crew.crewId.toString());
    if (!snap) continue;
    const t = deriveTodayCommitment({ ...base, vault: "ready", snapshot: snap });
    pools.push({ ...t, crewId: crew.crewId, crewName: crewDisplayName(crew, tc) });
  }
  const best = mostUrgentToday(global, pools.slice(1));
  // The global pool keeps the original shape (no crew fields) for existing consumers.
  const primary: TodayCommitment =
    best.crewId === 0n ? global : { ...stripPool(best), crewId: best.crewId.toString(), crewName: best.crewName };
  return { primary, pools };
}

function stripPool(p: PoolTodayCommitment): TodayCommitment {
  const { crewId: _c, crewName: _n, ...rest } = p;
  void _c;
  void _n;
  return rest;
}

export function useTodayCommitment(): TodayCommitment {
  return useTodayCommitments().primary;
}
