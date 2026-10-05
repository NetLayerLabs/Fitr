//! Regression tests for the Crews audit (audit2: crews-access, economics-multipool). Each test is
//! the auditor's PoC, inverted: the attack it demonstrated must now fail, and the honest path must
//! still work.
//!   CREW-1 / ECON-MP-3  global pause + attestor rotation reach every crew (live global reads,
//!                       sync_crew crank)
//!   CREW-2 / ECON-MP-1  zero-completer crew forfeits roll over to the crew's next completers; they
//!                       are never stranded in the reserve, never released by the sponsor tap
//!   CREW-3              update_config cannot brick a fixed-goal crew
//!   ECON-MP-2           the SGT bound is per pool (documented); the global SGT gate covers crews
//! Run after `anchor build`: cargo test --test regression_crews
mod common;
use anchor_lang::prelude::Pubkey;
use anchor_spl::token_2022;
use common::*;
use fitr_vault::{Exercise, GoalLimits, InitPoolParams, Pool, UpdateConfigParams};
use solana_keypair::Keypair;
use solana_signer::Signer;
use std::str::FromStr;

const DAY: u32 = 20_721;
const DAY_START: i64 = DAY as i64 * 86_400;
const CREW: u64 = 0xA0D1_7000_0000_0001;
const SGT_MINT: &str = "3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q";

const ERR_PAUSED: u32 = 6000;
const ERR_NOT_AUTHORITY: u32 = 6001;
const ERR_NOT_ATTESTOR: u32 = 6002;
const ERR_INVALID_CONFIG: u32 = 6004;
const ERR_SGT_REQUIRED: u32 = 6015;
const ERR_DEVICE_ALREADY_COMMITTED: u32 = 6017;
const ERR_INSUFFICIENT_FUNDS: u32 = 6019;
const ERR_INVALID_CREW: u32 = 6030;
const ERR_SPONSOR_TAP_CLOSED: u32 = 6031;

/// Mainnet-like: 24 h days, 1 h grace, 10 min review window, 5 % fee, sponsor tap 0.
fn p() -> InitPoolParams {
    InitPoolParams {
        commit_cutoff_secs: 64_800,
        attest_grace_secs: 3_600,
        fee_bps: 500,
        daily_sponsor_amount: 0,
        finalize_delay_secs: 600,
        ..params(Default::default(), 86_400)
    }
}

fn env_at_day() -> Env {
    let mut env = Env::new(p());
    env.warp(DAY_START + 3_600);
    env
}

fn create(env: &mut Env, id: u64, ex: Option<Exercise>, goal: Option<u32>) {
    let (creator, _) = env.user(0);
    let ix = env.ix_create_crew(&creator.pubkey(), id, crew_name("crew"), ex, goal);
    env.send(&[ix], &creator).unwrap();
}

fn pool_at(env: &Env, id: u64) -> Pool {
    read(&env.svm, &pool_pda(&env.mint, id)).unwrap()
}

fn settle_time(env: &Env, d: u32) -> i64 {
    env.day_end(d) + 3_600 + 600 + 1
}

fn set_global(env: &mut Env, up: UpdateConfigParams) {
    let cur = env.pool;
    env.use_crew(0);
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_update(&admin, up)]).unwrap();
    env.pool = cur;
    env.vault = vault_pda(&cur);
}

/// One completed day in the env's current pool for `u` (commit at day start, attest, finalize, claim).
fn complete_day(env: &mut Env, u: &Keypair, ata: &Pubkey, d: u32, amount: u64) {
    env.warp(env.day_start(d) + 60);
    env.send(&[env.ix_commit(&u.pubkey(), ata, d, amount, Exercise::Pushup, 20, None)], u).unwrap();
    env.warp(env.day_start(d) + 600);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d, 20, env.day_start(d) + 120)]).unwrap();
    env.warp(settle_time(env, d));
    let c = env.admin.insecure_clone();
    env.send(&[env.ix_finalize(&c.pubkey(), d)], &c).unwrap();
    env.send(&[env.ix_claim(&u.pubkey(), ata, d)], u).unwrap();
}

