/**
 * Browser-side network access. All Solana JSON-RPC goes through our own POST /api/rpc proxy
 * (the Helius key stays on the server); the Seeker check is GET /api/seeker?owner=.
 */
import { address, createSolanaRpc, type Address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import { tr } from "@/lib/i18n";
import type { ApiError, ApiErrorCode, SeekerStatus, SeekerStatusResponse } from "./types";

export const RPC_PROXY_PATH = "/api/rpc";
export const SEEKER_API_PATH = "/api/seeker";

export type BrowserRpc = Rpc<SolanaRpcApi>;

let browserRpc: BrowserRpc | null = null;

/** Memoized RPC client pointed at same-origin /api/rpc. Browser only. */
export function getBrowserRpc(): BrowserRpc {
  if (typeof window === "undefined") throw new Error("getBrowserRpc() is browser-only");
  browserRpc ??= createSolanaRpc(new URL(RPC_PROXY_PATH, window.location.origin).href);
  return browserRpc;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiErrorCode | "network" | "bad_response",
    readonly status: number | null,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isApiError(body: unknown): body is ApiError {
  return typeof body === "object" && body !== null && typeof (body as ApiError).error === "string" && typeof (body as ApiError).code === "string";
}

function parseSeekerResponse(body: unknown): SeekerStatus {
  const b = body as Partial<SeekerStatusResponse> | null;
  if (!b || typeof b.owner !== "string" || typeof b.isSeeker !== "boolean" || typeof b.checkedAt !== "number") {
    throw new ApiRequestError(tr("wallet", "seekerCheckBadResponse"), "bad_response", 200);
  }
  return {
    owner: address(b.owner),
    isSeeker: b.isSeeker,
    sgtMint: b.sgtMint ? address(b.sgtMint) : null,
    sgtTokenAccount: b.sgtTokenAccount ? address(b.sgtTokenAccount) : null,
    checkedAt: b.checkedAt,
  };
}

export async function fetchSeekerStatus(
  owner: Address,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<SeekerStatus> {
  const doFetch = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(`${SEEKER_API_PATH}?owner=${encodeURIComponent(owner)}`, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiRequestError(tr("wallet", "networkError"), "network", null);
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Fall through: handled below.
  }
  if (!res.ok) {
    if (isApiError(body)) throw new ApiRequestError(body.error, body.code, res.status, body.retryAfterSec);
    throw new ApiRequestError(tr("wallet", "seekerCheckFailed", { status: res.status }), "bad_response", res.status);
  }
  return parseSeekerResponse(body);
}
