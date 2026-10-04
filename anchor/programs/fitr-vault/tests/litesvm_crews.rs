//! Crews: permissionless group pools ["pool", mint, crew_id] that copy the global pool's config.
//! Covers create_crew validation, config copy, fixed exercise/goal enforcement, the creator having
//! no powers, a full crew day settled side by side with the global pool, cross-pool isolation
//! (no account of one pool can be used to move another pool's tokens) and sponsored days per pool.
//! Run after `anchor build`: cargo test --test litesvm_crews
mod common;
use anchor_lang::{prelude::Pubkey, solana_program::program_pack::Pack};
use common::*;
use fitr_vault::{CommitmentStatus, Exercise, InitPoolParams, Pool, UpdateConfigParams};
use solana_keypair::Keypair;
use solana_signer::Signer;

const DAY: u32 = 20_721; // 2026-09-25 UTC
const DAY_START: i64 = DAY as i64 * 86_400;
const CREW: u64 = 0xC0FF_EE00_1234_5678;

const ERR_PAUSED: u32 = 6000;
const ERR_NOT_AUTHORITY: u32 = 6001;
const ERR_INVALID_CONFIG: u32 = 6004;
const ERR_GOAL_OUT_OF_BOUNDS: u32 = 6024;
const ERR_CREW_GOAL_MISMATCH: u32 = 6029;
const ERR_INVALID_CREW: u32 = 6030;
const ERR_SPONSOR_TAP_CLOSED: u32 = 6031;
const ANCHOR_HAS_ONE: u32 = 2001;
const ANCHOR_SEEDS: u32 = 2006;

fn crew_params() -> InitPoolParams {
    InitPoolParams {
        commit_cutoff_secs: 12 * 3_600,
        attest_grace_secs: 2 * 3_600,
        fee_bps: 500,
        daily_sponsor_amount: 0,
        finalize_delay_secs: 600,
        ..params(Default::default(), 86_400)
    }
}

fn env_at_day() -> Env {
    let mut env = Env::new(crew_params());
    env.warp(DAY_START + 3_600);
    env
}

/// Creates crew `id` (paid by a fresh wallet) and returns the creator.
fn create(env: &mut Env, id: u64, name: &str, ex: Option<Exercise>, goal: Option<u32>) -> Keypair {
    let (creator, _) = env.user(0);
    let ix = env.ix_create_crew(&creator.pubkey(), id, crew_name(name), ex, goal);
    env.send(&[ix], &creator).unwrap();
    creator
}

fn pool_at(env: &Env, crew_id: u64) -> Pool {
    read(&env.svm, &pool_pda(&env.mint, crew_id)).unwrap()
}

