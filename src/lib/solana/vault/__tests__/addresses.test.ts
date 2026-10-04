import { describe, expect, it } from "vitest";
import { getAddressEncoder, getBase58Encoder, getProgramDerivedAddress, getU32Encoder, getU64Encoder } from "@solana/kit";
import {
  COMMITMENT_OFFSETS,
  COMMITMENT_SIZE,
  commitmentsForDayFilters,
  commitmentsForUserFilters,
  getDayAddress,
  getDeviceLockAddress,
  getPoolAddresses,
  getUserDayAddresses,
  vaultProgramAddress,
} from "../addresses";
import { FITR_VAULT_PROGRAM_ADDRESS, getCommitmentEncoder, getPoolEncoder, getPoolSize } from "../generated";
import { MINT, USER, makeCommitment, makePool } from "./fixtures";

const enc = new TextEncoder();
const addr = getAddressEncoder();
const u32 = getU32Encoder();
const PROGRAM = FITR_VAULT_PROGRAM_ADDRESS;

async function pda(...seeds: Array<string | Uint8Array | ReturnType<typeof u32.encode>>) {
  const [a] = await getProgramDerivedAddress({
    programAddress: PROGRAM,
    seeds: seeds.map((s) => (typeof s === "string" ? enc.encode(s) : s)),
  });
  return a;
}

describe("vault PDAs equal manual derivations (ASCII seeds, u32 LE day)", () => {
  it("uses the generated program id by default", () => {
    expect(vaultProgramAddress()).toBe(PROGRAM);
  });

  it("pool, vault, day, commitment, profile, device", async () => {
    const { pool, vault } = await getPoolAddresses(MINT, PROGRAM);
    // global pool = crew 0: ["pool", mint, 0u64 LE]
    expect(pool).toBe(await pda("pool", addr.encode(MINT), new Uint8Array(8)));
    expect(vault).toBe(await pda("vault", addr.encode(pool)));

    const day = 20_721;
    const dayLe = u32.encode(day);
    expect(Array.from(dayLe)).toEqual([0xf1, 0x50, 0x00, 0x00]);
    const u = await getUserDayAddresses({ pool, user: USER, dayIndex: day, programAddress: PROGRAM });
    expect(u.day).toBe(await pda("day", addr.encode(pool), dayLe));
    expect(await getDayAddress(pool, day, PROGRAM)).toBe(u.day);
    expect(u.commitment).toBe(await pda("commitment", addr.encode(pool), addr.encode(USER), dayLe));
    expect(u.profile).toBe(await pda("profile", addr.encode(pool), addr.encode(USER)));
    expect(await getDeviceLockAddress(pool, MINT, PROGRAM)).toBe(await pda("device", addr.encode(pool), addr.encode(MINT)));
  });
});

describe("crew pools", () => {
  it("derive ['pool', mint, crewId u64 LE]; crewId 0 is the global pool", async () => {
    const global = await getPoolAddresses(MINT, PROGRAM);
    expect((await getPoolAddresses(MINT, PROGRAM, 0n)).pool).toBe(global.pool);
    expect((await getPoolAddresses(MINT, PROGRAM, 0)).pool).toBe(global.pool);
    const id = 0xc0ffee0012345678n;
    const crew = await getPoolAddresses(MINT, PROGRAM, id);
    const le = getU64Encoder().encode(id);
    expect(Array.from(le)).toEqual([0x78, 0x56, 0x34, 0x12, 0x00, 0xee, 0xff, 0xc0]);
    expect(crew.pool).toBe(await pda("pool", addr.encode(MINT), le));
    expect(crew.vault).toBe(await pda("vault", addr.encode(crew.pool)));
    expect(crew.pool).not.toBe(global.pool);
  });

  it("Pool layout: crew fields appended after total_paused_secs (SPEC §2.1)", () => {
    expect(getPoolSize()).toBe(554);
    const bytes = getPoolEncoder().encode(
      makePool({ crewId: 0x0102030405060708n, creator: USER, fixedGoalTarget: 0x0a0b0c0d, hasFixedExercise: true }),
    );
    expect(bytes.length).toBe(554);
    expect(Array.from(bytes.slice(110, 142))).toEqual(Array.from(addr.encode(MINT))); // mint unchanged
    expect(Array.from(bytes.slice(412, 420))).toEqual([8, 7, 6, 5, 4, 3, 2, 1]); // crew_id
    expect(Array.from(bytes.slice(420, 452))).toEqual(Array.from(addr.encode(USER))); // creator
    expect(bytes[484]).toBe(1); // has_fixed_exercise
    expect(Array.from(bytes.slice(486, 490))).toEqual([0x0d, 0x0c, 0x0b, 0x0a]); // fixed_goal_target
  });
});

describe("getProgramAccounts filters (SPEC §2.4 frozen offsets)", () => {
  it("offsets match the generated encoder", async () => {
    const { pool } = await getPoolAddresses(MINT, PROGRAM);
    const bytes = getCommitmentEncoder().encode({ ...makeCommitment(0x01020304, { pool, status: 1 }) });
    expect(bytes.length).toBe(COMMITMENT_SIZE);
    expect(bytes[COMMITMENT_OFFSETS.status]).toBe(1);
    expect(Array.from(bytes.slice(COMMITMENT_OFFSETS.pool, COMMITMENT_OFFSETS.pool + 32))).toEqual(Array.from(addr.encode(pool)));
    expect(Array.from(bytes.slice(COMMITMENT_OFFSETS.user, COMMITMENT_OFFSETS.user + 32))).toEqual(Array.from(addr.encode(USER)));
    expect(Array.from(bytes.slice(COMMITMENT_OFFSETS.dayIndex, COMMITMENT_OFFSETS.dayIndex + 4))).toEqual([4, 3, 2, 1]);
  });

  it("day filters: size, pool@10, day@74, optional status@9", async () => {
    const { pool } = await getPoolAddresses(MINT, PROGRAM);
    const f = commitmentsForDayFilters(pool, 20_721);
    expect(f).toHaveLength(3);
    expect(f[0]).toEqual({ dataSize: 224n });
    expect(f[1]).toMatchObject({ memcmp: { offset: 10n, bytes: pool, encoding: "base58" } });
    const dayFilter = f[2] as { memcmp: { offset: bigint; bytes: string } };
    expect(dayFilter.memcmp.offset).toBe(74n);
    expect(Array.from(getBase58Encoder().encode(dayFilter.memcmp.bytes))).toEqual([0xf1, 0x50, 0, 0]);

    const crank = commitmentsForDayFilters(pool, 1, { onlyUnattested: true });
    expect(crank[3]).toMatchObject({ memcmp: { offset: 9n } });
    expect(Array.from(getBase58Encoder().encode((crank[3] as { memcmp: { bytes: string } }).memcmp.bytes))).toEqual([0]);
  });

  it("user filters: pool@10, user@42", async () => {
    const { pool } = await getPoolAddresses(MINT, PROGRAM);
    const f = commitmentsForUserFilters(pool, USER);
    expect(f[1]).toMatchObject({ memcmp: { offset: 10n, bytes: pool } });
    expect(f[2]).toMatchObject({ memcmp: { offset: 42n, bytes: USER } });
  });
});
