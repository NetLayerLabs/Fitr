import { describe, expect, test } from "vitest";
import { clientKey, createRateLimiter } from "../rateLimit";

describe("createRateLimiter", () => {
  test("allows the burst, then refills over time", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 3, refillPerSecond: 1, now: () => t });
    expect([rl.take("a"), rl.take("a"), rl.take("a"), rl.take("a")]).toEqual([true, true, true, false]);
    expect(rl.retryAfterSec("a")).toBe(1);
    t = 500;
    expect(rl.take("a")).toBe(false);
    t = 1000;
    expect(rl.take("a")).toBe(true);
    expect(rl.take("a")).toBe(false);
  });

  test("never refills above capacity", () => {
    let t = 0;
    const rl = createRateLimiter({ capacity: 2, refillPerSecond: 10, now: () => t });
    t = 60_000;
    expect([rl.take("a"), rl.take("a"), rl.take("a")]).toEqual([true, true, false]);
  });

  test("keys are independent", () => {
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 1, now: () => 0 });
    expect(rl.take("a")).toBe(true);
    expect(rl.take("a")).toBe(false);
    expect(rl.take("b")).toBe(true);
  });

  test("cost larger than the remaining tokens takes nothing", () => {
    const rl = createRateLimiter({ capacity: 5, refillPerSecond: 1, now: () => 0 });
    expect(rl.take("a", 4)).toBe(true);
    expect(rl.take("a", 2)).toBe(false);
    expect(rl.take("a", 1)).toBe(true);
  });

  test("bounded memory under a flood of keys", () => {
    const rl = createRateLimiter({ capacity: 1, refillPerSecond: 0.001, now: () => 0, maxKeys: 100 });
    for (let i = 0; i < 1000; i++) expect(rl.take(`ip${i}`)).toBe(true);
    // Recent keys are still limited.
    expect(rl.take("ip999")).toBe(false);
  });

  test("rejects invalid options", () => {
    expect(() => createRateLimiter({ capacity: 0, refillPerSecond: 1 })).toThrow(RangeError);
  });
});

describe("clientKey", () => {
  const req = (h: Record<string, string>) => new Request("http://x/", { headers: h });
  test("uses the right-most X-Forwarded-For entry (appended by our proxy)", () => {
    expect(clientKey(req({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
    expect(clientKey(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });
  test("falls back to X-Real-IP, then unknown", () => {
    expect(clientKey(req({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(clientKey(req({}))).toBe("unknown");
  });
});
