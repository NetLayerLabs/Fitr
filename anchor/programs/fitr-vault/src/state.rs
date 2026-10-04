use crate::constants::*;
use crate::error::VaultError;
use crate::math;
use anchor_lang::prelude::*;

/// Exercise a commitment is for. Borsh-encoded as one byte (the variant index).
/// The order is FROZEN: codes are stored on-chain in Commitment.exercise and index
/// Pool.goal_limits. New exercises are only ever appended.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Exercise {
    Pushup,          // 0  reps
    Squat,           // 1  reps
    Plank,           // 2  seconds
    Lunge,           // 3  reps (each leg counts 1)
    Situp,           // 4  reps
    LegRaise,        // 5  reps
    GluteBridge,     // 6  reps
    WallSit,         // 7  seconds
    PikePushup,      // 8  reps
    JumpSquat,       // 9  reps
    Pullup,          // 10 reps
    Dip,             // 11 reps
    Burpee,          // 12 reps
    MountainClimber, // 13 reps (each knee drive counts 1)
    JumpingJack,     // 14 reps
    HighKnees,       // 15 reps (each knee counts 1)
}

impl Exercise {
    pub fn index(self) -> usize {
        self as usize
    }

    /// True for timed holds, whose goal and result are SECONDS rather than reps.
    pub fn is_timed(self) -> bool {
        matches!(self, Exercise::Plank | Exercise::WallSit)
    }

    /// Hard-coded ceiling for this exercise's goal (reps, or seconds for timed holds).
    pub fn goal_ceiling(self) -> u32 {
        match self {
            Exercise::Plank | Exercise::WallSit => GOAL_SECS_CEILING,
            Exercise::MountainClimber | Exercise::JumpingJack | Exercise::HighKnees => {
                GOAL_HIGH_VOLUME_REPS_CEILING
            }
            Exercise::Pushup
            | Exercise::Squat
            | Exercise::Lunge
            | Exercise::Situp
            | Exercise::LegRaise
            | Exercise::GluteBridge
            | Exercise::PikePushup
            | Exercise::JumpSquat
            | Exercise::Pullup
            | Exercise::Dip
            | Exercise::Burpee => GOAL_REPS_CEILING,
        }
    }

    pub const ALL: [Exercise; EXERCISE_COUNT] = [
        Exercise::Pushup,
        Exercise::Squat,
        Exercise::Plank,
        Exercise::Lunge,
        Exercise::Situp,
        Exercise::LegRaise,
        Exercise::GluteBridge,
        Exercise::WallSit,
        Exercise::PikePushup,
        Exercise::JumpSquat,
        Exercise::Pullup,
        Exercise::Dip,
        Exercise::Burpee,
        Exercise::MountainClimber,
        Exercise::JumpingJack,
        Exercise::HighKnees,
    ];
}

/// Inclusive goal bounds for one exercise (reps, or seconds for plank / wall sit).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug, Default)]
pub struct GoalLimits {
    pub min: u32,
    pub max: u32,
}

