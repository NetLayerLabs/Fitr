/**
 * $SKR (classic SPL Token, 6 decimals) and SOL balance reads. Pure functions over an injected RPC,
 * so they run the same against the /api/rpc proxy, a server RPC, or a fake in tests.
 *
 * Balance is read from the owner's associated token account (ATA) only. SKR held in a non-ATA
 * token account is not counted (wallets always use the ATA).
 */
import {
  fetchEncodedAccount,
  type Address,
  type GetAccountInfoApi,
  type GetBalanceApi,
  type Rpc,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS, findAssociatedTokenPda, getTokenDecoder } from "@solana-program/token";
import { tr } from "@/lib/i18n";
import { SKR_DECIMALS } from "./config";
import type { SkrBalance } from "./types";

/** ~0.005 SOL: below this, the wallet likely cannot pay fees + rent for a stake transaction. */
export const MIN_SOL_FOR_FEES_LAMPORTS = 5_000_000n;

export interface ReadOptions {
  abortSignal?: AbortSignal;
}

export async function getSkrAta(owner: Address, mint: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

export class SkrAccountError extends Error {}

/** A missing ATA is a zero balance (exists: false), not an error. */
export async function fetchSkrBalance(
  rpc: Rpc<GetAccountInfoApi>,
  owner: Address,
  mint: Address,
  opts: ReadOptions = {},
): Promise<SkrBalance> {
  const ata = await getSkrAta(owner, mint);
  const account = await fetchEncodedAccount(rpc, ata, { abortSignal: opts.abortSignal, commitment: "confirmed" });
  if (!account.exists) {
    return { owner, mint, ata, amount: 0n, decimals: SKR_DECIMALS, exists: false };
  }
  if (account.programAddress !== TOKEN_PROGRAM_ADDRESS) {
    throw new SkrAccountError(tr("wallet", "tokenAccountWrongProgram"));
  }
  const token = getTokenDecoder().decode(account.data);
  if (token.mint !== mint || token.owner !== owner) {
    throw new SkrAccountError(tr("wallet", "tokenAccountMismatch"));
  }
  return { owner, mint, ata, amount: token.amount, decimals: SKR_DECIMALS, exists: true };
}

/** Lamports. */
export async function fetchSolBalance(rpc: Rpc<GetBalanceApi>, owner: Address, opts: ReadOptions = {}): Promise<bigint> {
  const { value } = await rpc.getBalance(owner, { commitment: "confirmed" }).send({ abortSignal: opts.abortSignal });
  return value;
}
