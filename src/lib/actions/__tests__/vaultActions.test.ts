import { describe, expect, it } from "vitest";
import {
  getBase64Encoder,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
  type Address,
} from "@solana/kit";
import {
  COMMIT_DISCRIMINATOR,
  CommitmentStatus,
  Exercise,
  FUND_RESERVE_DISCRIMINATOR,
  REGISTER_DEVICE_DISCRIMINATOR,
} from "@/lib/solana/vault/generated";
import { D0, makeCommitment, T0 } from "@/lib/solana/vault/__tests__/fixtures";
import {
  commitMetadata,
  commitTransaction,
  lookupPool,
  OPENS_SOON_MESSAGE,
  parseCommitQuery,
  SEEKER_ONLY_MESSAGE,
  simulationMessage,
  sponsorMetadata,
  sponsorTransaction,
} from "../vaultActions";
import {
  actionsChain,
  FakeChain,
  PROGRAM,
  seedAta,
  seedCommitment,
  seedDeviceLock,
  seedPool,
  USER,
} from "./fakeChain";

const NOW = T0 + 3_600; // 01:00 UTC on day D0: today's commit window is open
const SKR = 1_000_000n;

function url(path: string) {
  return new URL(`https://fitr.day${path}`);
}

function decodeTx(b64: string) {
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(b64));
  const msg = getCompiledTransactionMessageDecoder().decode(tx.messageBytes) as unknown as {
    staticAccounts: Address[];
    header: { numSignerAccounts: number };
    instructions: Array<{ programAddressIndex: number; data?: Uint8Array }>;
  };
  const discs = msg.instructions
    .filter((ix) => msg.staticAccounts[ix.programAddressIndex] === PROGRAM)
    .map((ix) => Array.from((ix.data ?? new Uint8Array()).slice(0, 8)).join(","));
  return { tx, msg, discs, feePayer: msg.staticAccounts[0] };
}

const disc = (d: ArrayLike<number>) => Array.from(d).join(",");

describe("lookupPool", () => {
  it("is missing when the global pool does not exist, invalid for a bad ?pool=", async () => {
    const chain = new FakeChain();
    const c = actionsChain(chain, { nowSecs: NOW });
    expect(await lookupPool(c, null)).toEqual({ kind: "missing" });
    expect((await lookupPool(c, "not-an-address")).kind).toBe("invalid");
    expect((await lookupPool(c, USER)).kind).toBe("invalid");
  });

  it("finds the global pool and a crew pool by address", async () => {
    const chain = new FakeChain();
    const g = await seedPool(chain);
    const crew = await seedPool(chain, { crewId: 7n });
    const c = actionsChain(chain, { nowSecs: NOW });
    const a = await lookupPool(c, null);
    expect(a.kind === "ok" && a.address).toBe(g.pool);
    const b = await lookupPool(c, crew.pool);
    expect(b.kind === "ok" && b.pool.crewId).toBe(7n);
  });
});

