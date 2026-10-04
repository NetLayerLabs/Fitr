import { describe, expect, it } from "vitest";
import { address, generateKeyPairSigner, getAddressEncoder, getBase58Encoder, getU64Encoder } from "@solana/kit";
import { FakeChain, PROGRAM } from "@/components/crews/__tests__/fakeChain";
import { getPoolAddresses } from "../addresses";
import {
  buildCreateCrewIx,
  commitmentsOfPoolDayFilters,
  commitmentsOfUserFilters,
  crewAppUrl,
  crewDisplayName,
  crewInfoFromPool,
  crewInvitePath,
  crewInviteUrl,
  crewLayoutSizesMatch,
  crewNameError,
  crewPath,
  dayStatesOfPoolFilters,
  decodeCrewName,
  encodeCrewName,
  fetchCrewBoard,
  fetchUserCrews,
  fetchUserTodayCommitments,
  GENERATED_CREW_ID_LIMIT,
  MAX_CREW_ID,
  parseCrewId,
  parseInviteInput,
  poolsByCreatorFilters,
  profilesOfPoolFilters,
  profilesOfUserFilters,
  randomCrewId,
} from "../crews";
import { fetchPool, fetchVaultSnapshot } from "../read";
import { buildDailyLoopIxs } from "../instructions";
import { CommitmentStatus, Exercise, getCreateCrewInstructionDataDecoder, getPoolEncoder } from "../generated";
import { D0, MINT, T0, USER, makePool } from "./fixtures";

const OTHER = address("Vote111111111111111111111111111111111111111");

describe("crew ids", () => {
  it("parses canonical decimal u64 ids only (0 is the global pool, never a crew)", () => {
    expect(parseCrewId("1")).toBe(1n);
    expect(parseCrewId(" 4503599627370495 ")).toBe(4503599627370495n);
    expect(parseCrewId(MAX_CREW_ID.toString())).toBe(MAX_CREW_ID);
    for (const bad of ["0", "", "01", "-1", "1.5", "1e3", "abc", "18446744073709551616", "999999999999999999999", null, undefined]) {
      expect(parseCrewId(bad as string)).toBeNull();
    }
  });

  it("random ids are non-zero and below 2^53", () => {
    const words = [
      [0, 0],
      [0, 0],
      [0xffff_ffff, 0xffff_ffff],
    ];
    let i = 0;
    const id = randomCrewId((a) => {
      a.set(words[i++] ?? [1, 2]);
      return a;
    });
    // The first two draws are 0 (retried); then the max 53-bit value.
    expect(id).toBe(GENERATED_CREW_ID_LIMIT - 1n);
    for (let k = 0; k < 50; k++) {
      const r = randomCrewId();
      expect(r > 0n && r < GENERATED_CREW_ID_LIMIT).toBe(true);
    }
  });
});

describe("invite links", () => {
  it("builds the public invite, the app link and the in-app path", () => {
    expect(crewInviteUrl(42n)).toBe("https://fitr.day/c/42");
    expect(crewInvitePath(42n)).toBe("/c/42");
    expect(crewAppUrl(42n)).toBe("https://app.fitr.day/crew/42");
    expect(crewPath(42n)).toBe("/crew/42");
  });

  it("finds the crew id in whatever was pasted", () => {
    const ok: Array<[string, bigint]> = [
      ["42", 42n],
      ["https://fitr.day/c/42", 42n],
      ["fitr.day/c/42", 42n],
      ["www.fitr.day/c/42/", 42n],
      ["https://fitr.day/c/42?utm=x#y", 42n],
      ["https://app.fitr.day/crew/42", 42n],
      ["/crew/42", 42n],
      ["/c/9007199254740991", 9007199254740991n],
      ["  Join me: https://fitr.day/c/7  ".trim().split(" ").pop()!, 7n],
    ];
    for (const [input, id] of ok) expect(parseInviteInput(input), input).toBe(id);
  });

  it("refuses other hosts, paths and malformed ids", () => {
    for (const bad of [
      "",
      "0",
      "https://evil.example/c/42",
      "https://fitr.day.evil.example/c/42",
      "https://fitr.day/crew",
      "https://fitr.day/c/0",
      "https://fitr.day/c/abc",
      "https://fitr.day/x/42",
      "javascript:alert(1)",
      "ftp://fitr.day/c/42",
      "x".repeat(600),
    ]) {
      expect(parseInviteInput(bad), bad).toBeNull();
    }
  });
});

