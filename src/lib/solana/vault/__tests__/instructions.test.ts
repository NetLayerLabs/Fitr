import { describe, expect, it } from "vitest";
import {
  address,
  compileTransactionMessage,
  createNoopSigner,
  getAddressEncoder,
  getU32Encoder,
  getU64Encoder,
  type Blockhash,
} from "@solana/kit";
import { COMPUTE_BUDGET_PROGRAM_ADDRESS } from "@solana-program/compute-budget";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getPoolAddresses, getDeviceLockAddress, getUserDayAddresses } from "../addresses";
import {
  CLAIM_DISCRIMINATOR,
  CLOSE_MISSED_DISCRIMINATOR,
  COMMIT_DISCRIMINATOR,
  Exercise,
  FINALIZE_DAY_DISCRIMINATOR,
  FITR_VAULT_PROGRAM_ADDRESS,
  REGISTER_DEVICE_DISCRIMINATOR,
} from "../generated";
import {
  buildAttestIx,
  buildCommitIx,
  buildDailyLoopIxs,
  composeUserTransaction,
  computeUnitLimitFromSimulation,
  estimateComputeUnits,
  signerAddresses,
  userTokenAccount,
} from "../instructions";
import { D0, MINT, USER } from "./fixtures";

const user = createNoopSigner(USER);
const SGT = {
  mint: address("3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q"),
  tokenAccount: address("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj"),
};
const commit = { dayIndex: D0, amount: 25_000_000n, exercise: Exercise.Plank, goalTarget: 90 };

function startsWith(data: ArrayLike<number>, prefix: ArrayLike<number>) {
  return Array.from(data).slice(0, prefix.length).join() === Array.from(prefix).join();
}

describe("commit instruction", () => {
  it("encodes discriminator + u32 day + u64 amount + u8 exercise + u32 goal", async () => {
    const ix = await buildCommitIx({ user, mint: MINT, ...commit });
    const data = ix.data!;
    expect(data.length).toBe(8 + 4 + 8 + 1 + 4);
    expect(startsWith(data, COMMIT_DISCRIMINATOR)).toBe(true);
    expect(Array.from(data.slice(8, 12))).toEqual(Array.from(getU32Encoder().encode(D0)));
    expect(Array.from(data.slice(12, 20))).toEqual(Array.from(getU64Encoder().encode(25_000_000n)));
    expect(data[20]).toBe(2); // Plank
    expect(Array.from(data.slice(21, 25))).toEqual(Array.from(getU32Encoder().encode(90)));
  });

  it("derives pool/vault/day/commitment/profile and the user's ATA; SGT slots = program id when off", async () => {
    const ix = await buildCommitIx({ user, mint: MINT, ...commit });
    const { pool, vault } = await getPoolAddresses(MINT);
    const u = await getUserDayAddresses({ pool, user: USER, dayIndex: D0 });
    const keys = ix.accounts!.map((a) => a.address);
    expect(keys).toEqual([
      USER,
      pool,
      MINT,
      await userTokenAccount(USER, MINT),
      vault,
      u.day,
      u.commitment,
      u.profile,
      FITR_VAULT_PROGRAM_ADDRESS,
      FITR_VAULT_PROGRAM_ADDRESS,
      TOKEN_PROGRAM_ADDRESS,
      address("11111111111111111111111111111111"),
    ]);
    expect(signerAddresses([ix])).toEqual([USER]);
  });

  it("SGT path fills the token account and the DeviceLock PDA", async () => {
    const { pool } = await getPoolAddresses(MINT);
    const device = await getDeviceLockAddress(pool, SGT.mint);
    const ix = await buildCommitIx({ user, mint: MINT, ...commit, sgt: SGT, deviceLock: device });
    expect(ix.accounts![8].address).toBe(SGT.tokenAccount);
    expect(ix.accounts![9].address).toBe(device);
    await expect(buildCommitIx({ user, mint: MINT, ...commit, sgt: SGT })).rejects.toThrow(/DeviceLock/);
  });
});

