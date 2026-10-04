import { generateKeyPairSigner, type Address } from "@solana/kit";
import { beforeEach, describe, expect, it } from "vitest";
import { Exercise } from "@/lib/solana/vault/generated";
import { DAY_LEN, FakeVault } from "@/lib/solana/server/__tests__/fakeVault";
import { ServerSolanaNotConfiguredError } from "@/lib/solana/server/attestor";
import vaultOnchain, { AttestNotConfiguredError, createVaultOnchain } from "../onchain";

const TODAY = 20721;
const fastSend = { sleep: async () => {}, intervalMs: 1, timeoutMs: 50 };

let vault: FakeVault;
let user: Address;

function adapter() {
  return createVaultOnchain({ context: async () => vault.context(), now: () => vault.nowSecs * 1000, send: fastSend });
}

beforeEach(async () => {
  vault = await new FakeVault().init();
  user = (await generateKeyPairSigner()).address;
});

describe("vault onchain adapter: getCommitment", () => {
  it("maps today's commitment (exercise code, goal, status, committedAt)", async () => {
    await vault.addCommitment(user, TODAY, { exercise: Exercise.WallSit, goalTarget: 90 });
    expect(await adapter().getCommitment(user, TODAY)).toEqual({
      exercise: "wall_sit",
      goalTarget: 90,
      status: "committed",
      committedAt: TODAY * DAY_LEN + 60,
    });
  });

  it("returns null for another day or when nothing is committed", async () => {
    await vault.addCommitment(user, TODAY + 1);
    expect(await adapter().getCommitment(user, TODAY + 1)).toBeNull();
    expect(await adapter().getCommitment(user, TODAY)).toBeNull();
  });

  it("reports completed commitments", async () => {
    await vault.addCommitment(user, TODAY, { status: 1 });
    expect((await adapter().getCommitment(user, TODAY))?.status).toBe("completed");
  });

  it("is not configured without server secrets or a pool", async () => {
    const missing = createVaultOnchain({
      context: async () => {
        throw new ServerSolanaNotConfiguredError("ATTESTOR_KEYPAIR");
      },
    });
    await expect(missing.getCommitment(user, TODAY)).rejects.toBeInstanceOf(AttestNotConfiguredError);
    vault.accounts.delete(vault.pool);
    await expect(adapter().getCommitment(user, TODAY)).rejects.toBeInstanceOf(AttestNotConfiguredError);
  });

  it("the default export is not configured in tests (no ATTESTOR_KEYPAIR) and sends nothing", async () => {
    await expect(vaultOnchain.getCommitment(user, TODAY)).rejects.toBeInstanceOf(AttestNotConfiguredError);
  });
});

describe("vault onchain adapter: submitAttestation", () => {
  const hash = new Uint8Array(32).fill(7);
  const startedAt = TODAY * DAY_LEN + 1800;

  it("signs attest_completion with the attestor key and confirms it", async () => {
    const commitment = await vault.addCommitment(user, TODAY, { goalTarget: 20 });
    const { signature } = await adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 22, sessionHash: hash, sessionStartedAt: startedAt });
    expect(signature).toBe(vault.sent[0].signature);
    expect(vault.sent[0]).toMatchObject({ kind: "attest", days: [TODAY], users: [user] });
    expect(vault.commitment(commitment)).toMatchObject({ status: 1, reps: 22 });
    expect(vault.priorityFeeCalls).toBe(1);
  });

  it("is idempotent: a retry after it landed returns the landed signature", async () => {
    await vault.addCommitment(user, TODAY);
    const first = await adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 20, sessionHash: hash, sessionStartedAt: startedAt });
    const again = await adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 20, sessionHash: hash, sessionStartedAt: startedAt });
    expect(again.signature).toBe(first.signature);
    expect(vault.sent).toHaveLength(1);
  });

  it("never sends a transaction bound to fail", async () => {
    await vault.addCommitment(user, TODAY, { goalTarget: 30 });
    await expect(
      adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 29, sessionHash: hash, sessionStartedAt: startedAt }),
    ).rejects.toThrow(/below your goal/);
    await expect(
      adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 30, sessionHash: hash, sessionStartedAt: startedAt - DAY_LEN }),
    ).rejects.toThrow(/not inside this pool day/);
    expect(vault.sent).toHaveLength(0);
  });

  it("refuses when ATTESTOR_KEYPAIR is not the pool's attestor", async () => {
    await vault.addCommitment(user, TODAY);
    const other = await generateKeyPairSigner();
    const wrong = createVaultOnchain({ context: async () => ({ ...vault.context(), signer: other }), now: () => vault.nowSecs * 1000 });
    await expect(
      wrong.submitAttestation({ wallet: user, dayIndex: TODAY, reps: 20, sessionHash: hash, sessionStartedAt: startedAt }),
    ).rejects.toThrow(/not the pool's attestor/);
    expect(vault.sent).toHaveLength(0);
  });

  it("maps program errors to plain copy", async () => {
    await vault.addCommitment(user, TODAY);
    vault.failNextWith = 6008;
    await expect(
      adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 20, sessionHash: hash, sessionStartedAt: startedAt }),
    ).rejects.toThrow(/verification window for this day has closed/);
    vault.failOnChainWith = 6000;
    await expect(
      adapter().submitAttestation({ wallet: user, dayIndex: TODAY, reps: 20, sessionHash: hash, sessionStartedAt: startedAt }),
    ).rejects.toThrow(/paused/);
  });
});
