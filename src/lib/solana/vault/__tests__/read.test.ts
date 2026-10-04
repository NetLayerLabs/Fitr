import { describe, expect, it } from "vitest";
import { address, getBase64Decoder, type Address, type ReadonlyUint8Array } from "@solana/kit";
import { getPoolAddresses, getUserDayAddresses, getDeviceLockAddress } from "../addresses";
import {
  CommitmentStatus,
  FITR_VAULT_PROGRAM_ADDRESS,
  getCommitmentEncoder,
  getDayStateEncoder,
  getDeviceLockDiscriminatorBytes,
  getDeviceLockEncoder,
  getPoolEncoder,
} from "../generated";
import { entryFor, fetchVaultSnapshot, type VaultRpc } from "../read";
import { D0, MINT, T0, USER, makeCommitment, makeDayState, makePool } from "./fixtures";

const b64 = getBase64Decoder();
const SGT_MINT = address("3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q");

function fakeRpc(accounts: Map<string, { data: ReadonlyUint8Array; owner: Address }>, calls: string[] = []) {
  const info = (a: string) => {
    const acc = accounts.get(a);
    if (!acc) return null;
    return {
      data: [b64.decode(acc.data), "base64"],
      executable: false,
      lamports: 1_000_000n,
      owner: acc.owner,
      space: BigInt(acc.data.length),
      rentEpoch: 0n,
    };
  };
  return {
    getAccountInfo: (a: string) => ({
      send: async () => {
        calls.push("getAccountInfo");
        return { context: { slot: 1n }, value: info(a) };
      },
    }),
    getMultipleAccounts: (as: string[]) => ({
      send: async () => {
        calls.push(`getMultipleAccounts:${as.length}`);
        return { context: { slot: 1n }, value: as.map(info) };
      },
    }),
  } as unknown as VaultRpc;
}

describe("fetchVaultSnapshot", () => {
  it("returns null when the pool does not exist (vault not deployed)", async () => {
    expect(await fetchVaultSnapshot(fakeRpc(new Map()), { mint: MINT, user: USER, nowSecs: T0 })).toBeNull();
  });

  it("ignores a pool-address account owned by another program", async () => {
    const { pool } = await getPoolAddresses(MINT);
    const m = new Map([[pool as string, { data: getPoolEncoder().encode(makePool()), owner: address("11111111111111111111111111111111") }]]);
    expect(await fetchVaultSnapshot(fakeRpc(m), { mint: MINT, user: USER, nowSecs: T0 })).toBeNull();
  });

  it("reads pool, profile-less user, today's day + commitment and the device lock in 2 calls", async () => {
    const owner = FITR_VAULT_PROGRAM_ADDRESS;
    const { pool } = await getPoolAddresses(MINT);
    const today = await getUserDayAddresses({ pool, user: USER, dayIndex: D0 });
    const yesterday = await getUserDayAddresses({ pool, user: USER, dayIndex: D0 - 1 });
    const device = await getDeviceLockAddress(pool, SGT_MINT);
    const m = new Map<string, { data: ReadonlyUint8Array; owner: Address }>([
      [pool, { data: getPoolEncoder().encode(makePool()), owner }],
      [today.day, { data: getDayStateEncoder().encode(makeDayState(D0, {}, pool)), owner }],
      [today.commitment, { data: getCommitmentEncoder().encode(makeCommitment(D0, {}, pool)), owner }],
      [yesterday.day, { data: getDayStateEncoder().encode(makeDayState(D0 - 1, { finalized: true }, pool)), owner }],
      [
        yesterday.commitment,
        { data: getCommitmentEncoder().encode(makeCommitment(D0 - 1, { status: CommitmentStatus.Completed }, pool)), owner },
      ],
      [
        device,
        {
          data: getDeviceLockEncoder().encode({
            version: 1,
            bump: 1,
            pool,
            sgtMint: SGT_MINT,
            lastWallet: USER,
            commitCount: 1,
            recentDays: [D0, 0],
            reserved: new Uint8Array(16),
          }),
          owner,
        },
      ],
    ]);
    const calls: string[] = [];
    const s = await fetchVaultSnapshot(fakeRpc(m, calls), { mint: MINT, user: USER, nowSecs: T0 + 100, days: 3, sgtMint: SGT_MINT });
    expect(s).not.toBeNull();
    expect(calls).toEqual(["getAccountInfo", `getMultipleAccounts:${1 + 2 * 5 + 1}`]);
    expect(s!.today).toBe(D0);
    expect(s!.entries.map((e) => e.day)).toEqual([D0 + 1, D0, D0 - 1, D0 - 2, D0 - 3]);
    expect(entryFor(s!, D0).commitment?.amount).toBe(100_000_000n);
    expect(entryFor(s!, D0 - 1).commitment?.status).toBe(CommitmentStatus.Completed);
    expect(entryFor(s!, D0 - 1).dayState?.finalized).toBe(true);
    expect(entryFor(s!, D0 + 1)).toEqual({ day: D0 + 1, commitment: null, dayState: null });
    expect(entryFor(s!, 5)).toEqual({ day: 5, commitment: null, dayState: null });
    expect(s!.profile).toBeNull();
    expect(s!.deviceLock?.sgtMint).toBe(SGT_MINT);
    expect(getDeviceLockDiscriminatorBytes()).toHaveLength(8);
  });

  it("without a user, only pool + day states are meaningful", async () => {
    const owner = FITR_VAULT_PROGRAM_ADDRESS;
    const { pool } = await getPoolAddresses(MINT);
    const today = await getUserDayAddresses({ pool, user: USER, dayIndex: D0 });
    const m = new Map<string, { data: ReadonlyUint8Array; owner: Address }>([
      [pool, { data: getPoolEncoder().encode(makePool()), owner }],
      [today.day, { data: getDayStateEncoder().encode(makeDayState(D0, { committedCount: 7 }, pool)), owner }],
      [today.commitment, { data: getCommitmentEncoder().encode(makeCommitment(D0, {}, pool)), owner }],
    ]);
    const s = await fetchVaultSnapshot(fakeRpc(m), { mint: MINT, user: null, nowSecs: T0 + 100, days: 1 });
    expect(entryFor(s!, D0).dayState?.committedCount).toBe(7);
    expect(s!.entries.every((e) => e.commitment === null)).toBe(true);
  });
});
