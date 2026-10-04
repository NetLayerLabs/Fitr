/**
 * GET /api/seeker?owner=<address>: does this wallet hold a genuine Seeker Genesis Token?
 * Always checks MAINNET (SGTs exist only there), whatever cluster the app runs on.
 * 10-minute in-memory cache per owner; upstream lookups limited to 10/min per IP.
 */
import "server-only";
import { address, createSolanaRpc, isAddress } from "@solana/kit";
import { findSeekerGenesisToken } from "@/lib/solana/sgt";
import { clientKey, createRateLimiter } from "@/lib/solana/server/rateLimit";
import { apiError, isSameOrigin, jsonResponse } from "@/lib/solana/server/rpcProxy";
import { readHeliusApiKey } from "@/lib/solana/server/secrets";
import { upstreamRpcUrl } from "@/lib/solana/server/upstream";
import type { SeekerStatusResponse } from "@/lib/solana/types";

const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 5_000;
const UPSTREAM_TIMEOUT_MS = 15_000;

const cache = new Map<string, { body: SeekerStatusResponse; expiresAt: number }>();
// 10 upstream lookups per minute per IP (cache hits are free).
const limiter = createRateLimiter({ capacity: 10, refillPerSecond: 10 / 60 });

const okHeaders = { "cache-control": "private, max-age=60" };

function cacheGet(owner: string, now: number): SeekerStatusResponse | null {
  const hit = cache.get(owner);
  if (!hit) return null;
  if (hit.expiresAt <= now) {
    cache.delete(owner);
    return null;
  }
  return hit.body;
}

function cacheSet(owner: string, body: SeekerStatusResponse, now: number): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
    while (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }
  cache.set(owner, { body, expiresAt: now + CACHE_TTL_MS });
}

export async function GET(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) {
    return jsonResponse(apiError("forbidden_origin", "Cross-origin requests are not allowed"), 403);
  }
  const owner = new URL(request.url).searchParams.get("owner")?.trim() ?? "";
  if (!isAddress(owner)) {
    return jsonResponse(apiError("bad_request", "owner must be a valid Solana address"), 400);
  }

  const now = Date.now();
  const cached = cacheGet(owner, now);
  if (cached) return jsonResponse(cached, 200, okHeaders);

  const ip = clientKey(request);
  if (!limiter.take(ip)) {
    const retry = Math.max(1, limiter.retryAfterSec(ip));
    return jsonResponse(apiError("rate_limited", "Too many requests", retry), 429, {
      "retry-after": String(retry),
    });
  }

  const upstream = upstreamRpcUrl("mainnet", readHeliusApiKey(), process.env.NODE_ENV);
  if (!upstream) {
    return jsonResponse(apiError("not_configured", "Seeker check is not configured"), 503);
  }

  try {
    const status = await findSeekerGenesisToken(createSolanaRpc(upstream), address(owner), {
      abortSignal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body: SeekerStatusResponse = {
      owner: status.owner,
      isSeeker: status.isSeeker,
      sgtMint: status.sgtMint,
      sgtTokenAccount: status.sgtTokenAccount,
      checkedAt: status.checkedAt,
    };
    cacheSet(owner, body, Date.now());
    return jsonResponse(body, 200, okHeaders);
  } catch {
    // Never log or return the error: transport errors can carry upstream details.
    return jsonResponse(apiError("upstream_unavailable", "Seeker check is temporarily unavailable"), 503);
  }
}
