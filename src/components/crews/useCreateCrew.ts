"use client";

/**
 * create_crew through the wallet: build → simulate → MWA signAndSend → confirm (the same pipeline
 * as stakes, stake/txflow.ts). The creator is the only signer and pays the crew's rent.
 */
import { useCallback, useRef, useState } from "react";
import type { Signature } from "@solana/kit";
import type { UiWalletAccount } from "@wallet-standard/react";
import { notifyBalancesChanged, useSendingSigner } from "@/components/wallet/hooks";
import { notifyVaultChanged } from "@/hooks/useVault";
import type { ExerciseKind } from "@/lib/pose/types";
import { solanaConfig } from "@/lib/solana/config";
import { getBrowserRpc } from "@/lib/solana/rpc";
import { buildCreateCrewIx, CREATE_CREW_COMPUTE_UNITS, randomCrewId } from "@/lib/solana/vault/crews";
import { friendlyTxError } from "@/lib/solana/vault/errors";
import { ConfirmationError, sendVaultTx, type TxStep } from "@/components/stake/txflow";
import { rememberCrew } from "./useCrews";

export interface CreateCrewInput {
  name: string;
  exercise: ExerciseKind | null;
  goalTarget: number | null;
}

export type CreateCrewPhase = "idle" | TxStep | "done" | "error";

export interface CreateCrewState {
  phase: CreateCrewPhase;
  crewId: bigint | null;
  signature: Signature | null;
  error: string | null;
}

const IDLE: CreateCrewState = { phase: "idle", crewId: null, signature: null, error: null };

export function useCreateCrew(account: UiWalletAccount) {
  const signer = useSendingSigner(account);
  const [state, setState] = useState<CreateCrewState>(IDLE);
  const running = useRef(false);

  const run = useCallback(
    async (input: CreateCrewInput): Promise<bigint | null> => {
      const mint = solanaConfig.skrMint;
      if (running.current || !mint) return null;
      running.current = true;
      const crewId = randomCrewId();
      setState({ ...IDLE, phase: "preparing", crewId });
      try {
        const ix = await buildCreateCrewIx({
          creator: signer,
          mint,
          crewId,
          name: input.name,
          exercise: input.exercise,
          goalTarget: input.exercise ? input.goalTarget : null,
        });
        const res = await sendVaultTx({
          rpc: getBrowserRpc(),
          signer,
          ixs: [ix],
          unitLimit: CREATE_CREW_COMPUTE_UNITS,
          onStep: (phase) => setState((s) => ({ ...s, phase })),
          onSigned: (signature) => setState((s) => ({ ...s, signature })),
        });
        rememberCrew(crewId);
        setState({ phase: "done", crewId, signature: res.signature, error: null });
        return crewId;
      } catch (err) {
        const timeout = err instanceof ConfirmationError && err.outcome === "timeout";
        if (timeout) rememberCrew(crewId);
        setState((s) => ({
          ...s,
          phase: "error",
          signature: err instanceof ConfirmationError ? err.signature : s.signature,
          error: timeout
            ? "Your wallet sent it, but the network has not confirmed it yet. Check the explorer, then refresh."
            : err instanceof ConfirmationError
              ? "Creating the crew failed onchain. Nothing was charged except the network fee."
              : friendlyTxError(err, solanaConfig.tokenLabel),
        }));
        return null;
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
