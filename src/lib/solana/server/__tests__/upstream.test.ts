import { describe, expect, test } from "vitest";
import { PUBLIC_RPC_URLS, scrubUpstreamSecrets, upstreamRpcUrl } from "../upstream";

describe("upstreamRpcUrl", () => {
  test("Helius mainnet and devnet when a key is set", () => {
    expect(upstreamRpcUrl("mainnet", "k1", "production")).toBe("https://mainnet.helius-rpc.com/?api-key=k1");
    expect(upstreamRpcUrl("devnet", "k1", "development")).toBe("https://devnet.helius-rpc.com/?api-key=k1");
  });
  test("the key is URL-encoded", () => {
    expect(upstreamRpcUrl("mainnet", "a&b=c", "production")).toBe("https://mainnet.helius-rpc.com/?api-key=a%26b%3Dc");
  });
  test("no key: public RPC outside production, null in production", () => {
    expect(upstreamRpcUrl("mainnet", null, "development")).toBe(PUBLIC_RPC_URLS.mainnet);
    expect(upstreamRpcUrl("devnet", null, "test")).toBe(PUBLIC_RPC_URLS.devnet);
    expect(upstreamRpcUrl("mainnet", null, undefined)).toBe(PUBLIC_RPC_URLS.mainnet);
    expect(upstreamRpcUrl("mainnet", null, "production")).toBeNull();
    expect(upstreamRpcUrl("devnet", null, "production")).toBeNull();
  });
});

describe("scrubUpstreamSecrets", () => {
  test("removes the URL and the raw and encoded key", () => {
    const url = upstreamRpcUrl("mainnet", "a&b", "production")!;
    const out = scrubUpstreamSecrets(`x ${url} y a&b z a%26b`, url);
    expect(out).not.toContain("a&b");
    expect(out).not.toContain("a%26b");
    expect(out).not.toContain("helius-rpc.com/?api-key");
  });
  test("leaves text without secrets unchanged", () => {
    expect(scrubUpstreamSecrets('{"result":1}', PUBLIC_RPC_URLS.mainnet)).toBe('{"result":1}');
  });
});