#[test]
fn create_crew_copies_the_global_config() {
    let mut env = env_at_day();
    let admin = env.admin.pubkey();
    // make the global config non-default so the copy is meaningful
    let up = UpdateConfigParams {
        min_stake: Some(2 * SKR),
        max_stake: Some(500 * SKR),
        fee_bps: Some(700),
        streak_bonus_bps: Some(300),
        max_streak_bonus_bps: Some(3_000),
        goal_limits: Some(goals_with(0, fitr_vault::GoalLimits { min: 12, max: 400 })),
        daily_sponsor_amount: Some(5 * SKR),
        require_sgt: Some(true),
        finalize_delay_secs: Some(1_200),
        ..Default::default()
    };
    env.send_admin(&[env.ix_update(&admin, up)]).unwrap();

    let (creator, _) = env.user(0);
    let ix = env.ix_create_crew(&creator.pubkey(), CREW, crew_name("Dawn patrol 🌅"), Some(Exercise::Pushup), Some(20));
    let r = env.send(&[ix], &creator).unwrap();
    println!("CU create_crew {:>6}", r.cu);

    let g = pool_at(&env, 0);
    let c = pool_at(&env, CREW);
    let crew_pool = pool_pda(&env.mint, CREW);
    // every config field is copied
    assert_eq!(
        (c.authority, c.attestor, c.mint, c.mint_decimals, c.require_sgt, c.day_length_secs, c.day_offset_secs),
        (g.authority, g.attestor, g.mint, g.mint_decimals, g.require_sgt, g.day_length_secs, g.day_offset_secs)
    );
    assert_eq!(
        (c.commit_cutoff_secs, c.attest_grace_secs, c.min_stake, c.max_stake, c.fee_bps),
        (g.commit_cutoff_secs, g.attest_grace_secs, g.min_stake, g.max_stake, g.fee_bps)
    );
    assert_eq!(
        (c.streak_bonus_bps, c.max_streak_bonus_bps, c.goal_limits, c.daily_sponsor_amount, c.finalize_delay_secs),
        (g.streak_bonus_bps, g.max_streak_bonus_bps, g.goal_limits, g.daily_sponsor_amount, g.finalize_delay_secs)
    );
    // own accounting and crew fields
    assert_eq!((c.reserve, c.treasury_accrued, c.outstanding, c.paused, c.paused_since, c.total_paused_secs), (0, 0, 0, false, 0, 0));
    assert_eq!((c.version, c.pending_authority, c.vault), (1, Pubkey::default(), vault_pda(&crew_pool)));
    assert_eq!((c.crew_id, c.creator, c.name), (CREW, creator.pubkey(), crew_name("Dawn patrol 🌅")));
    assert_eq!((c.has_fixed_exercise, c.fixed_exercise, c.fixed_goal_target), (true, Exercise::Pushup, 20));
    assert_ne!(c.authority, creator.pubkey());
    // the global pool's crew fields
    assert_eq!((g.crew_id, g.creator, g.name, g.has_fixed_exercise, g.fixed_goal_target), (0, Pubkey::default(), [0; 32], false, 0));
    // the crew vault is a token account of the mint owned by the crew pool
    assert!(exists(&env.svm, &c.vault));
    assert_eq!(balance(&env.svm, &c.vault), 0);
    let va = anchor_spl::token::spl_token::state::Account::unpack(&env.svm.get_account(&c.vault).unwrap().data).unwrap();
    assert_eq!((va.mint, va.owner), (env.mint, crew_pool));
}

