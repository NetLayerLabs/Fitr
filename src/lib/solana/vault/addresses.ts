/**
 * Vault PDAs and getProgramAccounts filters (layout frozen in anchor/SPEC.md §2.4). Pure.
 */
import {
  getAddressEncoder,
  getBase58Decoder,
  getU32Encoder,
  type Address,
  type Base58EncodedBytes,
  type GetProgramAccountsDatasizeFilter,
  type GetProgramAccountsMemcmpFilter,
} from "@solana/kit";
import { solanaConfig } from "../config";
import {
  findCommitmentPda,
  findDayPda,
  findDevicePda,
  findPoolPda,
  findProfilePda,
  findVaultPda,
  FITR_VAULT_PROGRAM_ADDRESS,
  getCommitmentSize,
} from "./generated";

/** The configured program id (NEXT_PUBLIC_VAULT_PROGRAM_ID override) or the generated constant. */
export function vaultProgramAddress(): Address {
  return solanaConfig.vaultProgramId ?? FITR_VAULT_PROGRAM_ADDRESS;
}

export async function getPoolAddresses(
  mint: Address,
  programAddress: Address = vaultProgramAddress(),
): Promise<{ pool: Address; vault: Address }> {
  const [pool] = await findPoolPda({ mint }, { programAddress });
  const [vault] = await findVaultPda({ pool }, { programAddress });
  return { pool, vault };
}

export async function getUserDayAddresses(p: {
  pool: Address;
  user: Address;
  dayIndex: number;
  programAddress?: Address;
}): Promise<{ day: Address; commitment: Address; profile: Address }> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const [[day], [commitment], [profile]] = await Promise.all([
    findDayPda({ pool: p.pool, dayIndex: p.dayIndex }, { programAddress }),
    findCommitmentPda({ pool: p.pool, user: p.user, dayIndex: p.dayIndex }, { programAddress }),
    findProfilePda({ pool: p.pool, user: p.user }, { programAddress }),
  ]);
  return { day, commitment, profile };
}

export async function getDayAddress(pool: Address, dayIndex: number, programAddress: Address = vaultProgramAddress()) {
  const [day] = await findDayPda({ pool, dayIndex }, { programAddress });
  return day;
}

export async function getDeviceLockAddress(
  pool: Address,
  sgtMint: Address,
  programAddress: Address = vaultProgramAddress(),
): Promise<Address> {
  const [device] = await findDevicePda({ pool, sgtMint }, { programAddress });
  return device;
}

/** Commitment byte offsets (SPEC §2.4, frozen). */
export const COMMITMENT_OFFSETS = { status: 9, pool: 10, user: 42, dayIndex: 74 } as const;
export const COMMITMENT_SIZE = 224;

type Filter = GetProgramAccountsDatasizeFilter | GetProgramAccountsMemcmpFilter;

const b58 = getBase58Decoder();

function memcmp(offset: number, bytes: Uint8Array | ReadonlyUint8ArrayLike): GetProgramAccountsMemcmpFilter {
  return {
    memcmp: { offset: BigInt(offset), bytes: b58.decode(bytes) as Base58EncodedBytes, encoding: "base58" },
  };
}
type ReadonlyUint8ArrayLike = ReturnType<ReturnType<typeof getU32Encoder>["encode"]>;

function sizeFilter(): GetProgramAccountsDatasizeFilter {
  // getCommitmentSize() includes the discriminator; keep the frozen constant as a cross-check.
  const size = getCommitmentSize();
  return { dataSize: BigInt(size === COMMITMENT_SIZE ? size : COMMITMENT_SIZE) };
}

/** All commitments of `pool` for `dayIndex`; `onlyUnattested` keeps status == Committed (crank). */
export function commitmentsForDayFilters(
  pool: Address,
  dayIndex: number,
  opts: { onlyUnattested?: boolean } = {},
): Filter[] {
  const filters: Filter[] = [
    sizeFilter(),
    memcmp(COMMITMENT_OFFSETS.pool, getAddressEncoder().encode(pool)),
    memcmp(COMMITMENT_OFFSETS.dayIndex, getU32Encoder().encode(dayIndex)),
  ];
  if (opts.onlyUnattested) filters.push(memcmp(COMMITMENT_OFFSETS.status, new Uint8Array([0])));
  return filters;
}

/** Every still-open commitment (any day) of `user` in `pool`; claimed/closed ones no longer exist. */
export function commitmentsForUserFilters(pool: Address, user: Address): Filter[] {
  return [
    sizeFilter(),
    memcmp(COMMITMENT_OFFSETS.pool, getAddressEncoder().encode(pool)),
    memcmp(COMMITMENT_OFFSETS.user, getAddressEncoder().encode(user)),
  ];
}
