use anchor_lang::prelude::*;

/// Codes are 6000 + declaration index. 6000-6022 are unchanged from the prototype;
/// 6023+ were appended in v2. Never reorder.
#[error_code]
pub enum VaultError {
    #[msg("Pool is paused")]
    Paused,
    #[msg("Signer is not the pool authority")]
    NotAuthority,
    #[msg("Signer is not the registered attestor")]
    NotAttestor,
    #[msg("Signer is not the pending authority")]
    NotPendingAuthority,
    #[msg("Config value out of bounds")]
    InvalidConfig,
    #[msg("Mint has a Token-2022 extension this vault does not support")]
    UnsupportedMintExtension,
    #[msg("Day index is not today or tomorrow")]
    InvalidDay,
    #[msg("Commit window for this day has closed")]
    CommitWindowClosed,
    #[msg("Attestation window for this day has closed")]
    AttestWindowClosed,
    #[msg("Day cannot be finalized before the attestation deadline")]
    DayNotOver,
    #[msg("Day already finalized")]
    AlreadyFinalized,
    #[msg("Day not finalized yet")]
    NotFinalized,
    #[msg("Day has been voided")]
    DayVoided,
    #[msg("Commitment is not in the required state")]
    InvalidCommitmentState,
    #[msg("Session timestamp is outside the allowed window")]
    InvalidSessionTime,
    #[msg("Seeker Genesis Token required")]
    SgtRequired,
    #[msg("Not a valid Seeker Genesis Token")]
    InvalidSgt,
    #[msg("Device already committed for this day")]
    DeviceAlreadyCommitted,
    #[msg("Not all commitments for this day are resolved")]
    DayNotResolved,
    #[msg("Amount exceeds available balance")]
    InsufficientFunds,
    #[msg("Vault solvency invariant violated")]
    InsolventVault,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Clock value is before the pool day offset")]
    ClockBeforeOffset,
    // ---- v2 additions: append only, never reorder (codes are part of the client ABI) ----
    #[msg("Stake amount is outside the pool's min/max stake")]
    StakeOutOfBounds,
    #[msg("Goal target is outside the pool's limits for this exercise")]
    GoalOutOfBounds,
    #[msg("Attested reps/seconds are below the committed goal")]
    GoalNotMet,
    #[msg("Stake mint has more decimals than supported")]
    UnsupportedMintDecimals,
    #[msg("Signer is not the program upgrade authority")]
    NotUpgradeAuthority,
    #[msg("Destination token account must not be the vault")]
    InvalidDestination,
    // ---- crews: append only ----
    #[msg("Commitment does not match the crew's fixed exercise or goal")]
    CrewGoalMismatch,
    #[msg("Invalid crew: crew_id 0, empty or non-UTF-8 name, or a fixed goal without a fixed exercise")]
    InvalidCrew,
    // ---- crews hardening: append only ----
    #[msg("This pool's sponsor tap is closed (daily_sponsor_amount is 0): a deposit would never be drawn")]
    SponsorTapClosed,
}
