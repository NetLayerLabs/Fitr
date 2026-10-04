use crate::constants::EXERCISE_COUNT;
use crate::state::{Exercise, GoalLimits};
use anchor_lang::prelude::*;

#[event]
pub struct PoolInitialized {
    pub pool: Pubkey,
    pub mint: Pubkey,
    pub authority: Pubkey,
    pub attestor: Pubkey,
    pub min_stake: u64,
    pub max_stake: u64,
    pub fee_bps: u16,
    pub day_length_secs: i64,
    pub day_offset_secs: i64,
    pub require_sgt: bool,
}

/// Emitted with the full post-update configuration.
#[event]
pub struct ConfigUpdated {
    pub pool: Pubkey,
    pub attestor: Pubkey,
    pub min_stake: u64,
    pub max_stake: u64,
    pub fee_bps: u16,
    pub streak_bonus_bps: u16,
    pub max_streak_bonus_bps: u16,
    pub commit_cutoff_secs: i64,
    pub attest_grace_secs: i64,
    pub goal_limits: [GoalLimits; EXERCISE_COUNT],
    pub daily_sponsor_amount: u64,
    pub paused: bool,
    pub require_sgt: bool,
    pub finalize_delay_secs: i64,
}

#[event]
pub struct AuthorityProposed {
    pub pool: Pubkey,
    pub authority: Pubkey,
    /// Pubkey::default() = proposal cancelled.
    pub pending_authority: Pubkey,
}

#[event]
pub struct AuthorityTransferred {
    pub pool: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct DeviceRegistered {
    pub pool: Pubkey,
    pub sgt_mint: Pubkey,
    pub wallet: Pubkey,
}

#[event]
pub struct Committed {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    pub amount: u64,
    pub exercise: Exercise,
    /// Reps (push-ups/squats) or seconds (plank).
    pub goal_target: u32,
    pub device: Pubkey,
}

#[event]
pub struct CompletionAttested {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    pub exercise: Exercise,
    pub goal_target: u32,
    /// Reps (push-ups/squats) or seconds (plank); always >= goal_target.
    pub reps: u32,
    pub session_hash: [u8; 32],
    pub weight: u64,
    pub streak: u16,
}

#[event]
pub struct CompletionRevoked {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    pub by: Pubkey,
}

#[event]
pub struct DayFinalized {
    pub pool: Pubkey,
    pub day_index: u32,
    pub total_staked: u64,
    pub completed_stake: u64,
    /// Stake of revoked commitments: refunded, never forfeited.
    pub revoked_stake: u64,
    pub slashed: u64,
    pub fee: u64,
    /// Drawn from the reserve into this day's bonus pool (sponsored amount; 0 when unsponsored).
    pub sponsor: u64,
    pub distributable: u64,
    /// Global pool, nobody completed: net forfeit moved to the reserve.
    pub to_reserve: u64,
    /// Crews: rollover released into this day's bonus pool (included in `distributable`).
    pub rollover_in: u64,
    /// Crews, nobody completed: net forfeit moved to the crew rollover.
    pub to_rollover: u64,
}

#[event]
pub struct DayVoided {
    pub pool: Pubkey,
    pub day_index: u32,
}

#[event]
pub struct Claimed {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    pub principal: u64,
    pub bonus: u64,
}

#[event]
pub struct MissedSettled {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    pub slashed: u64,
}

#[event]
pub struct DaySwept {
    pub pool: Pubkey,
    pub day_index: u32,
    pub dust: u64,
}

/// A sponsor deposit ("sponsored days"). Works on any pool, global or crew. The reserve is only
/// drawn through each finalized day's sponsor_cap snapshot (pool.daily_sponsor_amount when the day
/// was created, <= max_stake), and only on days with at least one completer; DayFinalized.sponsor
/// is the amount a given day actually received.
#[event]
pub struct ReserveFunded {
    pub pool: Pubkey,
    pub funder: Pubkey,
    pub amount: u64,
    /// The pool's crew_id (0 = global pool).
    pub crew_id: u64,
    /// Reserve after this deposit.
    pub reserve: u64,
    /// The pool's current per-day sponsor draw (0 = deposits are not drawn until the authority
    /// opens the tap with update_config).
    pub daily_sponsor_amount: u64,
}

#[event]
pub struct CrewCreated {
    /// The crew's pool PDA ["pool", mint, crew_id LE].
    pub pool: Pubkey,
    /// The global pool the config was copied from.
    pub global_pool: Pubkey,
    pub crew_id: u64,
    pub creator: Pubkey,
    pub name: [u8; 32],
    pub exercise: Option<Exercise>,
    pub goal_target: Option<u32>,
}

#[event]
pub struct TreasuryWithdrawn {
    pub pool: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
}

/// sync_crew: the crew now mirrors the global pool's trust settings.
#[event]
pub struct CrewSynced {
    pub pool: Pubkey,
    pub crew_id: u64,
    pub authority: Pubkey,
    pub attestor: Pubkey,
    pub require_sgt: bool,
}
