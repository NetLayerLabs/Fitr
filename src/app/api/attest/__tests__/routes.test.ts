import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAttestLimiters } from "@/lib/attest/http";
import { resetAttestService, setAttestOnchain } from "@/lib/attest/service";
import {
  chunkFrames,
  FakeClock,
  FakeOnchain,
  fixedPlan,
  pushupSessionFrames,
  WALLET_A,
  withRaisedHand,
} from "@/lib/attest/__tests__/helpers";
import { POST as chunkPOST } from "../chunk/route";
import { POST as finishPOST } from "../finish/route";
import { POST as startPOST } from "../start/route";

const DAY = 20721;
const START = { wallet: WALLET_A, dayIndex: DAY, exercise: "pushup", goalTarget: 10 };

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://fitr.day/api/attest/x", {
    method: "POST",
    headers: { "content-type": "application/json", host: "fitr.day", "x-forwarded-for": "203.0.113.7", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let clock: FakeClock;
let onchain: FakeOnchain;

beforeEach(() => {
  clock = new FakeClock();
  onchain = new FakeOnchain();
  onchain.commit(WALLET_A, DAY);
  setAttestOnchain(onchain);
  resetAttestLimiters();
  resetAttestService({ now: clock.now, planner: fixedPlan({ type: "raise_right_hand", atMsFromStart: 8000 }) });
});

afterEach(() => {
  setAttestOnchain(null);
  resetAttestService();
  resetAttestLimiters();
});

describe("/api/attest routes", () => {
  it("runs a full session over HTTP", async () => {
    const startRes = await startPOST(req(START, { origin: "https://fitr.day" }));
    expect(startRes.status).toBe(200);
    expect(startRes.headers.get("cache-control")).toBe("no-store");
    const start = await startRes.json();
    expect(start.challengePlan[0].type).toBeNull();

    const chunks = chunkFrames(withRaisedHand(pushupSessionFrames(), "right", 8500, 10500));
    let sawChallenge = false;
    for (const { chunk, lastMs } of chunks) {
      clock.t = start.serverTime + lastMs + 100;
      const r = await chunkPOST(req({ sessionId: start.sessionId, chunk }));
      expect(r.status).toBe(200);
      const body = await r.json();
      if (body.dueChallenge) sawChallenge = true;
    }
    expect(sawChallenge).toBe(true);
    const fin = await (await finishPOST(req({ sessionId: start.sessionId }))).json();
    expect(fin).toMatchObject({ verdict: "pass", count: 10, onchain: { status: "submitted" } });
  });

  it("maps errors to ApiError responses", async () => {
    const notJson = await startPOST(req("{"));
    expect(notJson.status).toBe(400);
    expect(await notJson.json()).toMatchObject({ code: "bad_request" });

    const cross = await startPOST(req(START, { origin: "https://evil.example" }));
    expect(cross.status).toBe(403);
    expect(await cross.json()).toMatchObject({ code: "forbidden_origin" });

    const big = await startPOST(req({ ...START, pad: "x".repeat(5000) }));
    expect(big.status).toBe(413);

    const missing = await finishPOST(req({ sessionId: "session_000000000404" }));
    expect(missing.status).toBe(404);

    setAttestOnchain(null);
    const notConfigured = await startPOST(req(START));
    expect(notConfigured.status).toBe(503);
    expect(await notConfigured.json()).toMatchObject({ code: "not_configured" });
  });

  it("rate-limits per IP", async () => {
    let last: Response | null = null;
    for (let i = 0; i < 12; i++) last = await startPOST(req({}, { "x-forwarded-for": "198.51.100.1, 10.0.0.1" }));
    expect(last!.status).toBe(429);
    expect(last!.headers.get("retry-after")).toMatch(/^\d+$/);
    const other = await startPOST(req({}, { "x-forwarded-for": "198.51.100.2" }));
    expect(other.status).toBe(400);
  });
});