describe("commitMetadata (GET)", () => {
  it("is disabled with an 'opens soon' error while the pool is missing", () => {
    const m = commitMetadata({ kind: "missing" }, { pool: null, exercise: "squat", goal: 30 });
    expect(m.type).toBe("action");
    expect(m.disabled).toBe(true);
    expect(m.error?.message).toBe(OPENS_SOON_MESSAGE);
    expect(m.icon).toMatch(/^https:\/\/fitr\.day\/art\/exercises\/squat-man\.jpg$/);
    expect(m.links).toBeUndefined();
  });

  it("offers presets inside the stake rails plus a custom amount parameter", async () => {
    const chain = new FakeChain();
    const { pool, data } = await seedPool(chain, { minStake: 20n * SKR, maxStake: 40n * SKR });
    const m = commitMetadata({ kind: "ok", address: pool, pool: data }, parseCommitQuery(url("/x?exercise=pushup&goal=30")));
    expect(m.title).toBe("Commit with me: 30 push-ups");
    expect(m.disabled).toBeUndefined();
    const actions = m.links!.actions;
    expect(actions.map((a) => a.label)).toEqual(["Stake 25 SKR", "Commit"]);
    expect(actions[0].href).toBe("/api/actions/commit?exercise=pushup&goal=30&amount=25");
    expect(actions[1].href).toBe("/api/actions/commit?exercise=pushup&goal=30&amount={amount}");
    expect(actions[1].parameters?.[0]).toMatchObject({ name: "amount", type: "number", required: true, min: 20, max: 40 });
    expect(m.description).toMatch(/Seeker-only/);
    expect(m.description).not.toMatch(/earn/i);
  });

  it("clamps the goal to the on-chain limits and defaults the exercise", async () => {
    const chain = new FakeChain();
    const { pool, data } = await seedPool(chain);
    const low = commitMetadata({ kind: "ok", address: pool, pool: data }, { pool: null, exercise: "plank", goal: 1 });
    expect(low.title).toBe("Commit with me: 30 s plank");
    const dflt = commitMetadata({ kind: "ok", address: pool, pool: data }, { pool: null, exercise: null, goal: null });
    expect(dflt.title).toMatch(/push-ups$/);
  });

  it("uses a crew's fixed challenge and keeps the crew pool in the hrefs", async () => {
    const chain = new FakeChain();
    const name = new Uint8Array(32);
    name.set(new TextEncoder().encode("Dawn Patrol"));
    const { pool, data } = await seedPool(chain, {
      crewId: 9n,
      name,
      hasFixedExercise: true,
      fixedExercise: Exercise.Squat,
      fixedGoalTarget: 50,
    });
    const m = commitMetadata({ kind: "ok", address: pool, pool: data }, { pool, exercise: "pushup", goal: 10 });
    expect(m.title).toBe("Commit with me: 50 squats");
    expect(m.description).toContain('"Dawn Patrol" crew');
    expect(m.links!.actions[0].href).toContain(`pool=${pool}`);
    expect(m.links!.actions[0].href).toContain("exercise=squat&goal=50");
  });

  it("is disabled while the pool is paused", async () => {
    const chain = new FakeChain();
    const { pool, data } = await seedPool(chain, { paused: true });
    const m = commitMetadata({ kind: "ok", address: pool, pool: data }, { pool: null, exercise: null, goal: null });
    expect(m.disabled).toBe(true);
    expect(m.error?.message).toMatch(/paused/);
  });
});

describe("commitTransaction (POST)", () => {
  const path = "/api/actions/commit?exercise=pushup&goal=30&amount=25";

  it("rejects a bad account and a missing amount", async () => {
    const chain = new FakeChain();
    const c = actionsChain(chain, { nowSecs: NOW });
    expect(await commitTransaction(c, url(path), "nope")).toMatchObject({ ok: false, status: 400 });
    expect(await commitTransaction(c, url("/api/actions/commit"), USER)).toMatchObject({ ok: false, status: 400 });
  });

  it("answers 'opens soon' when the pool is missing", async () => {
    const chain = new FakeChain();
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW }), url(path), USER);
    expect(r).toEqual({ ok: false, status: 404, message: OPENS_SOON_MESSAGE });
  });

  it("refuses wallets without a Seeker Genesis Token before building anything", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW, seeker: false }), url(path), USER);
    expect(r).toEqual({ ok: false, status: 403, message: SEEKER_ONLY_MESSAGE });
    expect(chain.simulated).toHaveLength(0);
    const down = await commitTransaction(actionsChain(chain, { nowSecs: NOW, sgtThrows: true }), url(path), USER);
    expect(down).toMatchObject({ ok: false, status: 503 });
  });

  it("checks the stake rails and the SKR balance", async () => {
    const chain = new FakeChain();
    await seedPool(chain, { minStake: 30n * SKR });
    await seedAta(chain, USER, 10n * SKR);
    const c = actionsChain(chain, { nowSecs: NOW });
    const low = await commitTransaction(c, url(path), USER);
    expect(low).toMatchObject({ ok: false, status: 400 });
    expect(!low.ok && low.message).toMatch(/Stake between 30 and/);
    const poor = await commitTransaction(c, url(path.replace("amount=25", "amount=40")), USER);
    expect(!poor.ok && poor.message).toMatch(/Not enough SKR: you have 10/);
  });

  it("builds an unsigned register_device + commit for today, fee payer = account", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW }), url(path), USER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.type).toBe("transaction");
    expect(r.body.message).toMatch(/25 SKR on 30 push-ups today/);
    const { tx, discs, feePayer, msg } = decodeTx(r.body.transaction);
    expect(feePayer).toBe(USER);
    expect(Object.keys(tx.signatures)).toEqual([USER]);
    expect(tx.signatures[USER as Address]).toBeNull();
    expect(discs).toEqual([disc(REGISTER_DEVICE_DISCRIMINATOR), disc(COMMIT_DISCRIMINATOR)]);
    expect(msg.header.numSignerAccounts).toBe(1);
    expect(chain.simulated).toHaveLength(1);
  });

  it("skips register_device when the device is registered and rolls to tomorrow after a commit today", async () => {
    const chain = new FakeChain();
    const { pool } = await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    await seedDeviceLock(chain, pool);
    await seedCommitment(chain, pool, makeCommitment(D0, { pool, user: USER }, pool));
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW }), url(path), USER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(decodeTx(r.body.transaction).discs).toEqual([disc(COMMIT_DISCRIMINATOR)]);
    expect(r.body.message).toMatch(/tomorrow/);
  });

  it("refuses when today and tomorrow are both taken", async () => {
    const chain = new FakeChain();
    const { pool } = await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    await seedCommitment(chain, pool, makeCommitment(D0, { user: USER, status: CommitmentStatus.Completed }, pool));
    await seedCommitment(chain, pool, makeCommitment(D0 + 1, { user: USER }, pool));
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW }), url(path), USER);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });

  it("never returns a transaction that fails simulation", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    chain.sim = { err: { InstructionError: [2, { Custom: 6017 }] }, logs: [] };
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW }), url(path), USER);
    expect(r).toEqual({ ok: false, status: 422, message: "This Seeker has already committed for that day." });
  });

  it("does not check for a Seeker when the pool doesn't require one", async () => {
    const chain = new FakeChain();
    await seedPool(chain, { requireSgt: false });
    await seedAta(chain, USER, 100n * SKR);
    const r = await commitTransaction(actionsChain(chain, { nowSecs: NOW, seeker: false }), url(path), USER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(decodeTx(r.body.transaction).discs).toEqual([disc(COMMIT_DISCRIMINATOR)]);
  });
});

