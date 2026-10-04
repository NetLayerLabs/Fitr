//! Fitr commitment vault. Users stake a self-chosen amount of the pool mint ($SKR on mainnet)
//! on doing a self-chosen workout goal on a given pool day. An off-chain attestor marks
//! completions; completers get their stake back plus a pro-rata (stake x streak weighted)
//! share of what non-completers forfeited, minus a protocol fee on the forfeited part only.
//! See SPEC.md for accounts, windows, math and the invariants the tests check.
pub mod constants;
pub mod contexts;
pub mod error;
pub mod events;
pub mod math;
pub mod state;
pub mod token_checks;

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, TransferChecked};

pub use constants::*;
pub use contexts::*;
pub use error::VaultError;
pub use events::*;
pub use state::*;

declare_id!("9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY");

#[program]
pub mod fitr_vault {
    use super::*;

    /// Upgrade-authority only. Creates the pool for `mint` and its vault token account.
    pub fn initialize_pool(ctx: Context<InitializePool>, p: InitPoolParams) -> Result<()> {
        require!(
            ctx.accounts.mint.decimals <= MAX_MINT_DECIMALS,
            VaultError::UnsupportedMintDecimals
        );
        token_checks::assert_supported_stake_mint(&ctx.accounts.mint.to_account_info())?;

        let pool = &mut ctx.accounts.pool;
        pool.version = ACCOUNT_VERSION;
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;
        pool.paused = false;
        pool.require_sgt = p.require_sgt;
        pool.mint_decimals = ctx.accounts.mint.decimals;
        pool.authority = ctx.accounts.authority.key();
        pool.pending_authority = Pubkey::default();
        pool.attestor = p.attestor;
        pool.mint = ctx.accounts.mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.day_length_secs = p.day_length_secs;
        pool.day_offset_secs = p.day_offset_secs;
        pool.commit_cutoff_secs = p.commit_cutoff_secs;
        pool.attest_grace_secs = p.attest_grace_secs;
        pool.min_stake = p.min_stake;
        pool.max_stake = p.max_stake;
        pool.fee_bps = p.fee_bps;
        pool.streak_bonus_bps = p.streak_bonus_bps;
        pool.max_streak_bonus_bps = p.max_streak_bonus_bps;
        pool.goal_limits = p.goal_limits;
        pool.daily_sponsor_amount = p.daily_sponsor_amount;
        pool.reserve = 0;
        pool.treasury_accrued = 0;
        pool.outstanding = 0;
        pool.finalize_delay_secs = p.finalize_delay_secs;
        pool.paused_since = 0;
        pool.total_paused_secs = 0;
        pool.validate()?;

        emit!(PoolInitialized {
            pool: pool.key(),
            mint: pool.mint,
            authority: pool.authority,
            attestor: pool.attestor,
            min_stake: pool.min_stake,
            max_stake: pool.max_stake,
            fee_bps: pool.fee_bps,
            day_length_secs: pool.day_length_secs,
            day_offset_secs: pool.day_offset_secs,
            require_sgt: pool.require_sgt,
        });
        Ok(())
    }

