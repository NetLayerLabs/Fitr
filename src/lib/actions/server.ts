/**
 * Server context for the public surfaces (Blinks, share cards, dashboard): a read/simulate RPC on
 * the configured cluster (Helius when HELIUS_API_KEY is set), a mainnet RPC for the Seeker check,
 * and a Helius priority-fee estimate with a fallback. Needs NO signing key: nothing here signs or
 * sends a transaction. Server only.
 */
import "server-only";
import { address, createSolanaRpc, type Address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { solanaConfig, type SolanaCluster } from "@/lib/solana/config";
import { readHeliusApiKey } from "@/lib/solana/server/secrets";
import { upstreamRpcUrl } from "@/lib/solana/server/upstream";
import { findSeekerGenesisToken } from "@/lib/solana/sgt";
import { vaultProgramAddress } from "@/lib/solana/vault/addresses";
import type { ActionsChain } from "./vaultActions";

export const DEFAULT_PRIORITY_MICROLAMPORTS = 20_000n;
export const MIN_PRIORITY_MICROLAMPORTS = 1_000n;
export const MAX_PRIORITY_MICROLAMPORTS = 2_000_000n;

export function clampPriorityFee(estimate: unknown): bigint {
  const n = typeof estimate === "number" ? estimate : typeof estimate === "string" ? Number(estimate) : NaN;
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PRIORITY_MICROLAMPORTS;
  const v = BigInt(Math.ceil(n));
  if (v < MIN_PRIORITY_MICROLAMPORTS) return MIN_PRIORITY_MICROLAMPORTS;
  return v > MAX_PRIORITY_MICROLAMPORTS ? MAX_PRIORITY_MICROLAMPORTS : v;
}

/** Helius getPriorityFeeEstimate (recommended) for a base64 transaction; the default on any failure. */
export async function estimatePriorityFeeForTx(
  upstreamUrl: string,
  txBase64: string,
  fetchImpl: typeof fetch = fetch,
): Promise<bigint> {
  try {
    const res = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "fitr-action-fee",
        method: "getPriorityFeeEstimate",
        params: [{ transaction: txBase64, options: { transactionEncoding: "base64", recommended: true } }],
      }),
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (!res.ok) return DEFAULT_PRIORITY_MICROLAMPORTS;
    const body = (await res.json()) as { result?: { priorityFeeEstimate?: unknown } };
    return clampPriorityFee(body?.result?.priorityFeeEstimate);
  } catch {
    return DEFAULT_PRIORITY_MICROLAMPORTS;
  }
}

export interface PublicChain {
  cluster: SolanaCluster;
  rpc: Rpc<SolanaRpcApi>;
  programAddress: Address;
  mint: Address;
  tokenLabel: string;
}

type Env = Record<string, string | undefined>;

/** Read-only chain access for pages (share card, dashboard). null when not configured. */
export function getPublicChain(env: Env = process.env): PublicChain | null {
  const cluster = solanaConfig.cluster;
  const upstream = upstreamRpcUrl(cluster, readHeliusApiKey(env), env.NODE_ENV);
  const mint = solanaConfig.skrMint;
  if (!upstream || !mint) return null;
  return {
    cluster,
    rpc: createSolanaRpc(upstream),
    programAddress: vaultProgramAddress(),
    mint: address(mint),
    tokenLabel: solanaConfig.tokenLabel,
  };
}

/** The Blinks context. null when RPC access or the staking mint is not configured (routes answer 503). */
export function getActionsChain(env: Env = process.env): ActionsChain | null {
  const cluster = solanaConfig.cluster;
  const key = readHeliusApiKey(env);
  const upstream = upstreamRpcUrl(cluster, key, env.NODE_ENV);
  const mainnet = upstreamRpcUrl("mainnet", key, env.NODE_ENV);
  const mint = solanaConfig.skrMint;
  if (!upstream || !mainnet || !mint) return null;
  const rpc = createSolanaRpc(upstream);
  const sgtRpc = cluster === "mainnet" ? rpc : createSolanaRpc(mainnet);
  return {
    cluster,
    rpc,
    programAddress: vaultProgramAddress(),
    mint: address(mint),
    tokenLabel: solanaConfig.tokenLabel,
    findSgt: (owner) => findSeekerGenesisToken(sgtRpc, owner, { abortSignal: AbortSignal.timeout(15_000) }),
    priorityFee: (tx) => estimatePriorityFeeForTx(upstream, tx),
    nowSecs: () => Math.floor(Date.now() / 1000),
  };
}