describe("simulationMessage", () => {
  it("maps vault errors, SPL insufficient funds and missing SOL", () => {
    expect(simulationMessage({ InstructionError: [0, { Custom: 6023 }] }, null)).toMatch(/stake is outside/);
    expect(simulationMessage({ InstructionError: [0, { Custom: 1 }] }, null)).toMatch(/Not enough SKR/);
    expect(simulationMessage("InsufficientFundsForFee", null)).toMatch(/SOL/);
    expect(simulationMessage({ weird: true }, [])).toMatch(/try again/);
  });
});

describe("sponsor action", () => {
  it("GET is disabled while sponsored days are off or the pool is missing", async () => {
    expect(sponsorMetadata({ kind: "missing" }).disabled).toBe(true);
    const chain = new FakeChain();
    const { pool, data } = await seedPool(chain, { dailySponsorAmount: 0n });
    const m = sponsorMetadata({ kind: "ok", address: pool, pool: data });
    expect(m.disabled).toBe(true);
    expect(m.links).toBeUndefined();
  });

  it("GET frames it as a bonus for people who show up, never yield", async () => {
    const chain = new FakeChain();
    const { pool, data } = await seedPool(chain, { dailySponsorAmount: 50n * SKR, reserve: 200n * SKR });
    const m = sponsorMetadata({ kind: "ok", address: pool, pool: data });
    expect(m.description).toMatch(/up to 50 SKR to each day's bonus/);
    expect(m.description).toMatch(/gift, not an investment/);
    expect(m.description).not.toMatch(/\b(earn|yield|APY|returns?)\b/i);
    expect(m.links!.actions.at(-1)!.href).toBe("/api/actions/sponsor?amount={amount}");
  });

  it("POST builds an unsigned fund_reserve, checks the balance", async () => {
    const chain = new FakeChain();
    const { pool } = await seedPool(chain, { dailySponsorAmount: 10n * SKR, crewId: 3n });
    await seedAta(chain, USER, 100n * SKR);
    const c = actionsChain(chain, { nowSecs: NOW });
    const ok = await sponsorTransaction(c, url(`/api/actions/sponsor?pool=${pool}&amount=100`), USER);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const d = decodeTx(ok.body.transaction);
      expect(d.feePayer).toBe(USER);
      expect(d.discs).toEqual([disc(FUND_RESERVE_DISCRIMINATOR)]);
    }
    const poor = await sponsorTransaction(c, url(`/api/actions/sponsor?pool=${pool}&amount=101`), USER);
    expect(poor).toMatchObject({ ok: false, status: 400 });
  });

  it("POST refuses while sponsoring is off", async () => {
    const chain = new FakeChain();
    await seedPool(chain);
    await seedAta(chain, USER, 100n * SKR);
    const r = await sponsorTransaction(actionsChain(chain, { nowSecs: NOW }), url("/api/actions/sponsor?amount=5"), USER);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });
});
