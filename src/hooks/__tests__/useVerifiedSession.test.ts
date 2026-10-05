import { address, generateKeyPairSigner, type Address } from "@solana/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChunkResponse, FinishResponse, StartResponse } from "@/lib/attest/protocol";
import { decodeChunk } from "@/lib/attest/trace";
import type { PoseFrame } from "@/lib/pose/types";
import { DAY_LEN, FakeVault, MINT } from "@/lib/solana/server/__tests__/fakeVault";
import { Exercise, FITR_VAULT_PROGRAM_ADDRESS } from "@/lib/solana/vault/generated";
import {
  loadTodayCommitment,
  VerifiedSessionController,
  verifyReasonCopy,
  type StakedCommitment,
} from "../useVerifiedSession";

const WALLET = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
const STAKE: StakedCommitment = { dayIndex: 20721, exercise: "pushup", goalTarget: 20, amount: 5_000_000n, status: "committed" };

interface Call {
  path: string;
  body: Record<string, unknown>;
}

function frame(t: number): PoseFrame {
  return { timestampMs: t, landmarks: [], imageWidth: 640, imageHeight: 480 };
}

const until = async (cond: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 2));
  }
};

/** A scripted attestor: /start, /chunk (reveals a live check on the 2nd chunk), /finish. */
function fakeServer(over: { start?: () => Response; finish?: () => Response; chunk?: (n: number) => Response | null } = {}) {
  const calls: Call[] = [];
  let chunks = 0;
  const fetchImpl = vi.fn(async (path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ path, body });
    if (path === "/api/attest/start") {
      if (over.start) return over.start();
      const res: StartResponse = {
        sessionId: "sess_0123456789abcdef",
        serverTime: 1,
        exercise: "pushup",
        goalTarget: 20,
        challengePlan: [{ id: "c1", atMsFromStart: 6000, windowMs: 6000, type: null }],
        chunkIntervalMs: 1000,
        maxChunkChars: 131072,
        maxDurationMs: 600_000,
      };
      return Response.json(res);
    }
    if (path === "/api/attest/chunk") {
      chunks++;
      const custom = over.chunk?.(chunks);
      if (custom) return custom;
      const res: ChunkResponse = {
        ack: { seq: body.chunk.seq, frames: 1, duplicate: false },
        serverElapsedMs: 1000 * chunks,
        dueChallenge:
          chunks >= 2
            ? { id: "c1", type: "raise_right_hand", prompt: "Raise your RIGHT hand above your head", windowMs: 6000, remainingMs: 5000 }
            : null,
        challengesPending: chunks >= 2 ? 0 : 1,
      };
      return Response.json(res);
    }
    if (path === "/api/attest/finish") {
      if (over.finish) return over.finish();
      const res: FinishResponse = {
        verdict: "pass",
        count: 21,
        goalTarget: 20,
        reasons: [],
        sessionHash: "ab".repeat(32),
        onchain: { status: "submitted", signature: "5igTx" },
      };
      return Response.json(res);
    }
    return Response.json({ error: "nope", code: "not_found" }, { status: 404 });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch, chunkCount: () => chunks };
}

let perf = 1000;
const vibrate = vi.fn();

function controller(server: ReturnType<typeof fakeServer>) {
  return new VerifiedSessionController("pushup", {
    fetchImpl: server.fetchImpl,
    perfNow: () => perf,
    chunkIntervalMs: 5,
    fastChunkIntervalMs: 5,
    retryDelayMs: 0,
    vibrate,
    explorerTxUrl: (sig) => `https://explorer.solana.com/tx/${sig}`,
  });
}