/// Global config + accounting. PDA: ["pool", mint]. One pool per stake mint.
#[account]
#[derive(InitSpace)]
pub struct Pool {
    /// Layout version (ACCOUNT_VERSION).
    pub version: u8,
    pub bump: u8,
    pub vault_bump: u8,
    /// Blocks commit, attest_completion, finalize_day and attestor-signed revoke_completion.
    /// Never blocks claim / close_missed / sweep. Time spent paused extends the attest window of
    /// every day that existed during the pause (see `paused_secs_total`).
    pub paused: bool,
    /// Require a Seeker Genesis Token (one commitment per device per day). true on mainnet.
    pub require_sgt: bool,
    pub mint_decimals: u8,
    pub authority: Pubkey,
    /// Pubkey::default() when no transfer is pending.
    pub pending_authority: Pubkey,
    /// Off-chain verifier key, snapshotted into each DayState when the day is created. Only the
    /// day's snapshot may attest/revoke for that day, so rotating it never affects live days.
    /// Never equal to `authority`.
    pub attestor: Pubkey,
    pub mint: Pubkey,
    /// Token account PDA ["vault", pool], authority = pool.
    pub vault: Pubkey,
    /// Length of one pool day in seconds (300..=86_400). IMMUTABLE after init.
    pub day_length_secs: i64,
    /// Day d starts at d * day_length_secs + day_offset_secs (0 <= offset < length). IMMUTABLE.
    pub day_offset_secs: i64,
    /// Commits for day d accepted while now < day_start(d) + commit_cutoff_secs.
    pub commit_cutoff_secs: i64,
    /// Attestations for day d accepted while now <= day_end(d) + attest_grace_secs
    /// (snapshotted into DayState.attest_deadline when the day is created).
    pub attest_grace_secs: i64,
    /// Inclusive per-commitment stake bounds, base units. 0 < min <= max <= ceiling.
    pub min_stake: u64,
    pub max_stake: u64,
    /// Protocol cut of forfeited stake, bps (snapshotted per day).
    pub fee_bps: u16,
    /// Extra bonus weight per consecutive completed day, bps (snapshotted per day).
    pub streak_bonus_bps: u16,
    /// Cap on the streak weight boost, bps (snapshotted per day).
    pub max_streak_bonus_bps: u16,
    /// Goal bounds indexed by `Exercise as u8` (all EXERCISE_COUNT variants, in enum order).
    pub goal_limits: [GoalLimits; EXERCISE_COUNT],
    /// Max amount drawn from `reserve` into each finalized day that has completers (snapshotted per
    /// day as DayState.sponsor_cap). 0 by default; never above `max_stake`.
    pub daily_sponsor_amount: u64,
    /// Sponsor deposits + net forfeits of zero-completer days + rounding dust.
    pub reserve: u64,
    /// Protocol fees; the ONLY balance the authority can withdraw.
    pub treasury_accrued: u64,
    /// Sum over live days of what is still owed to committers of that day.
    pub outstanding: u64,
    /// Review window after a day's (pause-extended) attest deadline before finalize_day is allowed
    /// (snapshotted per day). 0..=min(MAX_FINALIZE_DELAY_SECS, day_length_secs).
    pub finalize_delay_secs: i64,
    /// Unix time the current pause started; 0 while not paused.
    pub paused_since: i64,
    /// Total seconds of all completed pauses since the pool was created.
    pub total_paused_secs: i64,
    pub reserved: [u8; 64],
}

impl Pool {
    /// Largest stake the hard-coded ceiling allows for this pool's mint.
    pub fn stake_ceiling(&self) -> Result<u64> {
        math::stake_ceiling(self.mint_decimals)
    }

    /// Re-validates every configurable field against the hard-coded limits.
    /// Called by initialize_pool and after every update_config.
    pub fn validate(&self) -> Result<()> {
        let len = self.day_length_secs;
        require!(
            (MIN_DAY_LENGTH_SECS..=MAX_DAY_LENGTH_SECS).contains(&len),
            VaultError::InvalidConfig
        );
        require!((0..len).contains(&self.day_offset_secs), VaultError::InvalidConfig);
        require!(
            (0..=math::max_commit_cutoff(len)).contains(&self.commit_cutoff_secs),
            VaultError::InvalidConfig
        );
        require!(
            (0..=MAX_ATTEST_GRACE_SECS.min(len)).contains(&self.attest_grace_secs),
            VaultError::InvalidConfig
        );
        require!(self.fee_bps <= MAX_FEE_BPS, VaultError::InvalidConfig);
        require!(self.max_streak_bonus_bps <= MAX_STREAK_BONUS_BPS, VaultError::InvalidConfig);
        require!(self.streak_bonus_bps <= self.max_streak_bonus_bps, VaultError::InvalidConfig);
        require!(self.min_stake > 0, VaultError::InvalidConfig);
        require!(self.min_stake <= self.max_stake, VaultError::InvalidConfig);
        require!(self.max_stake <= self.stake_ceiling()?, VaultError::InvalidConfig);
        for ex in Exercise::ALL {
            let l = self.goal_limits[ex.index()];
            require!(l.min >= 1 && l.min <= l.max, VaultError::InvalidConfig);
            require!(l.max <= ex.goal_ceiling(), VaultError::InvalidConfig);
        }
        require!(
            (0..=MAX_FINALIZE_DELAY_SECS.min(len)).contains(&self.finalize_delay_secs),
            VaultError::InvalidConfig
        );
        // The reserve tap is bounded per day: one day can never drain more than one max stake.
        require!(self.daily_sponsor_amount <= self.max_stake, VaultError::InvalidConfig);
        require!(self.attestor != Pubkey::default(), VaultError::InvalidConfig);
        // Separation of duties: the authority can never make itself the attestor.
        require!(self.attestor != self.authority, VaultError::InvalidConfig);
        Ok(())
    }

