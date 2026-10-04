//! Shared LiteSVM helpers for the fitr-vault integration tests.
//! Run after `anchor build` (the tests load target/deploy/fitr_vault.so).
#![allow(dead_code)]

use anchor_lang::{
    prelude::Pubkey,
    solana_program::{
        bpf_loader_upgradeable::{self, UpgradeableLoaderState},
        clock::Clock,
        instruction::Instruction,
        program_pack::Pack,
        system_instruction,
    },
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::{associated_token, token::spl_token};
use fitr_vault::{
    accounts as acc, instruction as ix, Commitment, DayState, DeviceLock, Exercise, GoalLimits, InitPoolParams, Pool,
    UpdateConfigParams, UserProfile, COMMITMENT_SEED, DAY_SEED, DEVICE_SEED, POOL_SEED, PROFILE_SEED, VAULT_SEED,
};
use litesvm::LiteSVM;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

pub const SKR: u64 = 1_000_000; // 6 decimals like mainnet SKR
/// 2026-09-25T00:00:00Z
pub const T0: i64 = 1_790_294_400;
/// Mainnet goal limits (SPEC.md §9), indexed by Exercise code 0..16.
pub const MAINNET_GOALS: [GoalLimits; 16] = [
    GoalLimits { min: 10, max: 1_000 }, //  0 Pushup
    GoalLimits { min: 15, max: 1_000 }, //  1 Squat
    GoalLimits { min: 30, max: 3_600 }, //  2 Plank (s)
    GoalLimits { min: 10, max: 1_000 }, //  3 Lunge
    GoalLimits { min: 10, max: 1_000 }, //  4 Situp
    GoalLimits { min: 10, max: 1_000 }, //  5 LegRaise
    GoalLimits { min: 10, max: 1_000 }, //  6 GluteBridge
    GoalLimits { min: 30, max: 3_600 }, //  7 WallSit (s)
    GoalLimits { min: 5, max: 1_000 },  //  8 PikePushup
    GoalLimits { min: 10, max: 1_000 }, //  9 JumpSquat
    GoalLimits { min: 3, max: 1_000 },  // 10 Pullup
    GoalLimits { min: 5, max: 1_000 },  // 11 Dip
    GoalLimits { min: 5, max: 1_000 },  // 12 Burpee
    GoalLimits { min: 20, max: 3_000 }, // 13 MountainClimber
    GoalLimits { min: 20, max: 3_000 }, // 14 JumpingJack
    GoalLimits { min: 20, max: 3_000 }, // 15 HighKnees
];

/// MAINNET_GOALS with entry `i` replaced.
pub fn goals_with(i: usize, g: GoalLimits) -> [GoalLimits; 16] {
    let mut out = MAINNET_GOALS;
    out[i] = g;
    out
}
pub const SYS: Pubkey = anchor_lang::system_program::ID;

// ---------------------------------------------------------------- tx plumbing

#[derive(Debug, Clone)]
pub struct TxOk {
    /// Total CU of the transaction.
    pub cu: u64,
    /// CU of each top-level fitr_vault instruction, in order.
    pub ix_cu: Vec<u64>,
    pub logs: Vec<String>,
    /// Serialized wire size in bytes.
    pub size: usize,
}

#[derive(Debug, Clone)]
pub struct TxErr {
    /// Custom program error code, if any (Anchor/VaultError or SPL/system error).
    pub code: Option<u32>,
    pub err: String,
    pub logs: Vec<String>,
}

impl std::fmt::Display for TxErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} (code {:?})\n{}", self.err, self.code, self.logs.join("\n"))
    }
}

pub fn custom_code(err: &str) -> Option<u32> {
    let i = err.find("Custom(")? + 7;
    let j = err[i..].find(')')? + i;
    err[i..j].parse().ok()
}