beforeEach(() => {
  perf = 1000;
  vibrate.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("VerifiedSessionController", () => {
  it("stays off without a wallet and never touches the network", async () => {
    const server = fakeServer();
    const c = controller(server);
    await c.lookup(null, async () => STAKE);
    expect(c.getSnapshot().status).toBe("off");
    await c.begin();
    c.record(frame(1100));
    await c.finish();
    expect(server.calls).toHaveLength(0);
  });

  it("is off (with a hint) when today's stake is for another exercise", async () => {
    const server = fakeServer();
    const c = controller(server);
    await c.lookup(WALLET, async () => ({ ...STAKE, exercise: "squat" }));
    expect(c.getSnapshot()).toMatchObject({ status: "off", otherExercise: "squat", commitment: null });
    await c.begin();
    expect(server.calls).toHaveLength(0);
  });

  it("an unreachable chain falls back to an unstaked workout", async () => {
    const c = controller(fakeServer());
    await c.lookup(WALLET, async () => {
      throw new Error("rpc down");
    });
    expect(c.getSnapshot().status).toBe("off");
  });

  it("runs start -> chunks -> live check -> finish -> verified onchain", async () => {
    const server = fakeServer();
    const c = controller(server);
    await c.lookup(WALLET, async () => STAKE);
    expect(c.getSnapshot().status).toBe("ready");

    await c.begin();
    expect(c.getSnapshot()).toMatchObject({ status: "recording", challengesPending: 1 });
    expect(server.calls[0]).toEqual({
      path: "/api/attest/start",
      body: { wallet: WALLET, dayIndex: 20721, exercise: "pushup", goalTarget: 20 },
    });

    // Frames before the start response are not part of the trace; later ones are.
    c.record(frame(900));
    c.record(frame(1100));
    await until(() => server.chunkCount() >= 1);
    c.record(frame(1200));
    await until(() => c.getSnapshot().challenge !== null);
    const ch = c.getSnapshot().challenge!;
    expect(ch).toMatchObject({ id: "c1", type: "raise_right_hand", prompt: expect.stringMatching(/RIGHT hand/) });
    expect(ch.deadline).toBeGreaterThan(Date.now());
    expect(vibrate).toHaveBeenCalledTimes(1);

    c.record(frame(1300));
    await c.finish();
    const snap = c.getSnapshot();
    expect(snap.status).toBe("verified");
    expect(snap.outcome).toEqual({
      kind: "verified",
      count: 21,
      goalTarget: 20,
      signature: "5igTx",
      explorerUrl: "https://explorer.solana.com/tx/5igTx",
    });
    expect(snap.challenge).toBeNull();

    // Chunks went out in seq order and every recorded frame (after the origin) was sent.
    const chunkCalls = server.calls.filter((x) => x.path === "/api/attest/chunk");
    const seqs = chunkCalls.map((x) => (x.body.chunk as { seq: number }).seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    const frames = chunkCalls.flatMap((x) => decodeChunk(x.body.chunk as never).chunk.frames.map((f) => f.tMs));
    expect(frames).toEqual([100, 200, 300]);
    expect(server.calls.at(-1)).toEqual({ path: "/api/attest/finish", body: { sessionId: "sess_0123456789abcdef" } });

    // "Go again" after a verified day: already done, nothing more to verify.
    c.reset();
    expect(c.getSnapshot()).toMatchObject({ status: "already", outcome: null });
  });

  it("reports an honest failure with the server's reasons", async () => {
    const server = fakeServer({
      finish: () =>
        Response.json({ verdict: "fail", count: 12, goalTarget: 20, reasons: ["below_goal", "challenge_missed"], sessionHash: "00", onchain: null }),
    });
    const c = controller(server);
    await c.lookup(WALLET, async () => STAKE);
    await c.begin();
    c.record(frame(1100));
    await c.finish();
    expect(c.getSnapshot()).toMatchObject({
      status: "failed",
      outcome: { kind: "failed", count: 12, goalTarget: 20, reasons: ["below_goal", "challenge_missed"] },
    });
    expect(verifyReasonCopy("challenge_missed")).toMatch(/live check was missed/);
    expect(verifyReasonCopy("weird")).toMatch(/could not be verified/);
    // A failed day can be retried with a new session.
    c.reset();
    expect(c.getSnapshot().status).toBe("ready");
  });

  it("explains a start failure and lets the user retry", async () => {
    const server = fakeServer({
      start: () => Response.json({ error: "Verification is not available yet", code: "not_configured" }, { status: 503 }),
    });
    const c = controller(server);
    await c.lookup(WALLET, async () => STAKE);
    await c.begin();
    expect(c.getSnapshot()).toMatchObject({ status: "error", outcome: null });
    expect(c.getSnapshot().error).toMatch(/isn't available right now/);
    // not_configured is not retried within one call.
    expect(server.calls.filter((x) => x.path === "/api/attest/start")).toHaveLength(1);
    c.record(frame(1100));
    await c.finish(); // no session: nothing to finish
    expect(server.calls.filter((x) => x.path === "/api/attest/finish")).toHaveLength(0);

    const ok = fakeServer();
    const c2 = controller(ok);
    await c2.lookup(WALLET, async () => STAKE);
    await c2.begin();
    expect(c2.getSnapshot().status).toBe("recording");
    c2.cancel();
    expect(c2.getSnapshot().status).toBe("ready");
  });

  it("keeps chunks through a network blip and sends them in order", async () => {
    let flaky = 0;
    const server = fakeServer({
      chunk: (n) => {
        if (n === 1 && flaky++ === 0) throw new TypeError("network");
        return null;
      },
    });
    const c = controller(server);
    await c.lookup(WALLET, async () => STAKE);
    await c.begin();
    c.record(frame(1100));
    await until(() => c.getSnapshot().error !== null || server.chunkCount() >= 2);
    c.record(frame(1200));
    await c.finish();
    expect(c.getSnapshot().status).toBe("verified");
    const seqs = server.calls.filter((x) => x.path === "/api/attest/chunk").map((x) => (x.body.chunk as { seq: number }).seq);
    expect(seqs[0]).toBe(0);
    expect(new Set(seqs)).toEqual(new Set([0, 1]));
  });

  it("a passing workout whose onchain submission failed can retry just the submission", async () => {
    let attempt = 0;
    const server = fakeServer({
      finish: () =>
        Response.json({
          verdict: "pass",
          count: 20,
          goalTarget: 20,
          reasons: [],
          sessionHash: "00",
          onchain: attempt++ === 0 ? { status: "error", message: "blockhash expired" } : { status: "submitted", signature: "SiG2" },
        }),
    });
    const c = controller(server);
    await c.lookup(WALLET, async () => STAKE);
    await c.begin();
    c.record(frame(1100));
    await c.finish();
    expect(c.getSnapshot()).toMatchObject({ status: "error", outcome: { kind: "error", retryable: true } });
    await c.finish();
    expect(c.getSnapshot()).toMatchObject({ status: "verified", outcome: { signature: "SiG2" } });
  });
});

describe("loadTodayCommitment", () => {
  let vault: FakeVault;
  let user: Address;
  beforeEach(async () => {
    vault = await new FakeVault().init();
    user = (await generateKeyPairSigner()).address;
  });

  it("reads today's commitment through the vault decoders", async () => {
    await vault.addCommitment(user, 20721, { exercise: Exercise.Plank, goalTarget: 60, amount: 2_500_000 });
    const got = await loadTodayCommitment(vault.rpc(), user, {
      mint: MINT,
      nowSecs: 20721 * DAY_LEN + 100,
      programAddress: FITR_VAULT_PROGRAM_ADDRESS,
    });
    expect(got).toEqual({ dayIndex: 20721, exercise: "plank", goalTarget: 60, amount: 2_500_000n, status: "committed" });
  });

  it("is null without a mint, a pool or a commitment for today", async () => {
    const opts = { mint: MINT, nowSecs: 20721 * DAY_LEN + 100, programAddress: FITR_VAULT_PROGRAM_ADDRESS };
    await vault.addCommitment(user, 20720);
    expect(await loadTodayCommitment(vault.rpc(), user, opts)).toBeNull();
    expect(await loadTodayCommitment(vault.rpc(), user, { ...opts, mint: null })).toBeNull();
    vault.accounts.delete(vault.pool);
    expect(await loadTodayCommitment(vault.rpc(), user, opts)).toBeNull();
  });
});
