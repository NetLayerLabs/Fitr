/** Shared vault test fixtures: mainnet-parameter Pool, DayState and Commitment values. */
import { address, type Address } from "@solana/kit";
import {
  CommitmentStatus,
  Exercise,
  getCommitmentDiscriminatorBytes,
  getDayStateDiscriminatorBytes,
  getPoolDiscriminatorBytes,
  type Commitment,
  type DayState,
  type Pool,
} from "../generated";

export const MINT = address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
export const USER = address("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
export const ZERO = address("11111111111111111111111111111111");
/** 2026-09-25T00:00:00Z: day 20721 on a 24 h, offset-0 pool (math.rs golden value). */
export const T0 = 1_790_294_400;
export const D0 = 20_721;

/** SPEC §2.6 mainnet minimums, in code order. */
export const MAINNET_MINS = [10, 15, 30, 10, 10, 10, 10, 30, 5, 10, 3, 5, 5, 20, 20, 20];
export const CEILINGS = [1000, 1000, 3600, 1000, 1000, 1000, 1000, 3600, 1000, 1000, 1000, 1000, 1000, 3000, 3000, 3000];

export function makePool(over: Partial<Pool> = {}): Pool {
  return {
    discriminator: getPoolDiscriminatorBytes(),
    version: 1,
    bump: 255,
    vaultBump: 254,
    paused: false,
    requireSgt: true,
    mintDecimals: 6,
    authority: ZERO,
    pendingAuthority: ZERO,
    attestor: ZERO,
    mint: MINT,
    vault: ZERO,
    dayLengthSecs: 86_400n,
    dayOffsetSecs: 0n,
    commitCutoffSecs: 64_800n,
    attestGraceSecs: 3_600n,
    minStake: 1_000_000n,
    maxStake: 10_000_000_000n,
    feeBps: 500,
    streakBonusBps: 500,
    maxStreakBonusBps: 5_000,
    goalLimits: MAINNET_MINS.map((min, i) => ({ min, max: CEILINGS[i] })),
    dailySponsorAmount: 0n,
    reserve: 0n,
    treasuryAccrued: 0n,
    outstanding: 0n,
    finalizeDelaySecs: 0n,
    pausedSince: 0n,
    totalPausedSecs: 0n,
    crewId: 0n,
    creator: ZERO,
    name: new Uint8Array(32),
    hasFixedExercise: false,
    fixedExercise: Exercise.Pushup,
    fixedGoalTarget: 0,
    rollover: 0n,
    reserved: new Uint8Array(56),
    ...over,
  };
}

export function makeDayState(day: number, over: Partial<DayState> = {}, pool: Address = ZERO): DayState {
  return {
    discriminator: getDayStateDiscriminatorBytes(),
    version: 1,
    bump: 255,
    finalized: false,
    voided: false,
    pool,
    dayIndex: day,
    rentPayer: USER,
    feeBps: 500,
    streakBonusBps: 500,
    maxStreakBonusBps: 5_000,
    attestDeadline: BigInt((day + 1) * 86_400 + 3_600),
    committedCount: 3,
    completedCount: 2,
    resolvedCount: 0,
    totalStaked: 300_000_000n,
    completedStake: 200_000_000n,
    completedWeight: 200_000_000n,
    fee: 0n,
    sponsor: 0n,
    distributable: 0n,
    principalPaid: 0n,
    bonusPaid: 0n,
    attestor: ZERO,
    sponsorCap: 0n,
    finalizeDelaySecs: 0n,
    pausedSecsBase: 0n,
    revokedCount: 0,
    revokedStake: 0n,
    globalPausedSecsBase: 0n,
    rollover: 0n,
    reserved: new Uint8Array(16),
    ...over,
  };
}

export function makeCommitment(day: number, over: Partial<Commitment> = {}, pool: Address = ZERO): Commitment {
  return {
    discriminator: getCommitmentDiscriminatorBytes(),
    bump: 255,
    status: CommitmentStatus.Committed,
    pool,
    user: USER,
    dayIndex: day,
    version: 1,
    exercise: Exercise.Pushup,
    goalTarget: 20,
    amount: 100_000_000n,
    weight: 0n,
    committedAt: BigInt(day * 86_400 + 100),
    attestedAt: 0n,
    sessionStartedAt: 0n,
    reps: 0,
    sessionHash: new Uint8Array(32),
    device: ZERO,
    reserved: new Uint8Array(32),
    ...over,
  };
}
