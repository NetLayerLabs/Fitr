//! End-to-end flow on LiteSVM: init -> commit x3 -> attest x2 -> finalize -> claim -> close_missed -> sweep -> withdraw.
//! Run after `anchor build`: cargo test --test litesvm_flow
mod common;
use common::*;
use fitr_vault::{CommitmentStatus, Exercise, InitPoolParams};
use solana_signer::Signer;

const DAY: u32 = 20_721; // 2026-09-25 UTC
const DAY_START: i64 = DAY as i64 * 86_400;

fn flow_params() -> InitPoolParams {
    InitPoolParams {
        commit_cutoff_secs: 12 * 3_600,
        attest_grace_secs: 2 * 3_600,
        attestor: Default::default(), // filled with env.attestor
        ..params(Default::default(), 86_400)
    }
}

#[test]
fn full_day_flow() {
    let mut env = Env::new(flow_params());
    env.warp(DAY_START + 3_600);
    let users: Vec<_> = (0..3).map(|_| env.user(1_000)).collect();

    // --- 3 users commit 100 SKR each for today (push-ups, goal 20) ---
    for (u, ata) in &users {
        let ix = env.ix_commit(&u.pubkey(), ata, DAY, 100 * SKR, Exercise::Pushup, 20, None);
        let r = env.send(&[ix], u).unwrap();
        println!("CU commit {:>6}", r.cu);
    }
    assert_eq!(env.vault_balance(), 300 * SKR);
    // double commit same day -> fails (commitment PDA already exists)
    let (u0, a0) = &users[0];
    let ix = env.ix_commit(&u0.pubkey(), a0, DAY, 100 * SKR, Exercise::Pushup, 20, None);
    assert!(env.send(&[ix], u0).is_err());

    // --- attestor marks users 0 and 1 complete ---
    env.warp(DAY_START + 5 * 3_600);
    let att = env.attestor.pubkey();
    let started = DAY_START + 4 * 3_600;
    // a user cannot self-attest
    let (u2, _) = &users[2];
    expect_err(env.send(&[env.ix_attest(&u2.pubkey(), &u2.pubkey(), DAY, 20, started)], u2), 6002);
    for (u, _) in &users[..2] {
        let r = env.send_attestor(&[env.ix_attest(&att, &u.pubkey(), DAY, 20, started)]).unwrap();
        println!("CU attest {:>6}", r.cu);
    }
    // double attest -> InvalidCommitmentState
    expect_err(env.send_attestor(&[env.ix_attest(&att, &u0.pubkey(), DAY, 20, started)]), 6013);

    // --- finalize: too early fails, after deadline succeeds ---
    env.warp(DAY_START + 86_400 + 2 * 3_600); // == deadline, not after
    expect_err(env.send(&[env.ix_finalize(&u2.pubkey(), DAY)], u2), 6009);
    env.warp(DAY_START + 86_400 + 2 * 3_600 + 1);
    // late attestation after deadline fails
    expect_err(env.send_attestor(&[env.ix_attest(&att, &u2.pubkey(), DAY, 20, started)]), 6008);
    let r = env.send(&[env.ix_finalize(&u2.pubkey(), DAY)], u2).unwrap();
    println!("CU finalize {:>6}", r.cu);

    // --- claims: slashed 100, fee 5, distributable 95 -> 47.5 each ---
    for (u, ata) in &users[..2] {
        let r = env.send(&[env.ix_claim(&u.pubkey(), ata, DAY)], u).unwrap();
        println!("CU claim {:>6}", r.cu);
        assert_eq!(env.bal(ata), 900 * SKR + 147 * SKR + SKR / 2);
    }
    // double claim fails (commitment closed)
    assert!(env.send(&[env.ix_claim(&u0.pubkey(), a0, DAY)], u0).is_err());
    // misser cannot claim
    expect_err(env.send(&[env.ix_claim(&u2.pubkey(), &users[2].1, DAY)], u2), 6013);

    // --- close_missed (the misser cranks it: only signer + fee payer) + sweep ---
    let r = env.send(&[env.ix_close_missed(&u2.pubkey(), &u2.pubkey(), DAY)], u2).unwrap();
    println!("CU close_missed {:>6}", r.cu);
    let admin = env.admin.pubkey();
    let r = env.send_admin(&[env.ix_sweep(&admin, &u0.pubkey(), DAY)]).unwrap();
    println!("CU sweep {:>6}", r.cu);
    assert!(!exists(&env.svm, &env.day_pda(DAY)));
    let prof = env.profile(&u2.pubkey()).unwrap();
    assert_eq!((prof.total_committed, prof.total_missed, prof.current_streak), (1, 1, 0));

    // --- treasury: authority can take exactly the 5 SKR fee, not a lamport more ---
    let admin_ata = env.admin_ata;
    expect_err(env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 5 * SKR + 1)]), 6019);
    let r = env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 5 * SKR)]).unwrap();
    println!("CU withdraw {:>6}", r.cu);
    assert_eq!(env.vault_balance(), 0);
    let p = env.pool_state();
    assert_eq!((p.outstanding, p.reserve, p.treasury_accrued), (0, 0, 0));
}

