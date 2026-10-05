/**
 * Browser-side send pipeline for vault transactions:
 *   build → priority fee (Helius getPriorityFeeEstimate via /api/rpc, fallback default)
 *   → simulateTransaction via /api/rpc → right-size the CU limit → wallet signs AND sends
 *   (MWA signAndSendTransaction; the wallet is the only signer and fee payer) → poll status.
 */
import "client-only";
import {
  compileTransaction,
  getBase58Decoder,
  getBase64EncodedWireTransaction,
  signAndSendTransactionMessageWithSigners,
  type Instruction,
  type Signature,
  type TransactionSendingSigner,
} from "@solana/kit";
import { RPC_PROXY_PATH, type BrowserRpc } from "@/lib/solana/rpc";
import { pollSignature, type PollOutcome } from "@/lib/solana/server/confirm";
import {
  composeUserTransaction,
  computeUnitLimitFromSimulation,
  SIMULATION_CU_LIMIT,
} from "@/lib/solana/vault/instructions";

/** µ-lamports per CU when the estimate is unavailable (≈ 0.0000024 SOL at 120k CU). */
export const DEFAULT_PRIORITY_MICROLAMPORTS = 20_000n;
/** Never pay more than this per CU, whatever the estimate says (≈ 0.00024 SOL at 120k CU). */
export const MAX_PRIORITY_MICROLAMPORTS = 2_000_000n;
export const MIN_PRIORITY_MICROLAMPORTS = 1_000n;

export function clampPriorityFee(estimate: unknown): bigint {
  const n = typeof estimate === "number" ? estimate : typeof estimate === "string" ? Number(estimate) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PRIORITY_MICROLAMPORTS;
  const v = BigInt(Math.ceil(n));
  if (v < MIN_PRIORITY_MICROLAMPORTS) return MIN_PRIORITY_MICROLAMPORTS;
  return v > MAX_PRIORITY_MICROLAMPORTS ? MAX_PRIORITY_MICROLAMPORTS : v;
}

/** Helius getPriorityFeeEstimate ("recommended") for a base64 transaction; default on any failure. */
export async function fetchPriorityFee(
  txBase64: string,
  opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<bigint> {
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(RPC_PROXY_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "fee",
        method: "getPriorityFeeEstimate",
        params: [{ transaction: txBase64, options: { transactionEncoding: "base64", recommended: true } }],
      }),
      signal: opts.signal,
    });
    if (!res.ok) return DEFAULT_PRIORITY_MICROLAMPORTS;
    const body = (await res.json()) as { result?: { priorityFeeEstimate?: unknown } };
    return clampPriorityFee(body?.result?.priorityFeeEstimate);
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    return DEFAULT_PRIORITY_MICROLAMPORTS;
  }
}

export class SimulationFailedError extends Error {
  constructor(
    readonly err: unknown,
    readonly logs: readonly string[],
  ) {
    super("Transaction simulation failed");
    this.name = "SimulationFailedError";
  }
}

export class ConfirmationError extends Error {
  constructor(
    readonly outcome: Exclude<PollOutcome, "confirmed" | "finalized">,
    readonly signature: Signature,
  ) {
    super(outcome === "failed" ? "The transaction failed onchain" : "Confirmation timed out");
    this.name = "ConfirmationError";
  }
}

export type TxStep = "preparing" | "simulating" | "signing" | "confirming";

export interface SendVaultTxParams {
  rpc: BrowserRpc;
  signer: TransactionSendingSigner;
  ixs: readonly Instruction[];
  /** Initial CU limit (estimateComputeUnits); replaced by simulation units × 1.2. */
  unitLimit: number;
  onStep?: (step: TxStep) => void;
  /** Called with the signature as soon as the wallet returns it (before confirmation). */
  onSigned?: (signature: Signature) => void;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  confirmTimeoutMs?: number;
}

export interface SendVaultTxResult {
  signature: Signature;
  outcome: "confirmed" | "finalized";
  priorityMicroLamports: bigint;
  unitLimit: number;
}

/** Builds, simulates, has the wallet sign + send, and waits for confirmation. */
export async function sendVaultTx(p: SendVaultTxParams): Promise<SendVaultTxResult> {
  p.onStep?.("preparing");
  const { value: latestBlockhash } = await p.rpc.getLatestBlockhash({ commitment: "confirmed" }).send({ abortSignal: p.signal });

  const draft = composeUserTransaction({
    feePayer: p.signer,
    latestBlockhash,
    ixs: p.ixs,
    unitLimit: SIMULATION_CU_LIMIT,
    microLamportsPerCu: DEFAULT_PRIORITY_MICROLAMPORTS,
  });
  const draftB64 = getBase64EncodedWireTransaction(compileTransaction(draft));

  p.onStep?.("simulating");
  const [priority, sim] = await Promise.all([
    fetchPriorityFee(draftB64, { fetchImpl: p.fetchImpl, signal: p.signal }),
    p.rpc
      .simulateTransaction(draftB64, {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: "confirmed",
      })
      .send({ abortSignal: p.signal }),
  ]);
  if (sim.value.err) throw new SimulationFailedError(sim.value.err, sim.value.logs ?? []);
  const unitLimit = computeUnitLimitFromSimulation(sim.value.unitsConsumed ?? 0n, p.unitLimit);

  const message = composeUserTransaction({
    feePayer: p.signer,
    latestBlockhash,
    ixs: p.ixs,
    unitLimit,
    microLamportsPerCu: priority,
  });

  p.onStep?.("signing");
  const sigBytes = await signAndSendTransactionMessageWithSigners(message, { abortSignal: p.signal });
  const signature = getBase58Decoder().decode(sigBytes) as Signature;
  p.onSigned?.(signature);

  p.onStep?.("confirming");
  const outcome = await pollSignature(p.rpc, signature, {
    commitment: "confirmed",
    timeoutMs: p.confirmTimeoutMs ?? 90_000,
    intervalMs: 1_500,
    signal: p.signal,
  });
  if (outcome === "failed" || outcome === "timeout") throw new ConfirmationError(outcome, signature);
  return { signature, outcome, priorityMicroLamports: priority, unitLimit };
}
