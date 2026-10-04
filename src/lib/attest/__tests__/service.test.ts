import { describe, expect, it } from "vitest";
import { notConfiguredOnchain } from "../onchain";
import { AttestError, AttestService } from "../service";
import { AttestStore } from "../store";
import { encodeChunk, decodeChunk } from "../trace";
import {
  chunkFrames,
  FakeClock,
  FakeOnchain,
  fixedPlan,
  pushupSessionFrames,
  streamChunks,
  WALLET_A,
  WALLET_B,
  withRaisedHand,
} from "./helpers";

const DAY = 20721;
const START = { wallet: WALLET_A, dayIndex: DAY, exercise: "pushup", goalTarget: 10 };

function setup(over: { onchain?: FakeOnchain; store?: AttestStore } = {}) {
  const clock = new FakeClock();
  const onchain = over.onchain ?? new FakeOnchain();
  onchain.commit(WALLET_A, DAY);
  onchain.commit(WALLET_B, DAY);
  let n = 0;
  const service = new AttestService({
    onchain,
    now: clock.now,
    random: () => 0.5,
    newId: () => `session_${String(++n).padStart(12, "0")}`,
    planner: fixedPlan({ type: "raise_right_hand", atMsFromStart: 8000 }),
    store: over.store,
  });
  return { clock, onchain, service };
}

const goodChunks = chunkFrames(withRaisedHand(pushupSessionFrames(), "right", 8500, 10500));

async function expectError(p: Promise<unknown>, status: number, code: string) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(AttestError);
  expect((e as AttestError).status).toBe(status);
  expect((e as AttestError).code).toBe(code);
}

describe("AttestService happy path", () => {
  it("start -> chunks (challenge revealed only when due) -> finish passes and submits on-chain", async () => {
    const { clock, onchain, service } = setup();
    const start = await service.start(START);
    expect(start.challengePlan).toEqual([{ id: "c1", atMsFromStart: 8000, windowMs: 6000, type: null }]);
    expect(JSON.stringify(start)).not.toContain("raise_");

    const responses = await streamChunks(service, clock, start.sessionId, start.serverTime, goodChunks);
    const firstDue = responses.findIndex((r) => r.dueChallenge);
    expect(firstDue).toBeGreaterThan(3);
    for (const r of responses.slice(0, firstDue)) expect(JSON.stringify(r)).not.toContain("raise_");
    expect(responses[firstDue].dueChallenge).toMatchObject({ id: "c1", type: "raise_right_hand" });
    expect(responses[firstDue].dueChallenge!.prompt).toMatch(/RIGHT/);
    expect(responses[firstDue + 1].dueChallenge?.id).toBe("c1"); // repeated while open
    expect(responses[responses.length - 1].dueChallenge).toBeNull();

    const fin = await service.finish({ sessionId: start.sessionId });
    expect(fin).toMatchObject({ verdict: "pass", count: 10, goalTarget: 10, reasons: [] });
    expect(fin.sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fin.onchain).toEqual({ status: "submitted", signature: "sig1" });
    expect(onchain.submitted).toHaveLength(1);
    const sub = onchain.submitted[0];
    expect(sub).toMatchObject({ wallet: WALLET_A, dayIndex: DAY, reps: 10, sessionStartedAt: Math.floor(start.serverTime / 1000) });
    expect(Buffer.from(sub.sessionHash).toString("hex")).toBe(fin.sessionHash);

    // Idempotent finish; the day is now closed for new sessions.
    expect(await service.finish({ sessionId: start.sessionId })).toEqual(fin);
    expect(onchain.submitted).toHaveLength(1);
    await expectError(service.start(START), 409, "conflict");
  });
});

