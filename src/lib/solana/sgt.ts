/**
 * Seeker Genesis Token (SGT) check. Pure and shared (server routes, attestor, tests).
 *
 * Rules (vault brief §2.6, mirroring the onchain `token_checks.rs` and Solana Mobile's rule):
 * - the mint is owned by Token-2022;
 * - its TokenGroupMember extension has group == SGT_GROUP and mint == the mint itself
 *   (this carries the guarantee: only the group's update authority can add members);
 * - its MetadataPointer.metadataAddress == SGT_GROUP;
 * - the owner's token account holds exactly 1 (old zero-balance accounts stay open after a move).
 * Frozen token accounts are normal: real SGT accounts are always frozen.
 * SGTs exist only on mainnet, so callers always pass a mainnet RPC.
 */
import {
  address,
  getBase64Encoder,
  type Address,
  type GetMultipleAccountsApi,
  type GetTokenAccountsByOwnerApi,
  type Rpc,
} from "@solana/kit";
import { getMintDecoder, getTokenDecoder, TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { SGT_GROUP } from "./config";
import type { SeekerStatus } from "./types";

/** Upper bound on candidate mints checked per wallet (bounds upstream cost). */
export const MAX_SGT_CANDIDATES = 500;
const MULTIPLE_ACCOUNTS_CHUNK = 100;

/** True when `data` (raw mint account bytes, owned by `ownerProgram`) is a genuine SGT mint. */
export function isSeekerGenesisMint(mint: Address, data: Uint8Array, ownerProgram: Address): boolean {
  if (ownerProgram !== TOKEN_2022_PROGRAM_ADDRESS) return false;
  let decoded: ReturnType<ReturnType<typeof getMintDecoder>["decode"]>;
  try {
    decoded = getMintDecoder().decode(data);
  } catch {
    return false;
  }
  if (!decoded.isInitialized || decoded.extensions.__option !== "Some") return false;
  let memberOk = false;
  let pointerOk = false;
  for (const ext of decoded.extensions.value) {
    if (ext.__kind === "TokenGroupMember") {
      memberOk = ext.group === SGT_GROUP && ext.mint === mint;
    } else if (ext.__kind === "MetadataPointer") {
      pointerOk = ext.metadataAddress.__option === "Some" && ext.metadataAddress.value === SGT_GROUP;
    }
  }
  return memberOk && pointerOk;
}

/** Token account bytes → { mint, amount } when it is an initialized Token-2022 account of `owner`. */
export function decodeTokenAccount(data: Uint8Array, owner: Address): { mint: Address; amount: bigint } | null {
  try {
    const t = getTokenDecoder().decode(data);
    if (t.owner !== owner || t.state === 0) return null; // 0 = Uninitialized; 2 = Frozen is fine
    return { mint: t.mint, amount: t.amount };
  } catch {
    return null;
  }
}

function base64Bytes(data: unknown): Uint8Array | null {
  if (Array.isArray(data) && typeof data[0] === "string" && data[1] === "base64") {
    try {
      return new Uint8Array(getBase64Encoder().encode(data[0]));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Finds a genuine SGT held by `owner`: Token-2022 accounts with amount == 1, then the mints are
 * fetched with getMultipleAccounts and checked with isSeekerGenesisMint. RPC errors propagate.
 */
export async function findSeekerGenesisToken(
  rpc: Rpc<GetTokenAccountsByOwnerApi & GetMultipleAccountsApi>,
  owner: Address,
  opts: { now?: () => number; abortSignal?: AbortSignal } = {},
): Promise<SeekerStatus> {
  const now = opts.now ?? Date.now;
  const { value: accounts } = await rpc
    .getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ADDRESS }, { encoding: "base64" })
    .send({ abortSignal: opts.abortSignal });

  // mint -> token account holding exactly 1
  const candidates = new Map<Address, Address>();
  for (const { pubkey, account } of accounts) {
    if (account.owner !== TOKEN_2022_PROGRAM_ADDRESS) continue;
    const bytes = base64Bytes(account.data);
    if (!bytes) continue;
    const t = decodeTokenAccount(bytes, owner);
    if (!t || t.amount !== 1n || candidates.has(t.mint)) continue;
    candidates.set(t.mint, pubkey);
    if (candidates.size >= MAX_SGT_CANDIDATES) break;
  }

  const mints = [...candidates.keys()];
  for (let i = 0; i < mints.length; i += MULTIPLE_ACCOUNTS_CHUNK) {
    const chunk = mints.slice(i, i + MULTIPLE_ACCOUNTS_CHUNK);
    const { value: infos } = await rpc
      .getMultipleAccounts(chunk, { encoding: "base64" })
      .send({ abortSignal: opts.abortSignal });
    for (let j = 0; j < chunk.length; j++) {
      const info = infos[j];
      if (!info) continue;
      const bytes = base64Bytes(info.data);
      if (bytes && isSeekerGenesisMint(chunk[j], bytes, address(info.owner))) {
        return {
          owner,
          isSeeker: true,
          sgtMint: chunk[j],
          sgtTokenAccount: candidates.get(chunk[j]) ?? null,
          checkedAt: now(),
        };
      }
    }
  }
  return { owner, isSeeker: false, sgtMint: null, sgtTokenAccount: null, checkedAt: now() };
}
