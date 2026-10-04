/**
 * Crews (multi-pool) in the attestor: /start names the pool, the session attests for that pool,
 * and "already verified" is tracked per pool. The on-chain adapter reads the crew's Pool.
 */
import { generateKeyPairSigner, type Address } from "@solana/kit";
import { beforeEach, describe, expect, it } from "vitest";
import { DAY_LEN, FakeVault, MINT } from "@/lib/solana/server/__tests__/fakeVault";
import { getPoolAddresses } from "@/lib/solana/vault/addresses";
import { Exercise, FITR_VAULT_PROGRAM_ADDRESS, getPoolDecoder, getPoolEncoder } from "@/lib/solana/vault/generated";
import { createVaultOnchain, type AttestOnchain, type OnchainCommitment, type SubmitAttestationParams } from "../onchain";
import { AttestError, AttestService, parseCrewIdField } from "../service";
import { AttestStore } from "../store";
import {
  chunkFrames,
  FakeClock,
  fixedPlan,
  pushupSessionFrames,
  streamChunks,
  WALLET_A,
  withRaisedHand,
} from "./helpers";

const DAY = 20721;
const START = { wallet: WALLET_A, dayIndex: DAY, exercise: "pushup", goalTarget: 10 };

/** Commitments keyed by wallet, day and pool. */
class PoolOnchain implements AttestOnchain {
  commitments = new Map<string, OnchainCommitment>();
  lookups: Array<[string, number, bigint | undefined]> = [];
  submitted: SubmitAttestationParams[] = [];

  commit(wallet: string, day: number, crewId: bigint, c: Partial<OnchainCommitment> = {}) {
    this.commitments.set(`${wallet}:${day}:${crewId}`, {
      exercise: "pushup",
      goalTarget: 10,
      status: "committed",
      committedAt: 1_790_294_400,
      ...c,
    });
  }

  async getCommitment(wallet: string, day: number, crewId?: bigint) {
    this.lookups.push([wallet, day, crewId]);
    return this.commitments.get(`${wallet}:${day}:${crewId ?? 0n}`) ?? null;
  }

  async submitAttestation(p: SubmitAttestationParams) {
    this.submitted.push(p);
    return { signature: `sig${this.submitted.length}` };
  }
}

function setup() {
  const clock = new FakeClock();
  const onchain = new PoolOnchain();
  let n = 0;
  const service = new AttestService({
    onchain,
    now: clock.now,
    random: () => 0.5,
    newId: () => `session_${String(++n).padStart(12, "0")}`,
    planner: fixedPlan({ type: "raise_right_hand", atMsFromStart: 8000 }),
    store: new AttestStore(),
  });
  return { clock, onchain, service };
}

async function status(p: Promise<unknown>): Promise<number | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof AttestError ? e.status : -1;
  }
}

describe("parseCrewIdField", () => {
  it("accepts absent / 0 as the global pool and canonical u64 strings as crews", () => {
    expect(parseCrewIdField(undefined)).toBe(0n);
    expect(parseCrewIdField(null)).toBe(0n);
    expect(parseCrewIdField("0")).toBe(0n);
    expect(parseCrewIdField(0)).toBe(0n);
    expect(parseCrewIdField("42")).toBe(42n);
    expect(parseCrewIdField(42)).toBe(42n);
    expect(parseCrewIdField("18446744073709551615")).toBe(18446744073709551615n);
    for (const bad of ["18446744073709551616", "-1", "01", "1.5", "", "x", -1, 1.5, 2 ** 60, {}, [], true]) {
      expect(parseCrewIdField(bad), String(bad)).toBeNull();
    }
  });
});

describe("AttestService with crews", () => {
  it("looks the commitment up in the named crew and attests for it", async () => {
    const { clock, onchain, service } = setup();
    onchain.commit(WALLET_A, DAY, 77n);
    const start = await service.start({ ...START, crewId: "77" });
    expect(start.crewId).toBe("77");
    expect(onchain.lookups.at(-1)).toEqual([WALLET_A, DAY, 77n]);

    await streamChunks(service, clock, start.sessionId, start.serverTime, chunkFrames(withRaisedHand(pushupSessionFrames(), "right", 8500, 10500)));
    const fin = await service.finish({ sessionId: start.sessionId });
    expect(fin.verdict).toBe("pass");
    expect(onchain.submitted[0]).toMatchObject({ wallet: WALLET_A, dayIndex: DAY, crewId: 77n });

    // That crew's day is closed for new sessions; the global pool's day is not.
    expect(await status(service.start({ ...START, crewId: "77" }))).toBe(409);
    onchain.commit(WALLET_A, DAY, 0n);
    const global = await service.start(START);
    expect(global.crewId).toBeUndefined();
    expect(onchain.lookups.at(-1)).toEqual([WALLET_A, DAY, undefined]);
  });

  it("the global pool is unchanged: no crewId on lookup, submit or response", async () => {
    const { clock, onchain, service } = setup();
    onchain.commit(WALLET_A, DAY, 0n);
    const start = await service.start({ ...START, crewId: "0" });
    expect(start).not.toHaveProperty("crewId");
    await streamChunks(service, clock, start.sessionId, start.serverTime, chunkFrames(withRaisedHand(pushupSessionFrames(), "right", 8500, 10500)));
    await service.finish({ sessionId: start.sessionId });
    expect(onchain.submitted[0]).not.toHaveProperty("crewId");
  });

  it("a commitment in another pool does not count; bad crew ids are rejected", async () => {
    const { onchain, service } = setup();
    onchain.commit(WALLET_A, DAY, 5n);
    expect(await status(service.start(START))).toBe(404);
    expect(await status(service.start({ ...START, crewId: "6" }))).toBe(404);
    expect(await status(service.start({ ...START, crewId: "abc" }))).toBe(400);
    expect(await status(service.start({ ...START, crewId: "-5" }))).toBe(400);
    expect(await status(service.start({ ...START, crewId: "5" }))).toBeNull();
  });
});