/// Mixed stakes, streaks, a plank goal, and a dust-producing split, all checked to the base unit.
///
/// Day A (pool day 20721), fee 5%, streak +5%/day capped at +50%:
///   alice 50 SKR  push-ups goal 10  completes (streak 1, weight 50e6)
///   bob  250 SKR  plank 60 s        completes (streak 1, weight 250e6)
///   carol 1000 SKR squats goal 15   misses
///   dave  7.000003 SKR push-ups     misses
///   total 1_307_000_003, completed 300_000_000, slashed 1_007_000_003
///   fee floor(1_007_000_003 * 0.05) = 50_350_000, distributable 956_650_003
///   alice bonus floor(956_650_003 * 50/300)  = floor(159_441_667.17) = 159_441_667
///   bob   bonus floor(956_650_003 * 250/300) = floor(797_208_335.83) = 797_208_335
///   dust = 956_650_003 - 956_650_002 = 1 -> reserve at sweep
/// Day B (20722): bob 250 SKR again, alice 3 SKR; both complete (bob streak 2 -> weight 262.5e6,
/// alice streak 2 -> weight 3.15e6); nobody misses -> bonus 0, principal back exactly.
#[test]
fn variable_stake_flow() {
    let mut env = Env::new(params(Default::default(), 86_400));
    let d = 20_721u32;
    env.warp(env.day_start(d) + 60);
    let (alice, a_ata) = env.user(1_000);
    let (bob, b_ata) = env.user(1_000);
    let (carol, c_ata) = env.user(2_000);
    let (dave, d_ata) = env.user(10);
    let att = env.attestor.pubkey();

    let stakes = [
        (&alice, a_ata, 50 * SKR, Exercise::Pushup, 10u32),
        (&bob, b_ata, 250 * SKR, Exercise::Plank, 60),
        (&carol, c_ata, 1_000 * SKR, Exercise::Squat, 15),
        (&dave, d_ata, 7 * SKR + 3, Exercise::Pushup, 12),
    ];
    for (u, ata, amt, ex, goal) in stakes {
        env.send(&[env.ix_commit(&u.pubkey(), &ata, d, amt, ex, goal, None)], u).unwrap();
        let c = env.commitment(&u.pubkey(), d).unwrap();
        assert_eq!((c.amount, c.exercise, c.goal_target, c.status), (amt, ex, goal, CommitmentStatus::Committed));
    }
    let ds = env.day_state(d).unwrap();
    assert_eq!((ds.committed_count, ds.total_staked), (4, 1_307_000_003));
    assert_eq!(env.pool_state().outstanding, 1_307_000_003);

    env.warp(env.day_start(d) + 3_600);
    let started = env.day_start(d) + 3_000;
    // plank: 59 s held < 60 s goal -> GoalNotMet; 60 s -> ok
    expect_err(env.send_attestor(&[env.ix_attest(&att, &bob.pubkey(), d, 59, started)]), 6025);
    env.send_attestor(&[env.ix_attest(&att, &bob.pubkey(), d, 60, started)]).unwrap();
    env.send_attestor(&[env.ix_attest(&att, &alice.pubkey(), d, 11, started)]).unwrap();
    assert_eq!(env.commitment(&bob.pubkey(), d).unwrap().reps, 60);

    // --- day B commits (tomorrow) while day A is open ---
    let d2 = d + 1;
    env.send(&[env.ix_commit(&bob.pubkey(), &b_ata, d2, 250 * SKR, Exercise::Squat, 20, None)], &bob).unwrap();
    env.send(&[env.ix_commit(&alice.pubkey(), &a_ata, d2, 3 * SKR, Exercise::Pushup, 10, None)], &alice).unwrap();

    // --- day B starts (day A still inside its grace period): both complete, streak 2 weights ---
    env.warp(env.day_start(d2) + 600);
    let started = env.day_start(d2) + 100;
    env.send_attestor(&[env.ix_attest(&att, &bob.pubkey(), d2, 20, started)]).unwrap();
    env.send_attestor(&[env.ix_attest(&att, &alice.pubkey(), d2, 10, started)]).unwrap();
    assert_eq!(env.commitment(&bob.pubkey(), d2).unwrap().weight, 262_500_000);
    assert_eq!(env.commitment(&alice.pubkey(), d2).unwrap().weight, 3_150_000);
    assert_eq!(env.profile(&bob.pubkey()).unwrap().current_streak, 2);

    // --- finalize day A ---
    env.warp(env.day_end(d) + 7_200 + 1);
    env.send_admin(&[env.ix_finalize(&env.admin.pubkey(), d)]).unwrap();
    let ds = env.day_state(d).unwrap();
    assert_eq!((ds.fee, ds.sponsor, ds.distributable), (50_350_000, 0, 956_650_003));
    assert_eq!(env.pool_state().treasury_accrued, 50_350_000);

    let a0 = env.bal(&a_ata);
    env.send(&[env.ix_claim(&alice.pubkey(), &a_ata, d)], &alice).unwrap();
    assert_eq!(env.bal(&a_ata) - a0, 50 * SKR + 159_441_667);
    let b0 = env.bal(&b_ata);
    env.send(&[env.ix_claim(&bob.pubkey(), &b_ata, d)], &bob).unwrap();
    assert_eq!(env.bal(&b_ata) - b0, 250 * SKR + 797_208_335);
    for u in [&carol, &dave] {
        env.send(&[env.ix_close_missed(&u.pubkey(), &u.pubkey(), d)], u).unwrap();
    }
    assert_eq!(env.bal(&c_ata), 1_000 * SKR);
    assert_eq!(env.bal(&d_ata), 10 * SKR - 7 * SKR - 3);
    env.send_admin(&[env.ix_sweep(&env.admin.pubkey(), &alice.pubkey(), d)]).unwrap();
    let p = env.pool_state();
    assert_eq!(p.reserve, 1, "1 base unit of rounding dust goes to the reserve");

    // --- day B: bonus 0 since nobody forfeited ---
    env.warp(env.day_end(d2) + 7_200 + 1);
    env.send_admin(&[env.ix_finalize(&env.admin.pubkey(), d2)]).unwrap();
    let (a1, b1) = (env.bal(&a_ata), env.bal(&b_ata));
    env.send(&[env.ix_claim(&alice.pubkey(), &a_ata, d2)], &alice).unwrap();
    env.send(&[env.ix_claim(&bob.pubkey(), &b_ata, d2)], &bob).unwrap();
    assert_eq!(env.bal(&a_ata) - a1, 3 * SKR);
    assert_eq!(env.bal(&b_ata) - b1, 250 * SKR);
    env.send_admin(&[env.ix_sweep(&env.admin.pubkey(), &bob.pubkey(), d2)]).unwrap();

    // --- conservation: vault holds exactly reserve (dust) + treasury ---
    let p = env.pool_state();
    assert_eq!(p.outstanding, 0);
    assert_eq!(env.vault_balance(), p.reserve + p.treasury_accrued);
    assert_eq!(env.vault_balance(), 1 + 50_350_000);
}
