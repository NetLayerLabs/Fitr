use anchor_lang::prelude::*;

pub const POOL_SEED: &[u8] = b"pool";
pub const VAULT_SEED: &[u8] = b"vault";
pub const DAY_SEED: &[u8] = b"day";
pub const COMMITMENT_SEED: &[u8] = b"commitment";
pub const PROFILE_SEED: &[u8] = b"profile";
pub const DEVICE_SEED: &[u8] = b"device";

/// Layout version written into every account this program creates.
/// A future program version that changes a layout bumps this and migrates lazily.
pub const ACCOUNT_VERSION: u8 = 1;

pub const SECONDS_PER_HOUR: i64 = 3_600;
pub const BPS_DENOM: u64 = 10_000;

// ---------------------------------------------------------------------------
// Hard-coded sanity limits. `initialize_pool` and `update_config` can never set
// a value outside these, whatever the authority signs.
// ---------------------------------------------------------------------------

/// Pool day length bounds. 86_400 on mainnet; short days (e.g. 600 s) exist so
/// localnet/devnet rehearsals run a full day in minutes. Immutable after init.
pub const MIN_DAY_LENGTH_SECS: i64 = 300;
pub const MAX_DAY_LENGTH_SECS: i64 = 86_400;

/// attest_grace_secs <= min(MAX_ATTEST_GRACE_SECS, day_length_secs).
pub const MAX_ATTEST_GRACE_SECS: i64 = 6 * SECONDS_PER_HOUR;

/// finalize_delay_secs <= min(MAX_FINALIZE_DELAY_SECS, day_length_secs). The delay is a review
/// window after the attest deadline: attest/revoke are closed, void_day is still open, and
/// finalize_day is not allowed yet (SPEC.md §3, §8).
pub const MAX_FINALIZE_DELAY_SECS: i64 = 12 * SECONDS_PER_HOUR;

/// Protocol cut of forfeited (slashed) stake. 20% ceiling; mainnet uses 500 (5%).
pub const MAX_FEE_BPS: u16 = 2_000;
/// Streak weight boost cap: weight is at most 2x the stake.
pub const MAX_STREAK_BONUS_BPS: u16 = 10_000;

/// Hard ceiling on a single stake, in WHOLE tokens (multiplied by 10^decimals at
/// validation time). 1,000,000 SKR = 1e12 base units at 6 decimals.
/// Rationale (SPEC.md §7): bounds per-wallet loss exposure to a program/attestor
/// failure and keeps one wallet from dwarfing a day's pool, while leaving about
/// 18,000x headroom below u64::MAX for per-day sums even at 9 decimals.
pub const MAX_STAKE_CEILING_TOKENS: u64 = 1_000_000;
/// Stake mints with more decimals are rejected (keeps the ceiling above in u64 range).
pub const MAX_MINT_DECIMALS: u8 = 9;

/// Per-exercise goal ceilings (see `Exercise::goal_ceiling`).
/// Reps for strength/rep exercises, seconds for timed holds (plank, wall sit).
pub const GOAL_REPS_CEILING: u32 = 1_000;
/// High-volume rep exercises where one rep is one limb movement (mountain climbers,
/// jumping jacks, high knees): a single session of a few thousand is plausible.
pub const GOAL_HIGH_VOLUME_REPS_CEILING: u32 = 3_000;
pub const GOAL_SECS_CEILING: u32 = 3_600;
/// Number of `Exercise` variants (length of `Pool.goal_limits`).
pub const EXERCISE_COUNT: usize = 16;

/// Seeker Genesis Token collection (Token-2022 group mint == metadata address).
/// Source: solana-mobile/solana-mobile-skills skills/seeker-genesis-token/references/sgt-verification.md
pub const SGT_GROUP: Pubkey = pubkey!("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