#[test]
fn create_crew_validation() {
    let mut env = env_at_day();
    let (creator, _) = env.user(0);
    let cp = creator.pubkey();
    let g_before = pool_at(&env, 0);

    // crew_id 0 is the global pool's address: init fails (account in use), the global pool is untouched
    assert!(env.send(&[env.ix_create_crew(&cp, 0, crew_name("x"), None, None)], &creator).is_err());
    assert_eq!(pool_at(&env, 0).authority, g_before.authority);
    assert_eq!(pool_at(&env, 0).crew_id, 0);

    // names: empty, interior NUL, invalid UTF-8
    expect_err(env.send(&[env.ix_create_crew(&cp, 1, [0; 32], None, None)], &creator), ERR_INVALID_CREW);
    expect_err(env.send(&[env.ix_create_crew(&cp, 1, crew_name("a\0b"), None, None)], &creator), ERR_INVALID_CREW);
    let mut bad = [0u8; 32];
    bad[..2].copy_from_slice(&[0xC3, 0x28]);
    expect_err(env.send(&[env.ix_create_crew(&cp, 1, bad, None, None)], &creator), ERR_INVALID_CREW);
    // a fixed goal without a fixed exercise
    expect_err(env.send(&[env.ix_create_crew(&cp, 1, crew_name("g"), None, Some(20))], &creator), ERR_INVALID_CREW);
    // a fixed goal outside the pool's limits for that exercise (push-ups 10..=1000)
    for goal in [9, 1_001, 0] {
        expect_err(
            env.send(&[env.ix_create_crew(&cp, 1, crew_name("g"), Some(Exercise::Pushup), Some(goal))], &creator),
            ERR_GOAL_OUT_OF_BOUNDS,
        );
    }
    // the global pool's own account cannot be replaced by another pool as config source
    env.send(&[env.ix_create_crew(&cp, 7, crew_name("seven"), None, None)], &creator).unwrap();
    let mut ix = env.ix_create_crew(&cp, 8, crew_name("eight"), None, None);
    ix.accounts[1].pubkey = pool_pda(&env.mint, 7);
    expect_err(env.send(&[ix], &creator), ANCHOR_SEEDS);

    // valid: exercise only (free goal), and no rules at all
    env.send(&[env.ix_create_crew(&cp, 1, crew_name("Plankers"), Some(Exercise::Plank), None)], &creator).unwrap();
    let c = pool_at(&env, 1);
    assert_eq!((c.has_fixed_exercise, c.fixed_exercise, c.fixed_goal_target), (true, Exercise::Plank, 0));
    let c7 = pool_at(&env, 7);
    assert!(!c7.has_fixed_exercise);
    // boundary goals are accepted; full 32-byte name
    env.send(&[env.ix_create_crew(&cp, 2, [b'z'; 32], Some(Exercise::Pushup), Some(10))], &creator).unwrap();
    env.send(&[env.ix_create_crew(&cp, 3, crew_name("max"), Some(Exercise::Pushup), Some(1_000))], &creator).unwrap();

    // duplicate id: init fails, the existing crew keeps its creator and rules
    let (other, _) = env.user(0);
    assert!(env.send(&[env.ix_create_crew(&other.pubkey(), 1, crew_name("takeover"), None, None)], &other).is_err());
    let c = pool_at(&env, 1);
    assert_eq!((c.creator, c.name, c.fixed_exercise), (cp, crew_name("Plankers"), Exercise::Plank));

    // a paused global pool blocks new crews
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_update(&admin, UpdateConfigParams { paused: Some(true), ..Default::default() })]).unwrap();
    expect_err(env.send(&[env.ix_create_crew(&cp, 9, crew_name("p"), None, None)], &creator), ERR_PAUSED);
    env.send_admin(&[env.ix_update(&admin, UpdateConfigParams { paused: Some(false), ..Default::default() })]).unwrap();
    env.send(&[env.ix_create_crew(&cp, 9, crew_name("p"), None, None)], &creator).unwrap();
}

#[test]
fn fixed_exercise_and_goal_are_enforced() {
    let mut env = env_at_day();
    create(&mut env, 11, "pushups20", Some(Exercise::Pushup), Some(20));
    create(&mut env, 12, "squats", Some(Exercise::Squat), None);
    let (a, a_ata) = env.user(1_000);
    let ap = a.pubkey();

    env.use_crew(11);
    for (ex, goal) in [(Exercise::Squat, 20), (Exercise::Pushup, 21), (Exercise::Pushup, 19), (Exercise::Plank, 40)] {
        expect_err(env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, ex, goal, None)], &a), ERR_CREW_GOAL_MISMATCH);
    }
    // the pool rails still apply before the crew rule
    expect_err(env.send(&[env.ix_commit(&ap, &a_ata, DAY, 0, Exercise::Pushup, 20, None)], &a), 6023);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 20, None)], &a).unwrap();
    let c = env.commitment(&ap, DAY).unwrap();
    assert_eq!((c.exercise, c.goal_target, c.pool), (Exercise::Pushup, 20, env.pool));

    env.use_crew(12);
    expect_err(env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 20, None)], &a), ERR_CREW_GOAL_MISMATCH);
    // any goal within the limits (squats 15..=1000)
    expect_err(env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Squat, 14, None)], &a), ERR_GOAL_OUT_OF_BOUNDS);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Squat, 333, None)], &a).unwrap();

    // the global pool has no crew rule: same user, same day, any exercise
    env.use_crew(0);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Plank, 45, None)], &a).unwrap();
    assert_eq!(balance(&env.svm, &vault_pda(&pool_pda(&env.mint, 11))), 10 * SKR);
    assert_eq!(balance(&env.svm, &vault_pda(&pool_pda(&env.mint, 12))), 10 * SKR);
    assert_eq!(env.vault_balance(), 10 * SKR);
}