describe("crew names", () => {
  it("encodes trimmed UTF-8, zero padded, and decodes back", () => {
    const bytes = encodeCrewName("  Run Club 🏃 ");
    expect(bytes.length).toBe(32);
    expect(decodeCrewName(bytes)).toBe("Run Club 🏃");
    expect(bytes[new TextEncoder().encode("Run Club 🏃").length]).toBe(0);
  });

  it("mirrors is_valid_crew_name: non-empty, ≤ 32 bytes, no NUL/control characters", () => {
    expect(crewNameError("Morning Movers")).toBeNull();
    expect(crewNameError("a".repeat(32))).toBeNull();
    expect(crewNameError("   ")).toMatch(/name/);
    expect(crewNameError("a".repeat(33))).toMatch(/too long/);
    expect(crewNameError("🏃".repeat(9))).toMatch(/too long/); // 36 bytes
    expect(crewNameError("a\u0000b")).not.toBeNull();
    expect(() => encodeCrewName("")).toThrow();
  });

  it("refuses and strips invisible / bidi characters", () => {
    expect(crewNameError("abc\u202Egnp.exe")).not.toBeNull();
    expect(crewNameError("a\u200Bb")).not.toBeNull();
    const raw = new Uint8Array(32);
    raw.set(new TextEncoder().encode(" Run\u202E Club\u200B "));
    expect(decodeCrewName(raw)).toBe("Run Club");
    // The zero-width joiner inside emoji sequences stays.
    expect(crewNameError("Runners 🏃\u200D\u2640\uFE0F")).toBeNull();
  });

  it("decodes invalid UTF-8 as empty and falls back to a display name", () => {
    const bad = new Uint8Array(32);
    bad.set([0xff, 0xfe]);
    expect(decodeCrewName(bad)).toBe("");
    expect(crewDisplayName({ crewId: 123456n, name: "" })).toBe("Crew 3456");
    expect(crewDisplayName({ crewId: 0n, name: "" })).toBe("Solo");
  });
});

describe("crewInfoFromPool", () => {
  it("reads the fixed challenge (goal 0 = members pick)", () => {
    const pool = makePool({ crewId: 9n, name: encodeCrewName("Squad"), hasFixedExercise: true, fixedExercise: Exercise.Squat, fixedGoalTarget: 30 });
    expect(crewInfoFromPool(pool, OTHER)).toMatchObject({ crewId: 9n, name: "Squad", fixedExercise: "squat", fixedGoal: 30, poolAddress: OTHER });
    const free = crewInfoFromPool(makePool({ crewId: 9n, hasFixedExercise: true, fixedExercise: Exercise.Plank, fixedGoalTarget: 0 }), OTHER);
    expect(free).toMatchObject({ fixedExercise: "plank", fixedGoal: null });
    const open = crewInfoFromPool(makePool({ crewId: 9n, fixedGoalTarget: 50 }), OTHER);
    expect(open).toMatchObject({ fixedExercise: null, fixedGoal: null });
  });
});

describe("getProgramAccounts filters (SPEC offsets)", () => {
  const b58 = getBase58Encoder();
  const bytes = (f: unknown) => b58.encode((f as { memcmp: { bytes: string } }).memcmp.bytes);
  const offset = (f: unknown) => Number((f as { memcmp: { offset: bigint } }).memcmp.offset);
  const size = (f: unknown) => Number((f as { dataSize: bigint }).dataSize);
  const addr = getAddressEncoder();

  it("uses the frozen sizes and offsets", () => {
    expect(crewLayoutSizesMatch()).toBe(true);
    const pools = poolsByCreatorFilters(MINT, USER);
    expect(size(pools[0])).toBe(554);
    expect([offset(pools[1]), offset(pools[2])]).toEqual([110, 420]);
    expect(bytes(pools[1])).toEqual(addr.encode(MINT));
    expect(bytes(pools[2])).toEqual(addr.encode(USER));

    const prof = profilesOfPoolFilters(OTHER);
    expect([size(prof[0]), offset(prof[1])]).toEqual([153, 10]);
    const profU = profilesOfUserFilters(USER);
    expect(offset(profU[1])).toBe(42);
    const days = dayStatesOfPoolFilters(OTHER);
    expect(offset(days[1])).toBe(12);
    const com = commitmentsOfUserFilters(USER);
    expect([size(com[0]), offset(com[1])]).toEqual([224, 42]);
    const comDay = commitmentsOfPoolDayFilters(OTHER, D0);
    expect([offset(comDay[1]), offset(comDay[2])]).toEqual([10, 74]);
  });

  it("the Pool crew_id sits at offset 412 (u64 LE)", () => {
    const data = getPoolEncoder().encode(makePool({ crewId: 0x0102030405n }));
    expect(Array.from(data.slice(412, 420))).toEqual(Array.from(getU64Encoder().encode(0x0102030405n)));
  });
});