/// CREW-1 (crews-access f1), inverted. The operator pauses the global pool and rotates its
/// attestor after a key leak: crews stop taking stakes at once, and once the global pool is
/// unpaused every NEW crew day snapshots the fresh attestor, so the leaked key cannot attest it.
#[test]
fn crew_1_global_pause_and_attestor_rotation_reach_crews() {
    let mut env = env_at_day();
    create(&mut env, CREW, None, None);
    let leaked = env.attestor.insecure_clone();
    let fresh = Keypair::new();
    env.svm.airdrop(&fresh.pubkey(), 1_000_000_000).unwrap();
    set_global(&mut env, UpdateConfigParams { attestor: Some(fresh.pubkey()), paused: Some(true), ..Default::default() });

    // the crew itself is untouched (its own flag), but the global kill switch blocks it
    let c = pool_at(&env, CREW);
    assert_eq!((c.attestor, c.paused), (leaked.pubkey(), false));
    env.warp(DAY_START + 86_400 + 3_600);
    let d = DAY + 1;
    env.use_crew(CREW);
    let (victim, v_ata) = env.user(1_000);
    let (attacker, a_ata) = env.user(1_000);
    expect_err(
        env.send(&[env.ix_commit(&victim.pubkey(), &v_ata, d, 500 * SKR, Exercise::Pushup, 10, None)], &victim),
        ERR_PAUSED,
    );
    expect_err(
        env.send(&[env.ix_commit(&attacker.pubkey(), &a_ata, d, SKR, Exercise::Pushup, 10, None)], &attacker),
        ERR_PAUSED,
    );

    // incident over: the global pool is unpaused with the fresh attestor; the crew was never synced
    set_global(&mut env, UpdateConfigParams { paused: Some(false), ..Default::default() });
    env.send(&[env.ix_commit(&victim.pubkey(), &v_ata, d, 500 * SKR, Exercise::Pushup, 10, None)], &victim).unwrap();
    env.send(&[env.ix_commit(&attacker.pubkey(), &a_ata, d, SKR, Exercise::Pushup, 10, None)], &attacker).unwrap();
    // the new crew day snapshotted the GLOBAL (fresh) attestor, not the crew's stale copy
    assert_eq!(env.day_state(d).unwrap().attestor, fresh.pubkey());
    assert_eq!(pool_at(&env, CREW).attestor, leaked.pubkey());

    // the leaked key cannot attest the attacker's fake workout
    env.warp(DAY_START + 86_400 + 5 * 3_600);
    let ix = env.ix_attest(&leaked.pubkey(), &attacker.pubkey(), d, 10, DAY_START + 86_400 + 4 * 3_600);
    expect_err(send(&mut env.svm, &[ix], &leaked, &[]), ERR_NOT_ATTESTOR);
    // ... while the fresh attestor still serves honest users
    let ix = env.ix_attest(&fresh.pubkey(), &victim.pubkey(), d, 10, DAY_START + 86_400 + 4 * 3_600);
    send(&mut env.svm, &[ix], &fresh, &[]).unwrap();

    env.warp(settle_time(&env, d));
    env.send(&[env.ix_finalize(&attacker.pubkey(), d)], &attacker).unwrap();
    // the attacker never completed: nothing to claim, the 1 SKR stake funds the victim
    assert!(env.send(&[env.ix_claim(&attacker.pubkey(), &a_ata, d)], &attacker).is_err());
    env.send(&[env.ix_claim(&victim.pubkey(), &v_ata, d)], &victim).unwrap();
    assert_eq!(env.bal(&v_ata), 1_000 * SKR + SKR - SKR / 20); // + 95 % of the attacker's 1 SKR
    assert_eq!(env.bal(&a_ata), 999 * SKR);
}

