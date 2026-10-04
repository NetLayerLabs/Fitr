/**
 * Route-handler factory for the Blinks: GET (metadata), POST (transaction), OPTIONS (CORS).
 * The chain context is injectable so tests drive the real handlers against an in-memory RPC.
 * Errors never leak upstream details (the RPC URL carries the Helius key). Server only.
 */
import "server-only";
import { solanaConfig, type SolanaCluster } from "@/lib/solana/config";
import { clientKey, createRateLimiter, type RateLimiter } from "@/lib/solana/server/rateLimit";
import { readBodyCapped } from "@/lib/solana/server/rpcProxy";
import { actionError, actionJson, actionOptions, type ActionGetResponse, type ActionPostResponse } from "./spec";
import { getActionsChain } from "./server";
import {
  commitMetadata,
  commitTransaction,
  lookupPool,
  parseCommitQuery,
  sponsorMetadata,
  sponsorTransaction,
  type ActionResult,
  type ActionsChain,
  type PoolLookup,
} from "./vaultActions";

export interface ActionRouteSpec {
  /** GET body for the pool named by `?pool=` (or the global pool). */
  metadata(lookup: PoolLookup, url: URL, tokenLabel: string): ActionGetResponse;
  transaction(chain: ActionsChain, url: URL, account: unknown): Promise<ActionResult<ActionPostResponse>>;
}

export interface ActionRouteDeps {
  chain?: () => ActionsChain | null;
  getLimiter?: RateLimiter;
  postLimiter?: RateLimiter;
}

const NOT_CONFIGURED = "Fitr Blinks are not available right now. Please try again later.";
const UNAVAILABLE = "Solana is busy right now. Please try again in a minute.";

export function createActionRoute(spec: ActionRouteSpec, deps: ActionRouteDeps = {}) {
  const chainOf = deps.chain ?? (() => getActionsChain());
  const getLimiter = deps.getLimiter ?? createRateLimiter({ capacity: 60, refillPerSecond: 1 });
  const postLimiter = deps.postLimiter ?? createRateLimiter({ capacity: 10, refillPerSecond: 10 / 60 });
  const clusterOf = (chain: ActionsChain | null): SolanaCluster => chain?.cluster ?? solanaConfig.cluster;

  async function GET(request: Request): Promise<Response> {
    const chain = chainOf();
    const cluster = clusterOf(chain);
    if (!getLimiter.take(clientKey(request))) return actionError("Too many requests. Try again shortly.", cluster, 429);
    if (!chain) return actionError(NOT_CONFIGURED, cluster, 503);
    const url = new URL(request.url);
    let lookup: PoolLookup;
    try {
      lookup = await lookupPool(chain, url.searchParams.get("pool"));
    } catch {
      return actionError(UNAVAILABLE, cluster, 503);
    }
    return actionJson(spec.metadata(lookup, url, chain.tokenLabel), cluster, 200, "public, max-age=30");
  }

  async function POST(request: Request): Promise<Response> {
    const chain = chainOf();
    const cluster = clusterOf(chain);
    if (!postLimiter.take(clientKey(request))) return actionError("Too many requests. Try again shortly.", cluster, 429);
    if (!chain) return actionError(NOT_CONFIGURED, cluster, 503);
    const body = await readBodyCapped(request, 4_096);
    if (!body.ok) return actionError("Invalid request.", cluster, body.status);
    let account: unknown;
    try {
      account = (JSON.parse(body.text) as { account?: unknown })?.account;
    } catch {
      return actionError("Invalid request body.", cluster, 400);
    }
    let result: ActionResult<ActionPostResponse>;
    try {
      result = await spec.transaction(chain, new URL(request.url), account);
    } catch {
      return actionError(UNAVAILABLE, cluster, 503);
    }
    if (!result.ok) return actionError(result.message, cluster, result.status);
    return actionJson(result.body, cluster, 200);
  }

  function OPTIONS(): Response {
    return actionOptions(clusterOf(null));
  }

  return { GET, POST, OPTIONS };
}

/* ------------------------------------------------------------------------------------------ */
/* The two Blinks                                                                              */
/* ------------------------------------------------------------------------------------------ */

export const COMMIT_ACTION: ActionRouteSpec = {
  metadata: (lookup, url, tokenLabel) => commitMetadata(lookup, parseCommitQuery(url), tokenLabel),
  transaction: commitTransaction,
};

export const SPONSOR_ACTION: ActionRouteSpec = {
  metadata: (lookup, _url, tokenLabel) => sponsorMetadata(lookup, tokenLabel),
  transaction: sponsorTransaction,
};
