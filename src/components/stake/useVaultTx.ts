"use client";

import { useCallback, useRef, useState } from "react";
import type { Address, Signature } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import { notifyBalancesChanged, useSendingSigner } from "@/components/wallet/hooks";
import { notifyVaultChanged } from "@/hooks/useVault";
import { solanaConfig } from "@/lib/solana/config";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { extractCustomErrorCode, friendlyTxError } from "@/lib/solana/vault/errors";
import type { Exercise } from "@/lib/solana/vault/generated";
import {
  buildDailyLoopIxs,
  estimateComputeUnits,
  type SgtAccounts,
} from "@/lib/solana/vault/instructions";
import { fallbackPlan, type TxPlan } from "./plan";
import { ConfirmationError, SimulationFailedError, sendVaultTx, type TxStep } from "./txflow";

export interface CommitArgs {
  dayIndex: number;
  amount: bigint;
  exercise: Exercise;
  goalTarget: number;
}

export interface VaultTxRequest {
  plan: TxPlan;
  commit: CommitArgs | null;
  /** Required for commit when the pool requires a Seeker Genesis Token. */
  sgt: SgtAccounts | null;
  registerDevice: boolean;
  /** The pool every instruction acts on: 0 / omitted = the global pool, else a crew. */
  crewId?: bigint;
}

export type VaultTxPhase = "idle" | TxStep | "done" | "error";

export interface VaultTxState {
  phase: VaultTxPhase;
  /** What the confirmed transaction did. */
  did: { committed: boolean; settled: TxPlan["settle"] } | null;
  signature: Signature | null;
  error: string | null;
  /** The wallet returned a signature but confirmation timed out: it may still land. */
  unconfirmed: boolean;
}

const IDLE: VaultTxState = { phase: "idle", did: null, signature: null, error: null, unconfirmed: false };

export function isBusy(phase: VaultTxPhase): boolean {
  return phase === "preparing" || phase === "simulating" || phase === "signing" || phase === "confirming";
}

/**
 * Runs one vault transaction for the connected account: build → simulate (with one smaller
 * retry when a bundled finalize races the crank/clock) → wallet signs+sends → confirm.
 * Render only while `account` is connected (hooks cannot be conditional).
 */
export function useVaultTx(account: UiWalletAccount) {
  const signer = useSendingSigner(account);
  const [state, setState] = useState<VaultTxState>(IDLE);
  const running = useRef(false);

  const run = useCallback(
    async (req: VaultTxRequest) => {
      const mint: Address | null = solanaConfig.skrMint;
      if (running.current || !mint) return;
      running.current = true;
      setState({ ...IDLE, phase: "preparing" });
      const rpc = getBrowserRpc();

      const attempt = async (plan: TxPlan) => {
        const commit = plan.commit ? req.commit : null;
        const ixs = await buildDailyLoopIxs({
          user: signer,
          mint,
          settle: plan.settle,
          commit,
          sgt: commit ? req.sgt : null,
          registerDevice: Boolean(commit && req.sgt && req.registerDevice),
          crewId: req.crewId ?? 0n,
        });
        const unitLimit = estimateComputeUnits({
          settle: plan.settle,
          commit,
          registerDevice: Boolean(commit && req.sgt && req.registerDevice),
        });
        const res = await sendVaultTx({
          rpc,
          signer,
          ixs,
          unitLimit,
          onStep: (phase) => setState((s) => ({ ...s, phase })),
          onSigned: (signature) => setState((s) => ({ ...s, signature })),
        });
        return { res, plan };
      };

      try {
        let outcome;
        try {
          outcome = await attempt(req.plan);
        } catch (err) {
          const smaller = err instanceof SimulationFailedError ? fallbackPlan(req.plan, extractCustomErrorCode(err)) : null;
          if (!smaller) throw err;
          outcome = await attempt(smaller);
        }
        setState({
          phase: "done",
          did: { committed: outcome.plan.commit && req.commit !== null, settled: outcome.plan.settle },
          signature: outcome.res.signature,
          error: null,
          unconfirmed: false,
        });
      } catch (err) {
        const timeout = err instanceof ConfirmationError && err.outcome === "timeout";
        setState((s) => ({
          ...s,
          phase: "error",
          signature: err instanceof ConfirmationError ? err.signature : s.signature,
          unconfirmed: timeout,
          error: timeout
            ? "Your wallet sent it, but the network has not confirmed it yet. Check the explorer, then refresh."
            : err instanceof ConfirmationError
              ? "The transaction failed onchain. Nothing was staked. Refresh and try again."
              : friendlyTxError(err, solanaConfig.tokenLabel),
        }));
      } finally {
        running.current = false;
        notifyVaultChanged();
        notifyBalancesChanged();
      }
    },
    [signer],
  );

  const reset = useCallback(() => setState(IDLE), []);
  return { state, run, reset };
}