describe("buildCreateCrewIx", () => {
  it("targets the crew PDA and encodes name, exercise and goal", async () => {
    const creator = await generateKeyPairSigner();
    const ix = await buildCreateCrewIx({ creator, mint: MINT, crewId: 77n, name: "Run Club", exercise: "pushup", goalTarget: 25, programAddress: PROGRAM });
    const { pool, vault } = await getPoolAddresses(MINT, PROGRAM, 77n);
    const { pool: global } = await getPoolAddresses(MINT, PROGRAM, 0n);
    const accs = ix.accounts!.map((a) => a.address);
    expect(accs[0]).toBe(creator.address);
    expect(accs).toContain(pool);
    expect(accs).toContain(vault);
    expect(accs).toContain(global);
    const data = getCreateCrewInstructionDataDecoder().decode(ix.data!);
    expect(data.crewId).toBe(77n);
    expect(decodeCrewName(data.name)).toBe("Run Club");
    expect(data.exercise).toEqual({ __option: "Some", value: Exercise.Pushup });
    expect(data.goalTarget).toEqual({ __option: "Some", value: 25 });
  });

  it("free crews pass None; rejects crew 0 and a goal without exercise", async () => {
    const creator = await generateKeyPairSigner();
    const ix = await buildCreateCrewIx({ creator, mint: MINT, crewId: 5n, name: "Free", exercise: null, goalTarget: null, programAddress: PROGRAM });
    const data = getCreateCrewInstructionDataDecoder().decode(ix.data!);
    expect(data.exercise).toEqual({ __option: "None" });
    expect(data.goalTarget).toEqual({ __option: "None" });
    await expect(buildCreateCrewIx({ creator, mint: MINT, crewId: 0n, name: "X", exercise: null, goalTarget: null })).rejects.toThrow();
    await expect(buildCreateCrewIx({ creator, mint: MINT, crewId: 3n, name: "X", exercise: null, goalTarget: 10 })).rejects.toThrow();
    await expect(buildCreateCrewIx({ creator, mint: MINT, crewId: 3n, name: " ", exercise: null, goalTarget: null })).rejects.toThrow();
  });
});

describe("crew pool in the daily loop and reads", () => {
  it("buildDailyLoopIxs commits into the crew pool", async () => {
    const user = await generateKeyPairSigner();
    const { pool } = await getPoolAddresses(MINT, PROGRAM, 12n);
    const { pool: global } = await getPoolAddresses(MINT, PROGRAM, 0n);
    const ixs = await buildDailyLoopIxs({
      user,
      mint: MINT,
      commit: { dayIndex: D0, amount: 1_000_000n, exercise: Exercise.Pushup, goalTarget: 20 },
      crewId: 12n,
      programAddress: PROGRAM,
    });
    const accs = ixs.flatMap((ix) => ix.accounts!.map((a) => a.address));
    expect(accs).toContain(pool);
    // the only reference to the global pool is commit's read-only global_pool (live pause /
    // attestor / SGT gate, SPEC §2.7), in the last slot
    expect(accs.filter((a) => a === global)).toHaveLength(1);
    expect(ixs.at(-1)!.accounts!.at(-1)!.address).toBe(global);
  });

  it("fetchPool / fetchVaultSnapshot read the crew; a missing crew is null", async () => {
    const chain = new FakeChain();
    await chain.pool(0n);
    const crew = await chain.pool(12n, { name: encodeCrewName("Twelve") });
    const found = await fetchPool(chain.rpc(), MINT, { programAddress: PROGRAM, crewId: 12n });
    expect(found?.poolAddress).toBe(crew);
    expect(await fetchPool(chain.rpc(), MINT, { programAddress: PROGRAM, crewId: 13n })).toBeNull();
    const snap = await fetchVaultSnapshot(chain.rpc(), { mint: MINT, user: USER, nowSecs: T0 + 100, crewId: 12n, programAddress: PROGRAM });
    expect(snap?.poolAddress).toBe(crew);
    expect(snap?.pool.crewId).toBe(12n);
  });
});

