/**
 * Instruction builders over the generated client, plus transaction-message composition for the
 * user-facing flows (anchor/SPEC.md §4).
 *
 * User transactions have the wallet as the ONLY signer and the fee payer (what MWA
 * signAndSendTransaction needs). The permissionless finalize_day / close_missed are signed by the
 * user as "cranker" so the daily loop never waits on Fitr's crank. Pure: no network.
 */
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getDeviceLockAddress, getGlobalPoolAddress, getPoolAddresses, vaultProgramAddress } from "./addresses";
import {
  getAttestCompletionInstructionAsync,
  getClaimInstructionAsync,
  getCloseMissedInstructionAsync,
  getCommitInstructionAsync,
  getFinalizeDayInstructionAsync,
  getRegisterDeviceInstructionAsync,
  getSweepDayInstructionAsync,
  getSyncCrewInstruction,
  type Exercise,
} from "./generated";
import type { Settlement } from "./status";

export interface SgtAccounts {
  /** The Seeker Genesis Token mint (Token-2022). */
  mint: Address;
  /** The user's Token-2022 account holding it. */
  tokenAccount: Address;
}

/** Classic SPL ATA of `owner` for `mint` ($SKR and the devnet test mint are classic SPL). */
export async function userTokenAccount(owner: Address, mint: Address): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

export interface CommitIxParams {
  user: TransactionSigner;
  mint: Address;
  dayIndex: number;
  /** Base units, within [pool.minStake, pool.maxStake]. */
  amount: bigint;
  exercise: Exercise;
  /** Reps, or seconds for plank / wall sit; within pool.goalLimits[exercise]. */
  goalTarget: number;
  /** Source token account; default the user's ATA. */
  userToken?: Address;
  /** Required when pool.requireSgt. */
  sgt?: SgtAccounts | null;
  /** Required with `sgt`: the DeviceLock PDA ["device", pool, sgt.mint]. */
  deviceLock?: Address | null;
  programAddress?: Address;
  /** Target pool: 0 / omitted = the global pool, else a crew. */
  crewId?: bigint;
}

export async function buildCommitIx(p: CommitIxParams): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const { pool, vault } = await getPoolAddresses(p.mint, programAddress, p.crewId ?? 0n);
  if (p.sgt && !p.deviceLock) throw new Error("commit with an SGT needs its DeviceLock address");
  return getCommitInstructionAsync(
    {
      user: p.user,
      pool,
      mint: p.mint,
      userToken: p.userToken ?? (await userTokenAccount(p.user.address, p.mint)),
      vault,
      sgtToken: p.sgt?.tokenAccount,
      device: p.sgt ? (p.deviceLock ?? undefined) : undefined,
      dayIndex: p.dayIndex,
      amount: p.amount,
      exercise: p.exercise,
      goalTarget: p.goalTarget,
    },
    { programAddress },
  );
}

export interface ClaimIxParams {
  user: TransactionSigner;
  mint: Address;
  dayIndex: number;
  /** Payout destination; default the user's ATA. */
  userToken?: Address;
  programAddress?: Address;
  /** Pool to claim from: 0 / omitted = the global pool, else a crew. */
  crewId?: bigint;
}

export async function buildClaimIx(p: ClaimIxParams): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const { pool, vault } = await getPoolAddresses(p.mint, programAddress, p.crewId ?? 0n);
  return getClaimInstructionAsync(
    {
      user: p.user,
      pool,
      mint: p.mint,
      vault,
      userToken: p.userToken ?? (await userTokenAccount(p.user.address, p.mint)),
      dayIndex: p.dayIndex,
    },
    { programAddress },
  );
}

/**
 * finalize_day(d), permissionless: `cranker` only signs (and pays the fee). `globalPool` is the
 * global pool of the same mint (== `pool` for a global-pool day; see getGlobalPoolAddress).
 */
export async function buildFinalizeIx(p: {
  cranker: TransactionSigner;
  pool: Address;
  globalPool: Address;
  dayIndex: number;
  programAddress?: Address;
}): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getFinalizeDayInstructionAsync(
    { cranker: p.cranker, pool: p.pool, globalPool: p.globalPool, dayIndex: p.dayIndex },
    { programAddress },
  );
}

