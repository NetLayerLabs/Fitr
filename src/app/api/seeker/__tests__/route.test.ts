import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const KEY = "seeker-test-helius-key-1a2b3c";
const SGT_MINT = "3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q";
const SGT_ATA = "8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj";
const SGT_OWNER = "6pwzDMzt4VU4SG2YGXnUf8HQtD88U4G2rJToYbDWSpWZ";
const PLAIN_OWNER = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const fixtureB64 = (name: string) =>
  readFileSync(fileURLToPath(new URL(`../../../../lib/solana/__tests__/fixtures/${name}.bin`, import.meta.url))).toString(
    "base64",
  );
const MINT_B64 = fixtureB64(SGT_MINT);
const ATA_B64 = fixtureB64(SGT_ATA);

const account = (b64: string) => ({
  data: [b64, "base64"],
  executable: false,
  lamports: 2039280,
  owner: TOKEN_2022,
  rentEpoch: 18446744073709551615n.toString(),
  space: Buffer.from(b64, "base64").length,
});

/** Fake mainnet JSON-RPC: the SGT owner holds the real SGT; everyone else holds nothing. */
function fakeMainnet() {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body));
    let result: unknown;
    if (req.method === "getTokenAccountsByOwner") {
      const owner = req.params[0];
      result = {
        context: { slot: 1 },
        value: owner === SGT_OWNER ? [{ pubkey: SGT_ATA, account: account(ATA_B64) }] : [],
      };
    } else if (req.method === "getMultipleAccounts") {
      result = {
        context: { slot: 1 },
        value: (req.params[0] as string[]).map((k) => (k === SGT_MINT ? account(MINT_B64) : null)),
      };
    } else {
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32601, message: "nope" } }));
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }), {
      headers: { "content-type": "application/json" },
    });
  });
}

type GetFn = (req: Request) => Promise<Response>;

async function loadRoute(env: Record<string, string>): Promise<GetFn> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("../route")).GET;
}

const get = (owner: string | null, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/api/seeker${owner === null ? "" : `?owner=${encodeURIComponent(owner)}`}`, {
    headers: { host: "fitr.day", "x-forwarded-for": "3.3.3.3", ...headers },
  });

let fetchMock: ReturnType<typeof fakeMainnet>;

beforeEach(() => {
  fetchMock = fakeMainnet();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/seeker", () => {
  test("the real SGT owner is a Seeker; always queries mainnet, even in devnet mode", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY, NODE_ENV: "production", NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" });
    const res = await GET(get(SGT_OWNER, { origin: "https://fitr.day" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=60");
    const text = await res.text();
    expect(text).not.toContain(KEY);
    const body = JSON.parse(text);
    expect(body).toMatchObject({ owner: SGT_OWNER, isSeeker: true, sgtMint: SGT_MINT, sgtTokenAccount: SGT_ATA });
    expect(typeof body.checkedAt).toBe("number");
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).toBe(`https://mainnet.helius-rpc.com/?api-key=${KEY}`);
    }
  });

  test("a wallet without an SGT is not a Seeker", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY });
    const body = await (await GET(get(PLAIN_OWNER))).json();
    expect(body).toMatchObject({ owner: PLAIN_OWNER, isSeeker: false, sgtMint: null, sgtTokenAccount: null });
  });

  test("results are cached per owner (no second upstream lookup)", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY });
    const a = await (await GET(get(SGT_OWNER))).json();
    const calls = fetchMock.mock.calls.length;
    const b = await (await GET(get(SGT_OWNER))).json();
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(b).toEqual(a);
  });

  test("400 for a missing or invalid owner", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY });
    for (const o of [null, "", "not-an-address", "0OIl"]) {
      const res = await GET(get(o));
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe("bad_request");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("403 for a cross-origin request", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY });
    const res = await GET(get(SGT_OWNER, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  test("10 upstream lookups per minute per IP", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: KEY });
    const owners = [
      "11111111111111111111111111111111",
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      TOKEN_2022,
      "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
      "ComputeBudget111111111111111111111111111111",
      "SysvarRent111111111111111111111111111111111",
      "SysvarC1ock11111111111111111111111111111111",
      "Vote111111111111111111111111111111111111111",
      "Stake11111111111111111111111111111111111111",
      "Config1111111111111111111111111111111111111",
    ];
    for (const o of owners) expect((await GET(get(o))).status).toBe(200);
    const limited = await GET(get(PLAIN_OWNER));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThanOrEqual(1);
    // Cached owners are still served.
    expect((await GET(get(owners[0]))).status).toBe(200);
  });

  test("production without a key: 503 not_configured", async () => {
    const GET = await loadRoute({ HELIUS_API_KEY: "", NODE_ENV: "production" });
    const res = await GET(get(SGT_OWNER));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
  });

  test("upstream failure: 503 without the key, nothing logged with it, not cached", async () => {
    const spies = (["log", "error", "warn", "info"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const GET = await loadRoute({ HELIUS_API_KEY: KEY, NODE_ENV: "production" });
    fetchMock.mockImplementationOnce(async () => new Response(`boom ${KEY}`, { status: 500 }));
    const res = await GET(get(SGT_OWNER));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(KEY);
    for (const s of spies) {
      expect(JSON.stringify(s.mock.calls)).not.toContain(KEY);
      s.mockRestore();
    }
    const retry = await GET(get(SGT_OWNER));
    expect((await retry.json()).isSeeker).toBe(true);
  });
});
