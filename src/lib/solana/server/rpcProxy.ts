/**
 * JSON-RPC proxy logic for POST /api/rpc: validation, same-origin check, capped body reading and
 * forwarding. The upstream URL (which carries the Helius key) never appears in a response.
 */
import type { ApiError, ApiErrorCode } from "../types";
import { scrubUpstreamSecrets } from "./upstream";

/** Read-only methods (plus simulate) the browser client needs. Sending goes through the wallet. */
export const RPC_METHOD_ALLOWLIST: ReadonlySet<string> = new Set([
  "getAccountInfo",
  "getMultipleAccounts",
  "getBalance",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getProgramAccounts",
  "getLatestBlockhash",
  "isBlockhashValid",
  "getFeeForMessage",
  "getMinimumBalanceForRentExemption",
  "getSignatureStatuses",
  "simulateTransaction",
  "getPriorityFeeEstimate",
  "getSlot",
]);

export const MAX_RPC_BODY_BYTES = 65_536;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown[] | Record<string, unknown>;
}

export type RpcValidation =
  | { ok: true; request: JsonRpcRequest }
  | { ok: false; status: 400 | 403 | 413; body: ApiError };

export interface ValidateRpcOptions {
  /** getProgramAccounts is allowed only against this program, with memcmp filters. null: never. */
  vaultProgramId?: string | null;
}

export function apiError(code: ApiErrorCode, error: string, retryAfterSec?: number): ApiError {
  return retryAfterSec === undefined ? { error, code } : { error, code, retryAfterSec };
}

/** JSON response with no-store caching; used for every proxy answer. */
export function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function fail(status: 400 | 403 | 413, code: ApiErrorCode, error: string): RpcValidation {
  return { ok: false, status, body: apiError(code, error) };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function utf8Length(s: string): number {
  return new TextEncoder().encode(s).byteLength;
}

/** getProgramAccounts: [vaultProgramId, { filters: [≥1 memcmp, optional dataSize] , ... }]. */
function checkProgramAccounts(params: unknown, vaultProgramId: string | null | undefined): string | null {
  if (!vaultProgramId) return "getProgramAccounts is not enabled";
  if (!Array.isArray(params) || params.length < 2) return "getProgramAccounts needs a program id and filters";
  if (params[0] !== vaultProgramId) return "getProgramAccounts is only allowed on the Fitr vault program";
  const cfg = params[1];
  if (!isPlainObject(cfg) || !Array.isArray(cfg.filters) || cfg.filters.length === 0) {
    return "getProgramAccounts needs memcmp filters";
  }
  let memcmp = 0;
  for (const f of cfg.filters) {
    if (!isPlainObject(f)) return "invalid getProgramAccounts filter";
    if ("memcmp" in f && isPlainObject(f.memcmp)) {
      const { offset, bytes } = f.memcmp;
      if (typeof offset !== "number" && typeof offset !== "bigint") return "invalid memcmp filter";
      if (typeof bytes !== "string" || bytes.length === 0) return "invalid memcmp filter";
      memcmp++;
    } else if (!("dataSize" in f)) {
      return "only memcmp and dataSize filters are allowed";
    }
  }
  if (memcmp === 0) return "getProgramAccounts needs at least one memcmp filter";
  return null;
}

/** Validates one JSON-RPC 2.0 request. Batches, unknown methods and oversized bodies are rejected. */
export function validateRpcRequest(rawBody: string, opts: ValidateRpcOptions = {}): RpcValidation {
  if (utf8Length(rawBody) > MAX_RPC_BODY_BYTES) {
    return fail(413, "payload_too_large", "Request body too large");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return fail(400, "bad_request", "Body is not valid JSON");
  }
  if (Array.isArray(parsed)) return fail(400, "bad_request", "Batch requests are not supported");
  if (!isPlainObject(parsed)) return fail(400, "bad_request", "Body must be a JSON-RPC request object");
  const { jsonrpc, id, method, params } = parsed;
  if (jsonrpc !== "2.0") return fail(400, "bad_request", 'jsonrpc must be "2.0"');
  if (!(typeof id === "string" || typeof id === "number" || id === null)) {
    return fail(400, "bad_request", "id must be a string, number or null");
  }
  if (typeof method !== "string" || method.length === 0 || method.length > 64) {
    return fail(400, "bad_request", "method must be a string");
  }
  if (params !== undefined && !Array.isArray(params) && !isPlainObject(params)) {
    return fail(400, "bad_request", "params must be an array or object");
  }
  if (!RPC_METHOD_ALLOWLIST.has(method)) {
    return fail(403, "forbidden_method", "Method not allowed");
  }
  if (method === "getProgramAccounts") {
    const why = checkProgramAccounts(params, opts.vaultProgramId);
    if (why) return fail(403, "forbidden_method", why);
  }
  const request: JsonRpcRequest = { jsonrpc: "2.0", id, method };
  if (params !== undefined) request.params = params as JsonRpcRequest["params"];
  return { ok: true, request };
}

/**
 * Same-origin check. Allows requests without an Origin header (same-origin GETs, server-to-server).
 * Rejects `Sec-Fetch-Site: cross-site` and any Origin whose host differs from the host the request
 * was addressed to (X-Forwarded-Host from Caddy, else Host, else the request URL).
 */
export function isSameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = req.headers.get("origin");
  if (origin === null) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // includes Origin: null (sandboxed iframes, file://)
  }
  const forwarded = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  let selfHost = forwarded || req.headers.get("host")?.trim() || "";
  if (!selfHost) {
    try {
      selfHost = new URL(req.url).host;
    } catch {
      return false;
    }
  }
  return originHost.toLowerCase() === selfHost.toLowerCase();
}

export type CappedBody = { ok: true; text: string } | { ok: false; status: 400 | 413; body: ApiError };

/** Reads the request body as UTF-8, aborting once it exceeds `maxBytes`. */
export async function readBodyCapped(req: Request, maxBytes = MAX_RPC_BODY_BYTES): Promise<CappedBody> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413, body: apiError("payload_too_large", "Request body too large") };
  }
  if (!req.body) return { ok: true, text: "" };
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, status: 413, body: apiError("payload_too_large", "Request body too large") };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, body: apiError("bad_request", "Could not read request body") };
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(all) };
  } catch {
    return { ok: false, status: 400, body: apiError("bad_request", "Body is not valid UTF-8") };
  }
}

export interface ForwardRpcOptions {
  fetchImpl?: typeof fetch;
  /** Default 15 s. */
  timeoutMs?: number;
}

/**
 * Forwards one validated request upstream. Upstream failures become 503 `upstream_unavailable`
 * with a generic message; a successful body is passed through with the upstream URL and key
 * scrubbed (defence in depth). Never throws.
 */
export async function forwardRpc(
  req: JsonRpcRequest,
  upstreamUrl: string,
  opts: ForwardRpcOptions = {},
): Promise<Response> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const unavailable = () =>
    jsonResponse(apiError("upstream_unavailable", "Solana RPC is temporarily unavailable"), 503);
  let upstream: Response;
  try {
    upstream = await fetchImpl(upstreamUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch {
    return unavailable();
  }
  if (upstream.status === 429) {
    return jsonResponse(apiError("rate_limited", "Solana RPC is busy, retry shortly", 2), 429, {
      "retry-after": "2",
    });
  }
  if (!upstream.ok) return unavailable();
  let text: string;
  try {
    text = await upstream.text();
  } catch {
    return unavailable();
  }
  return new Response(scrubUpstreamSecrets(text, upstreamUrl), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