    /// Total seconds the pool has been paused, including a pause still in progress at `now`.
    pub fn paused_secs_total(&self, now: i64) -> Result<i64> {
        let ongoing = if self.paused { now.saturating_sub(self.paused_since).max(0) } else { 0 };
        self.total_paused_secs.checked_add(ongoing).ok_or(error!(VaultError::MathOverflow))
    }

    /// Applies a pause/unpause at `now`, keeping the pause-time accounting. No-op when unchanged.
    pub fn set_paused(&mut self, paused: bool, now: i64) -> Result<()> {
        if paused == self.paused {
            return Ok(());
        }
        if paused {
            self.paused_since = now;
        } else {
            let secs = now.saturating_sub(self.paused_since).max(0);
            self.total_paused_secs = self.total_paused_secs.checked_add(secs).ok_or(VaultError::MathOverflow)?;
            self.paused_since = 0;
        }
        self.paused = paused;
        Ok(())
    }
}

/// Per-day aggregate. PDA: ["day", pool, day_index_le]. Created by the day's first commit
/// (which pays its rent and gets it back at sweep_day).
#[account]
#[derive(InitSpace)]
pub struct DayState {
    pub version: u8,
    pub bump: u8,
    pub finalized: bool,
    pub voided: bool,
    pub pool: Pubkey,
    pub day_index: u32,
    pub rent_payer: Pubkey,
    // --- rules snapshot, fixed when the day is created (update_config cannot change them) ---
    pub fee_bps: u16,
    pub streak_bonus_bps: u16,
    pub max_streak_bonus_bps: u16,
    /// day_end(d) + attest_grace_secs at creation (the NOMINAL deadline). Attest/revoke while
    /// now <= effective_attest_deadline (this + time the pool spent paused since the day was
    /// created); finalize once now > that + finalize_delay_secs and the pool is not paused.
    pub attest_deadline: i64,
    // --- aggregates ---
    pub committed_count: u32,
    pub completed_count: u32,
    /// Commitments closed via claim or close_missed.
    pub resolved_count: u32,
    pub total_staked: u64,
    pub completed_stake: u64,
    pub completed_weight: u64,
    // --- fixed at finalize ---
    pub fee: u64,
    pub sponsor: u64,
    /// Bonus pool for completers: forfeited - fee + sponsor.
    pub distributable: u64,
    // --- settlement progress ---
    pub principal_paid: u64,
    pub bonus_paid: u64,
    // --- v2 snapshot + revocation fields (appended; offsets above are unchanged) ---
    /// Pool attestor when the day was created: the only key that may attest (or, besides the
    /// authority, revoke) on this day.
    pub attestor: Pubkey,
    /// pool.daily_sponsor_amount at creation: the most finalize may draw from the reserve.
    pub sponsor_cap: u64,
    /// Pool finalize_delay_secs at creation.
    pub finalize_delay_secs: i64,
    /// Pool total paused seconds at creation; pauses after this extend the attest window.
    pub paused_secs_base: i64,
    /// Revoked commitments: never forfeited, claim refunds principal only.
    pub revoked_count: u32,
    pub revoked_stake: u64,
    pub reserved: [u8; 32],
}

impl DayState {
    /// Seconds the pool has been paused since this day was created (including an ongoing pause).
    pub fn pause_extension(&self, pool: &Pool, now: i64) -> Result<i64> {
        Ok(pool.paused_secs_total(now)?.saturating_sub(self.paused_secs_base).max(0))
    }

    /// Last second (inclusive) attest/revoke are accepted: the nominal deadline pushed back by the
    /// time the pool spent paused, so a pause can never run out an honest user's attestation.
    pub fn effective_attest_deadline(&self, pool: &Pool, now: i64) -> Result<i64> {
        self.attest_deadline
            .checked_add(self.pause_extension(pool, now)?)
            .ok_or(error!(VaultError::MathOverflow))
    }

    /// finalize_day is allowed once now > this (and the pool is not paused).
    pub fn finalize_after(&self, pool: &Pool, now: i64) -> Result<i64> {
        self.effective_attest_deadline(pool, now)?
            .checked_add(self.finalize_delay_secs)
            .ok_or(error!(VaultError::MathOverflow))
    }