/// ECON-MP-3 (economics-multipool poc3), inverted, plus the live-day path: a crew day created
/// BEFORE the incident (leaked attestor snapshotted) cannot be attested, finalized or committed
/// to while the global pool is paused; the authority voids it and everyone gets principal back.
#[test]
fn econ_mp_3_global_pause_freezes_live_crew_days() {
    let mut env = env_at_day();
    const C: u64 = 7;
    create(&mut env, C, None, None);
    env.use_crew(C);
    let (victim, v_ata) = env.user(1_000);
    let (thief, t_ata) = env.user(1);
    env.send(&[env.ix_commit(&victim.pubkey(), &v_ata, DAY, 1_000 * SKR, Exercise::Pushup, 20, None)], &victim)
        .unwrap();
    env.send(&[env.ix_commit(&thief.pubkey(), &t_ata, DAY, SKR, Exercise::Pushup, 10, None)], &thief).unwrap();
    assert_eq!(env.day_state(DAY).unwrap().attestor, env.attestor.pubkey());

    // incident: global paused + attestor rotated (the crew is not touched)
    let fresh = Keypair::new().pubkey();
    set_global(&mut env, UpdateConfigParams { paused: Some(true), attestor: Some(fresh), ..Default::default() });
    env.warp(DAY_START + 4_000);
    let att = env.attestor.pubkey();
    expect_err(env.send_attestor(&[env.ix_attest(&att, &thief.pubkey(), DAY, 10, DAY_START + 3_700)]), ERR_PAUSED);
    // nobody can add stakes to the frozen day
    let (late, l_ata) = env.user(10);
    expect_err(env.send(&[env.ix_commit(&late.pubkey(), &l_ata, DAY, SKR, Exercise::Pushup, 10, None)], &late), ERR_PAUSED);
    // finalize is blocked while the global pool is paused, even far past the deadline
    env.warp(settle_time(&env, DAY) + 86_400);
    let c = env.admin.insecure_clone();
    expect_err(env.send(&[env.ix_finalize(&c.pubkey(), DAY)], &c), ERR_PAUSED);
    // the authority voids the compromised crew day: principal back to everyone, no forfeits
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_void(&admin, DAY)]).unwrap();
    env.send(&[env.ix_claim(&victim.pubkey(), &v_ata, DAY)], &victim).unwrap();
    env.send(&[env.ix_claim(&thief.pubkey(), &t_ata, DAY)], &thief).unwrap();
    assert_eq!((env.bal(&v_ata), env.bal(&t_ata)), (1_000 * SKR, SKR));
}

/// A global pause extends crew days' attest windows exactly like the crew's own pause, so an
/// honest user's pending attestation can never run out because of a global incident pause.
#[test]
fn crew_1_global_pause_extends_crew_attest_window() {
    let mut env = env_at_day();
    create(&mut env, CREW, None, None);
    env.use_crew(CREW);
    let (u, ata) = env.user(100);
    env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY, 10 * SKR, Exercise::Pushup, 20, None)], &u).unwrap();
    let ds = env.day_state(DAY).unwrap();
    assert_eq!(ds.global_paused_secs_base, 0);
    let deadline = ds.attest_deadline;
    // global pause of 2 h, ending after the nominal deadline
    env.warp(deadline - 3_600);
    set_global(&mut env, UpdateConfigParams { paused: Some(true), ..Default::default() });
    env.warp(deadline + 3_600);
    set_global(&mut env, UpdateConfigParams { paused: Some(false), ..Default::default() });
    // the window is now deadline + 2 h: the attestation still lands
    env.warp(deadline + 2 * 3_600 - 1);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), DAY, 20, DAY_START + 3_700)]).unwrap();
    // finalize waits for the extended deadline + the review window
    let c = env.admin.insecure_clone();
    env.warp(deadline + 2 * 3_600 + 600);
    expect_err(env.send(&[env.ix_finalize(&c.pubkey(), DAY)], &c), 6009);
    env.warp(deadline + 2 * 3_600 + 601);
    env.send(&[env.ix_finalize(&c.pubkey(), DAY)], &c).unwrap();
    // a day created after the pause records the global pause total as its base (now is in DAY + 1)
    assert_eq!(env.today(), DAY + 1);
    env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY + 1, 10 * SKR, Exercise::Pushup, 20, None)], &u).unwrap();
    assert_eq!(env.day_state(DAY + 1).unwrap().global_paused_secs_base, 2 * 3_600);
}