#[test]
fn creator_has_no_powers() {
    let mut env = env_at_day();
    let creator = create(&mut env, CREW, "mine", None, None);
    let cp = creator.pubkey();
    env.svm.airdrop(&cp, 1_000_000_000).unwrap();
    env.use_crew(CREW);
    let (a, a_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    let creator_ata = fund_ata(&mut env.svm, &env.admin.insecure_clone(), &env.mint, &cp, 0);

    let up = UpdateConfigParams { attestor: Some(cp), ..Default::default() };
    expect_err(env.send(&[env.ix_update(&cp, up)], &creator), ERR_NOT_AUTHORITY);
    let up = UpdateConfigParams { paused: Some(true), ..Default::default() };
    expect_err(env.send(&[env.ix_update(&cp, up)], &creator), ERR_NOT_AUTHORITY);
    expect_err(env.send(&[env.ix_propose(&cp, cp)], &creator), ERR_NOT_AUTHORITY);
    expect_err(env.send(&[env.ix_void(&cp, DAY)], &creator), ERR_NOT_AUTHORITY);
    expect_err(env.send(&[env.ix_withdraw(&cp, &creator_ata, 0)], &creator), ERR_NOT_AUTHORITY);
    env.warp(DAY_START + 4 * 3_600);
    expect_err(env.send(&[env.ix_attest(&cp, &a.pubkey(), DAY, 10, DAY_START + 3 * 3_600)], &creator), 6002);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), DAY, 10, DAY_START + 3 * 3_600)]).unwrap();
    expect_err(env.send(&[env.ix_revoke(&cp, &a.pubkey(), DAY)], &creator), ERR_NOT_AUTHORITY);

    // the global authority does govern the crew, without touching the global pool
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_update(&admin, UpdateConfigParams { fee_bps: Some(1_000), ..Default::default() })]).unwrap();
    assert_eq!(pool_at(&env, CREW).fee_bps, 1_000);
    assert_eq!(pool_at(&env, 0).fee_bps, 500);
    // and changes to the global pool do not leak into an existing crew
    env.use_crew(0);
    env.send_admin(&[env.ix_update(&admin, UpdateConfigParams { min_stake: Some(3 * SKR), ..Default::default() })]).unwrap();
    assert_eq!(pool_at(&env, CREW).min_stake, SKR);
    assert_eq!(pool_at(&env, 0).min_stake, 3 * SKR);
    // the crew's authority transfer is per pool
    env.use_crew(CREW);
    let new_auth = Keypair::new();
    env.svm.airdrop(&new_auth.pubkey(), 1_000_000_000).unwrap();
    env.send_admin(&[env.ix_propose(&admin, new_auth.pubkey())]).unwrap();
    expect_err(env.send(&[env.ix_accept(&cp)], &creator), 6003);
    env.send(&[env.ix_accept(&new_auth.pubkey())], &new_auth).unwrap();
    assert_eq!(pool_at(&env, CREW).authority, new_auth.pubkey());
    assert_eq!(pool_at(&env, 0).authority, admin);
}

