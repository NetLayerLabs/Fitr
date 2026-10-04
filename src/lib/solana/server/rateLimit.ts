/**
 * In-memory per-key token bucket. Single process only (one `next start` on the VPS).
 */

export interface RateLimiterOptions {
  /** Bucket size (burst). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
  /** Clock in milliseconds; injectable for tests. */
  now?: () => number;
  /** Bucket count that triggers pruning of idle (full) buckets. Default 10,000. */
  maxKeys?: number;
}

export interface RateLimiter {
  /** Takes `cost` tokens (default 1). Returns false, taking nothing, if not enough remain. */
  take(key: string, cost?: number): boolean;
  /** Whole seconds until `cost` tokens are available (0 if available now). */
  retryAfterSec(key: string, cost?: number): number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export function createRateLimiter(o: RateLimiterOptions): RateLimiter {
  const { capacity, refillPerSecond } = o;
  if (!(capacity > 0) || !(refillPerSecond > 0)) {
    throw new RangeError("capacity and refillPerSecond must be positive");
  }
  const now = o.now ?? Date.now;
  const maxKeys = o.maxKeys ?? 10_000;
  const buckets = new Map<string, Bucket>();

  function refill(key: string): Bucket {
    const t = now();
    const b = buckets.get(key);
    if (!b) {
      const fresh = { tokens: capacity, updatedAt: t };
      return fresh;
    }
    const elapsed = Math.max(0, t - b.updatedAt) / 1000;
    b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSecond);
    b.updatedAt = t;
    return b;
  }

  function prune(): void {
    const t = now();
    for (const [k, b] of buckets) {
      const tokens = b.tokens + (Math.max(0, t - b.updatedAt) / 1000) * refillPerSecond;
      if (tokens >= capacity) buckets.delete(k);
    }
    // Still over the cap (a flood of distinct keys): drop the oldest entries.
    if (buckets.size > maxKeys) {
      const excess = buckets.size - maxKeys;
      let i = 0;
      for (const k of buckets.keys()) {
        if (i++ >= excess) break;
        buckets.delete(k);
      }
    }
  }

  return {
    take(key, cost = 1) {
      const b = refill(key);
      if (b.tokens < cost) {
        buckets.set(key, b);
        return false;
      }
      b.tokens -= cost;
      if (!buckets.has(key) && buckets.size >= maxKeys) prune();
      buckets.set(key, b);
      return true;
    },
    retryAfterSec(key, cost = 1) {
      const b = buckets.get(key) ? refill(key) : { tokens: capacity };
      if (b.tokens >= cost) return 0;
      return Math.ceil((cost - b.tokens) / refillPerSecond);
    },
  };
}

/**
 * Client key for rate limiting: the right-most `X-Forwarded-For` entry (the address appended by
 * our own proxy, Caddy, so a client cannot spoof it by sending its own header), else
 * `X-Real-IP`, else "unknown".
 */
export function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = parts.at(-1);
    if (last) return last;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  return real || "unknown";
}