pub fn send(svm: &mut LiteSVM, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> Result<TxOk, TxErr> {
    svm.expire_blockhash();
    let mut all: Vec<&Keypair> = vec![payer];
    for s in signers {
        if s.pubkey() != payer.pubkey() {
            all.push(s);
        }
    }
    let tx = Transaction::new_signed_with_payer(ixs, Some(&payer.pubkey()), &all, svm.latest_blockhash());
    let size = 1 + 64 * tx.signatures.len() + tx.message_data().len();
    match svm.send_transaction(tx) {
        Ok(m) => {
            let prefix = format!("Program {} consumed ", fitr_vault::ID);
            let ix_cu = m
                .logs
                .iter()
                .filter_map(|l| l.strip_prefix(&prefix))
                .filter_map(|r| r.split_whitespace().next()?.parse().ok())
                .collect();
            Ok(TxOk { cu: m.compute_units_consumed, ix_cu, logs: m.logs, size })
        }
        Err(e) => {
            let err = format!("{:?}", e.err);
            Err(TxErr { code: custom_code(&err), err, logs: e.meta.logs })
        }
    }
}

/// Asserts the transaction failed with the given custom error code.
#[track_caller]
pub fn expect_err(r: Result<TxOk, TxErr>, code: u32) {
    match r {
        Ok(_) => panic!("expected error {code}, transaction succeeded"),
        Err(e) => assert_eq!(e.code, Some(code), "wrong error: {e}"),
    }
}

// ---------------------------------------------------------------- clock / accounts

pub fn set_time(svm: &mut LiteSVM, ts: i64) {
    let mut c: Clock = svm.get_sysvar();
    c.unix_timestamp = ts;
    svm.set_sysvar(&c);
}

pub fn now(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<Clock>().unix_timestamp
}

pub fn balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    spl_token::state::Account::unpack(&svm.get_account(ata).unwrap().data).unwrap().amount
}

pub fn read<T: AccountDeserialize>(svm: &LiteSVM, addr: &Pubkey) -> Option<T> {
    let a = svm.get_account(addr)?;
    if a.lamports == 0 || a.data.is_empty() {
        return None;
    }
    T::try_deserialize(&mut a.data.as_slice()).ok()
}

pub fn exists(svm: &LiteSVM, addr: &Pubkey) -> bool {
    svm.get_account(addr).map(|a| a.lamports > 0).unwrap_or(false)
}

pub fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &fitr_vault::ID).0
}

// ---------------------------------------------------------------- deploy / mints

pub fn so_bytes() -> Vec<u8> {
    std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../../target/deploy/fitr_vault.so"))
        .expect("run `anchor build` first")
}

pub fn program_data_address() -> Pubkey {
    Pubkey::find_program_address(&[fitr_vault::ID.as_ref()], &bpf_loader_upgradeable::ID).0
}

/// Deploys the program through the upgradeable loader with `upgrade_authority`, exactly like
/// `solana program deploy` would (initialize_pool checks the ProgramData upgrade authority).
pub fn deploy_upgradeable(svm: &mut LiteSVM, so: &[u8], upgrade_authority: Option<Pubkey>) {
    let loader = bpf_loader_upgradeable::ID;
    let programdata = program_data_address();
    let mut pd = Vec::with_capacity(45 + so.len());
    pd.extend_from_slice(&3u32.to_le_bytes()); // UpgradeableLoaderState::ProgramData
    pd.extend_from_slice(&0u64.to_le_bytes()); // slot
    match upgrade_authority {
        Some(a) => {
            pd.push(1);
            pd.extend_from_slice(a.as_ref());
        }
        None => pd.extend_from_slice(&[0u8; 33]),
    }
    assert_eq!(pd.len(), UpgradeableLoaderState::size_of_programdata_metadata());
    pd.extend_from_slice(so);
    let lamports = svm.minimum_balance_for_rent_exemption(pd.len());
    svm.set_account(
        programdata,
        solana_account::Account { lamports, data: pd, owner: loader, executable: false, rent_epoch: 0 },
    )
    .unwrap();
    let mut p = 2u32.to_le_bytes().to_vec(); // UpgradeableLoaderState::Program
    p.extend_from_slice(programdata.as_ref());
    assert_eq!(p.len(), UpgradeableLoaderState::size_of_program());
    let lamports = svm.minimum_balance_for_rent_exemption(p.len());
    svm.set_account(
        fitr_vault::ID,
        solana_account::Account { lamports, data: p, owner: loader, executable: true, rent_epoch: 0 },
    )
    .unwrap();
}

pub fn create_mint(svm: &mut LiteSVM, authority: &Keypair, decimals: u8) -> Pubkey {
    let mint = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN);
    send(
        svm,
        &[
            system_instruction::create_account(
                &authority.pubkey(),
                &mint.pubkey(),
                rent,
                spl_token::state::Mint::LEN as u64,
                &spl_token::ID,
            ),
            spl_token::instruction::initialize_mint2(&spl_token::ID, &mint.pubkey(), &authority.pubkey(), None, decimals)
                .unwrap(),
        ],
        authority,
        &[&mint],
    )
    .unwrap();
    mint.pubkey()
}