describe("fetchUserCrews", () => {
  it("joins crews with a profile, created crews and remembered ids; skips the global pool and other mints", async () => {
    const chain = new FakeChain();
    const global = await chain.pool(0n);
    const joined = await chain.pool(1n, { name: encodeCrewName("Bravo") });
    await chain.pool(2n, { name: encodeCrewName("Alpha"), creator: USER });
    await chain.pool(3n, { name: encodeCrewName("Charlie") });
    await chain.pool(4n, { name: encodeCrewName("Other mint"), mint: OTHER });
    await chain.profile(global, USER);
    await chain.profile(joined, USER);
    await chain.profile(joined, OTHER);

    const crews = await fetchUserCrews(chain.rpc(), { mint: MINT, user: USER, extraCrewIds: [3n, 99n, 0n], programAddress: PROGRAM });
    expect(crews.map((c) => [c.name, c.crewId])).toEqual([
      ["Alpha", 2n],
      ["Bravo", 1n],
      ["Charlie", 3n],
    ]);
  });
});

describe("fetchCrewBoard", () => {
  it("returns today's commitments, live days and profiles of that pool only", async () => {
    const chain = new FakeChain();
    const crew = await chain.pool(5n);
    const other = await chain.pool(6n);
    await chain.commitment(crew, USER, D0);
    await chain.commitment(crew, OTHER, D0, { status: CommitmentStatus.Completed });
    await chain.commitment(crew, USER, D0 - 1);
    await chain.commitment(other, USER, D0);
    await chain.day(crew, D0);
    await chain.day(crew, D0 - 1);
    await chain.day(other, D0);
    await chain.profile(crew, USER);
    await chain.profile(other, USER);

    const board = await fetchCrewBoard(chain.rpc(), { poolAddress: crew, today: D0, programAddress: PROGRAM });
    expect(board.today.map((c) => c.user).sort()).toEqual([OTHER, USER].sort());
    expect(board.days.map((d) => d.dayIndex).sort()).toEqual([D0 - 1, D0]);
    expect(board.profiles).toHaveLength(1);
  });

  it("drops accounts owned by another program", async () => {
    const chain = new FakeChain();
    const crew = await chain.pool(5n);
    const c = await chain.commitment(crew, USER, D0);
    chain.set(c, chain.accounts.get(c)!.data, OTHER);
    const board = await fetchCrewBoard(chain.rpc(), { poolAddress: crew, today: D0, programAddress: PROGRAM });
    expect(board.today).toHaveLength(0);
  });
});

describe("fetchUserTodayCommitments", () => {
  it("lists today's commitment in every pool of the mint, global first", async () => {
    const chain = new FakeChain();
    const global = await chain.pool(0n);
    const crew = await chain.pool(8n, { name: encodeCrewName("Eight") });
    const foreign = await chain.pool(9n, { mint: OTHER });
    await chain.commitment(crew, USER, D0, { exercise: Exercise.Squat });
    await chain.commitment(global, USER, D0);
    await chain.commitment(global, USER, D0 - 1);
    await chain.commitment(foreign, USER, D0);
    await chain.commitment(crew, OTHER, D0);

    const got = await fetchUserTodayCommitments(chain.rpc(), { mint: MINT, user: USER, nowSecs: T0 + 100, programAddress: PROGRAM });
    expect(got.map((g) => [g.crew.crewId, g.commitment.exercise])).toEqual([
      [0n, Exercise.Pushup],
      [8n, Exercise.Squat],
    ]);
    expect(got[1].crew.name).toBe("Eight");
  });
});