/**
 * sync_crew: permissionless crank copying the global pool's authority, attestor and require_sgt
 * into crew `pool` (SPEC §2.7). No signer besides the fee payer; batch several per transaction.
 */
export function buildSyncCrewIx(p: { pool: Address; globalPool: Address; programAddress?: Address }): Instruction {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getSyncCrewInstruction({ pool: p.pool, globalPool: p.globalPool }, { programAddress });
}

/** close_missed(d) for `user`; the user may sign alone as the cranker (rent comes back to them). */
export async function buildCloseMissedIx(p: {
  cranker: TransactionSigner;
  pool: Address;
  user: Address;
  dayIndex: number;
  programAddress?: Address;
}): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getCloseMissedInstructionAsync(
    { cranker: p.cranker, pool: p.pool, user: p.user, dayIndex: p.dayIndex },
    { programAddress },
  );
}

export async function buildSweepIx(p: {
  cranker: TransactionSigner;
  pool: Address;
  rentPayer: Address;
  dayIndex: number;
  programAddress?: Address;
}): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getSweepDayInstructionAsync(
    { cranker: p.cranker, pool: p.pool, rentPayer: p.rentPayer, dayIndex: p.dayIndex },
    { programAddress },
  );
}

/** register_device: binds an SGT to a DeviceLock (once per device, user pays the rent). */
export async function buildRegisterDeviceIx(p: {
  user: TransactionSigner;
  pool: Address;
  sgt: SgtAccounts;
  programAddress?: Address;
}): Promise<Instruction> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getRegisterDeviceInstructionAsync(
    { user: p.user, pool: p.pool, sgtMint: p.sgt.mint, sgtToken: p.sgt.tokenAccount },
    { programAddress },
  );
}

/** attest_completion (attestor server only). `globalPool`: see buildFinalizeIx. */
export async function buildAttestIx(p: {
  attestor: TransactionSigner;
  pool: Address;
  globalPool: Address;
  user: Address;
  dayIndex: number;
  reps: number;
  sessionHash: Uint8Array;
  sessionStartedAt: number;
  programAddress?: Address;
}): Promise<Instruction> {
  if (p.sessionHash.length !== 32) throw new Error("sessionHash must be 32 bytes");
  const programAddress = p.programAddress ?? vaultProgramAddress();
  return getAttestCompletionInstructionAsync(
    {
      attestor: p.attestor,
      pool: p.pool,
      globalPool: p.globalPool,
      user: p.user,
      dayIndex: p.dayIndex,
      reps: p.reps,
      sessionHash: p.sessionHash,
      sessionStartedAt: BigInt(p.sessionStartedAt),
    },
    { programAddress },
  );
}

/* ------------------------------------------------------------------------------------------ */
/* The daily loop                                                                              */
/* ------------------------------------------------------------------------------------------ */

export interface DailyLoopParams {
  user: TransactionSigner;
  mint: Address;
  /** Settle a past day first (claim or close_missed, optionally after finalize_day). */
  settle?: Settlement | null;
  /** Then commit (omit for a claim-only transaction). */
  commit?: Omit<CommitIxParams, "user" | "mint" | "sgt" | "deviceLock" | "programAddress" | "userToken" | "crewId"> | null;
  /** Required for commit when pool.requireSgt. */
  sgt?: SgtAccounts | null;
  /** Prepend register_device (no DeviceLock exists for this SGT yet). */
  registerDevice?: boolean;
  programAddress?: Address;
  /** The pool every instruction acts on: 0 / omitted = the global pool, else a crew. */
  crewId?: bigint;
}