describe("store: attested per pool", () => {
  it("keeps the global key format and separates crews", () => {
    const store = new AttestStore();
    store.markAttested(WALLET_A, DAY, 0);
    expect(store.isAttested(WALLET_A, DAY, 1)).toBe(true);
    expect(store.isAttested(WALLET_A, DAY, 1, 0n)).toBe(true);
    expect(store.isAttested(WALLET_A, DAY, 1, 9n)).toBe(false);
    store.markAttested(WALLET_A, DAY, 0, 9n);
    expect(store.isAttested(WALLET_A, DAY, 1, 9n)).toBe(true);
  });
});

describe("vault onchain adapter with crews", () => {
  const TODAY = 20721;
  const fastSend = { sleep: async () => {}, intervalMs: 1, timeoutMs: 50 };
  let vault: FakeVault;
  let user: Address;
  let globalPool: Address;
  let crewPool: Address;

  async function addCrew(crewId: bigint, over: { attestor?: Address } = {}): Promise<Address> {
    const { pool } = await getPoolAddresses(MINT, FITR_VAULT_PROGRAM_ADDRESS, crewId);
    const g = getPoolDecoder().decode(vault.accounts.get(globalPool)!);
    vault.accounts.set(pool, new Uint8Array(getPoolEncoder().encode({ ...g, crewId, attestor: over.attestor ?? g.attestor })));
    return pool;
  }

  function adapter() {
    return createVaultOnchain({ context: async () => vault.context(), now: () => vault.nowSecs * 1000, send: fastSend });
  }

  beforeEach(async () => {
    vault = await new FakeVault().init();
    user = (await generateKeyPairSigner()).address;
    globalPool = vault.pool;
    crewPool = await addCrew(31n);
  });

  it("reads the commitment from the crew pool, not the global one", async () => {
    vault.pool = crewPool;
    await vault.addCommitment(user, TODAY, { exercise: Exercise.Squat, goalTarget: 30 });
    vault.pool = globalPool;
    expect(await adapter().getCommitment(user, TODAY, 31n)).toMatchObject({ exercise: "squat", goalTarget: 30, status: "committed" });
    expect(await adapter().getCommitment(user, TODAY)).toBeNull();
    // An unknown crew is "no commitment", never an error.
    expect(await adapter().getCommitment(user, TODAY, 32n)).toBeNull();
  });

  it("submits attest_completion against the crew's accounts", async () => {
    vault.pool = crewPool;
    await vault.addCommitment(user, TODAY);
    await vault.addDay(TODAY);
    vault.pool = globalPool;
    const startedAt = TODAY * DAY_LEN + 3600;
    const { signature } = await adapter().submitAttestation({
      wallet: user,
      dayIndex: TODAY,
      reps: 22,
      sessionHash: new Uint8Array(32).fill(1),
      sessionStartedAt: startedAt,
      crewId: 31n,
    });
    expect(signature).toBeTruthy();
    const sent = vault.sent.at(-1)!;
    expect(sent.kind).toBe("attest");
    expect(sent.users).toEqual([user]);
  });

  it("attests a crew whose attestor copy is stale: crew days use the global attestor", async () => {
    const stale = await addCrew(40n, { attestor: (await generateKeyPairSigner()).address });
    vault.pool = stale;
    await vault.addCommitment(user, TODAY);
    vault.pool = globalPool;
    const { signature } = await adapter().submitAttestation({
      wallet: user,
      dayIndex: TODAY,
      reps: 22,
      sessionHash: new Uint8Array(32),
      sessionStartedAt: TODAY * DAY_LEN + 3600,
      crewId: 40n,
    });
    expect(signature).toBeTruthy();
    expect(vault.sent).toHaveLength(1);
  });
});
