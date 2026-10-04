import { describe, expect, test, vi } from "vitest";
import {
  forwardRpc,
  isSameOrigin,
  MAX_RPC_BODY_BYTES,
  readBodyCapped,
  RPC_METHOD_ALLOWLIST,
  validateRpcRequest,
} from "../rpcProxy";

const VAULT = "9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY";
const KEY = "sekrit-helius-key-123";
const UPSTREAM = `https://mainnet.helius-rpc.com/?api-key=${KEY}`;

const rpc = (method: string, params?: unknown, id: unknown = 1) =>
  JSON.stringify({ jsonrpc: "2.0", id, method, ...(params === undefined ? {} : { params }) });

describe("validateRpcRequest", () => {
  test("accepts every allowlisted read method", () => {
    for (const m of RPC_METHOD_ALLOWLIST) {
      if (m === "getProgramAccounts") continue;
      const v = validateRpcRequest(rpc(m, []));
      expect(v.ok, m).toBe(true);
    }
  });

  test("returns the normalized request", () => {
    const v = validateRpcRequest(rpc("getBalance", ["abc"], "x"));
    expect(v).toEqual({ ok: true, request: { jsonrpc: "2.0", id: "x", method: "getBalance", params: ["abc"] } });
  });

  test.each(["sendTransaction", "requestAirdrop", "getBlock", "getSignaturesForAddress", "getTransaction"])(
    "403 forbidden_method for %s",
    (m) => {
      const v = validateRpcRequest(rpc(m, []));
      expect(v).toMatchObject({ ok: false, status: 403, body: { code: "forbidden_method" } });
    },
  );

  test("400 for a batch", () => {
    const v = validateRpcRequest(JSON.stringify([JSON.parse(rpc("getSlot"))]));
    expect(v).toMatchObject({ ok: false, status: 400, body: { code: "bad_request" } });
  });

  test("400 for malformed JSON, wrong jsonrpc, bad id, bad params", () => {
    expect(validateRpcRequest("{nope")).toMatchObject({ status: 400 });
    expect(validateRpcRequest(JSON.stringify({ jsonrpc: "1.0", id: 1, method: "getSlot" }))).toMatchObject({ status: 400 });
    expect(validateRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: {}, method: "getSlot" }))).toMatchObject({ status: 400 });
    expect(validateRpcRequest(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: "x" }))).toMatchObject({ status: 400 });
    expect(validateRpcRequest('"str"')).toMatchObject({ status: 400 });
    expect(validateRpcRequest("null")).toMatchObject({ status: 400 });
  });

  test("413 for a body over 64 KB", () => {
    const big = rpc("getBalance", ["x".repeat(MAX_RPC_BODY_BYTES)]);
    expect(validateRpcRequest(big)).toMatchObject({ ok: false, status: 413, body: { code: "payload_too_large" } });
  });

  test("413 counts UTF-8 bytes, not characters", () => {
    const s = "é".repeat(MAX_RPC_BODY_BYTES / 2); // 2 bytes each
    expect(validateRpcRequest(rpc("getBalance", [s]))).toMatchObject({ status: 413 });
  });

  describe("getProgramAccounts", () => {
    const memcmp = { memcmp: { offset: 8, bytes: "abc", encoding: "base58" } };
    test("allowed on the vault program with a memcmp filter", () => {
      const v = validateRpcRequest(rpc("getProgramAccounts", [VAULT, { encoding: "base64", filters: [memcmp, { dataSize: 120 }] }]), {
        vaultProgramId: VAULT,
      });
      expect(v.ok).toBe(true);
    });
    test("rejected when no vault program id is configured", () => {
      const v = validateRpcRequest(rpc("getProgramAccounts", [VAULT, { filters: [memcmp] }]));
      expect(v).toMatchObject({ status: 403 });
    });
    test("rejected on another program", () => {
      const v = validateRpcRequest(
        rpc("getProgramAccounts", ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", { filters: [memcmp] }]),
        { vaultProgramId: VAULT },
      );
      expect(v).toMatchObject({ status: 403 });
    });
    test("rejected without filters, with only dataSize, or with unknown filters", () => {
      for (const cfg of [undefined, {}, { filters: [] }, { filters: [{ dataSize: 8 }] }, { filters: [memcmp, { tokenAccountState: {} }] }]) {
        const params = cfg === undefined ? [VAULT] : [VAULT, cfg];
        expect(validateRpcRequest(rpc("getProgramAccounts", params), { vaultProgramId: VAULT }), JSON.stringify(cfg)).toMatchObject({
          status: 403,
        });
      }
    });
  });
});