    /// Principal the day owes back after finalize: completers and revoked commitments.
    pub fn refunded_principal(&self) -> Result<u64> {
        self.completed_stake.checked_add(self.revoked_stake).ok_or(error!(VaultError::MathOverflow))
    }

    /// What the vault still owes this day's committers.
    pub fn liability(&self) -> Result<u64> {
        let gross = if self.voided {
            self.total_staked
        } else if self.finalized {
            self.refunded_principal()?
                .checked_add(self.distributable)
                .ok_or(VaultError::MathOverflow)?
        } else {
            self.total_staked
        };
        gross
            .checked_sub(self.principal_paid)
            .and_then(|v| v.checked_sub(self.bonus_paid))
            .ok_or(error!(VaultError::InsolventVault))
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum CommitmentStatus {
    Committed,
    Completed,
    /// A completion undone by revoke_completion. Never forfeited: claim refunds principal only
    /// (no bonus), so a revocation can never turn a user's stake into someone else's payout.
    Revoked,
}

/// One stake for one day. PDA: ["commitment", pool, user, day_index_le].
///
/// Byte layout (incl. the 8-byte discriminator) is FROZEN for getProgramAccounts memcmp:
///   0 discriminator | 8 bump | 9 status | 10 pool | 42 user | 74 day_index (u32 LE)
///   | 78 version | 79 exercise | 80 goal_target | 84 amount | ... (see SPEC.md §2.4)
#[account]
#[derive(InitSpace)]
pub struct Commitment {
    pub bump: u8,
    pub status: CommitmentStatus,
    pub pool: Pubkey,
    pub user: Pubkey,
    pub day_index: u32,
    /// Layout version (placed after day_index so pool/user/day_index keep their offsets).
    pub version: u8,
    pub exercise: Exercise,
    /// User-picked goal, locked at commit: reps, or seconds for timed holds (plank, wall sit).
    pub goal_target: u32,
    /// Stake in base units, chosen by the user within [pool.min_stake, pool.max_stake].
    pub amount: u64,
    /// Bonus weight (amount * streak multiplier); set at attestation, 0 otherwise.
    pub weight: u64,
    pub committed_at: i64,
    pub attested_at: i64,
    pub session_started_at: i64,
    /// Attested result: reps, or SECONDS held for timed holds (plank, wall sit). >= goal_target.
    pub reps: u32,
    /// sha256 of the canonical session summary the attestor verified.
    pub session_hash: [u8; 32],
    /// SGT mint used for this commit, or Pubkey::default() when SGT not required.
    pub device: Pubkey,
    pub reserved: [u8; 32],
}

/// Per-user stats. PDA: ["profile", pool, user]
#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub version: u8,
    pub bump: u8,
    pub pool: Pubkey,
    pub user: Pubkey,
    pub current_streak: u16,
    pub best_streak: u16,
    pub has_completed: bool,
    pub last_completed_day: u32,
    pub total_committed: u32,
    pub total_completed: u32,
    pub total_missed: u32,
    pub total_bonus_earned: u64,
    // --- v2 streak bookkeeping (appended) ---
    /// Bit i set <=> day (last_completed_day - i) is completed (attested, not revoked).
    /// Makes the streak independent of the order in which the attestor submits days.
    pub completed_days_mask: u64,
    /// Exact streak ending at day (last_completed_day - 64), i.e. just below the mask window.
    pub streak_carry: u16,
    /// Stake of the commitment completed on last_completed_day: the most of today's stake the
    /// streak boost applies to (the boost only covers stake that was also at risk the day before).
    pub last_completed_amount: u64,
    pub reserved: [u8; 32],
}

impl UserProfile {
    /// Consecutive completed days ending at day (last_completed_day - off), off < 64.
    pub fn streak_at(&self, off: u32) -> u16 {
        if off >= 64 {
            return 0;
        }
        let ones = (self.completed_days_mask >> off).trailing_ones();
        if ones >= 64 - off {
            ((64 - off) as u16).saturating_add(self.streak_carry)
        } else {
            ones as u16
        }
    }