/// CREW-1 (crews-access f1b), inverted. Crew spam no longer multiplies incident work: one global
/// pause blocks every crew, and a permissionless sync_crew crank (batched, any payer) propagates
/// an authority and attestor rotation to all of them without a multisig signature per crew.
#[test]
fn crew_1b_crew_spam_does_not_multiply_incident_work() {
    let mut env = env_at_day();
    let (spammer, _) = env.user(0);
    const N: u64 = 40;
    for id in 1..=N {
        let ix = env.ix_create_crew(&spammer.pubkey(), id, crew_name("x"), None, None);
        env.send(&[ix], &spammer).unwrap();
    }
    set_global(&mut env, UpdateConfigParams { paused: Some(true), ..Default::default() });
    let (u, ata) = env.user(100);
    for id in 1..=N {
        env.use_crew(id);
        expect_err(env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY, SKR, Exercise::Pushup, 20, None)], &u), ERR_PAUSED);
    }

    // rotate the global attestor and hand the global authority to a new multisig
    let new_att = Keypair::new().pubkey();
    let squads = Keypair::new();
    env.svm.airdrop(&squads.pubkey(), 1_000_000_000).unwrap();
    set_global(&mut env, UpdateConfigParams { attestor: Some(new_att), ..Default::default() });
    env.use_crew(0);
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_propose(&admin, squads.pubkey())]).unwrap();
    env.send(&[env.ix_accept(&squads.pubkey())], &squads).unwrap();
    // a stale proposal on one crew is cleared by the sync
    env.use_crew(3);
    env.send_admin(&[env.ix_propose(&admin, Keypair::new().pubkey())]).unwrap();

    // anyone cranks sync_crew, 10 crews per transaction
    let (cranker, _) = env.user(0);
    for chunk in (1..=N).collect::<Vec<_>>().chunks(10) {
        let ixs: Vec<_> = chunk
            .iter()
            .map(|id| {
                env.use_crew(*id);
                env.ix_sync_crew()
            })
            .collect();
        let r = env.send(&ixs, &cranker).unwrap();
        assert!(r.size <= 1_232, "batch fits in one transaction ({} bytes)", r.size);
    }
    for id in 1..=N {
        let c = pool_at(&env, id);
        assert_eq!((c.authority, c.attestor, c.pending_authority), (squads.pubkey(), new_att, Pubkey::default()));
    }
    // the old authority lost every crew; the new one controls them
    env.use_crew(5);
    let up = UpdateConfigParams { paused: Some(true), ..Default::default() };
    expect_err(env.send_admin(&[env.ix_update(&admin, up.clone())]), ERR_NOT_AUTHORITY);
    env.send(&[env.ix_update(&squads.pubkey(), up)], &squads).unwrap();
    // sync_crew refuses the global pool itself
    env.use_crew(0);
    expect_err(env.send(&[env.ix_sync_crew()], &cranker), ERR_INVALID_CREW);
}

/// The global authority can revoke a bad attestation on a crew day even before sync_crew ran
/// (it may have rotated); a random signer still cannot.
#[test]
fn crew_1_global_authority_can_revoke_on_unsynced_crews() {
    let mut env = env_at_day();
    create(&mut env, CREW, None, None);
    let squads = Keypair::new();
    env.svm.airdrop(&squads.pubkey(), 1_000_000_000).unwrap();
    env.use_crew(0);
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_propose(&admin, squads.pubkey())]).unwrap();
    env.send(&[env.ix_accept(&squads.pubkey())], &squads).unwrap();

    env.use_crew(CREW);
    let (u, ata) = env.user(100);
    env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY, 10 * SKR, Exercise::Pushup, 20, None)], &u).unwrap();
    env.warp(DAY_START + 7_200);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), DAY, 20, DAY_START + 3_700)]).unwrap();
    let (rando, _) = env.user(0);
    expect_err(env.send(&[env.ix_revoke(&rando.pubkey(), &u.pubkey(), DAY)], &rando), ERR_NOT_AUTHORITY);
    env.send(&[env.ix_revoke(&squads.pubkey(), &u.pubkey(), DAY)], &squads).unwrap();
    assert_eq!(env.day_state(DAY).unwrap().revoked_count, 1);
}