describe("isSameOrigin", () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost:3000/api/rpc", { method: "POST", headers });
  test("no Origin header is allowed", () => {
    expect(isSameOrigin(req({}))).toBe(true);
  });
  test("matching Host is allowed", () => {
    expect(isSameOrigin(req({ origin: "https://fitr.day", host: "fitr.day" }))).toBe(true);
  });
  test("X-Forwarded-Host takes precedence (behind Caddy)", () => {
    expect(isSameOrigin(req({ origin: "https://fitr.day", host: "127.0.0.1:3000", "x-forwarded-host": "fitr.day" }))).toBe(true);
  });
  test("different origin is rejected", () => {
    expect(isSameOrigin(req({ origin: "https://evil.example", host: "fitr.day" }))).toBe(false);
  });
  test("Origin: null and Sec-Fetch-Site: cross-site are rejected", () => {
    expect(isSameOrigin(req({ origin: "null", host: "fitr.day" }))).toBe(false);
    expect(isSameOrigin(req({ "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});

describe("readBodyCapped", () => {
  test("reads a small body", async () => {
    const r = await readBodyCapped(new Request("http://x/", { method: "POST", body: "hello" }));
    expect(r).toEqual({ ok: true, text: "hello" });
  });
  test("413 when the streamed body exceeds the cap", async () => {
    const r = await readBodyCapped(new Request("http://x/", { method: "POST", body: "x".repeat(101) }), 100);
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
  test("413 from a large Content-Length before reading", async () => {
    const r = await readBodyCapped(
      new Request("http://x/", { method: "POST", body: "x", headers: { "content-length": "999999" } }),
      100,
    );
    expect(r).toMatchObject({ ok: false, status: 413 });
  });
});

describe("forwardRpc", () => {
  const request = { jsonrpc: "2.0" as const, id: 1, method: "getSlot" };

  test("passes the upstream body through and posts the request", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"jsonrpc":"2.0","id":1,"result":5}', { status: 200 }));
    const res = await forwardRpc(request, UPSTREAM, { fetchImpl });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ jsonrpc: "2.0", id: 1, result: 5 });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(UPSTREAM);
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  test("a network error becomes 503 without the URL or key", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError(`fetch failed: ${UPSTREAM}`);
    });
    const res = await forwardRpc(request, UPSTREAM, { fetchImpl });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("helius");
    expect(JSON.parse(text).code).toBe("upstream_unavailable");
  });

  test("an upstream 5xx becomes 503; a 429 becomes 429 with Retry-After", async () => {
    const r1 = await forwardRpc(request, UPSTREAM, { fetchImpl: async () => new Response(`bad ${KEY}`, { status: 500 }) });
    expect(r1.status).toBe(503);
    expect(await r1.text()).not.toContain(KEY);
    const r2 = await forwardRpc(request, UPSTREAM, { fetchImpl: async () => new Response("slow", { status: 429 }) });
    expect(r2.status).toBe(429);
    expect(r2.headers.get("retry-after")).toBe("2");
  });

  test("the key is scrubbed even if upstream echoes it in a 200 body", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: `bad key ${KEY} at ${UPSTREAM}` } }));
    const text = await (await forwardRpc(request, UPSTREAM, { fetchImpl })).text();
    expect(text).not.toContain(KEY);
    expect(text).toContain("[redacted]");
  });

  test("a timeout becomes 503", async () => {
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    const res = await forwardRpc(request, UPSTREAM, { fetchImpl: fetchImpl as typeof fetch, timeoutMs: 10 });
    expect(res.status).toBe(503);
  });
});
