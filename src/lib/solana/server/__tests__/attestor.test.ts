import { generateKeyPairSigner, SolanaError, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM } from "@solana/kit";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  customCodeFromTransactionError,
  DEFAULT_PRIORITY_MICROLAMPORTS,
  estimatePriorityFee,
  extractCustomErrorCode,
  getServerSolana,
  MAX_PRIORITY_MICROLAMPORTS,
  resetServerSolana,
  runCrank,
  SYNC_CREW_BATCH,
  ServerSolanaNotConfiguredError,
} from "../attestor";
import { DAY_LEN, FakeVault, MINT } from "./fakeVault";

const noSleep = async () => {};
const fastSend = { sleep: noSleep, intervalMs: 1, timeoutMs: 50 };

describe("extractCustomErrorCode", () => {
  it("reads kit custom errors through the cause chain, RPC error values and log text", () => {
    const kit = new SolanaError(SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM, { code: 6009, index: 2 });
    expect(extractCustomErrorCode(new Error("preflight", { cause: kit }))).toBe(6009);
    expect(extractCustomErrorCode(new Error("Program failed: custom program error: 0x177a"))).toBe(6010);
    expect(customCodeFromTransactionError({ InstructionError: [1, { Custom: 6013n }] })).toBe(6013);
    expect(customCodeFromTransactionError("AccountInUse")).toBeNull();
    expect(extractCustomErrorCode(new Error("network down"))).toBeNull();
  });
});

describe("getServerSolana", () => {
  afterEach(() => resetServerSolana());

  it("is not configured without the attestor key or the mint, and never leaks values", async () => {
    await expect(getServerSolana({ NODE_ENV: "production", ATTESTOR_KEYPAIR: "" })).rejects.toBeInstanceOf(
      ServerSolanaNotConfiguredError,
    );
    await expect(getServerSolana({ NODE_ENV: "test" })).rejects.toThrow(/ATTESTOR_KEYPAIR/);
    const kp = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));
    await expect(getServerSolana({ NODE_ENV: "test", ATTESTOR_KEYPAIR: kp }, { mint: null })).rejects.toThrow(/mint/);
    const err = await getServerSolana({ NODE_ENV: "test", ATTESTOR_KEYPAIR: "[1,2" }).catch((e: Error) => e);
    expect(String(err)).toMatch(/ATTESTOR_KEYPAIR is malformed/);
    expect(String(err)).not.toContain("[1,2");
  });
});

describe("estimatePriorityFee", () => {
  let vault: FakeVault;
  beforeEach(async () => {
    vault = await new FakeVault().init();
  });

  it("uses the Helius estimate, clamped", async () => {
    const ctx = vault.context();
    expect(await estimatePriorityFee(ctx, [])).toBe(25_000n);
    const huge = { ...ctx, fetchImpl: (async () => Response.json({ result: { priorityFeeEstimate: 9e12 } })) as unknown as typeof fetch };
    expect(await estimatePriorityFee(huge, [])).toBe(MAX_PRIORITY_MICROLAMPORTS);
  });

  it("falls back when the method is missing or the request fails", async () => {
    const ctx = vault.context();
    const missing = { ...ctx, fetchImpl: (async () => Response.json({ error: { code: -32601 } })) as unknown as typeof fetch };
    expect(await estimatePriorityFee(missing, [])).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
    const down = { ...ctx, fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch };
    expect(await estimatePriorityFee(down, [])).toBe(DEFAULT_PRIORITY_MICROLAMPORTS);
  });
});