/// Creates `owner`'s ATA for `mint` (paid by the mint authority) and mints `amount` into it.
pub fn fund_ata(svm: &mut LiteSVM, mint_authority: &Keypair, mint: &Pubkey, owner: &Pubkey, amount: u64) -> Pubkey {
    let ata = associated_token::get_associated_token_address(owner, mint);
    let mut ixs = vec![];
    if !exists(svm, &ata) {
        ixs.push(associated_token::spl_associated_token_account::instruction::create_associated_token_account(
            &mint_authority.pubkey(),
            owner,
            mint,
            &spl_token::ID,
        ));
    }
    if amount > 0 {
        ixs.push(spl_token::instruction::mint_to(&spl_token::ID, mint, &ata, &mint_authority.pubkey(), &[], amount).unwrap());
    }
    send(svm, &ixs, mint_authority, &[]).unwrap();
    ata
}

// ---------------------------------------------------------------- pool environment

pub fn params(attestor: Pubkey, day_len: i64) -> InitPoolParams {
    InitPoolParams {
        attestor,
        min_stake: SKR,
        max_stake: 10_000 * SKR,
        fee_bps: 500,
        streak_bonus_bps: 500,
        max_streak_bonus_bps: 5_000,
        day_length_secs: day_len,
        day_offset_secs: 0,
        commit_cutoff_secs: fitr_vault::math::max_commit_cutoff(day_len),
        attest_grace_secs: (day_len / 12).min(7_200),
        goal_limits: MAINNET_GOALS,
        daily_sponsor_amount: 0,
        require_sgt: false,
        // 0 keeps the classic "finalize at deadline + 1" timing in the older tests;
        // tests/regression.rs exercises a non-zero review window.
        finalize_delay_secs: 0,
    }
}

pub struct Env {
    pub svm: LiteSVM,
    /// Upgrade authority and pool authority.
    pub admin: Keypair,
    pub attestor: Keypair,
    pub mint: Pubkey,
    pub pool: Pubkey,
    pub vault: Pubkey,
    pub admin_ata: Pubkey,
    pub day_len: i64,
    pub offset: i64,
}

impl Env {
    /// Fresh LiteSVM, program deployed (upgrade authority = admin), 6-dp mint, pool initialized.
    pub fn new(p: InitPoolParams) -> Self {
        Self::with_so(&so_bytes(), p)
    }

    pub fn with_so(so: &[u8], p: InitPoolParams) -> Self {
        let mut env = Self::bare(so);
        let mut p = p;
        if p.attestor == Pubkey::default() {
            p.attestor = env.attestor.pubkey();
        }
        env.day_len = p.day_length_secs;
        env.offset = p.day_offset_secs;
        let init = env.ix_init(&env.admin.pubkey(), p);
        let admin = env.admin.insecure_clone();
        send(&mut env.svm, &[init], &admin, &[]).unwrap();
        env
    }

    /// Deployed program + mint, no pool yet.
    pub fn bare(so: &[u8]) -> Self {
        let mut svm = LiteSVM::new();
        let admin = Keypair::new();
        let attestor = Keypair::new();
        svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();
        svm.airdrop(&attestor.pubkey(), 1_000_000_000).unwrap();
        set_time(&mut svm, T0);
        deploy_upgradeable(&mut svm, so, Some(admin.pubkey()));
        let mint = create_mint(&mut svm, &admin, 6);
        let admin_ata = fund_ata(&mut svm, &admin, &mint, &admin.pubkey(), 0);
        let pool = pda(&[POOL_SEED, mint.as_ref()]);
        let vault = pda(&[VAULT_SEED, pool.as_ref()]);
        Env { svm, admin, attestor, mint, pool, vault, admin_ata, day_len: 86_400, offset: 0 }
    }