/// CREW-2 (crews-access f2), inverted. A crew day nobody completes no longer strands its forfeits
/// in the reserve: they wait in the crew rollover, and the authority still can only take the fee.
#[test]
fn crew_2_zero_completer_crew_forfeits_roll_over() {
    let mut env = env_at_day();
    create(&mut env, CREW, None, None);
    env.use_crew(CREW);
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, DAY, 100 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, DAY, 100 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.warp(settle_time(&env, DAY));
    env.send(&[env.ix_finalize(&a.pubkey(), DAY)], &a).unwrap();
    env.send(&[env.ix_close_missed(&a.pubkey(), &a.pubkey(), DAY)], &a).unwrap();
    env.send(&[env.ix_close_missed(&b.pubkey(), &b.pubkey(), DAY)], &b).unwrap();
    let c = pool_at(&env, CREW);
    assert_eq!((c.reserve, c.rollover, c.treasury_accrued, c.outstanding), (0, 190 * SKR, 10 * SKR, 0));
    // the authority can only take the fee
    let admin = env.admin.pubkey();
    let admin_ata = env.admin_ata;
    expect_err(env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 11 * SKR)]), ERR_INSUFFICIENT_FUNDS);
    env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 10 * SKR)]).unwrap();
    assert_eq!(env.vault_balance(), 190 * SKR);

    // the next day B shows up: the rollover + A's new forfeit go to B
    let d = DAY + 1;
    env.warp(env.day_start(d) + 60);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.warp(env.day_start(d) + 600);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 10, env.day_start(d) + 120)]).unwrap();
    env.warp(settle_time(&env, d));
    env.send(&[env.ix_finalize(&a.pubkey(), d)], &a).unwrap();
    let ds = env.day_state(d).unwrap();
    assert_eq!((ds.rollover, ds.distributable), (190 * SKR, 190 * SKR + 9 * SKR + SKR / 2));
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b).unwrap();
    assert_eq!(env.bal(&b_ata), 1_000 * SKR - 100 * SKR + 190 * SKR + 9 * SKR + SKR / 2);
    let c = pool_at(&env, CREW);
    assert_eq!((c.reserve, c.rollover, c.outstanding), (0, 0, 0));
    assert_eq!(env.vault_balance(), c.treasury_accrued);
}

/// ECON-MP-1 (economics-multipool poc1), inverted. Friends A and B both miss; A shows up the
/// next day and gets the rollover. Nothing is left for a stranger to capture later, opening the
/// tap releases nothing, and a sponsor cannot deposit into a closed tap.
#[test]
fn econ_mp_1_rollover_goes_to_the_next_completer_not_a_stranger() {
    let mut env = Env::new(p());
    env.warp(DAY_START + 3_600);
    const C: u64 = 42;
    create(&mut env, C, None, None);
    env.use_crew(C);

    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    for (u, ata) in [(&a, a_ata), (&b, b_ata)] {
        env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY, 500 * SKR, Exercise::Pushup, 20, None)], u).unwrap();
    }
    env.warp(settle_time(&env, DAY));
    let c = env.admin.insecure_clone();
    env.send(&[env.ix_finalize(&c.pubkey(), DAY)], &c).unwrap();
    let pc = env.pool_state();
    assert_eq!((pc.reserve, pc.rollover, pc.treasury_accrued), (0, 950 * SKR, 50 * SKR));

    // a sponsor cannot park SKR behind a closed tap
    let (sponsor, s_ata) = env.user(100);
    expect_err(env.send(&[env.ix_fund(&sponsor.pubkey(), &s_ata, 10 * SKR)], &sponsor), ERR_SPONSOR_TAP_CLOSED);

    // friend A shows up the next day and receives the whole rollover
    let before = env.bal(&a_ata);
    complete_day(&mut env, &a, &a_ata, DAY + 1, 10 * SKR);
    assert_eq!(env.bal(&a_ata) - before, 950 * SKR);
    assert_eq!(env.day_state(DAY + 1).unwrap().rollover, 950 * SKR);
    for d in DAY + 2..DAY + 4 {
        let before = env.bal(&a_ata);
        complete_day(&mut env, &a, &a_ata, d, 10 * SKR);
        assert_eq!(env.bal(&a_ata), before, "no further rollover");
    }

    // opening the tap later releases nothing to a 1-SKR stranger
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_update(
        &admin,
        UpdateConfigParams { daily_sponsor_amount: Some(10_000 * SKR), ..Default::default() },
    )])
    .unwrap();
    let (stranger, s2_ata) = env.user(1);
    complete_day(&mut env, &stranger, &s2_ata, DAY + 4, SKR);
    assert_eq!(env.bal(&s2_ata), SKR, "stranger only gets their own stake back");
    let pc = env.pool_state();
    assert_eq!((pc.reserve, pc.rollover, pc.outstanding), (0, 0, 0));
    assert_eq!(env.vault_balance(), pc.treasury_accrued);
}

