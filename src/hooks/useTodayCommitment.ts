"use client";

/**
 * Today's $SKR commitment, summarised for the Today screen (contract shared with the Today tab):
 * { state, exercise?, goalTarget?, amountLabel?, deadlineMs?, claimableLabel? }.
 */
import { useCallback } from "react";
import { useSeekerStatus, useSelectedWallet } from "@/components/wallet/hooks";
import { deriveTodayCommitment, type TodayCommitment } from "@/components/stake/plan";
import type { ExerciseKind } from "@/lib/pose/types";
import { solanaConfig } from "@/lib/solana/config";
import { formatSkr } from "@/lib/solana/format";
import { useNow, useSessions } from "./useSessions";
import { useVault } from "./useVault";

export type { TodayCommitment, TodayCommitmentState } from "@/components/stake/plan";

export function useTodayCommitment(): TodayCommitment {
  const { owner } = useSelectedWallet();
  const seeker = useSeekerStatus(owner);
  const vault = useVault(owner, { sgtMint: seeker.data?.sgtMint ?? null });
  const sessions = useSessions();
  const nowMs = useNow();

  const hasLocalGoalMet = useCallback(
    (exercise: ExerciseKind, goal: number, startMs: number, endMs: number) =>
      sessions.some(
        (s) =>
          s.exercise === exercise &&
          s.endedAt >= startMs &&
          s.endedAt < endMs &&
          (exercise === "plank" || exercise === "wall_sit"
            ? Math.floor(s.summary.holdMs / 1000) >= goal
            : s.summary.reps >= goal),
      ),
    [sessions],
  );

  if (!owner) return { state: "no_wallet" };
  const requireSgt = vault.snapshot ? vault.snapshot.pool.requireSgt : solanaConfig.cluster === "mainnet" ? true : null;
  return deriveTodayCommitment({
    hasWallet: true,
    requireSgt,
    isSeeker: seeker.status === "ready" && seeker.data ? seeker.data.isSeeker : null,
    vault: vault.status,
    snapshot: vault.snapshot,
    nowSecs: Math.floor(nowMs / 1000),
    hasLocalGoalMet,
    formatAmount: (a) => formatSkr(a, { maxFractionDigits: 2 }),
  });
}
