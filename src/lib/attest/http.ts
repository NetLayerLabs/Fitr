/**
 * HTTP plumbing for the attestor route handlers: per-IP rate limits, capped JSON body reading,
 * same-origin check and error mapping. Server only.
 */
import "server-only";
import type { ApiError, ApiErrorCode } from "@/lib/solana/types";
import { AttestError } from "./service";

/** Fixed-window counter per key, bounded in size. */
export class RateLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly maxKeys = 20_000,
  ) {}

  /** Returns 0 when allowed, else the seconds until the window resets. */
  hit(key: string, now: number): number {
    const e = this.hits.get(key);
    if (!e || now - e.start >= this.windowMs) {
      if (this.hits.size >= this.maxKeys) this.prune(now);
      this.hits.set(key, { start: now, count: 1 });
      return 0;
    }
    e.count++;
    if (e.count <= this.limit) return 0;
    return Math.max(1, Math.ceil((e.start + this.windowMs - now) / 1000));
  }

  private prune(now: number): void {
    for (const [k, e] of this.hits) if (now - e.start >= this.windowMs) this.hits.delete(k);
    // Still full (under attack): drop the oldest entries.
    while (this.hits.size >= this.maxKeys) this.hits.delete(this.hits.keys().next().value as string);
  }
}

interface Limiters {
  start: RateLimiter;
  chunk: RateLimiter;
  finish: RateLimiter;
}

const G = globalThis as typeof globalThis & { __fitrAttestLimits?: Limiters };

/** Per-IP limits. A session sends ~1 chunk/s, so 150/min leaves room for retries. */
export function attestLimiters(): Limiters {
  return (G.__fitrAttestLimits ??= {
    start: new RateLimiter(10, 60_000),
    chunk: new RateLimiter(150, 60_000),
    finish: new RateLimiter(20, 60_000),
  });
}

/** Tests only. */
export function resetAttestLimiters(): void {
  G.__fitrAttestLimits = undefined;
}

/**
 * Client IP. Production runs behind Caddy, which sets X-Forwarded-For; its first entry is the
 * client. Only trustworthy because the Node server is not reachable except through Caddy.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return (req.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

export function apiError(status: number, code: ApiErrorCode, error: string, retryAfterSec?: number): Response {
  const body: ApiError = retryAfterSec !== undefined ? { error, code, retryAfterSec } : { error, code };
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (retryAfterSec !== undefined) headers["Retry-After"] = String(retryAfterSec);
  return Response.json(body, { status, headers });
}

export function jsonOk(body: unknown): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}

/** Rejects cross-site browser requests. Requests without an Origin header (native, curl) pass. */
export function checkOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return apiError(403, "forbidden_origin", "Cross-origin request refused");
  }
  if (!host || originHost !== host) return apiError(403, "forbidden_origin", "Cross-origin request refused");
  return null;
}

class BodyTooLarge extends Error {}

/** Reads a JSON body of at most `maxBytes`, streaming so a lying Content-Length cannot bypass it. */
export async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: apiError(413, "payload_too_large", "Request body too large") };
  }
  let text: string;
  try {
    text = await readCapped(req, maxBytes);
  } catch (e) {
    if (e instanceof BodyTooLarge) return { ok: false, response: apiError(413, "payload_too_large", "Request body too large") };
    return { ok: false, response: apiError(400, "bad_request", "Could not read request body") };
  }
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: apiError(400, "bad_request", "Body must be JSON") };
  }
}

async function readCapped(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new BodyTooLarge();
    }
    parts.push(value);
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.byteLength;
  }
  return new TextDecoder().decode(all);
}

export function errorResponse(e: unknown): Response {
  if (e instanceof AttestError) return apiError(e.status, e.code, e.message, e.retryAfterSec);
  console.error("[attest] unexpected error", e);
  return apiError(500, "upstream_unavailable", "Internal error");
}

/** Shared POST pipeline: origin check -> per-IP limit -> capped JSON -> handler. */
export async function handleAttestPost(
  req: Request,
  limiter: RateLimiter,
  maxBytes: number,
  handler: (body: unknown) => Promise<unknown>,
): Promise<Response> {
  const denied = checkOrigin(req);
  if (denied) return denied;
  const retry = limiter.hit(clientIp(req), Date.now());
  if (retry > 0) return apiError(429, "rate_limited", "Too many requests", retry);
  const body = await readJson(req, maxBytes);
  if (!body.ok) return body.response;
  try {
    return jsonOk(await handler(body.value));
  } catch (e) {
    return errorResponse(e);
  }
}