describe("daily loop composition", () => {
  it("[finalize(d−1), claim(d−1), register_device, commit(d)] with the user as the ONLY signer", async () => {
    const ixs = await buildDailyLoopIxs({
      user,
      mint: MINT,
      settle: { day: D0 - 1, kind: "claim", needsFinalize: true },
      commit,
      sgt: SGT,
      registerDevice: true,
    });
    const discs = [FINALIZE_DAY_DISCRIMINATOR, CLAIM_DISCRIMINATOR, REGISTER_DEVICE_DISCRIMINATOR, COMMIT_DISCRIMINATOR];
    expect(ixs).toHaveLength(4);
    ixs.forEach((ix, i) => expect(startsWith(ix.data!, discs[i])).toBe(true));
    expect(Array.from(ixs[1].data!.slice(8, 12))).toEqual(Array.from(getU32Encoder().encode(D0 - 1)));
    expect(signerAddresses(ixs)).toEqual([USER]);
    expect(ixs.every((ix) => ix.programAddress === FITR_VAULT_PROGRAM_ADDRESS)).toBe(true);
  });

  it("[close_missed(d−1), commit(d)] after a miss; claim-only and commit-only variants", async () => {
    const missed = await buildDailyLoopIxs({ user, mint: MINT, settle: { day: D0 - 1, kind: "close_missed", needsFinalize: false }, commit });
    expect(missed.map((ix) => startsWith(ix.data!, CLOSE_MISSED_DISCRIMINATOR))).toEqual([true, false]);
    // close_missed: cranker (signer) = user, user account = user.
    expect(missed[0].accounts![0]).toMatchObject({ address: USER });
    expect(missed[0].accounts![2]).toMatchObject({ address: USER });

    expect(await buildDailyLoopIxs({ user, mint: MINT, settle: { day: 1, kind: "claim", needsFinalize: false } })).toHaveLength(1);
    expect(await buildDailyLoopIxs({ user, mint: MINT, commit })).toHaveLength(1);
    await expect(buildDailyLoopIxs({ user, mint: MINT })).rejects.toThrow();
  });

  it("composes a v0 message with the wallet as fee payer and exactly one required signature", async () => {
    const ixs = await buildDailyLoopIxs({ user, mint: MINT, settle: { day: D0 - 1, kind: "claim", needsFinalize: false }, commit });
    const msg = composeUserTransaction({
      feePayer: user,
      latestBlockhash: { blockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn" as Blockhash, lastValidBlockHeight: 100n },
      ixs,
      unitLimit: 120_000,
      microLamportsPerCu: 20_000n,
    });
    expect(msg.feePayer.address).toBe(USER);
    expect(msg.instructions[0].programAddress).toBe(COMPUTE_BUDGET_PROGRAM_ADDRESS);
    expect(msg.instructions[1].programAddress).toBe(COMPUTE_BUDGET_PROGRAM_ADDRESS);
    const compiled = compileTransactionMessage(msg);
    expect(compiled.header.numSignerAccounts).toBe(1);
    expect(compiled.staticAccounts[0]).toBe(USER);

    const noPrice = composeUserTransaction({
      feePayer: user,
      latestBlockhash: { blockhash: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZAMdL4VZHirAn" as Blockhash, lastValidBlockHeight: 1n },
      ixs,
      unitLimit: 120_000,
      microLamportsPerCu: 0n,
    });
    expect(noPrice.instructions).toHaveLength(ixs.length + 1);
  });
});

describe("compute units", () => {
  it("floors at 120k (SPEC §4) and grows with bundled work", () => {
    expect(estimateComputeUnits({ commit })).toBe(120_000);
    expect(
      estimateComputeUnits({ settle: { day: 1, kind: "claim", needsFinalize: true }, commit, registerDevice: true }),
    ).toBe(Math.ceil((10_200 + 31_100 + 58_700 + 21_200) * 1.2));
  });

  it("right-sizes from simulation", () => {
    expect(computeUnitLimitFromSimulation(89_661n, 120_000)).toBe(107_594);
    expect(computeUnitLimitFromSimulation(10n, 120_000)).toBe(50_000);
    expect(computeUnitLimitFromSimulation(0n, 120_000)).toBe(120_000);
    expect(computeUnitLimitFromSimulation(5_000_000, 1)).toBe(1_400_000);
  });
});

describe("attest instruction (server)", () => {
  it("has the attestor as its only signer and rejects bad hashes", async () => {
    const attestor = createNoopSigner(address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te"));
    const { pool } = await getPoolAddresses(MINT);
    const ix = await buildAttestIx({ attestor, pool, user: USER, dayIndex: D0, reps: 21, sessionHash: new Uint8Array(32), sessionStartedAt: 1 });
    expect(signerAddresses([ix])).toEqual([attestor.address]);
    expect(ix.accounts!.some((a) => a.address === USER)).toBe(true);
    await expect(
      buildAttestIx({ attestor, pool, user: USER, dayIndex: D0, reps: 1, sessionHash: new Uint8Array(31), sessionStartedAt: 1 }),
    ).rejects.toThrow(/32 bytes/);
    expect(getAddressEncoder().encode(USER)).toHaveLength(32);
  });
});