describe("runCrank", () => {
  let vault: FakeVault;
  const D = 20720; // yesterday relative to vault.nowSecs (day 20721)

  beforeEach(async () => {
    vault = await new FakeVault().init();
  });

  async function seedDay(missed: number, completed = 1) {
    const day = await vault.addDay(D, { committedCount: missed + completed });
    const users = [];
    for (let i = 0; i < missed; i++) {
      const u = (await generateKeyPairSigner()).address;
      users.push(u);
      await vault.addCommitment(u, D);
    }
    for (let i = 0; i < completed; i++) {
      await vault.addCommitment((await generateKeyPairSigner()).address, D, { status: 1 });
    }
    return { day, users };
  }

  it("does nothing while a day's attest deadline has not passed", async () => {
    await vault.addDay(20721);
    await seedDay(1);
    vault.nowSecs = (D + 1) * DAY_LEN + 3600; // exactly the deadline: still open
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.days).toEqual([]);
    expect(vault.sent).toHaveLength(0);
    expect(r.today).toBe(20721);
  });

  it("finalizes, closes missed commitments in batches, and leaves the sweep to after claims", async () => {
    const { day, users } = await seedDay(7, 1);
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.days).toHaveLength(1);
    expect(r.days[0]).toMatchObject({ day: D, finalize: "finalized", closedMissed: 7, missedLeft: 0, swept: false, errors: [] });
    expect(vault.sent.map((t) => t.kind)).toEqual(["finalize", "close_missed", "close_missed"]);
    expect(new Set(vault.sent.flatMap((t) => t.users))).toEqual(new Set(users));
    // The completer has not claimed yet: 7 of 8 resolved, so no sweep.
    expect(vault.dayState(day)?.resolvedCount).toBe(7);
    expect(vault.priorityFeeCalls).toBe(3);
  });

  it("is idempotent: a second run after the last claim only sweeps", async () => {
    const { day } = await seedDay(2, 0);
    await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    // 2 missed of 2 committed resolved by the first run, which also swept.
    expect(vault.sent.map((t) => t.kind)).toEqual(["finalize", "close_missed", "sweep"]);
    expect(vault.dayState(day)).toBeNull();

    const again = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(again.days).toEqual([]);
    expect(vault.sent).toHaveLength(3);
  });

  it("treats an already-finalized day as done and sweeps once resolved", async () => {
    const day = await vault.addDay(D, { finalized: true, committedCount: 3, resolvedCount: 3 });
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.days[0]).toMatchObject({ finalize: "already", swept: true });
    expect(vault.sent.map((t) => t.kind)).toEqual(["sweep"]);
    expect(vault.dayState(day)).toBeNull();
  });

  it("retries DayNotOver (chain clock behind wall time), then reports not_over", async () => {
    await seedDay(1);
    vault.dayNotOverLag = 1;
    let slept = 0;
    const ok = await runCrank(vault.context(), { nowSecs: vault.nowSecs, sleep: async () => void slept++, send: fastSend });
    expect(slept).toBe(1);
    expect(ok.days[0].finalize).toBe("finalized");

    const v2 = await new FakeVault().init();
    await v2.addDay(D, { committedCount: 1 });
    v2.dayNotOverLag = 10;
    const pending = await runCrank(v2.context(), { nowSecs: v2.nowSecs, sleep: noSleep, dayNotOverRetries: 2, send: fastSend });
    expect(pending.days[0]).toMatchObject({ finalize: "not_over", closedMissed: 0, errors: [] });
    expect(v2.sent).toHaveLength(0);
  });

  it("skips close_missed on a voided day and stops at maxTransactions", async () => {
    await vault.addDay(D, { voided: true, committedCount: 2, resolvedCount: 1 });
    const voided = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(voided.days[0]).toMatchObject({ finalize: "voided", closedMissed: 0, swept: false });
    expect(vault.sent).toHaveLength(0);

    const v2 = await new FakeVault().init();
    await v2.addDay(D - 1, { committedCount: 0 });
    await v2.addDay(D, { committedCount: 0 });
    const capped = await runCrank(v2.context(), { nowSecs: v2.nowSecs, maxTransactions: 1, send: fastSend });
    expect(capped.truncated).toBe(true);
    expect(v2.sent).toHaveLength(1);

    const v3 = await new FakeVault().init();
    await v3.addDay(D, { committedCount: 0 });
    let t = 0;
    const late = await runCrank(v3.context(), { nowSecs: v3.nowSecs, budgetMs: 10, clock: () => (t += 20), send: fastSend });
    expect(late).toMatchObject({ truncated: true, days: [] });
    expect(v3.sent).toHaveLength(0);
  });

  it("reports onchain failures without throwing", async () => {
    await seedDay(1);
    vault.failOnChainWith = 6000;
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.days[0].finalize).toBe("error");
    expect(r.days[0].errors[0]).toMatch(/program error 6000/);
  });

  it("settles crew pools too, after the global pool, passing the global pool to finalize", async () => {
    await seedDay(1, 1);
    const crewA = await vault.addCrew(7n);
    const crewB = await vault.addCrew(3n);
    await vault.addDay(D, { committedCount: 1 }, crewA);
    await vault.addCommitment((await generateKeyPairSigner()).address, D, {}, crewA);
    await vault.addDay(D, { committedCount: 0 }, crewB);
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.crewsScanned).toBe(2);
    expect(r.errors).toEqual([]);
    expect(r.days.map((d) => d.crewId ?? "global")).toEqual(["global", "3", "7"]);
    expect(r.days[2]).toMatchObject({ day: D, finalize: "finalized", closedMissed: 1, swept: true });
    const finals = vault.sent.filter((t) => t.kind === "finalize");
    expect(finals.map((t) => t.pools)).toEqual([
      [vault.pool, vault.pool],
      [crewB, vault.pool],
      [crewA, vault.pool],
    ]);
  });

  it("leaves crew days alone while the global pool is paused, and gives the global pool first claim on the budget", async () => {
    const crew = await vault.addCrew(9n);
    await vault.addDay(D, { committedCount: 0 }, crew);
    const paused = await new FakeVault().init({ paused: true, pausedSince: vault.nowSecs - 10 });
    const pCrew = await paused.addCrew(9n);
    await paused.addDay(D, { committedCount: 0 }, pCrew);
    const r = await runCrank(paused.context(), { nowSecs: paused.nowSecs, send: fastSend });
    expect(r.days).toEqual([]);
    expect(paused.sent).toHaveLength(0);

    await vault.addDay(D, { committedCount: 0 });
    const capped = await runCrank(vault.context(), { nowSecs: vault.nowSecs, maxTransactions: 1, send: fastSend });
    expect(capped.truncated).toBe(true);
    expect(capped.days.map((d) => d.crewId)).toEqual([undefined]);
  });

  it("syncs crews whose copied authority / attestor went stale, in batches, and leaves synced crews alone", async () => {
    const old = (await generateKeyPairSigner()).address;
    const stale: string[] = [];
    for (let i = 1n; i <= 10n; i++) stale.push(await vault.addCrew(i, { attestor: old }));
    await vault.addCrew(11n); // already in sync
    const pending = await vault.addCrew(12n, { pendingAuthority: old });
    const r = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(r.crewsSynced).toBe(11);
    expect(r.crewsScanned).toBe(12);
    const syncs = vault.sent.filter((t) => t.kind === "sync_crew");
    expect(syncs.map((t) => t.pools?.length)).toEqual([SYNC_CREW_BATCH, 11 - SYNC_CREW_BATCH]);
    expect(new Set(syncs.flatMap((t) => t.pools))).toEqual(new Set([...stale, pending]));
    const again = await runCrank(vault.context(), { nowSecs: vault.nowSecs, send: fastSend });
    expect(again.crewsSynced).toBe(0);
  });

  it("refuses to run without a pool", async () => {
    const ctx = { ...vault.context(), mint: (await generateKeyPairSigner()).address };
    await expect(runCrank(ctx, { nowSecs: vault.nowSecs })).rejects.toThrow(/pool/);
    expect(MINT).toBeTruthy();
  });
});
