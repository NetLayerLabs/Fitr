import { describe, expect, it, vi } from "vitest";
import { address, getBase64Decoder, type Address } from "@solana/kit";
import { AccountState, TOKEN_PROGRAM_ADDRESS, getTokenEncoder } from "@solana-program/token";
import { SKR_MAINNET_MINT } from "../config";
import { ApiRequestError, fetchSeekerStatus } from "../rpc";
import { SkrAccountError, fetchSkrBalance, fetchSolBalance, getSkrAta } from "../skr";

const OWNER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const OTHER = address("So11111111111111111111111111111111111111112");

function tokenData(mint: Address, owner: Address, amount: bigint): string {
  const bytes = getTokenEncoder().encode({
    mint,
    owner,
    amount,
    delegate: null,
    state: AccountState.Initialized,
    isNative: null,
    delegatedAmount: 0n,
    closeAuthority: null,
  });
  return getBase64Decoder().decode(bytes);
}

function fakeRpc(value: unknown) {
  const getAccountInfo = vi.fn(() => ({ send: () => Promise.resolve({ context: { slot: 1n }, value }) }));
  return { rpc: { getAccountInfo } as never, getAccountInfo };
}

function accountInfo(data: string, programOwner: Address = TOKEN_PROGRAM_ADDRESS) {
  return { data: [data, "base64"], executable: false, lamports: 2_039_280n, owner: programOwner, space: 165n, rentEpoch: 0n };
}

describe("getSkrAta", () => {
  it("derives a deterministic classic-SPL ATA", async () => {
    const a = await getSkrAta(OWNER, SKR_MAINNET_MINT);
    expect(await getSkrAta(OWNER, SKR_MAINNET_MINT)).toBe(a);
    expect(await getSkrAta(OTHER, SKR_MAINNET_MINT)).not.toBe(a);
  });
});

describe("fetchSkrBalance", () => {
  it("returns a zero, non-existent balance when the ATA is missing", async () => {
    const { rpc, getAccountInfo } = fakeRpc(null);
    const b = await fetchSkrBalance(rpc, OWNER, SKR_MAINNET_MINT);
    expect(b).toMatchObject({ owner: OWNER, mint: SKR_MAINNET_MINT, amount: 0n, decimals: 6, exists: false });
    expect(b.ata).toBe(await getSkrAta(OWNER, SKR_MAINNET_MINT));
    expect(getAccountInfo).toHaveBeenCalledWith(b.ata, expect.objectContaining({ encoding: "base64" }));
  });

  it("decodes the token amount", async () => {
    const { rpc } = fakeRpc(accountInfo(tokenData(SKR_MAINNET_MINT, OWNER, 123_456_789n)));
    const b = await fetchSkrBalance(rpc, OWNER, SKR_MAINNET_MINT);
    expect(b.amount).toBe(123_456_789n);
    expect(b.exists).toBe(true);
  });

  it("rejects accounts with the wrong program, mint or owner", async () => {
    await expect(
      fetchSkrBalance(fakeRpc(accountInfo(tokenData(SKR_MAINNET_MINT, OWNER, 1n), OTHER)).rpc, OWNER, SKR_MAINNET_MINT),
    ).rejects.toBeInstanceOf(SkrAccountError);
    await expect(
      fetchSkrBalance(fakeRpc(accountInfo(tokenData(OTHER, OWNER, 1n))).rpc, OWNER, SKR_MAINNET_MINT),
    ).rejects.toBeInstanceOf(SkrAccountError);
    await expect(
      fetchSkrBalance(fakeRpc(accountInfo(tokenData(SKR_MAINNET_MINT, OTHER, 1n))).rpc, OWNER, SKR_MAINNET_MINT),
    ).rejects.toBeInstanceOf(SkrAccountError);
  });
});

describe("fetchSolBalance", () => {
  it("returns lamports", async () => {
    const getBalance = vi.fn(() => ({ send: () => Promise.resolve({ context: { slot: 1n }, value: 42n }) }));
    expect(await fetchSolBalance({ getBalance } as never, OWNER)).toBe(42n);
    expect(getBalance).toHaveBeenCalledWith(OWNER, { commitment: "confirmed" });
  });
});

describe("fetchSeekerStatus", () => {
  const json = (status: number, body: unknown) =>
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })));

  it("calls GET /api/seeker?owner= and parses the response", async () => {
    const fetchImpl = json(200, { owner: OWNER, isSeeker: true, sgtMint: OTHER, sgtTokenAccount: null, checkedAt: 5 });
    const s = await fetchSeekerStatus(OWNER, { fetchImpl: fetchImpl as never });
    expect(s).toEqual({ owner: OWNER, isSeeker: true, sgtMint: OTHER, sgtTokenAccount: null, checkedAt: 5 });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/seeker?owner=${OWNER}`, expect.objectContaining({ method: "GET" }));
  });

  it("surfaces ApiError bodies", async () => {
    const fetchImpl = json(429, { error: "Slow down", code: "rate_limited", retryAfterSec: 3 });
    const err = await fetchSeekerStatus(OWNER, { fetchImpl: fetchImpl as never }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ message: "Slow down", code: "rate_limited", status: 429, retryAfterSec: 3 });
  });

  it("maps malformed and network failures", async () => {
    await expect(fetchSeekerStatus(OWNER, { fetchImpl: json(200, { nope: 1 }) as never })).rejects.toMatchObject({
      code: "bad_response",
    });
    await expect(fetchSeekerStatus(OWNER, { fetchImpl: json(500, "oops") as never })).rejects.toMatchObject({
      code: "bad_response",
      status: 500,
    });
    const offline = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(fetchSeekerStatus(OWNER, { fetchImpl: offline as never })).rejects.toMatchObject({ code: "network" });
  });
});