/// The worked example (3 x 100 SKR, 2 complete, 5 % fee) in a crew, while the same wallets also
/// stake in the global pool, where everyone completes. Each pool settles on its own vault.
#[test]
fn crew_day_settles_independently_of_the_global_pool() {
    let mut env = env_at_day();
    create(&mut env, CREW, "Push crew", Some(Exercise::Pushup), Some(20));
    let users: Vec<_> = (0..3).map(|_| env.user(1_000)).collect();
    let crew_pool = pool_pda(&env.mint, CREW);
    let crew_vault = vault_pda(&crew_pool);
    let global_vault = vault_pda(&env.global_pool());

    for (u, ata) in &users {
        env.use_crew(CREW);
        env.send(&[env.ix_commit(&u.pubkey(), ata, DAY, 100 * SKR, Exercise::Pushup, 20, None)], u).unwrap();
        env.use_crew(0);
        env.send(&[env.ix_commit(&u.pubkey(), ata, DAY, 40 * SKR, Exercise::Squat, 15, None)], u).unwrap();
    }
    assert_eq!((balance(&env.svm, &crew_vault), balance(&env.svm, &global_vault)), (300 * SKR, 120 * SKR));

    env.warp(DAY_START + 5 * 3_600);
    let att = env.attestor.pubkey();
    let started = DAY_START + 4 * 3_600;
    env.use_crew(CREW);
    for (u, _) in &users[..2] {
        env.send_attestor(&[env.ix_attest(&att, &u.pubkey(), DAY, 20, started)]).unwrap();
    }
    env.use_crew(0);
    for (u, _) in &users {
        env.send_attestor(&[env.ix_attest(&att, &u.pubkey(), DAY, 15, started)]).unwrap();
    }
    // per-pool streaks / leaderboard data
    let crew_prof: fitr_vault::UserProfile =
        read(&env.svm, &pda(&[fitr_vault::PROFILE_SEED, crew_pool.as_ref(), users[2].0.pubkey().as_ref()])).unwrap();
    assert_eq!((crew_prof.total_committed, crew_prof.total_completed, crew_prof.current_streak), (1, 0, 0));
    assert_eq!(env.profile(&users[2].0.pubkey()).unwrap().current_streak, 1);

    env.warp(DAY_START + 86_400 + 2 * 3_600 + 600 + 1);
    let cranker = users[2].0.insecure_clone();
    for crew in [CREW, 0] {
        env.use_crew(crew);
        env.send(&[env.ix_finalize(&cranker.pubkey(), DAY)], &cranker).unwrap();
    }
    env.use_crew(CREW);
    let ds = env.day_state(DAY).unwrap();
    assert_eq!((ds.fee, ds.distributable, ds.sponsor, ds.pool), (5 * SKR, 95 * SKR, 0, crew_pool));
    env.use_crew(0);
    let gs = env.day_state(DAY).unwrap();
    assert_eq!((gs.fee, gs.distributable, gs.total_staked), (0, 0, 120 * SKR));

    for (i, (u, ata)) in users.iter().enumerate() {
        let before = env.bal(ata);
        env.use_crew(CREW);
        if i < 2 {
            env.send(&[env.ix_claim(&u.pubkey(), ata, DAY)], u).unwrap();
            assert_eq!(env.bal(ata) - before, 147 * SKR + SKR / 2);
        } else {
            expect_err(env.send(&[env.ix_claim(&u.pubkey(), ata, DAY)], u), 6013);
            env.send(&[env.ix_close_missed(&u.pubkey(), &u.pubkey(), DAY)], u).unwrap();
        }
        let mid = env.bal(ata);
        env.use_crew(0);
        env.send(&[env.ix_claim(&u.pubkey(), ata, DAY)], u).unwrap();
        assert_eq!(env.bal(ata) - mid, 40 * SKR);
    }
    let pc = pool_at(&env, CREW);
    let pg = pool_at(&env, 0);
    assert_eq!((pc.outstanding, pc.reserve, pc.treasury_accrued), (0, 0, 5 * SKR));
    assert_eq!((pg.outstanding, pg.reserve, pg.treasury_accrued), (0, 0, 0));
    assert_eq!((balance(&env.svm, &crew_vault), balance(&env.svm, &global_vault)), (5 * SKR, 0));

    // fees are withdrawn per pool; the global pool cannot pay out the crew's fee
    let admin = env.admin.pubkey();
    let admin_ata = env.admin_ata;
    env.use_crew(0);
    expect_err(env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 5 * SKR)]), 6019);
    env.use_crew(CREW);
    env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 5 * SKR)]).unwrap();
    env.send_admin(&[env.ix_sweep(&admin, &users[0].0.pubkey(), DAY)]).unwrap();
    assert_eq!(balance(&env.svm, &crew_vault), 0);
    assert_eq!(env.bal(&admin_ata), 5 * SKR);
}