/// CREW-3 (crews-access f3), inverted. Tightening goal limits below a crew's fixed goal is
/// rejected, so the crew stays usable; limits that keep the fixed goal valid are accepted.
#[test]
fn crew_3_fixed_goal_crew_cannot_be_bricked() {
    let mut env = env_at_day();
    create(&mut env, CREW, Some(Exercise::Pushup), Some(500));
    env.use_crew(CREW);
    let admin = env.admin.pubkey();
    let tighten = |max| UpdateConfigParams {
        goal_limits: Some(goals_with(0, GoalLimits { min: 10, max })),
        ..Default::default()
    };
    expect_err(env.send_admin(&[env.ix_update(&admin, tighten(200))]), ERR_INVALID_CONFIG);
    env.send_admin(&[env.ix_update(&admin, tighten(500))]).unwrap();
    let (u, ata) = env.user(100);
    env.send(&[env.ix_commit(&u.pubkey(), &ata, DAY, SKR, Exercise::Pushup, 500, None)], &u).unwrap();
    // tightening the GLOBAL pool's limits never touches the crew's own rule
    set_global(&mut env, tighten(100));
    let (v, v_ata) = env.user(100);
    env.send(&[env.ix_commit(&v.pubkey(), &v_ata, DAY, SKR, Exercise::Pushup, 500, None)], &v).unwrap();
}

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(format!("{}/tests/fixtures/{name}.bin", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

/// ECON-MP-2 (economics-multipool poc2). Decision: the Sybil bound is per pool by design and is
/// now documented as such (SPEC §8); the cross-pool reuse of one workout is refused off-chain by
/// the attestor. Onchain this test pins what holds: one Seeker commits at most once per pool per
/// day, and turning the SGT gate on in the global pool gates every crew immediately (a crew's
/// own stale require_sgt = false cannot be used to skip it).
#[test]
fn econ_mp_2_sgt_bound_is_per_pool_and_the_global_gate_covers_crews() {
    let mut env = Env::new(p());
    env.warp(DAY_START + 3_600);
    create(&mut env, 11, None, None);
    assert!(!pool_at(&env, 11).require_sgt);
    set_global(&mut env, UpdateConfigParams { require_sgt: Some(true), ..Default::default() });

    let sgt_mint = Pubkey::from_str(SGT_MINT).unwrap();
    let raw = |data: Vec<u8>| solana_account::Account {
        lamports: 10_000_000,
        data,
        owner: token_2022::ID,
        executable: false,
        rent_epoch: 0,
    };
    env.svm.set_account(sgt_mint, raw(fixture(SGT_MINT))).unwrap();
    let (cheater, ata) = env.user(50_000);
    let sgt_tok = Keypair::new().pubkey();
    let mut data = fixture("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj");
    data[32..64].copy_from_slice(cheater.pubkey().as_ref());
    data[64..72].copy_from_slice(&1u64.to_le_bytes());
    env.svm.set_account(sgt_tok, raw(data)).unwrap();

    // the crew still says require_sgt = false, but the global gate applies
    env.use_crew(11);
    expect_err(
        env.send(&[env.ix_commit(&cheater.pubkey(), &ata, DAY, SKR, Exercise::Pushup, 10, None)], &cheater),
        ERR_SGT_REQUIRED,
    );
    for id in [0u64, 11] {
        env.use_crew(id);
        env.send(&[env.ix_register(&cheater.pubkey(), &sgt_mint, &sgt_tok)], &cheater).unwrap();
        let dev = env.device_pda(&sgt_mint);
        env.send(&[env.ix_commit(&cheater.pubkey(), &ata, DAY, SKR, Exercise::Pushup, 10, Some((sgt_tok, dev)))], &cheater)
            .unwrap();
        // a second wallet-day in the same pool with the same Seeker is refused
        let (alt, alt_ata) = env.user(10);
        let mut d2 = fixture("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj");
        d2[32..64].copy_from_slice(alt.pubkey().as_ref());
        d2[64..72].copy_from_slice(&1u64.to_le_bytes());
        let alt_tok = Keypair::new().pubkey();
        env.svm.set_account(alt_tok, raw(d2)).unwrap();
        expect_err(
            env.send(&[env.ix_commit(&alt.pubkey(), &alt_ata, DAY, SKR, Exercise::Pushup, 10, Some((alt_tok, dev)))], &alt),
            ERR_DEVICE_ALREADY_COMMITTED,
        );
    }
}