    /// Authority only. Applies the given fields, then re-validates the whole config.
    /// Days that already exist are unaffected: their fee, streak rules, attest deadline, attestor,
    /// sponsor cap and finalize delay are snapshotted in DayState. Pausing extends the attest
    /// window of existing days by the time spent paused and blocks finalize while paused.
    pub fn update_config(ctx: Context<UpdateConfig>, p: UpdateConfigParams) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pool = &mut ctx.accounts.pool;
        if let Some(v) = p.attestor {
            pool.attestor = v;
        }
        if let Some(v) = p.min_stake {
            pool.min_stake = v;
        }
        if let Some(v) = p.max_stake {
            pool.max_stake = v;
        }
        if let Some(v) = p.fee_bps {
            pool.fee_bps = v;
        }
        if let Some(v) = p.streak_bonus_bps {
            pool.streak_bonus_bps = v;
        }
        if let Some(v) = p.max_streak_bonus_bps {
            pool.max_streak_bonus_bps = v;
        }
        if let Some(v) = p.commit_cutoff_secs {
            pool.commit_cutoff_secs = v;
        }
        if let Some(v) = p.attest_grace_secs {
            pool.attest_grace_secs = v;
        }
        if let Some(v) = p.goal_limits {
            pool.goal_limits = v;
        }
        if let Some(v) = p.daily_sponsor_amount {
            pool.daily_sponsor_amount = v;
        }
        if let Some(v) = p.paused {
            pool.set_paused(v, now)?;
        }
        if let Some(v) = p.require_sgt {
            pool.require_sgt = v;
        }
        if let Some(v) = p.finalize_delay_secs {
            pool.finalize_delay_secs = v;
        }
        pool.validate()?;
        emit!(ConfigUpdated {
            pool: pool.key(),
            attestor: pool.attestor,
            min_stake: pool.min_stake,
            max_stake: pool.max_stake,
            fee_bps: pool.fee_bps,
            streak_bonus_bps: pool.streak_bonus_bps,
            max_streak_bonus_bps: pool.max_streak_bonus_bps,
            commit_cutoff_secs: pool.commit_cutoff_secs,
            attest_grace_secs: pool.attest_grace_secs,
            goal_limits: pool.goal_limits,
            daily_sponsor_amount: pool.daily_sponsor_amount,
            paused: pool.paused,
            require_sgt: pool.require_sgt,
            finalize_delay_secs: pool.finalize_delay_secs,
        });
        Ok(())
    }

    /// Two-step authority transfer. Pass Pubkey::default() to cancel.
    pub fn propose_authority(ctx: Context<UpdateConfig>, new_authority: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.pending_authority = new_authority;
        emit!(AuthorityProposed {
            pool: pool.key(),
            authority: pool.authority,
            pending_authority: new_authority,
        });
        Ok(())
    }

    pub fn accept_authority(ctx: Context<AcceptAuthority>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let old = pool.authority;
        pool.authority = ctx.accounts.new_authority.key();
        pool.pending_authority = Pubkey::default();
        pool.validate()?; // the attestor can never become the authority
        emit!(AuthorityTransferred { pool: pool.key(), old_authority: old, new_authority: pool.authority });
        Ok(())
    }

    /// One DeviceLock per Seeker Genesis Token mint (== per physical device). User signs and pays.
    pub fn register_device(ctx: Context<RegisterDevice>) -> Result<()> {
        token_checks::assert_is_sgt(&ctx.accounts.sgt_mint.to_account_info())?;
        let d = &mut ctx.accounts.device;
        d.version = ACCOUNT_VERSION;
        d.bump = ctx.bumps.device;
        d.pool = ctx.accounts.pool.key();
        d.sgt_mint = ctx.accounts.sgt_mint.key();
        d.last_wallet = ctx.accounts.user.key();
        d.commit_count = 0;
        d.recent_days = [0, 0];
        emit!(DeviceRegistered { pool: d.pool, sgt_mint: d.sgt_mint, wallet: d.last_wallet });
        Ok(())
    }

    /// Stake `amount` base units on doing `goal_target` reps (seconds for plank / wall sit) of `exercise`
    /// during pool day `day_index` (today or tomorrow). User is the only signer and pays rent.
    pub fn commit(
        ctx: Context<Commit>,
        day_index: u32,
        amount: u64,
        exercise: Exercise,
        goal_target: u32,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(!pool.paused, VaultError::Paused);
        let (len, offset) = (pool.day_length_secs, pool.day_offset_secs);
        let now = Clock::get()?.unix_timestamp;
        let today = math::day_index_at(now, offset, len)?;
        let tomorrow = today.checked_add(1).ok_or(VaultError::MathOverflow)?;
        require!(day_index == today || day_index == tomorrow, VaultError::InvalidDay);
        let cutoff = math::day_start(day_index, offset, len)?
            .checked_add(pool.commit_cutoff_secs)
            .ok_or(VaultError::MathOverflow)?;
        require!(now < cutoff, VaultError::CommitWindowClosed);

        // --- user-chosen stake and goal, bounded by the pool's rails ---
        require!(
            amount >= pool.min_stake && amount <= pool.max_stake,
            VaultError::StakeOutOfBounds
        );
        let limits = pool.goal_limits[exercise.index()];
        require!(
            goal_target >= limits.min && goal_target <= limits.max,
            VaultError::GoalOutOfBounds
        );

        // --- Sybil gate: one commitment per Seeker device per day ---
        let user_key = ctx.accounts.user.key();
        let mut device_key = Pubkey::default();
        if pool.require_sgt {
            let (Some(sgt_token), Some(device)) = (&ctx.accounts.sgt_token, &mut ctx.accounts.device)
            else {
                return err!(VaultError::SgtRequired);
            };
            require_keys_eq!(device.pool, pool.key(), VaultError::InvalidSgt);
            require_keys_eq!(*sgt_token.to_account_info().owner, anchor_spl::token_2022::ID, VaultError::InvalidSgt);
            require_keys_eq!(sgt_token.mint, device.sgt_mint, VaultError::InvalidSgt);
            require_keys_eq!(sgt_token.owner, user_key, VaultError::InvalidSgt);
            require!(sgt_token.amount == 1, VaultError::InvalidSgt);
            require!(!device.has_committed_for(day_index), VaultError::DeviceAlreadyCommitted);
            device.record_commit(day_index)?;
            device.last_wallet = user_key;
            device_key = device.sgt_mint;
        }

        // --- DayState lazy init (init_if_needed): version 0 means freshly created ---
        let day = &mut ctx.accounts.day;
        if day.version == 0 {
            day.version = ACCOUNT_VERSION;
            day.bump = ctx.bumps.day;
            day.pool = pool.key();
            day.day_index = day_index;
            day.rent_payer = user_key;
            // Snapshot the day's economic rules: later update_config calls cannot change them.
            day.fee_bps = pool.fee_bps;
            day.streak_bonus_bps = pool.streak_bonus_bps;
            day.max_streak_bonus_bps = pool.max_streak_bonus_bps;
            day.attest_deadline = math::day_end(day_index, offset, len)?
                .checked_add(pool.attest_grace_secs)
                .ok_or(VaultError::MathOverflow)?;
            // Trust snapshot: rotating the attestor, opening the sponsor tap or changing the
            // review window mid-day can never affect a day that already has stakes.
            day.attestor = pool.attestor;
            day.sponsor_cap = pool.daily_sponsor_amount;
            day.finalize_delay_secs = pool.finalize_delay_secs;
            day.paused_secs_base = pool.total_paused_secs; // commit requires !paused
        }
        require!(!day.finalized, VaultError::AlreadyFinalized);
        require!(!day.voided, VaultError::DayVoided);

        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;

        day.committed_count = day.committed_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        day.total_staked = day.total_staked.checked_add(amount).ok_or(VaultError::MathOverflow)?;

        let c = &mut ctx.accounts.commitment;
        c.bump = ctx.bumps.commitment;
        c.status = CommitmentStatus::Committed;
        c.pool = pool.key();
        c.user = user_key;
        c.day_index = day_index;
        c.version = ACCOUNT_VERSION;
        c.exercise = exercise;
        c.goal_target = goal_target;
        c.amount = amount;
        c.weight = 0;
        c.committed_at = now;
        c.device = device_key;

        let prof = &mut ctx.accounts.profile;
        if prof.version == 0 {
            prof.version = ACCOUNT_VERSION;
            prof.bump = ctx.bumps.profile;
            prof.pool = pool.key();
            prof.user = user_key;
        }
        prof.total_committed = prof.total_committed.checked_add(1).ok_or(VaultError::MathOverflow)?;

        let pool = &mut ctx.accounts.pool;
        pool.outstanding = pool.outstanding.checked_add(amount).ok_or(VaultError::MathOverflow)?;

        emit!(Committed {
            pool: pool.key(),
            user: user_key,
            day_index,
            amount,
            exercise,
            goal_target,
            device: device_key,
        });
        Ok(())
    }

    /// Called by the off-chain attestor after it verified a workout session.
    /// `reps` is reps for push-ups/squats and seconds for plank; it must meet the committed goal.
    pub fn attest_completion(
        ctx: Context<AttestCompletion>,
        day_index: u32,
        reps: u32,
        session_hash: [u8; 32],
        session_started_at: i64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(!pool.paused, VaultError::Paused);
        let now = Clock::get()?.unix_timestamp;
        let day = &mut ctx.accounts.day;
        require!(!day.finalized, VaultError::AlreadyFinalized);
        require!(!day.voided, VaultError::DayVoided);
        require!(now <= day.effective_attest_deadline(pool, now)?, VaultError::AttestWindowClosed);

        let c = &mut ctx.accounts.commitment;
        require!(c.status == CommitmentStatus::Committed, VaultError::InvalidCommitmentState);
        // Workout must start after the stake was locked, inside the day, and not in the future.
        let (len, offset) = (pool.day_length_secs, pool.day_offset_secs);
        let ds = math::day_start(day_index, offset, len)?;
        let de = math::day_end(day_index, offset, len)?;
        require!(
            session_started_at >= c.committed_at
                && session_started_at >= ds
                && session_started_at < de
                && session_started_at <= now,
            VaultError::InvalidSessionTime
        );
        require!(reps >= c.goal_target, VaultError::GoalNotMet);

        let prof = &mut ctx.accounts.profile;
        // Streak from the completed-days mask, so attestation order does not matter (audit F4);
        // the boost only covers the part of the stake also completed the day before (audit F3).
        let (streak, basis) = prof.record_completion(day_index, c.amount);
        let weight = math::weight_for(c.amount, basis, streak, day.streak_bonus_bps, day.max_streak_bonus_bps)?;

        c.status = CommitmentStatus::Completed;
        c.weight = weight;
        c.attested_at = now;
        c.session_started_at = session_started_at;
        c.reps = reps;
        c.session_hash = session_hash;

        day.completed_count = day.completed_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        day.completed_stake = day.completed_stake.checked_add(c.amount).ok_or(VaultError::MathOverflow)?;
        day.completed_weight = day.completed_weight.checked_add(weight).ok_or(VaultError::MathOverflow)?;

        prof.total_completed = prof.total_completed.checked_add(1).ok_or(VaultError::MathOverflow)?;

        emit!(CompletionAttested {
            pool: pool.key(),
            user: c.user,
            day_index,
            exercise: c.exercise,
            goal_target: c.goal_target,
            reps,
            session_hash,
            weight,
            streak,
        });
        Ok(())
    }

    /// Escape hatch for a bad attestation: the authority or the day's attestor can undo it while
    /// the (pause-extended) attestation window is open. A revoked commitment is NEVER forfeited:
    /// it becomes Revoked and its owner can only claim the principal back, without a bonus. So a
    /// revocation can never turn anyone's stake into someone else's payout (audit SM-1 / AUD-AT-1).
    /// The attestor cannot revoke while the pool is paused; the authority can.
    pub fn revoke_completion(ctx: Context<RevokeCompletion>, day_index: u32) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let pool = &ctx.accounts.pool;
        require!(
            !pool.paused || ctx.accounts.signer.key() == pool.authority,
            VaultError::Paused
        );
        let day = &mut ctx.accounts.day;
        require!(!day.finalized, VaultError::AlreadyFinalized);
        require!(!day.voided, VaultError::DayVoided);
        require!(now <= day.effective_attest_deadline(pool, now)?, VaultError::AttestWindowClosed);
        let c = &mut ctx.accounts.commitment;
        require!(c.status == CommitmentStatus::Completed, VaultError::InvalidCommitmentState);
        day.completed_count = day.completed_count.checked_sub(1).ok_or(VaultError::MathOverflow)?;
        day.completed_stake = day.completed_stake.checked_sub(c.amount).ok_or(VaultError::MathOverflow)?;
        day.completed_weight = day.completed_weight.checked_sub(c.weight).ok_or(VaultError::MathOverflow)?;
        day.revoked_count = day.revoked_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        day.revoked_stake = day.revoked_stake.checked_add(c.amount).ok_or(VaultError::MathOverflow)?;
        c.status = CommitmentStatus::Revoked;
        c.weight = 0;
        let prof = &mut ctx.accounts.profile;
        prof.clear_completion(day_index);
        prof.total_completed = prof.total_completed.saturating_sub(1);
        emit!(CompletionRevoked {
            pool: ctx.accounts.pool.key(),
            user: c.user,
            day_index,
            by: ctx.accounts.signer.key(),
        });
        Ok(())
    }

    /// Permissionless crank once the day's review window is over: now > attest deadline (extended
    /// by any pause) + finalize_delay_secs. Blocked while the pool is paused, so an incident pause
    /// can never forfeit users whose attestation was pending; the authority voids or unpauses.
    /// Fixes the day's bonus pool.
    pub fn finalize_day(ctx: Context<FinalizeDay>, day_index: u32) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(!pool.paused, VaultError::Paused);
        let day = &mut ctx.accounts.day;
        require!(!day.finalized, VaultError::AlreadyFinalized);
        require!(!day.voided, VaultError::DayVoided);
        let now = Clock::get()?.unix_timestamp;
        require!(now > day.finalize_after(pool, now)?, VaultError::DayNotOver);

        let f = math::finalize_math(
            day.total_staked,
            day.completed_stake,
            day.revoked_stake,
            day.completed_count,
            day.fee_bps,
            day.sponsor_cap,
            pool.reserve,
        )?;
        // outstanding: -fee (to treasury) -to_reserve (to reserve) +sponsor (from reserve)
        pool.outstanding = pool
            .outstanding
            .checked_sub(f.fee)
            .and_then(|v| v.checked_sub(f.to_reserve))
            .and_then(|v| v.checked_add(f.sponsor))
            .ok_or(VaultError::MathOverflow)?;
        pool.treasury_accrued = pool.treasury_accrued.checked_add(f.fee).ok_or(VaultError::MathOverflow)?;
        pool.reserve = pool
            .reserve
            .checked_sub(f.sponsor)
            .and_then(|v| v.checked_add(f.to_reserve))
            .ok_or(VaultError::MathOverflow)?;
        day.fee = f.fee;
        day.sponsor = f.sponsor;
        day.distributable = f.distributable;
        day.finalized = true;
        emit!(DayFinalized {
            pool: pool.key(),
            day_index,
            total_staked: day.total_staked,
            completed_stake: day.completed_stake,
            revoked_stake: day.revoked_stake,
            slashed: f.slashed,
            fee: f.fee,
            sponsor: f.sponsor,
            distributable: f.distributable,
            to_reserve: f.to_reserve,
        });
        Ok(())
    }

    /// Safety valve (attestor outage / compromise / incident pause): every committer gets principal
    /// back, no slashing. Allowed until the day is finalized, i.e. through the whole review window.
    pub fn void_day(ctx: Context<VoidDay>, day_index: u32) -> Result<()> {
        let day = &mut ctx.accounts.day;
        require!(!day.finalized, VaultError::AlreadyFinalized);
        require!(!day.voided, VaultError::DayVoided);
        day.voided = true;
        emit!(DayVoided { pool: ctx.accounts.pool.key(), day_index });
        Ok(())
    }

    /// User only signer. Completed on a finalized day: principal + bonus. Revoked on a finalized
    /// day: principal. Any status on a voided day: principal. Closes the Commitment (rent to user)
    /// so it can never pay twice.
    pub fn claim(ctx: Context<Claim>, day_index: u32) -> Result<()> {
        let day = &mut ctx.accounts.day;
        let c = &ctx.accounts.commitment;
        let (principal, bonus) = if day.voided {
            (c.amount, 0)
        } else {
            require!(day.finalized, VaultError::NotFinalized);
            match c.status {
                CommitmentStatus::Completed => {
                    (c.amount, math::bonus_share(day.distributable, c.weight, day.completed_weight)?)
                }
                CommitmentStatus::Revoked => (c.amount, 0),
                CommitmentStatus::Committed => return err!(VaultError::InvalidCommitmentState),
            }
        };
        let payout = principal.checked_add(bonus).ok_or(VaultError::MathOverflow)?;

        let mint_key = ctx.accounts.mint.key();
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, mint_key.as_ref(), &bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
            ctx.accounts.mint.decimals,
        )?;

        day.principal_paid = day.principal_paid.checked_add(principal).ok_or(VaultError::MathOverflow)?;
        day.bonus_paid = day.bonus_paid.checked_add(bonus).ok_or(VaultError::MathOverflow)?;
        require!(day.bonus_paid <= day.distributable, VaultError::InsolventVault);
        day.resolved_count = day.resolved_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        let pool = &mut ctx.accounts.pool;
        pool.outstanding = pool.outstanding.checked_sub(payout).ok_or(VaultError::InsolventVault)?;
        let prof = &mut ctx.accounts.profile;
        prof.total_bonus_earned = prof.total_bonus_earned.checked_add(bonus).ok_or(VaultError::MathOverflow)?;
        emit!(Claimed { pool: pool.key(), user: c.user, day_index, principal, bonus });
        Ok(()) // commitment closed to user by `close = user` (rent refund, prevents double claim)
    }

    /// Permissionless (the user may crank it themselves): close a missed commitment after
    /// finalize. The stake was already counted as forfeited at finalize; this refunds rent only.
    pub fn close_missed(ctx: Context<CloseMissed>, day_index: u32) -> Result<()> {
        let day = &mut ctx.accounts.day;
        require!(day.finalized, VaultError::NotFinalized);
        let c = &ctx.accounts.commitment;
        require!(c.status == CommitmentStatus::Committed, VaultError::InvalidCommitmentState);
        day.resolved_count = day.resolved_count.checked_add(1).ok_or(VaultError::MathOverflow)?;
        let prof = &mut ctx.accounts.profile;
        prof.total_missed = prof.total_missed.checked_add(1).ok_or(VaultError::MathOverflow)?;
        if !prof.has_completed || day_index > prof.last_completed_day {
            prof.current_streak = 0;
        }
        emit!(MissedSettled { pool: ctx.accounts.pool.key(), user: c.user, day_index, slashed: c.amount });
        Ok(())
    }

    /// Permissionless: once the day is over and every commitment is resolved, move rounding
    /// dust to the reserve and close DayState (rent back to whoever created it).
    pub fn sweep_day(ctx: Context<SweepDay>, day_index: u32) -> Result<()> {
        let day = &ctx.accounts.day;
        require!(day.finalized || day.voided, VaultError::NotFinalized);
        // A voided day can be fully claimed while its commit window is still open; closing the
        // DayState then would let a new commit re-create it. Waiting for the deadline prevents that.
        let now = Clock::get()?.unix_timestamp;
        require!(now > day.attest_deadline, VaultError::DayNotOver);
        require!(day.resolved_count == day.committed_count, VaultError::DayNotResolved);
        let owed_principal = if day.voided { day.total_staked } else { day.refunded_principal()? };
        require!(day.principal_paid == owed_principal, VaultError::InsolventVault);
        let dust = if day.voided {
            0
        } else {
            day.distributable.checked_sub(day.bonus_paid).ok_or(VaultError::InsolventVault)?
        };
        let pool = &mut ctx.accounts.pool;
        pool.outstanding = pool.outstanding.checked_sub(dust).ok_or(VaultError::InsolventVault)?;
        pool.reserve = pool.reserve.checked_add(dust).ok_or(VaultError::MathOverflow)?;
        emit!(DaySwept { pool: pool.key(), day_index, dust });
        Ok(())
    }

    /// Anyone (sponsor) can top up the reserve. Only drawn via each day's sponsor_cap snapshot of
    /// daily_sponsor_amount (0 by default, never above max_stake).
    pub fn fund_reserve(ctx: Context<FundReserve>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidConfig);
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.funder_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.funder.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let pool = &mut ctx.accounts.pool;
        pool.reserve = pool.reserve.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        emit!(ReserveFunded { pool: pool.key(), funder: ctx.accounts.funder.key(), amount });
        Ok(())
    }

    /// Authority can only ever withdraw accrued fees - never principal or the reserve directly.
    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, amount: u64) -> Result<()> {
        require!(amount <= ctx.accounts.pool.treasury_accrued, VaultError::InsufficientFunds);
        let mint_key = ctx.accounts.mint.key();
        let bump = [ctx.accounts.pool.bump];
        let signer_seeds: &[&[&[u8]]] = &[&[POOL_SEED, mint_key.as_ref(), &bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            ctx.accounts.mint.decimals,
        )?;
        let pool = &mut ctx.accounts.pool;
        pool.treasury_accrued = pool.treasury_accrued.checked_sub(amount).ok_or(VaultError::InsufficientFunds)?;
        ctx.accounts.vault.reload()?;
        let liabilities = pool
            .outstanding
            .checked_add(pool.reserve)
            .and_then(|v| v.checked_add(pool.treasury_accrued))
            .ok_or(VaultError::MathOverflow)?;
        require!(ctx.accounts.vault.amount >= liabilities, VaultError::InsolventVault);
        emit!(TreasuryWithdrawn { pool: pool.key(), to: ctx.accounts.destination.key(), amount });
        Ok(())
    }
}