    /// Records a completion of `day` with stake `amount`. Returns (streak ending at `day`, boost
    /// basis): the basis is the stake completed on day - 1 when that is known exactly (`day`
    /// directly follows the newest completed day), else 0, so the streak boost only ever applies
    /// to stake that was also at risk, and completed, the day before.
    pub fn record_completion(&mut self, day: u32, amount: u64) -> (u16, u64) {
        let mut basis = 0;
        if !self.has_completed {
            self.completed_days_mask = 1;
            self.streak_carry = 0;
            self.last_completed_day = day;
            self.last_completed_amount = amount;
        } else if day > self.last_completed_day {
            let s = day - self.last_completed_day;
            // The new window bottom is day - 64, i.e. old offset 64 - s.
            self.streak_carry = if s > 64 { 0 } else { self.streak_at(64 - s) };
            self.completed_days_mask = if s >= 64 { 0 } else { self.completed_days_mask << s };
            self.completed_days_mask |= 1;
            if s == 1 && self.completed_days_mask & 2 != 0 {
                basis = self.last_completed_amount;
            }
            self.last_completed_day = day;
            self.last_completed_amount = amount;
        } else {
            // Out-of-order attestation (day d attested after d + k): fills its bit so the streak
            // stays intact; no boost for this day because the d - 1 stake is not on record.
            let off = self.last_completed_day - day;
            if off < 64 {
                self.completed_days_mask |= 1u64 << off;
            }
        }
        self.has_completed = true;
        let off = self.last_completed_day - day;
        let streak = if off < 64 { self.streak_at(off) } else { 1 };
        self.current_streak = self.streak_at(0);
        self.best_streak = self.best_streak.max(self.current_streak);
        (streak.max(1), basis)
    }

    /// Undoes a completion of `day` (revoke_completion).
    pub fn clear_completion(&mut self, day: u32) {
        if self.has_completed && day <= self.last_completed_day {
            let off = self.last_completed_day - day;
            if off < 64 {
                self.completed_days_mask &= !(1u64 << off);
            }
        }
        self.current_streak = self.streak_at(0);
    }
}

/// One per Seeker device (SGT mint). PDA: ["device", pool, sgt_mint]
#[account]
#[derive(InitSpace)]
pub struct DeviceLock {
    pub version: u8,
    pub bump: u8,
    pub pool: Pubkey,
    pub sgt_mint: Pubkey,
    pub last_wallet: Pubkey,
    /// Number of commitments made with this device.
    pub commit_count: u32,
    /// The two highest day indices committed with this device, recent_days[0] >= recent_days[1].
    /// Only the first min(commit_count, 2) entries are meaningful.
    pub recent_days: [u32; 2],
    pub reserved: [u8; 16],
}

impl DeviceLock {
    /// Commits are only accepted for today or today+1, so every earlier commit for a day
    /// >= today is among the two highest committed days: checking those two is exact.
    pub fn has_committed_for(&self, day: u32) -> bool {
        (self.commit_count >= 1 && self.recent_days[0] == day)
            || (self.commit_count >= 2 && self.recent_days[1] == day)
    }

