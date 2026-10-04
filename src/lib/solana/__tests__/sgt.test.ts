import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { address, type Address } from "@solana/kit";
import { getMintDecoder, getMintEncoder, TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { describe, expect, test } from "vitest";
import { SGT_GROUP } from "../config";
import { decodeTokenAccount, findSeekerGenesisToken, isSeekerGenesisMint } from "../sgt";

// Real mainnet accounts: SGT mint #120999 and its (frozen, amount 1) holder account.
const SGT_MINT = address("3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q");
const SGT_ATA = address("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj");
const SGT_OWNER = address("6pwzDMzt4VU4SG2YGXnUf8HQtD88U4G2rJToYbDWSpWZ");
const OTHER = address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${name}.bin`, import.meta.url))));
}
const mintBytes = fixture(SGT_MINT);
const ataBytes = fixture(SGT_ATA);

type MintExt = Extract<ReturnType<ReturnType<typeof getMintDecoder>["decode"]>["extensions"], { __option: "Some" }>["value"][number];

/** Re-encodes the real mint with its extension list transformed. */
function counterfeit(transform: (exts: MintExt[]) => MintExt[]): Uint8Array {
  const m = getMintDecoder().decode(mintBytes);
  if (m.extensions.__option !== "Some") throw new Error("fixture has no extensions");
  return new Uint8Array(getMintEncoder().encode({ ...m, extensions: { __option: "Some", value: transform(m.extensions.value) } }));
}

describe("isSeekerGenesisMint", () => {
  test("the real mainnet SGT mint passes", () => {
    expect(isSeekerGenesisMint(SGT_MINT, mintBytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(true);
  });

  test("re-encoding without changes still passes (encoder sanity)", () => {
    expect(isSeekerGenesisMint(SGT_MINT, counterfeit((e) => e), TOKEN_2022_PROGRAM_ADDRESS)).toBe(true);
  });

  test("a counterfeit with a different group fails", () => {
    const bytes = counterfeit((exts) =>
      exts.map((e) => (e.__kind === "TokenGroupMember" ? { ...e, group: OTHER } : e)),
    );
    expect(isSeekerGenesisMint(SGT_MINT, bytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });

  test("a counterfeit without the group member extension fails", () => {
    const bytes = counterfeit((exts) => exts.filter((e) => e.__kind !== "TokenGroupMember"));
    expect(isSeekerGenesisMint(SGT_MINT, bytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });

  test("a counterfeit without the metadata pointer fails", () => {
    const bytes = counterfeit((exts) => exts.filter((e) => e.__kind !== "MetadataPointer"));
    expect(isSeekerGenesisMint(SGT_MINT, bytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });

  test("a metadata pointer to another address fails", () => {
    const bytes = counterfeit((exts) =>
      exts.map((e) =>
        e.__kind === "MetadataPointer" ? { ...e, metadataAddress: { __option: "Some" as const, value: OTHER } } : e,
      ),
    );
    expect(isSeekerGenesisMint(SGT_MINT, bytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });

  test("member.mint must be the mint itself (copied SGT data under another address fails)", () => {
    expect(isSeekerGenesisMint(OTHER, mintBytes, TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });

  test("a mint not owned by Token-2022 fails", () => {
    expect(isSeekerGenesisMint(SGT_MINT, mintBytes, TOKEN_PROGRAM_ADDRESS)).toBe(false);
  });

  test("garbage data fails without throwing", () => {
    expect(isSeekerGenesisMint(SGT_MINT, new Uint8Array(10), TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
    expect(isSeekerGenesisMint(SGT_MINT, mintBytes.slice(0, 82), TOKEN_2022_PROGRAM_ADDRESS)).toBe(false);
  });
});

describe("decodeTokenAccount", () => {
  test("the real frozen SGT account decodes with amount 1", () => {
    expect(decodeTokenAccount(ataBytes, SGT_OWNER)).toEqual({ mint: SGT_MINT, amount: 1n });
  });
  test("returns null for a different owner", () => {
    expect(decodeTokenAccount(ataBytes, OTHER)).toBeNull();
  });
});

// --- findSeekerGenesisToken with a fake RPC -----------------------------------------------------

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

interface FakeAccount {
  pubkey: Address;
  data: Uint8Array;
  owner: Address;
}

function fakeRpc(tokenAccounts: FakeAccount[], mints: Record<string, { data: Uint8Array; owner: Address } | null>) {
  const calls = { byOwner: 0, multiple: [] as string[][] };
  const acct = (data: Uint8Array, owner: Address) => ({
    data: [b64(data), "base64"] as const,
    owner,
    executable: false,
    lamports: 1n,
    space: BigInt(data.length),
    rentEpoch: 0n,
  });
  const rpc = {
    getTokenAccountsByOwner: () => ({
      send: async () => {
        calls.byOwner++;
        return {
          context: { slot: 1n },
          value: tokenAccounts.map((t) => ({ pubkey: t.pubkey, account: acct(t.data, t.owner) })),
        };
      },
    }),
    getMultipleAccounts: (keys: Address[]) => ({
      send: async () => {
        calls.multiple.push([...keys]);
        return {
          context: { slot: 1n },
          value: keys.map((k) => {
            const m = mints[k];
            return m ? acct(m.data, m.owner) : null;
          }),
        };
      },
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { rpc: rpc as any, calls };
}

describe("findSeekerGenesisToken", () => {
  test("finds the real SGT held by its real owner", async () => {
    const { rpc } = fakeRpc(
      [{ pubkey: SGT_ATA, data: ataBytes, owner: TOKEN_2022_PROGRAM_ADDRESS }],
      { [SGT_MINT]: { data: mintBytes, owner: TOKEN_2022_PROGRAM_ADDRESS } },
    );
    const s = await findSeekerGenesisToken(rpc, SGT_OWNER, { now: () => 42 });
    expect(s).toEqual({ owner: SGT_OWNER, isSeeker: true, sgtMint: SGT_MINT, sgtTokenAccount: SGT_ATA, checkedAt: 42 });
  });

  test("a counterfeit group member is not a Seeker", async () => {
    const fake = counterfeit((exts) =>
      exts.map((e) => (e.__kind === "TokenGroupMember" ? { ...e, group: OTHER } : e)),
    );
    const { rpc } = fakeRpc(
      [{ pubkey: SGT_ATA, data: ataBytes, owner: TOKEN_2022_PROGRAM_ADDRESS }],
      { [SGT_MINT]: { data: fake, owner: TOKEN_2022_PROGRAM_ADDRESS } },
    );
    const s = await findSeekerGenesisToken(rpc, SGT_OWNER, { now: () => 1 });
    expect(s.isSeeker).toBe(false);
    expect(s.sgtMint).toBeNull();
  });

  test("an empty (amount 0) SGT account does not count and the mint is not fetched", async () => {
    const empty = new Uint8Array(ataBytes);
    empty.fill(0, 64, 72); // amount u64 LE at offset 64
    const { rpc, calls } = fakeRpc(
      [{ pubkey: SGT_ATA, data: empty, owner: TOKEN_2022_PROGRAM_ADDRESS }],
      { [SGT_MINT]: { data: mintBytes, owner: TOKEN_2022_PROGRAM_ADDRESS } },
    );
    const s = await findSeekerGenesisToken(rpc, SGT_OWNER);
    expect(s.isSeeker).toBe(false);
    expect(calls.multiple).toHaveLength(0);
  });

  test("a wallet with no Token-2022 accounts is not a Seeker", async () => {
    const { rpc } = fakeRpc([], {});
    expect((await findSeekerGenesisToken(rpc, OTHER)).isSeeker).toBe(false);
  });

  test("the mint must be owned by Token-2022", async () => {
    const { rpc } = fakeRpc(
      [{ pubkey: SGT_ATA, data: ataBytes, owner: TOKEN_2022_PROGRAM_ADDRESS }],
      { [SGT_MINT]: { data: mintBytes, owner: TOKEN_PROGRAM_ADDRESS } },
    );
    expect((await findSeekerGenesisToken(rpc, SGT_OWNER)).isSeeker).toBe(false);
  });

  test("SGT_GROUP is the real group address", () => {
    expect(SGT_GROUP).toBe("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
  });
});