/// Every instruction that moves tokens or settles a day rejects accounts mixed from two pools.
#[test]
fn cross_pool_accounts_are_rejected() {
    let mut env = env_at_day();
    create(&mut env, 1, "crew A", None, None);
    create(&mut env, 2, "crew B", None, None);
    let a_pool = pool_pda(&env.mint, 1);
    let b_pool = pool_pda(&env.mint, 2);
    let g_pool = env.global_pool();
    let (a_vault, b_vault, g_vault) = (vault_pda(&a_pool), vault_pda(&b_pool), vault_pda(&g_pool));
    let (alice, a_ata) = env.user(1_000);
    let (bob, b_ata) = env.user(1_000);
    let (sponsor, s_ata) = env.user(1_000);
    let ap = alice.pubkey();
    let att = env.attestor.pubkey();

    // alice stakes 100 in crew A; bob stakes 300 in crew B and 50 in the global pool
    env.use_crew(1);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 100 * SKR, Exercise::Pushup, 10, None)], &alice).unwrap();
    env.use_crew(2);
    env.send(&[env.ix_commit(&bob.pubkey(), &b_ata, DAY, 300 * SKR, Exercise::Pushup, 10, None)], &bob).unwrap();
    env.use_crew(0);
    env.send(&[env.ix_commit(&bob.pubkey(), &b_ata, DAY, 50 * SKR, Exercise::Pushup, 10, None)], &bob).unwrap();
    env.use_crew(2);
    // deposits need an open sponsor tap (audit CREW-2); bob's day already snapshotted cap 0
    expect_err(env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 200 * SKR)], &sponsor), ERR_SPONSOR_TAP_CLOSED);
    let admin = env.admin.pubkey();
    let up = UpdateConfigParams { daily_sponsor_amount: Some(SKR), ..Default::default() };
    env.send_admin(&[env.ix_update(&admin, up)]).unwrap();
    env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 200 * SKR)], &sponsor).unwrap();

    env.use_crew(1);
    // commit into crew A paying into crew B's / the global vault
    for v in [b_vault, g_vault] {
        let mut c = env.ix_commit(&ap, &a_ata, DAY + 1, 10 * SKR, Exercise::Pushup, 10, None);
        c.accounts[4].pubkey = v;
        expect_err(env.send(&[c], &alice), ANCHOR_HAS_ONE);
    }
    // commit with crew B's pool account but crew A's day / commitment / profile PDAs
    let mut c = env.ix_commit(&ap, &a_ata, DAY + 1, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[1].pubkey = b_pool;
    c.accounts[4].pubkey = b_vault;
    expect_err(env.send(&[c], &alice), ANCHOR_SEEDS);
    // fund crew A's reserve into crew B's vault
    let mut f = env.ix_fund(&sponsor.pubkey(), &s_ata, SKR);
    f.accounts[4].pubkey = b_vault;
    expect_err(env.send(&[f], &sponsor), ANCHOR_HAS_ONE);

    // attest alice's crew-A commitment through crew B's pool account
    env.warp(DAY_START + 5 * 3_600);
    let mut a = env.ix_attest(&att, &ap, DAY, 10, DAY_START + 4 * 3_600);
    a.accounts[1].pubkey = b_pool;
    expect_err(env.send_attestor(&[a]), ANCHOR_SEEDS);
    env.send_attestor(&[env.ix_attest(&att, &ap, DAY, 10, DAY_START + 4 * 3_600)]).unwrap();
    // revoke through another pool
    let mut r = env.ix_revoke(&env.admin.pubkey(), &ap, DAY);
    r.accounts[1].pubkey = g_pool;
    expect_err(env.send_admin(&[r]), ANCHOR_SEEDS);

    env.warp(DAY_START + 86_400 + 2 * 3_600 + 600 + 1);
    // finalize / void crew A's day through another pool's account (would mix accounting)
    let mut fz = env.ix_finalize(&ap, DAY);
    fz.accounts[1].pubkey = b_pool;
    expect_err(env.send(&[fz], &alice), ANCHOR_SEEDS);
    let mut v = env.ix_void(&env.admin.pubkey(), DAY);
    v.accounts[1].pubkey = g_pool;
    expect_err(env.send_admin(&[v]), ANCHOR_SEEDS);
    for crew in [1, 2, 0] {
        env.use_crew(crew);
        env.send(&[env.ix_finalize(&ap, DAY)], &alice).unwrap();
    }

    env.use_crew(1);
    // claim alice's crew-A win from crew B's vault (which holds 300 + 200 sponsored)
    let mut cl = env.ix_claim(&ap, &a_ata, DAY);
    cl.accounts[3].pubkey = b_vault;
    expect_err(env.send(&[cl], &alice), ANCHOR_HAS_ONE);
    // ... or with crew B's pool + vault and crew A's day / commitment
    let mut cl = env.ix_claim(&ap, &a_ata, DAY);
    cl.accounts[1].pubkey = b_pool;
    cl.accounts[3].pubkey = b_vault;
    expect_err(env.send(&[cl], &alice), ANCHOR_SEEDS);
    // ... or with the global pool + vault and crew A's day / commitment
    let mut cl = env.ix_claim(&ap, &a_ata, DAY);
    cl.accounts[1].pubkey = g_pool;
    cl.accounts[3].pubkey = g_vault;
    expect_err(env.send(&[cl], &alice), ANCHOR_SEEDS);
    // ... or the global pool's own (nonexistent) commitment PDAs: nothing to claim there
    env.use_crew(0);
    assert!(env.send(&[env.ix_claim(&ap, &a_ata, DAY)], &alice).is_err());
    // close_missed / sweep through another pool
    env.use_crew(2);
    let mut cm = env.ix_close_missed(&ap, &bob.pubkey(), DAY);
    cm.accounts[1].pubkey = a_pool;
    expect_err(env.send(&[cm], &alice), ANCHOR_SEEDS);
    // the treasury of crew B (300 x 5 % = 15) cannot be withdrawn through crew A or the global pool
    let admin = env.admin.pubkey();
    let admin_ata = env.admin_ata;
    let mut w = env.ix_withdraw(&admin, &admin_ata, 15 * SKR);
    w.accounts[1].pubkey = a_pool;
    expect_err(env.send_admin(&[w]), ANCHOR_HAS_ONE);
    let mut w = env.ix_withdraw(&admin, &admin_ata, SKR);
    w.accounts[3].pubkey = a_vault;
    expect_err(env.send_admin(&[w]), ANCHOR_HAS_ONE);

    // honest settlement: each vault pays exactly its own pool's liabilities
    env.use_crew(1);
    env.send(&[env.ix_claim(&ap, &a_ata, DAY)], &alice).unwrap();
    assert_eq!(env.bal(&a_ata), 1_000 * SKR); // the only crew-A committer completed: principal back
    assert_eq!(balance(&env.svm, &a_vault), 0);
    assert_eq!(balance(&env.svm, &b_vault), 500 * SKR); // bob missed: 300 forfeited stays in crew B
    assert_eq!(balance(&env.svm, &g_vault), 50 * SKR);
    let pb = pool_at(&env, 2);
    // nobody completed crew B's day: its net forfeit is the crew's rollover, not the reserve
    assert_eq!((pb.reserve, pb.rollover, pb.treasury_accrued, pb.outstanding), (200 * SKR, 285 * SKR, 15 * SKR, 0));
    let pa = pool_at(&env, 1);
    assert_eq!((pa.reserve, pa.rollover, pa.treasury_accrued, pa.outstanding), (0, 0, 0, 0));
}