    pub fn ix_init(&self, authority: &Pubkey, p: InitPoolParams) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::InitializePool {
                authority: *authority,
                mint: self.mint,
                pool: self.pool,
                vault: self.vault,
                program_data: program_data_address(),
                token_program: spl_token::ID,
                system_program: SYS,
            }
            .to_account_metas(None),
            data: ix::InitializePool { p }.data(),
        }
    }

    // ---- time
    pub fn day_start(&self, d: u32) -> i64 {
        d as i64 * self.day_len + self.offset
    }
    pub fn day_end(&self, d: u32) -> i64 {
        self.day_start(d + 1)
    }
    pub fn today(&self) -> u32 {
        ((now(&self.svm) - self.offset) / self.day_len) as u32
    }
    pub fn warp(&mut self, ts: i64) {
        set_time(&mut self.svm, ts);
    }

    // ---- users
    pub fn user(&mut self, skr: u64) -> (Keypair, Pubkey) {
        let u = Keypair::new();
        self.svm.airdrop(&u.pubkey(), 2_000_000_000).unwrap();
        let admin = self.admin.insecure_clone();
        let ata = fund_ata(&mut self.svm, &admin, &self.mint, &u.pubkey(), skr * SKR);
        (u, ata)
    }

    // ---- PDAs
    pub fn day_pda(&self, d: u32) -> Pubkey {
        pda(&[DAY_SEED, self.pool.as_ref(), &d.to_le_bytes()])
    }
    pub fn commitment_pda(&self, user: &Pubkey, d: u32) -> Pubkey {
        pda(&[COMMITMENT_SEED, self.pool.as_ref(), user.as_ref(), &d.to_le_bytes()])
    }
    pub fn profile_pda(&self, user: &Pubkey) -> Pubkey {
        pda(&[PROFILE_SEED, self.pool.as_ref(), user.as_ref()])
    }
    pub fn device_pda(&self, sgt_mint: &Pubkey) -> Pubkey {
        pda(&[DEVICE_SEED, self.pool.as_ref(), sgt_mint.as_ref()])
    }

    // ---- reads
    pub fn pool_state(&self) -> Pool {
        read(&self.svm, &self.pool).unwrap()
    }
    pub fn day_state(&self, d: u32) -> Option<DayState> {
        read(&self.svm, &self.day_pda(d))
    }
    pub fn commitment(&self, user: &Pubkey, d: u32) -> Option<Commitment> {
        read(&self.svm, &self.commitment_pda(user, d))
    }
    pub fn profile(&self, user: &Pubkey) -> Option<UserProfile> {
        read(&self.svm, &self.profile_pda(user))
    }
    pub fn device(&self, sgt_mint: &Pubkey) -> Option<DeviceLock> {
        read(&self.svm, &self.device_pda(sgt_mint))
    }
    pub fn vault_balance(&self) -> u64 {
        balance(&self.svm, &self.vault)
    }
    pub fn bal(&self, ata: &Pubkey) -> u64 {
        balance(&self.svm, ata)
    }

    // ---- instruction builders
    #[allow(clippy::too_many_arguments)]
    pub fn ix_commit(
        &self,
        user: &Pubkey,
        user_token: &Pubkey,
        d: u32,
        amount: u64,
        exercise: Exercise,
        goal: u32,
        sgt: Option<(Pubkey, Pubkey)>, // (sgt token account, device lock)
    ) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::Commit {
                user: *user,
                pool: self.pool,
                mint: self.mint,
                user_token: *user_token,
                vault: self.vault,
                day: self.day_pda(d),
                commitment: self.commitment_pda(user, d),
                profile: self.profile_pda(user),
                sgt_token: sgt.map(|s| s.0),
                device: sgt.map(|s| s.1),
                token_program: spl_token::ID,
                system_program: SYS,
            }
            .to_account_metas(None),
            data: ix::Commit { day_index: d, amount, exercise, goal_target: goal }.data(),
        }
    }

    pub fn ix_attest(&self, signer: &Pubkey, user: &Pubkey, d: u32, reps: u32, started: i64) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::AttestCompletion {
                attestor: *signer,
                pool: self.pool,
                user: *user,
                day: self.day_pda(d),
                commitment: self.commitment_pda(user, d),
                profile: self.profile_pda(user),
            }
            .to_account_metas(None),
            data: ix::AttestCompletion { day_index: d, reps, session_hash: [7u8; 32], session_started_at: started }
                .data(),
        }
    }

    pub fn ix_revoke(&self, signer: &Pubkey, user: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::RevokeCompletion {
                signer: *signer,
                pool: self.pool,
                user: *user,
                day: self.day_pda(d),
                commitment: self.commitment_pda(user, d),
                profile: self.profile_pda(user),
            }
            .to_account_metas(None),
            data: ix::RevokeCompletion { day_index: d }.data(),
        }
    }

    pub fn ix_finalize(&self, cranker: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::FinalizeDay { cranker: *cranker, pool: self.pool, day: self.day_pda(d) }.to_account_metas(None),
            data: ix::FinalizeDay { day_index: d }.data(),
        }
    }

    pub fn ix_void(&self, authority: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::VoidDay { authority: *authority, pool: self.pool, day: self.day_pda(d) }.to_account_metas(None),
            data: ix::VoidDay { day_index: d }.data(),
        }
    }

    pub fn ix_claim(&self, user: &Pubkey, user_token: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::Claim {
                user: *user,
                pool: self.pool,
                mint: self.mint,
                vault: self.vault,
                user_token: *user_token,
                day: self.day_pda(d),
                commitment: self.commitment_pda(user, d),
                profile: self.profile_pda(user),
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
            data: ix::Claim { day_index: d }.data(),
        }
    }

    pub fn ix_close_missed(&self, cranker: &Pubkey, user: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::CloseMissed {
                cranker: *cranker,
                pool: self.pool,
                user: *user,
                day: self.day_pda(d),
                commitment: self.commitment_pda(user, d),
                profile: self.profile_pda(user),
            }
            .to_account_metas(None),
            data: ix::CloseMissed { day_index: d }.data(),
        }
    }

    pub fn ix_sweep(&self, cranker: &Pubkey, rent_payer: &Pubkey, d: u32) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::SweepDay { cranker: *cranker, pool: self.pool, rent_payer: *rent_payer, day: self.day_pda(d) }
                .to_account_metas(None),
            data: ix::SweepDay { day_index: d }.data(),
        }
    }

    pub fn ix_fund(&self, funder: &Pubkey, funder_token: &Pubkey, amount: u64) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::FundReserve {
                funder: *funder,
                pool: self.pool,
                mint: self.mint,
                funder_token: *funder_token,
                vault: self.vault,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
            data: ix::FundReserve { amount }.data(),
        }
    }

    pub fn ix_withdraw(&self, authority: &Pubkey, destination: &Pubkey, amount: u64) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::WithdrawTreasury {
                authority: *authority,
                pool: self.pool,
                mint: self.mint,
                vault: self.vault,
                destination: *destination,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
            data: ix::WithdrawTreasury { amount }.data(),
        }
    }

    pub fn ix_update(&self, authority: &Pubkey, p: UpdateConfigParams) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::UpdateConfig { authority: *authority, pool: self.pool }.to_account_metas(None),
            data: ix::UpdateConfig { p }.data(),
        }
    }

    pub fn ix_propose(&self, authority: &Pubkey, new_authority: Pubkey) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::UpdateConfig { authority: *authority, pool: self.pool }.to_account_metas(None),
            data: ix::ProposeAuthority { new_authority }.data(),
        }
    }

    pub fn ix_accept(&self, new_authority: &Pubkey) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::AcceptAuthority { new_authority: *new_authority, pool: self.pool }.to_account_metas(None),
            data: ix::AcceptAuthority {}.data(),
        }
    }

    pub fn ix_register(&self, user: &Pubkey, sgt_mint: &Pubkey, sgt_token: &Pubkey) -> Instruction {
        Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::RegisterDevice {
                user: *user,
                pool: self.pool,
                sgt_mint: *sgt_mint,
                sgt_token: *sgt_token,
                device: self.device_pda(sgt_mint),
                token_2022_program: anchor_spl::token_2022::ID,
                system_program: SYS,
            }
            .to_account_metas(None),
            data: ix::RegisterDevice {}.data(),
        }
    }

    // ---- send shortcuts
    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair) -> Result<TxOk, TxErr> {
        send(&mut self.svm, ixs, payer, &[])
    }
    pub fn send_admin(&mut self, ixs: &[Instruction]) -> Result<TxOk, TxErr> {
        let a = self.admin.insecure_clone();
        send(&mut self.svm, ixs, &a, &[])
    }
    pub fn send_attestor(&mut self, ixs: &[Instruction]) -> Result<TxOk, TxErr> {
        let a = self.attestor.insecure_clone();
        send(&mut self.svm, ixs, &a, &[])
    }
}

// ---------------------------------------------------------------- deterministic PRNG

/// SplitMix64: tiny, deterministic, dependency-free.
#[derive(Clone)]
pub struct Rng(pub u64);

impl Rng {
    pub fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
    /// Uniform in [lo, hi] (inclusive).
    pub fn range(&mut self, lo: u64, hi: u64) -> u64 {
        assert!(lo <= hi);
        let span = hi - lo;
        if span == u64::MAX {
            return self.next();
        }
        lo + self.next() % (span + 1)
    }
    pub fn irange(&mut self, lo: i64, hi: i64) -> i64 {
        assert!(lo <= hi);
        lo + (self.next() % ((hi - lo) as u64 + 1)) as i64
    }
    pub fn chance(&mut self, pct: u64) -> bool {
        self.next() % 100 < pct
    }
    pub fn pick<'a, T>(&mut self, v: &'a [T]) -> &'a T {
        &v[(self.next() % v.len() as u64) as usize]
    }
}