describe("AttestService failures", () => {
  it("missed challenge fails and does not submit", async () => {
    const { clock, onchain, service } = setup();
    const start = await service.start(START);
    await streamChunks(service, clock, start.sessionId, start.serverTime, chunkFrames(pushupSessionFrames()));
    const fin = await service.finish({ sessionId: start.sessionId });
    expect(fin).toMatchObject({ verdict: "fail", reasons: ["challenge_missed"], onchain: null });
    expect(onchain.submitted).toHaveLength(0);
  });

  it("finishing before the challenge is due fails with challenge_not_issued", async () => {
    const { clock, service } = setup();
    const start = await service.start(START);
    await streamChunks(service, clock, start.sessionId, start.serverTime, goodChunks.slice(0, 5));
    const fin = await service.finish({ sessionId: start.sessionId });
    expect(fin.reasons).toContain("challenge_not_issued");
  });

  it("a pre-recorded trace uploaded at once never sees the challenge and fails the clock check", async () => {
    const { clock, service } = setup();
    const start = await service.start(START);
    clock.t += 2000;
    for (const { chunk } of goodChunks) {
      const r = await service.chunk({ sessionId: start.sessionId, chunk });
      expect(r.dueChallenge).toBeNull();
    }
    const fin = await service.finish({ sessionId: start.sessionId });
    expect(fin.verdict).toBe("fail");
    expect(fin.reasons).toEqual(expect.arrayContaining(["trace_ahead_of_clock", "challenge_not_issued"]));
  });

  it("replayed chunks: identical retry is acked, re-sequenced replay and seq reuse are refused", async () => {
    const { clock, service } = setup();
    const start = await service.start(START);
    await streamChunks(service, clock, start.sessionId, start.serverTime, goodChunks.slice(0, 3));
    const retry = await service.chunk({ sessionId: start.sessionId, chunk: goodChunks[2].chunk });
    expect(retry.ack).toEqual({ seq: 2, frames: expect.any(Number), duplicate: true });

    const replay = decodeChunk(goodChunks[1].chunk).chunk;
    await expectError(service.chunk({ sessionId: start.sessionId, chunk: encodeChunk({ ...replay, seq: 3 }) }), 409, "conflict");
    await expectError(service.chunk({ sessionId: start.sessionId, chunk: encodeChunk({ ...replay, seq: 0 }) }), 409, "conflict");
    await expectError(service.chunk({ sessionId: start.sessionId, chunk: goodChunks[5].chunk }), 409, "conflict"); // gap
  });

  it("the same trace content cannot be attested twice (duplicate session hash)", async () => {
    const { clock, service, onchain } = setup();
    const a = await service.start(START);
    await streamChunks(service, clock, a.sessionId, a.serverTime, goodChunks);
    expect((await service.finish({ sessionId: a.sessionId })).verdict).toBe("pass");

    clock.t += 60_000;
    const b = await service.start({ ...START, wallet: WALLET_B });
    await streamChunks(service, clock, b.sessionId, b.serverTime, goodChunks);
    const fin = await service.finish({ sessionId: b.sessionId });
    expect(fin.verdict).toBe("fail");
    expect(fin.reasons).toEqual(["duplicate_session"]);
    expect(onchain.submitted).toHaveLength(1);
  });

  it("rejects bad input, unknown commitments and mismatched goals", async () => {
    const { service, onchain } = setup();
    await expectError(service.start({ ...START, wallet: "nope" }), 400, "bad_request");
    await expectError(service.start({ ...START, exercise: "deadlift" }), 400, "bad_request");
    await expectError(service.start({ ...START, goalTarget: 1.5 }), 400, "bad_request");
    await expectError(service.start({ ...START, dayIndex: DAY + 1 }), 404, "not_found");
    await expectError(service.start({ ...START, goalTarget: 20 }), 409, "conflict");
    onchain.commit(WALLET_A, DAY, { status: "completed" });
    await expectError(service.start(START), 409, "conflict");
    await expectError(service.chunk({ sessionId: "x" }), 400, "bad_request");
    await expectError(service.chunk({ sessionId: "session_999999999999", chunk: goodChunks[0].chunk }), 404, "not_found");
  });

  it("rejects malformed and oversized chunks", async () => {
    const { service } = setup();
    const s = await service.start(START);
    await expectError(service.chunk({ sessionId: s.sessionId, chunk: { v: 1, seq: 0, data: "AAAA" } }), 400, "bad_request");
    await expectError(
      service.chunk({ sessionId: s.sessionId, chunk: { v: 1, seq: 0, data: "A".repeat(200_000) } }),
      413,
      "payload_too_large",
    );
  });

  it("answers 503 not_configured until the on-chain adapter exists", async () => {
    const service = new AttestService({ onchain: notConfiguredOnchain });
    await expectError(service.start(START), 503, "not_configured");
  });

  it("keeps a passing verdict when submission fails and retries it on the next finish", async () => {
    const { clock, service, onchain } = setup();
    onchain.failSubmit = new Error("rpc down");
    const s = await service.start(START);
    await streamChunks(service, clock, s.sessionId, s.serverTime, goodChunks);
    const first = await service.finish({ sessionId: s.sessionId });
    expect(first).toMatchObject({ verdict: "pass", onchain: { status: "error", message: "rpc down" } });
    onchain.failSubmit = null;
    const second = await service.finish({ sessionId: s.sessionId });
    expect(second.onchain).toEqual({ status: "submitted", signature: "sig1" });
    expect(second.sessionHash).toBe(first.sessionHash);
  });

  it("one active session per wallet; idle sessions expire", async () => {
    const { clock, service } = setup();
    const a = await service.start(START);
    const b = await service.start(START);
    await expectError(service.finish({ sessionId: a.sessionId }), 404, "not_found");
    clock.t += 10 * 60_000;
    await expectError(service.finish({ sessionId: b.sessionId }), 404, "not_found");
  });

  it("caps sessions and per-wallet starts", async () => {
    const { service } = setup({ store: new AttestStore({ maxSessions: 1, walletStartsPerHour: 3 }) });
    await service.start(START);
    await expectError(service.start({ ...START, wallet: WALLET_B }), 503, "rate_limited");
    await service.start(START);
    await service.start(START);
    await expectError(service.start(START), 429, "rate_limited");
  });
});
