/**
 * Public Solana configuration. Pure: importable from client, server, tests and scripts.
 *
 * Production is Solana MAINNET with real $SKR. Devnet exists only as a developer test mode
 * (a test SKR mint, "tSKR"), selected at build time with NEXT_PUBLIC_SOLANA_CLUSTER=devnet.
 */
import { address, isAddress, type Address } from "@solana/kit";

export type SolanaCluster = "mainnet" | "devnet";
export type SolanaChain = `solana:${SolanaCluster}`;

/** $SKR: classic SPL Token (not Token-2022), 6 decimals. */
export const SKR_MAINNET_MINT: Address = address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
export const SKR_DECIMALS = 6;
/** Seeker Genesis Token group (Token-2022 group mint); SGT checks always read mainnet. */
export const SGT_GROUP: Address = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");

export interface PublicSolanaConfig {
  cluster: SolanaCluster;
  chain: SolanaChain;
  /** Staking mint: real SKR on mainnet; the devnet test mint (or null if unset) on devnet. */
  skrMint: Address | null;
  tokenLabel: "SKR" | "tSKR";
  isTestToken: boolean;
  /** Override for the vault program id; null means "use the generated client's constant". */
  vaultProgramId: Address | null;
  explorerTxUrl(signature: string): string;
  explorerAddressUrl(addr: string): string;
}

export class SolanaConfigError extends Error {}

function optionalAddress(name: string, value: string | undefined): Address | null {
  if (!value) return null;
  if (!isAddress(value)) throw new SolanaConfigError(`${name} is not a valid address`);
  return address(value);
}

export function parsePublicSolanaConfig(env: {
  NEXT_PUBLIC_SOLANA_CLUSTER?: string;
  NEXT_PUBLIC_DEVNET_SKR_MINT?: string;
  NEXT_PUBLIC_VAULT_PROGRAM_ID?: string;
}): PublicSolanaConfig {
  const raw = (env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "mainnet").trim() || "mainnet";
  if (raw !== "mainnet" && raw !== "devnet") {
    throw new SolanaConfigError(`Unknown NEXT_PUBLIC_SOLANA_CLUSTER "${raw}" (expected mainnet or devnet)`);
  }
  const cluster: SolanaCluster = raw;
  const devnet = cluster === "devnet";
  const suffix = devnet ? "?cluster=devnet" : "";
  return {
    cluster,
    chain: `solana:${cluster}`,
    skrMint: devnet ? optionalAddress("NEXT_PUBLIC_DEVNET_SKR_MINT", env.NEXT_PUBLIC_DEVNET_SKR_MINT) : SKR_MAINNET_MINT,
    tokenLabel: devnet ? "tSKR" : "SKR",
    isTestToken: devnet,
    vaultProgramId: optionalAddress("NEXT_PUBLIC_VAULT_PROGRAM_ID", env.NEXT_PUBLIC_VAULT_PROGRAM_ID),
    explorerTxUrl: (sig) => `https://explorer.solana.com/tx/${sig}${suffix}`,
    explorerAddressUrl: (a) => `https://explorer.solana.com/address/${a}${suffix}`,
  };
}

/** Built from literal process.env.NEXT_PUBLIC_* reads so Next inlines them at build time. */
export const solanaConfig: PublicSolanaConfig = parsePublicSolanaConfig({
  NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  NEXT_PUBLIC_DEVNET_SKR_MINT: process.env.NEXT_PUBLIC_DEVNET_SKR_MINT,
  NEXT_PUBLIC_VAULT_PROGRAM_ID: process.env.NEXT_PUBLIC_VAULT_PROGRAM_ID,
});
