import { describe, expect, it } from "vitest";
import { T0 } from "@/lib/solana/vault/__tests__/fixtures";
import { createRateLimiter } from "@/lib/solana/server/rateLimit";
import { COMMIT_ACTION, createActionRoute, SPONSOR_ACTION } from "../routes";
import { ACTION_VERSION, ACTIONS_JSON, BLOCKCHAIN_IDS } from "../spec";
import { OPENS_SOON_MESSAGE, SEEKER_ONLY_MESSAGE } from "../vaultActions";
import { actionsChain, FakeChain, seedAta, seedPool, USER } from "./fakeChain";
import { GET as actionsJsonGet, OPTIONS as actionsJsonOptions } from "@/app/actions.json/route";

const NOW = T0 + 3_600;
const BASE = "https://fitr.day/api/actions/commit?exercise=pushup&goal=30";

function expectCors(res: Response) {
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
  expect(res.headers.get("access-control-allow-methods")).toBe("GET,POST,PUT,OPTIONS");
  expect(res.headers.get("access-control-allow-headers")).toMatch(/Content-Type, Authorization, Content-Encoding, Accept-Encoding/);
  expect(res.headers.get("x-action-version")).toBe(ACTION_VERSION);
  expect(res.headers.get("x-blockchain-ids")).toBe(BLOCKCHAIN_IDS.mainnet);
}

function route(chain: FakeChain | null, o: { seeker?: boolean } = {}) {
  return createActionRoute(COMMIT_ACTION, {
    chain: () => (chain ? actionsChain(chain, { nowSecs: NOW, seeker: o.seeker }) : null),
  });
}

const post = (url: string, body: unknown) =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("Blink route handlers", () => {
  it("OPTIONS answers the CORS preflight", () => {
    const res = route(null).OPTIONS();
    expect(res.status).toBe(204);
    expectCors(res);
  });

  it("GET returns action metadata with CORS headers", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    const res = await route(chain).GET(new Request(BASE));
    expect(res.status).toBe(200);
    expectCors(res);
    const body = await res.json();
    expect(body).toMatchObject({ type: "action", label: "Commit", title: "Commit with me: 30 push-ups" });
    expect(body.icon).toMatch(/^https:\/\//);
    expect(body.links.actions.length).toBeGreaterThan(0);
  });

  it("GET while the pool is missing is a disabled action (200), not an HTTP error", async () => {
    const res = await route(new FakeChain()).GET(new Request(BASE));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disabled).toBe(true);
    expect(body.error.message).toBe(OPENS_SOON_MESSAGE);
  });

  it("503 with an ActionError (and CORS) when not configured", async () => {
    const res = await route(null).GET(new Request(BASE));
    expect(res.status).toBe(503);
    expectCors(res);
    expect(typeof (await res.json()).message).toBe("string");
  });

  it("POST: bad JSON → 400, no Seeker → 403 with the Seeker-only message", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100_000_000n);
    const bad = await route(chain).POST(post(`${BASE}&amount=25`, "{"));
    expect(bad.status).toBe(400);
    expectCors(bad);
    const res = await route(chain, { seeker: false }).POST(post(`${BASE}&amount=25`, { account: USER }));
    expect(res.status).toBe(403);
    expectCors(res);
    expect(await res.json()).toEqual({ message: SEEKER_ONLY_MESSAGE });
  });

  it("POST returns {type, transaction, message}", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100_000_000n);
    const res = await route(chain).POST(post(`${BASE}&amount=25`, { account: USER }));
    expect(res.status).toBe(200);
    expectCors(res);
    const body = await res.json();
    expect(body.type).toBe("transaction");
    expect(typeof body.transaction).toBe("string");
    expect(body.message).toMatch(/You're in/);
  });

  it("POST hides unexpected errors behind a generic 503", async () => {
    const chain = new FakeChain();
    const r = createActionRoute(
      { ...SPONSOR_ACTION, transaction: async () => { throw new Error("https://mainnet.helius-rpc.com/?api-key=SECRET"); } },
      { chain: () => actionsChain(chain, { nowSecs: NOW }) },
    );
    const res = await r.POST(post("https://fitr.day/api/actions/sponsor?amount=1", { account: USER }));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("SECRET");
  });

  it("rate limits POSTs per client", async () => {
    const chain = new FakeChain();
    const r = createActionRoute(COMMIT_ACTION, {
      chain: () => actionsChain(chain, { nowSecs: NOW }),
      postLimiter: createRateLimiter({ capacity: 1, refillPerSecond: 0.0001 }),
    });
    await r.POST(post(`${BASE}&amount=25`, { account: USER }));
    const res = await r.POST(post(`${BASE}&amount=25`, { account: USER }));
    expect(res.status).toBe(429);
    expectCors(res);
  });
});

describe("/actions.json", () => {
  it("maps the action paths and carries CORS headers", async () => {
    const res = actionsJsonGet();
    expectCors(res);
    expect(await res.json()).toEqual(ACTIONS_JSON);
    expect(ACTIONS_JSON.rules[0]).toEqual({ pathPattern: "/api/actions/**", apiPath: "/api/actions/**" });
    expect(actionsJsonOptions().status).toBe(204);
  });
});