/// Sponsored days: anyone funds any pool's reserve; each pool draws only its own reserve, up to
/// its own daily_sponsor_amount snapshot (<= max_stake), and only into days with completers.
#[test]
fn sponsored_days_are_per_pool() {
    let mut env = env_at_day();
    create(&mut env, CREW, "sponsored", None, None);
    let admin = env.admin.pubkey();
    let (sponsor, s_ata) = env.user(10_000);
    let att = env.attestor.pubkey();

    env.use_crew(CREW);
    // the tap is bounded by max_stake (10,000 SKR in these params)
    let up = UpdateConfigParams { daily_sponsor_amount: Some(10_000 * SKR + 1), ..Default::default() };
    expect_err(env.send_admin(&[env.ix_update(&admin, up)]), ERR_INVALID_CONFIG);
    let up = UpdateConfigParams { daily_sponsor_amount: Some(30 * SKR), ..Default::default() };
    env.send_admin(&[env.ix_update(&admin, up)]).unwrap();
    expect_err(env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 0)], &sponsor), ERR_INVALID_CONFIG);
    let r = env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 50 * SKR)], &sponsor).unwrap();
    assert!(r.logs.iter().any(|l| l.starts_with("Program data: ")), "ReserveFunded event emitted");
    env.use_crew(0);
    // the global tap is 0 (mainnet default): a deposit there is refused, never stranded
    expect_err(env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 70 * SKR)], &sponsor), ERR_SPONSOR_TAP_CLOSED);
    assert_eq!((pool_at(&env, CREW).reserve, pool_at(&env, 0).reserve), (50 * SKR, 0));

    // day DAY: two crew members, one completes. Global day: one member completes (tap is 0 there).
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    env.use_crew(CREW);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, DAY, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    // the next day snapshots the tap too: nobody completes it, so it draws nothing
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, DAY + 1, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.use_crew(0);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.use_crew(CREW);
    assert_eq!(env.day_state(DAY).unwrap().sponsor_cap, 30 * SKR);
    env.use_crew(0);
    assert_eq!(env.day_state(DAY).unwrap().sponsor_cap, 0);

    env.warp(DAY_START + 5 * 3_600);
    for crew in [CREW, 0] {
        env.use_crew(crew);
        env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), DAY, 10, DAY_START + 4 * 3_600)]).unwrap();
    }
    env.warp(DAY_START + 86_400 + 2 * 3_600 + 600 + 1);
    for crew in [CREW, 0] {
        env.use_crew(crew);
        env.send(&[env.ix_finalize(&a.pubkey(), DAY)], &a).unwrap();
    }
    env.use_crew(CREW);
    let ds = env.day_state(DAY).unwrap();
    // forfeit 10, fee 0.5, + sponsor 30 = 39.5 distributable
    assert_eq!((ds.sponsor, ds.fee, ds.distributable), (30 * SKR, SKR / 2, 39 * SKR + SKR / 2));
    assert_eq!(pool_at(&env, CREW).reserve, 20 * SKR);
    env.use_crew(0);
    assert_eq!(env.day_state(DAY).unwrap().sponsor, 0);
    assert_eq!(pool_at(&env, 0).reserve, 0);

    env.use_crew(CREW);
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, DAY)], &a).unwrap();
    let c = env.commitment(&b.pubkey(), DAY).unwrap();
    assert_eq!(c.status, CommitmentStatus::Committed);
    // a: 1000 - 10 (crew) - 10 (crew claim pays 10 + 39.5) - 10 (global, unclaimed)
    assert_eq!(env.bal(&a_ata), 1_000 * SKR - 20 * SKR + 10 * SKR + 39 * SKR + SKR / 2);

    // DAY + 1 in the crew: zero completers -> no draw; the net forfeit rolls over to the crew's
    // next day with a completer instead of joining the sponsor reserve
    env.warp(DAY_START + 2 * 86_400 + 2 * 3_600 + 600 + 1);
    env.send(&[env.ix_finalize(&a.pubkey(), DAY + 1)], &a).unwrap();
    let d1 = env.day_state(DAY + 1).unwrap();
    assert_eq!((d1.sponsor, d1.distributable, d1.rollover), (0, 0, 0));
    let pc = pool_at(&env, CREW);
    assert_eq!((pc.reserve, pc.rollover), (20 * SKR, 10 * SKR - SKR / 2));
}
