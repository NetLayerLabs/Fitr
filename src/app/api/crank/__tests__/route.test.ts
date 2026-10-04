import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  runCrank: vi.fn(),
  getServerSolana: vi.fn(),
}));

vi.mock("@/lib/solana/server/attestor", async (orig) => {
  const actual = await orig<typeof import("@/lib/solana/server/attestor")>();
  return { ...actual, runCrank: h.runCrank, getServerSolana: h.getServerSolana };
});

import { ServerSolanaNotConfiguredError } from "@/lib/solana/server/attestor";
import { POST } from "../route";

const SECRET = "s3cret-cron-value";

function req(auth?: string): Request {
  return new Request("https://fitr.day/api/crank", {
    method: "POST",
    headers: auth === undefined ? {} : { authorization: auth },
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("ATTESTOR_KEYPAIR", "");
  h.getServerSolana.mockResolvedValue({ fake: true });
  h.runCrank.mockResolvedValue({ today: 20721, days: [], truncated: false });
});

afterEach(() => {
  vi.unstubAllEnvs();
  h.runCrank.mockReset();
  h.getServerSolana.mockReset();
});

describe("POST /api/crank", () => {
  it("requires the bearer secret", async () => {
    for (const auth of [undefined, "", "Bearer wrong", `Basic ${SECRET}`, `Bearer ${SECRET}x`]) {
      const res = await POST(req(auth));
      expect(res.status).toBe(401);
      expect(await res.text()).not.toContain(SECRET);
    }
    expect(h.runCrank).not.toHaveBeenCalled();
  });

  it("runs one crank pass and returns its report", async () => {
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ today: 20721, days: [], truncated: false });
    expect(h.runCrank).toHaveBeenCalledWith({ fake: true });
  });

  it("is 503 not_configured without CRON_SECRET or server keys", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(503);

    vi.stubEnv("CRON_SECRET", SECRET);
    h.getServerSolana.mockRejectedValueOnce(new ServerSolanaNotConfiguredError("ATTESTOR_KEYPAIR"));
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("not_configured");
  });

  it("rejects a concurrent run with 409 and recovers after", async () => {
    let release!: () => void;
    h.runCrank.mockImplementationOnce(() => new Promise((r) => (release = () => r({ today: 1, days: [], truncated: false }))));
    const first = POST(req(`Bearer ${SECRET}`));
    await new Promise((r) => setTimeout(r, 0));
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(409);
    release();
    expect((await first).status).toBe(200);
    expect((await POST(req(`Bearer ${SECRET}`))).status).toBe(200);
  });

  it("maps a failed run to 503 without leaking details", async () => {
    h.runCrank.mockRejectedValueOnce(new Error("https://mainnet.helius-rpc.com/?api-key=SECRETKEY exploded"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(`Bearer ${SECRET}`));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("SECRETKEY");
    expect(JSON.stringify(spy.mock.calls)).not.toContain("SECRETKEY");
    spy.mockRestore();
  });
});
