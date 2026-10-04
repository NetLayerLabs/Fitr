import { describe, expect, it, vi } from "vitest";
import {
  clampPriorityFee,
  DEFAULT_PRIORITY_MICROLAMPORTS,
  fetchPriorityFee,
  MAX_PRIORITY_MICROLAMPORTS,
  MIN_PRIORITY_MICROLAMPORTS,
} from "../txflow";

describe("priority fee", () => {
  it("clamps estimates and falls back to the default", () => {
    expect(clampPriorityFee(undefined)).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
    expect(clampPriorityFee(-5)).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
    expect(clampPriorityFee(12.2)).toBe(MIN_PRIORITY_MICROLAMPORTS);
    expect(clampPriorityFee(55_000.4)).toBe(55_001n);
    expect(clampPriorityFee("70000")).toBe(70_000n);
    expect(clampPriorityFee(9e12)).toBe(MAX_PRIORITY_MICROLAMPORTS);
  });

  it("asks Helius getPriorityFeeEstimate through /api/rpc", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: "fee", result: { priorityFeeEstimate: 42_000 } })));
    expect(await fetchPriorityFee("AQID", { fetchImpl })).toBe(42_000n);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/rpc");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      method: "getPriorityFeeEstimate",
      params: [{ transaction: "AQID", options: { transactionEncoding: "base64", recommended: true } }],
    });
  });

  it("uses the default when the proxy refuses or the network fails", async () => {
    expect(await fetchPriorityFee("x", { fetchImpl: async () => new Response("{}", { status: 403 }) })).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
    expect(
      await fetchPriorityFee("x", {
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
      }),
    ).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
  });
});
