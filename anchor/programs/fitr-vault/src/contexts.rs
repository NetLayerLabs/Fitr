use crate::constants::*;
use crate::error::VaultError;
use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitPoolParams {
    pub attestor: Pubkey,
    /// Inclusive per-commitment stake bounds in base units (0 < min <= max <= ceiling).
    pub min_stake: u64,
    pub max_stake: u64,
    pub fee_bps: u16,
    pub streak_bonus_bps: u16,
    pub max_streak_bonus_bps: u16,
    /// 300..=86_400. IMMUTABLE after init (86_400 on mainnet).
    pub day_length_secs: i64,
    /// 0 <= offset < day_length_secs. IMMUTABLE after init.
    pub day_offset_secs: i64,
    pub commit_cutoff_secs: i64,
    pub attest_grace_secs: i64,
    /// Goal bounds indexed by Exercise code (0..EXERCISE_COUNT, enum order).
    pub goal_limits: [GoalLimits; EXERCISE_COUNT],
    /// <= max_stake.
    pub daily_sponsor_amount: u64,
    pub require_sgt: bool,
    /// Review window between a day's attest deadline and finalize: 0..=min(12 h, day length).
    pub finalize_delay_secs: i64,
}

/// Every field optional; day_length_secs and day_offset_secs are deliberately absent (immutable).
/// All bounds are re-validated on the resulting config.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct UpdateConfigParams {
    pub attestor: Option<Pubkey>,
    pub min_stake: Option<u64>,
    pub max_stake: Option<u64>,
    pub fee_bps: Option<u16>,
    pub streak_bonus_bps: Option<u16>,
    pub max_streak_bonus_bps: Option<u16>,
    pub commit_cutoff_secs: Option<i64>,
    pub attest_grace_secs: Option<i64>,
    pub goal_limits: Option<[GoalLimits; EXERCISE_COUNT]>,
    pub daily_sponsor_amount: Option<u64>,
    pub paused: Option<bool>,
    pub require_sgt: Option<bool>,
    pub finalize_delay_secs: Option<i64>,
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    /// Becomes pool.authority and pays rent. Must be the program's upgrade authority.
    #[account(mut)]
    pub authority: Signer<'info>,
    /// This program's ProgramData account. Only the program's upgrade authority may create
    /// a pool, so nobody can front-run the canonical ["pool", SKR] PDA after deploy.
    /// (Anchor runs `init` before other constraints; a failed check reverts the whole tx.)
    #[account(
        seeds = [crate::ID.as_ref()],
        bump,
        seeds::program = anchor_lang::solana_program::bpf_loader_upgradeable::ID,
        constraint = program_data.upgrade_authority_address == Some(authority.key())
            @ VaultError::NotUpgradeAuthority
    )]
    pub program_data: Box<Account<'info, ProgramData>>,
    #[account(mint::token_program = token_program)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    #[account(
        init,
        payer = authority,
        seeds = [VAULT_SEED, pool.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = pool,
        token::token_program = token_program
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @ VaultError::NotAuthority)]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct AcceptAuthority<'info> {
    pub new_authority: Signer<'info>,
    #[account(mut, constraint = pool.pending_authority == new_authority.key() @ VaultError::NotPendingAuthority)]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct RegisterDevice<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub pool: Account<'info, Pool>,
    /// Must be a Token-2022 mint; SGT extension checks run in the handler.
    #[account(mint::token_program = token_2022_program)]
    pub sgt_mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = sgt_mint,
        token::authority = user,
        token::token_program = token_2022_program,
        constraint = sgt_token.amount == 1 @ VaultError::InvalidSgt
    )]
    pub sgt_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + DeviceLock::INIT_SPACE,
        seeds = [DEVICE_SEED, pool.key().as_ref(), sgt_mint.key().as_ref()],
        bump
    )]
    pub device: Account<'info, DeviceLock>,
    #[account(address = anchor_spl::token_2022::ID)]
    pub token_2022_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct Commit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [POOL_SEED, mint.key().as_ref()],
        bump = pool.bump,
        has_one = mint,
        has_one = vault
    )]
    pub pool: Box<Account<'info, Pool>>,
    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = user,
        token::token_program = token_program
    )]
    pub user_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + DayState::INIT_SPACE,
        seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()],
        bump
    )]
    pub day: Box<Account<'info, DayState>>,
    #[account(
        init,
        payer = user,
        space = 8 + Commitment::INIT_SPACE,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), user.key().as_ref(), &day_index.to_le_bytes()],
        bump
    )]
    pub commitment: Box<Account<'info, Commitment>>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [PROFILE_SEED, pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
    /// Required iff pool.require_sgt. Validated in handler against `device`.
    pub sgt_token: Option<Box<InterfaceAccount<'info, TokenAccount>>>,
    /// Required iff pool.require_sgt. PDA ["device", pool, sgt_mint] created by register_device.
    /// Owner + discriminator are checked by Account<>; DeviceLock accounts can only be created by
    /// register_device at that PDA after assert_is_sgt, so the handler's `device.pool == pool` and
    /// `sgt_token.mint == device.sgt_mint` checks bind it without re-deriving the address.
    #[account(mut)]
    pub device: Option<Box<Account<'info, DeviceLock>>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct AttestCompletion<'info> {
    /// Must be the attestor snapshotted into this day's DayState (not the current pool.attestor),
    /// so rotating the pool attestor never changes who can attest a live day.
    pub attestor: Signer<'info>,
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: only used as a PDA seed; the commitment/profile seeds bind it.
    pub user: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()],
        bump = day.bump,
        constraint = day.attestor == attestor.key() @ VaultError::NotAttestor
    )]
    pub day: Box<Account<'info, DayState>>,
    #[account(
        mut,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), user.key().as_ref(), &day_index.to_le_bytes()],
        bump = commitment.bump
    )]
    pub commitment: Box<Account<'info, Commitment>>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, pool.key().as_ref(), user.key().as_ref()],
        bump = profile.bump
    )]
    pub profile: Box<Account<'info, UserProfile>>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct RevokeCompletion<'info> {
    /// The pool authority or the day's snapshotted attestor.
    pub signer: Signer<'info>,
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: PDA seed only.
    pub user: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()],
        bump = day.bump,
        constraint = (signer.key() == pool.authority || signer.key() == day.attestor) @ VaultError::NotAuthority
    )]
    pub day: Box<Account<'info, DayState>>,
    #[account(
        mut,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), user.key().as_ref(), &day_index.to_le_bytes()],
        bump = commitment.bump
    )]
    pub commitment: Box<Account<'info, Commitment>>,
    #[account(mut, seeds = [PROFILE_SEED, pool.key().as_ref(), user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct FinalizeDay<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(mut, seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()], bump = day.bump)]
    pub day: Box<Account<'info, DayState>>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct VoidDay<'info> {
    pub authority: Signer<'info>,
    #[account(has_one = authority @ VaultError::NotAuthority)]
    pub pool: Box<Account<'info, Pool>>,
    #[account(mut, seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()], bump = day.bump)]
    pub day: Box<Account<'info, DayState>>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct Claim<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [POOL_SEED, mint.key().as_ref()],
        bump = pool.bump,
        has_one = mint,
        has_one = vault
    )]
    pub pool: Box<Account<'info, Pool>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    /// Any token account of the stake mint (payout destination), except the vault itself.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = user_token.key() != vault.key() @ VaultError::InvalidDestination
    )]
    pub user_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()], bump = day.bump)]
    pub day: Box<Account<'info, DayState>>,
    #[account(
        mut,
        close = user,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), user.key().as_ref(), &day_index.to_le_bytes()],
        bump = commitment.bump
    )]
    pub commitment: Box<Account<'info, Commitment>>,
    #[account(mut, seeds = [PROFILE_SEED, pool.key().as_ref(), user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct CloseMissed<'info> {
    pub cranker: Signer<'info>,
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: rent refund destination; bound by commitment seeds + has_one.
    #[account(mut)]
    pub user: UncheckedAccount<'info>,
    #[account(mut, seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()], bump = day.bump)]
    pub day: Box<Account<'info, DayState>>,
    #[account(
        mut,
        close = user,
        has_one = user,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), user.key().as_ref(), &day_index.to_le_bytes()],
        bump = commitment.bump
    )]
    pub commitment: Box<Account<'info, Commitment>>,
    #[account(mut, seeds = [PROFILE_SEED, pool.key().as_ref(), user.key().as_ref()], bump = profile.bump)]
    pub profile: Box<Account<'info, UserProfile>>,
}

#[derive(Accounts)]
#[instruction(day_index: u32)]
pub struct SweepDay<'info> {
    pub cranker: Signer<'info>,
    #[account(mut)]
    pub pool: Box<Account<'info, Pool>>,
    /// CHECK: receives DayState rent; must equal day.rent_payer.
    #[account(mut, address = day.rent_payer)]
    pub rent_payer: UncheckedAccount<'info>,
    #[account(
        mut,
        close = rent_payer,
        seeds = [DAY_SEED, pool.key().as_ref(), &day_index.to_le_bytes()],
        bump = day.bump
    )]
    pub day: Box<Account<'info, DayState>>,
}

#[derive(Accounts)]
pub struct FundReserve<'info> {
    pub funder: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub pool: Box<Account<'info, Pool>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = mint, token::authority = funder, token::token_program = token_program)]
    pub funder_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [POOL_SEED, mint.key().as_ref()],
        bump = pool.bump,
        has_one = authority @ VaultError::NotAuthority,
        has_one = mint,
        has_one = vault
    )]
    pub pool: Box<Account<'info, Pool>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut)]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = destination.key() != vault.key() @ VaultError::InvalidDestination
    )]
    pub destination: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}
