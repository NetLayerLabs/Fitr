/**
 * Upstream Solana RPC URL selection (server side only; the URL carries the Helius key).
 * Pure: the key and NODE_ENV are parameters so tests never touch process.env.
 */
import type { SolanaCluster } from "../config";

export const PUBLIC_RPC_URLS: Readonly<Record<SolanaCluster, string>> = {
  mainnet: "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
};

/**
 * Helius when a key is set. Without a key: the public RPC outside production (developer
 * convenience), null in production (callers answer 503 `not_configured`).
 */
export function upstreamRpcUrl(
  cluster: SolanaCluster,
  heliusApiKey: string | null,
  nodeEnv: string | undefined,
): string | null {
  if (heliusApiKey) {
    return `https://${cluster}.helius-rpc.com/?api-key=${encodeURIComponent(heliusApiKey)}`;
  }
  if (nodeEnv === "production") return null;
  return PUBLIC_RPC_URLS[cluster];
}

/**
 * Removes every occurrence of the upstream URL and its `api-key` value from `text`.
 * Defence in depth for anything derived from upstream (bodies, error text).
 */
export function scrubUpstreamSecrets(text: string, upstreamUrl: string): string {
  const secrets = new Set<string>([upstreamUrl]);
  try {
    const key = new URL(upstreamUrl).searchParams.get("api-key");
    if (key) {
      secrets.add(key);
      secrets.add(encodeURIComponent(key));
    }
  } catch {
    // Not a URL: only the literal string is scrubbed.
  }
  let out = text;
  // Longest first so the full URL is replaced before its key fragment.
  for (const s of [...secrets].sort((a, b) => b.length - a.length)) {
    if (s) out = out.split(s).join("[redacted]");
  }
  return out;
}
