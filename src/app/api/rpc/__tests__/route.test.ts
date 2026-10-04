import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const KEY = "route-test-helius-key-9f8e7d";

type PostFn = (req: Request) => Promise<Response>;

async function loadRoute(env: Record<string, string | undefined>): Promise<PostFn> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  return (await import("../route")).POST;
}

function rpcReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/rpc", {
    method: "POST",
    headers: { "content-type": "application/json", host: "fitr.day", "x-forwarded-for": "1.1.1.1", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const slot = { jsonrpc: "2.0", id: 1, method: "getSlot" };

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{"jsonrpc":"2.0","id":1,"result":123}', { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/rpc", () => {
  test("forwards an allowlisted request to Helius mainnet and never returns the key", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY, NODE_ENV: "production", NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet" });
    const res = await POST(rpcReq(slot, { origin: "https://fitr.day" }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text).result).toBe(123);
    expect(text).not.toContain(KEY);
    expect([...res.headers.values()].join(" ")).not.toContain(KEY);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://mainnet.helius-rpc.com/?api-key=${KEY}`);
  });

  test("devnet mode forwards to Helius devnet", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY, NODE_ENV: "production", NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" });
    await POST(rpcReq(slot));
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://devnet.helius-rpc.com/?api-key=${KEY}`);
  });

  test("403 for sendTransaction", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    const res = await POST(rpcReq({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: ["AA=="] }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden_method");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("400 for a batch", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    const res = await POST(rpcReq([slot, slot]));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("413 for a body over 64 KB", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    const res = await POST(rpcReq({ ...slot, params: ["x".repeat(70_000)] }));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("payload_too_large");
  });

  test("403 forbidden_origin for a cross-origin request", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    const res = await POST(rpcReq(slot, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden_origin");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("getProgramAccounts is allowed only on the vault program with memcmp", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    const filters = [{ memcmp: { offset: 8, bytes: "abc" } }];
    const ok = await POST(
      rpcReq({ jsonrpc: "2.0", id: 1, method: "getProgramAccounts", params: ["9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY", { filters }] }),
    );
    expect(ok.status).toBe(200);
    const bad = await POST(
      rpcReq({ jsonrpc: "2.0", id: 1, method: "getProgramAccounts", params: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", { filters }] }),
    );
    expect(bad.status).toBe(403);
  });

  test("429 after the per-IP burst of 60, other IPs unaffected", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: KEY });
    for (let i = 0; i < 60; i++) expect((await POST(rpcReq(slot))).status).toBe(200);
    const limited = await POST(rpcReq(slot));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    expect((await limited.json()).code).toBe("rate_limited");
    expect((await POST(rpcReq(slot, { "x-forwarded-for": "2.2.2.2" }))).status).toBe(200);
  });

  test("production without a key: 503 not_configured, nothing forwarded", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: "", NODE_ENV: "production" });
    const res = await POST(rpcReq(slot));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("development without a key falls back to the public RPC", async () => {
    const POST = await loadRoute({ HELIUS_API_KEY: "", NODE_ENV: "development", NEXT_PUBLIC_SOLANA_CLUSTER: "mainnet" });
    expect((await POST(rpcReq(slot))).status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.mainnet-beta.solana.com");
  });

  test("upstream failure: 503 without the key, and nothing logged with it", async () => {
    const spies = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    fetchMock.mockImplementation(async () => {
      throw new Error(`connect ECONNREFUSED https://mainnet.helius-rpc.com/?api-key=${KEY}`);
    });
    const POST = await loadRoute({ HELIUS_API_KEY: KEY, NODE_ENV: "production" });
    const res = await POST(rpcReq(slot));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(KEY);
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain(KEY);
      s.mockRestore();
    }
  });
});