/** [finalize?, claim | close_missed]?, [register_device?, commit]? — one signer, one signature. */
export async function buildDailyLoopIxs(p: DailyLoopParams): Promise<Instruction[]> {
  const programAddress = p.programAddress ?? vaultProgramAddress();
  const crewId = p.crewId ?? 0n;
  const { pool } = await getPoolAddresses(p.mint, programAddress, crewId);
  const userToken = await userTokenAccount(p.user.address, p.mint);
  const ixs: Instruction[] = [];

  if (p.settle) {
    const dayIndex = p.settle.day;
    if (p.settle.needsFinalize) {
      const globalPool = await getGlobalPoolAddress(p.mint, programAddress);
      ixs.push(await buildFinalizeIx({ cranker: p.user, pool, globalPool, dayIndex, programAddress }));
    }
    ixs.push(
      p.settle.kind === "claim"
        ? await buildClaimIx({ user: p.user, mint: p.mint, dayIndex, userToken, programAddress, crewId })
        : await buildCloseMissedIx({ cranker: p.user, pool, user: p.user.address, dayIndex, programAddress }),
    );
  }

  if (p.commit) {
    let deviceLock: Address | null = null;
    if (p.sgt) {
      deviceLock = await getDeviceLockAddress(pool, p.sgt.mint, programAddress);
      if (p.registerDevice) ixs.push(await buildRegisterDeviceIx({ user: p.user, pool, sgt: p.sgt, programAddress }));
    }
    ixs.push(
      await buildCommitIx({
        ...p.commit,
        user: p.user,
        mint: p.mint,
        userToken,
        sgt: p.sgt ?? null,
        deviceLock,
        programAddress,
        crewId,
      }),
    );
  }
  if (ixs.length === 0) throw new Error("nothing to do");
  return ixs;
}

/** Measured CU per instruction (anchor/SPEC.md §4, LiteSVM), rounded up. */
export const CU_ESTIMATES = {
  /** Worst case (fresh DayState + Profile, unlucky PDA bumps), measured up to 59,596. */
  commit: 60_000,
  claim: 31_100,
  closeMissed: 12_600,
  finalize: 16_100,
  registerDevice: 21_200,
} as const;

/** CU limit for a daily-loop transaction: measured sum × 1.2, at least 120,000 (SPEC §4). */
export function estimateComputeUnits(p: Pick<DailyLoopParams, "settle" | "commit" | "registerDevice">): number {
  let cu = 0;
  if (p.settle) {
    if (p.settle.needsFinalize) cu += CU_ESTIMATES.finalize;
    cu += p.settle.kind === "claim" ? CU_ESTIMATES.claim : CU_ESTIMATES.closeMissed;
  }
  if (p.commit) cu += CU_ESTIMATES.commit + (p.registerDevice ? CU_ESTIMATES.registerDevice : 0);
  return Math.max(120_000, Math.ceil(cu * 1.2));
}

/** From a simulation's unitsConsumed: +20 % headroom, never below 50k nor above 1.4M. */
export function computeUnitLimitFromSimulation(unitsConsumed: bigint | number, fallback: number): number {
  const units = Number(unitsConsumed);
  if (!Number.isFinite(units) || units <= 0) return fallback;
  return Math.min(1_400_000, Math.max(50_000, Math.ceil(units * 1.2)));
}

export function computeBudgetIxs(p: { unitLimit: number; microLamportsPerCu: bigint | number }): Instruction[] {
  const ixs: Instruction[] = [getSetComputeUnitLimitInstruction({ units: p.unitLimit })];
  const price = BigInt(p.microLamportsPerCu);
  if (price > 0n) ixs.push(getSetComputeUnitPriceInstruction({ microLamports: price }));
  return ixs;
}

/** v0 message: wallet = fee payer, compute budget first, then `ixs`. */
export function composeUserTransaction(p: {
  feePayer: TransactionSigner;
  latestBlockhash: { blockhash: Blockhash; lastValidBlockHeight: bigint };
  ixs: readonly Instruction[];
  unitLimit: number;
  microLamportsPerCu: bigint | number;
}) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(p.feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(p.latestBlockhash, m),
    (m) =>
      appendTransactionMessageInstructions(
        [...computeBudgetIxs({ unitLimit: p.unitLimit, microLamportsPerCu: p.microLamportsPerCu }), ...p.ixs],
        m,
      ),
  );
}

/** Every distinct signer address across `ixs` (role bit 0b10 = signer in kit's AccountRole). */
export function signerAddresses(ixs: readonly Instruction[]): Address[] {
  const out = new Set<Address>();
  for (const ix of ixs) {
    for (const meta of ix.accounts ?? []) {
      if ((meta.role & 0b10) !== 0) out.add(meta.address);
    }
  }
  return [...out];
}