    pub fn record_commit(&mut self, day: u32) -> Result<()> {
        if self.commit_count == 0 {
            self.recent_days = [day, 0];
        } else if day > self.recent_days[0] {
            self.recent_days = [day, self.recent_days[0]];
        } else if self.commit_count == 1 || day > self.recent_days[1] {
            self.recent_days[1] = day;
        }
        self.commit_count = self.commit_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mainnet goal minimums (SPEC.md §9) with each exercise's hard ceiling as max.
    fn mainnet_goals() -> [GoalLimits; EXERCISE_COUNT] {
        const MINS: [u32; EXERCISE_COUNT] = [10, 15, 30, 10, 10, 10, 10, 30, 5, 10, 3, 5, 5, 20, 20, 20];
        let mut g = [GoalLimits::default(); EXERCISE_COUNT];
        for ex in Exercise::ALL {
            g[ex.index()] = GoalLimits { min: MINS[ex.index()], max: ex.goal_ceiling() };
        }
        g
    }

    fn pool() -> Pool {
        Pool {
            version: ACCOUNT_VERSION,
            bump: 0,
            vault_bump: 0,
            paused: false,
            require_sgt: true,
            mint_decimals: 6,
            authority: Pubkey::new_unique(),
            pending_authority: Pubkey::default(),
            attestor: Pubkey::new_unique(),
            mint: Pubkey::new_unique(),
            vault: Pubkey::new_unique(),
            day_length_secs: 86_400,
            day_offset_secs: 0,
            commit_cutoff_secs: 64_800,
            attest_grace_secs: 7_200,
            min_stake: 1_000_000,
            max_stake: 10_000_000_000,
            fee_bps: 500,
            streak_bonus_bps: 500,
            max_streak_bonus_bps: 5_000,
            goal_limits: mainnet_goals(),
            daily_sponsor_amount: 0,
            reserve: 0,
            treasury_accrued: 0,
            outstanding: 0,
            finalize_delay_secs: 14_400,
            paused_since: 0,
            total_paused_secs: 0,
            reserved: [0; 64],
        }
    }

    #[test]
    fn mainnet_params_are_valid() {
        pool().validate().unwrap();
    }

    #[test]
    fn config_bounds() {
        let bad: Vec<Box<dyn Fn(&mut Pool)>> = vec![
            Box::new(|p| p.day_length_secs = 299),
            Box::new(|p| p.day_length_secs = 86_401),
            Box::new(|p| p.day_offset_secs = 86_400),
            Box::new(|p| p.day_offset_secs = -1),
            Box::new(|p| p.commit_cutoff_secs = 82_801), // > len - len/24
            Box::new(|p| p.commit_cutoff_secs = -1),
            Box::new(|p| p.attest_grace_secs = 21_601),
            Box::new(|p| p.attest_grace_secs = -1),
            Box::new(|p| {
                p.day_length_secs = 600;
                p.commit_cutoff_secs = 0;
                p.attest_grace_secs = 601; // > len
            }),
            Box::new(|p| {
                p.day_length_secs = 600;
                p.attest_grace_secs = 60;
                p.commit_cutoff_secs = 576; // > 600 - 25
            }),
            Box::new(|p| p.fee_bps = 2_001),
            Box::new(|p| p.max_streak_bonus_bps = 10_001),
            Box::new(|p| p.streak_bonus_bps = 5_001),
            Box::new(|p| p.min_stake = 0),
            Box::new(|p| p.min_stake = p.max_stake + 1),
            Box::new(|p| p.max_stake = 1_000_000_000_001), // 1M SKR + 1 base unit
            Box::new(|p| p.goal_limits[0].min = 0),
            Box::new(|p| p.goal_limits[1].max = 1_001),
            Box::new(|p| p.goal_limits[2].max = 3_601),
            Box::new(|p| p.goal_limits[2] = GoalLimits { min: 40, max: 39 }),
            Box::new(|p| p.goal_limits[3].min = 0),
            Box::new(|p| p.goal_limits[7].max = 3_601), // wall sit seconds
            Box::new(|p| p.goal_limits[10].max = 1_001), // pull-ups: strength reps ceiling
            Box::new(|p| p.goal_limits[12].max = 1_001), // burpees: strength reps ceiling
            Box::new(|p| p.goal_limits[13].max = 3_001), // mountain climbers
            Box::new(|p| p.goal_limits[14].max = 3_001), // jumping jacks
            Box::new(|p| p.goal_limits[15].max = 3_001), // high knees
            Box::new(|p| p.goal_limits[15] = GoalLimits { min: 21, max: 20 }),
            Box::new(|p| p.attestor = Pubkey::default()),
            Box::new(|p| p.attestor = p.authority), // audit AUD-AT-1 / F2
            Box::new(|p| p.daily_sponsor_amount = p.max_stake + 1), // audit AUD-AT-1 / F2
            Box::new(|p| p.daily_sponsor_amount = u64::MAX),
            Box::new(|p| p.finalize_delay_secs = -1),
            Box::new(|p| p.finalize_delay_secs = 43_201),
            Box::new(|p| {
                p.day_length_secs = 600;
                p.commit_cutoff_secs = 0;
                p.attest_grace_secs = 60;
                p.finalize_delay_secs = 601; // > len
            }),
        ];
        for (i, f) in bad.iter().enumerate() {
            let mut p = pool();
            f(&mut p);
            assert!(p.validate().is_err(), "case {i} should be rejected");
        }
        // edges that must pass
        let good: Vec<Box<dyn Fn(&mut Pool)>> = vec![
            Box::new(|p| p.commit_cutoff_secs = 82_800),
            Box::new(|p| p.attest_grace_secs = 21_600),
            Box::new(|p| p.day_offset_secs = 86_399),
            Box::new(|p| p.max_stake = 1_000_000_000_000),
            Box::new(|p| p.min_stake = p.max_stake),
            Box::new(|p| {
                p.day_length_secs = 300;
                p.day_offset_secs = 299;
                p.commit_cutoff_secs = 288;
                p.attest_grace_secs = 300;
                p.finalize_delay_secs = 300;
            }),
            Box::new(|p| p.fee_bps = 2_000),
            Box::new(|p| p.goal_limits[2] = GoalLimits { min: 3_600, max: 3_600 }),
            Box::new(|p| p.goal_limits[7] = GoalLimits { min: 1, max: 3_600 }),
            Box::new(|p| p.goal_limits[13].max = 3_000),
            Box::new(|p| p.goal_limits[15] = GoalLimits { min: 3_000, max: 3_000 }),
            Box::new(|p| p.daily_sponsor_amount = p.max_stake),
            Box::new(|p| p.finalize_delay_secs = 0),
            Box::new(|p| p.finalize_delay_secs = 43_200),
        ];
        for (i, f) in good.iter().enumerate() {
            let mut p = pool();
            f(&mut p);
            p.validate().unwrap_or_else(|e| panic!("case {i} should pass: {e:?}"));
        }
    }

    #[test]
    fn device_lock_tracks_two_highest_days() {
        let mut d = DeviceLock {
            version: 1,
            bump: 0,
            pool: Pubkey::default(),
            sgt_mint: Pubkey::default(),
            last_wallet: Pubkey::default(),
            commit_count: 0,
            recent_days: [0, 0],
            reserved: [0; 16],
        };
        assert!(!d.has_committed_for(0));
        // pre-commit tomorrow, then commit today: both allowed
        d.record_commit(101).unwrap();
        assert!(!d.has_committed_for(100));
        d.record_commit(100).unwrap();
        assert!(d.has_committed_for(100) && d.has_committed_for(101));
        assert_eq!(d.recent_days, [101, 100]);
        // next day: today = 101 (already committed), 102 free
        assert!(!d.has_committed_for(102));
        d.record_commit(102).unwrap();
        assert_eq!(d.recent_days, [102, 101]);
        assert!(d.has_committed_for(101) && d.has_committed_for(102));
        // days far in the past are forgotten, but they can no longer be committed anyway
        d.record_commit(110).unwrap();
        assert_eq!(d.recent_days, [110, 102]);
        d.record_commit(111).unwrap();
        assert_eq!(d.recent_days, [111, 110]);
        assert_eq!(d.commit_count, 5);
    }

    #[test]
    fn exercise_encoding_is_stable() {
        // FROZEN on-chain codes: never reorder, only append.
        let expected = [
            (Exercise::Pushup, 0u8),
            (Exercise::Squat, 1),
            (Exercise::Plank, 2),
            (Exercise::Lunge, 3),
            (Exercise::Situp, 4),
            (Exercise::LegRaise, 5),
            (Exercise::GluteBridge, 6),
            (Exercise::WallSit, 7),
            (Exercise::PikePushup, 8),
            (Exercise::JumpSquat, 9),
            (Exercise::Pullup, 10),
            (Exercise::Dip, 11),
            (Exercise::Burpee, 12),
            (Exercise::MountainClimber, 13),
            (Exercise::JumpingJack, 14),
            (Exercise::HighKnees, 15),
        ];
        assert_eq!(expected.len(), EXERCISE_COUNT);
        for (i, (ex, byte)) in expected.into_iter().enumerate() {
            let mut v = vec![];
            ex.serialize(&mut v).unwrap();
            assert_eq!(v, vec![byte]);
            assert_eq!(ex.index(), byte as usize);
            assert_eq!(Exercise::ALL[i], ex);
            assert_eq!(Exercise::try_from_slice(&[byte]).unwrap(), ex);
        }
        assert!(Exercise::try_from_slice(&[EXERCISE_COUNT as u8]).is_err());
        assert!(Exercise::try_from_slice(&[255]).is_err());
    }

    #[test]
    fn exercise_units_and_ceilings() {
        for ex in Exercise::ALL {
            let (timed, ceil) = match ex {
                Exercise::Plank | Exercise::WallSit => (true, 3_600),
                Exercise::MountainClimber | Exercise::JumpingJack | Exercise::HighKnees => (false, 3_000),
                _ => (false, 1_000),
            };
            assert_eq!((ex.is_timed(), ex.goal_ceiling()), (timed, ceil), "{ex:?}");
        }
    }

    #[test]
    fn pause_accounting() {
        let mut p = pool();
        p.set_paused(true, 1_000).unwrap();
        assert_eq!((p.paused, p.paused_since, p.paused_secs_total(1_250).unwrap()), (true, 1_000, 250));
        p.set_paused(true, 1_100).unwrap(); // no-op: already paused
        assert_eq!(p.paused_since, 1_000);
        p.set_paused(false, 1_300).unwrap();
        assert_eq!((p.paused, p.paused_since, p.total_paused_secs), (false, 0, 300));
        assert_eq!(p.paused_secs_total(9_999).unwrap(), 300);
        p.set_paused(false, 2_000).unwrap(); // no-op
        p.set_paused(true, 2_000).unwrap();
        p.set_paused(false, 2_050).unwrap();
        assert_eq!(p.total_paused_secs, 350);
    }

    fn profile() -> UserProfile {
        UserProfile {
            version: 1,
            bump: 0,
            pool: Pubkey::default(),
            user: Pubkey::default(),
            current_streak: 0,
            best_streak: 0,
            has_completed: false,
            last_completed_day: 0,
            total_committed: 0,
            total_completed: 0,
            total_missed: 0,
            total_bonus_earned: 0,
            completed_days_mask: 0,
            streak_carry: 0,
            last_completed_amount: 0,
            reserved: [0; 32],
        }
    }

    #[test]
    fn streak_in_order_and_basis() {
        let mut p = profile();
        assert_eq!(p.record_completion(100, 5), (1, 0));
        assert_eq!(p.record_completion(101, 7), (2, 5)); // basis = yesterday's stake
        assert_eq!(p.record_completion(102, 1), (3, 7));
        assert_eq!((p.current_streak, p.best_streak, p.last_completed_amount), (3, 3, 1));
        // gap: day 103 missed
        assert_eq!(p.record_completion(104, 9), (1, 0));
        assert_eq!((p.current_streak, p.best_streak), (1, 3));
        // long streaks keep counting past the 64-day mask window (carry)
        let mut q = profile();
        for d in 0..200u32 {
            let (s, _) = q.record_completion(1_000 + d, 1);
            assert_eq!(s as u32, d + 1);
        }
        assert_eq!((q.current_streak, q.best_streak), (200, 200));
        // a jump of exactly 64 / more than 64 days resets
        assert_eq!(q.record_completion(1_199 + 65, 1), (1, 0));
        assert_eq!(q.record_completion(1_199 + 65 + 64, 1).0, 1);
    }

    #[test]
    fn streak_is_independent_of_attestation_order() {
        // audit F4: d0, d1 in order, then d3 attested before d2
        let mut p = profile();
        p.record_completion(10, 1);
        p.record_completion(11, 1);
        assert_eq!(p.record_completion(13, 1), (1, 0));
        assert_eq!(p.current_streak, 1);
        // the late d2 attestation closes the gap: streak at d2 = 3, current = 4; no boost basis
        assert_eq!(p.record_completion(12, 1), (3, 0));
        assert_eq!((p.current_streak, p.best_streak, p.last_completed_day), (4, 4, 13));
        // the next day continues the full streak with an exact basis
        assert_eq!(p.record_completion(14, 1), (5, 1));
        // out-of-order fill that reaches the carry below the window
        let mut q = profile();
        for d in 0..100u32 {
            q.record_completion(d, 1);
        }
        q.record_completion(101, 1); // day 100 pending
        assert_eq!(q.current_streak, 1);
        assert_eq!(q.record_completion(100, 1).0, 101);
        assert_eq!(q.current_streak, 102);
    }

    #[test]
    fn revoke_clears_the_day() {
        let mut p = profile();
        for d in 0..5u32 {
            p.record_completion(d, 1);
        }
        p.clear_completion(2);
        assert_eq!(p.current_streak, 2); // days 3, 4
        p.clear_completion(4);
        assert_eq!(p.current_streak, 0);
        assert_eq!(p.record_completion(5, 1), (1, 0)); // day 4 revoked: no streak, no basis
        assert_eq!(p.best_streak, 5);
    }

    #[test]
    fn account_sizes() {
        assert_eq!(8 + Pool::INIT_SPACE, 476);
        assert_eq!(8 + DayState::INIT_SPACE, 270);
        assert_eq!(8 + Commitment::INIT_SPACE, 224);
        assert_eq!(8 + UserProfile::INIT_SPACE, 153);
        assert_eq!(8 + DeviceLock::INIT_SPACE, 134);
    }
}
