/**
 * POST /api/rpc: same-origin JSON-RPC proxy to Helius for the browser wallet client.
 * Single requests only, method allowlist, 64 KB body cap, per-IP token bucket.
 * The Helius key is added server side and never appears in a response.
 */
import "server-only";
import { solanaConfig } from "@/lib/solana/config";
import { clientKey, createRateLimiter } from "@/lib/solana/server/rateLimit";
import {
  apiError,
  forwardRpc,
  isSameOrigin,
  jsonResponse,
  MAX_RPC_BODY_BYTES,
  readBodyCapped,
  validateRpcRequest,
} from "@/lib/solana/server/rpcProxy";
import { readHeliusApiKey } from "@/lib/solana/server/secrets";
import { upstreamRpcUrl } from "@/lib/solana/server/upstream";

/** Fitr vault program (anchor/programs/fitr-vault declare_id); overridable per build. */
const DEFAULT_VAULT_PROGRAM_ID = "9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY";

// 20 requests/s per IP with a burst of 60. In-memory: one `next start` process on the VPS.
const limiter = createRateLimiter({ capacity: 60, refillPerSecond: 20 });

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonResponse(apiError("forbidden_origin", "Cross-origin requests are not allowed"), 403);
  }
  const ip = clientKey(request);
  if (!limiter.take(ip)) {
    const retry = Math.max(1, limiter.retryAfterSec(ip));
    return jsonResponse(apiError("rate_limited", "Too many requests", retry), 429, {
      "retry-after": String(retry),
    });
  }

  const body = await readBodyCapped(request, MAX_RPC_BODY_BYTES);
  if (!body.ok) return jsonResponse(body.body, body.status);

  const v = validateRpcRequest(body.text, {
    vaultProgramId: solanaConfig.vaultProgramId ?? DEFAULT_VAULT_PROGRAM_ID,
  });
  if (!v.ok) return jsonResponse(v.body, v.status);

  const upstream = upstreamRpcUrl(solanaConfig.cluster, readHeliusApiKey(), process.env.NODE_ENV);
  if (!upstream) {
    return jsonResponse(apiError("not_configured", "Solana RPC is not configured"), 503);
  }
  return forwardRpc(v.request, upstream);
}
