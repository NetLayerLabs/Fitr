//! Edge cases and one negative test per reachable error path, mostly on short (600 s) days.
//! Error codes: VaultError = 6000 + index (see error.rs); Anchor constraint codes 2xxx/3xxx.
mod common;
use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, system_instruction},
    InstructionData, ToAccountMetas,
};
use anchor_spl::token_2022;
use common::*;
use fitr_vault::{
    accounts as acc, instruction as ix, CommitmentStatus, Exercise, GoalLimits, InitPoolParams, UpdateConfigParams,
};
use solana_keypair::Keypair;
use solana_signer::Signer;

const LEN: i64 = 600;
const GRACE: i64 = 60;

/// 600 s days, 60 s grace, commits accepted during the first 500 s of a day.
fn short_env() -> Env {
    let p = InitPoolParams {
        day_length_secs: LEN,
        attest_grace_secs: GRACE,
        commit_cutoff_secs: 500,
        ..params(Default::default(), LEN)
    };
    let mut env = Env::new(p);
    let d = env.today();
    env.warp(env.day_start(d) + 10);
    env
}

fn deadline(env: &Env, d: u32) -> i64 {
    env.day_end(d) + GRACE
}

#[test]
fn short_day_flow() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    for (u, ata) in [(&a, a_ata), (&b, b_ata)] {
        env.send(&[env.ix_commit(&u.pubkey(), &ata, d, 100 * SKR, Exercise::Pushup, 10, None)], u).unwrap();
    }
    env.warp(env.day_start(d) + 300);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, env.day_start(d) + 200)]).unwrap();
    env.warp(deadline(&env, d));
    expect_err(env.send(&[env.ix_finalize(&b.pubkey(), d)], &b), 6009);
    env.warp(deadline(&env, d) + 1);
    env.send(&[env.ix_finalize(&b.pubkey(), d)], &b).unwrap();
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_close_missed(&b.pubkey(), &b.pubkey(), d)], &b).unwrap();
    // payouts 195 and 0 (fee 5 of the forfeited 100)
    assert_eq!(env.bal(&a_ata), 900 * SKR + 195 * SKR);
    assert_eq!(env.bal(&b_ata), 900 * SKR);
    env.send(&[env.ix_sweep(&b.pubkey(), &a.pubkey(), d)], &b).unwrap();
    let p = env.pool_state();
    assert_eq!((p.treasury_accrued, p.reserve, p.outstanding), (5 * SKR, 0, 0));
    assert_eq!(env.vault_balance(), 5 * SKR);
}

#[test]
fn mwa_claim_and_commit_one_tx() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 40 * SKR, Exercise::Squat, 20, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 60 * SKR, Exercise::Squat, 20, None)], &b).unwrap();
    env.warp(env.day_start(d) + 100);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 25, env.day_start(d) + 50)]).unwrap();
    env.warp(deadline(&env, d) + 1);
    env.send(&[env.ix_finalize(&b.pubkey(), d)], &b).unwrap();
    // day d+1 is "today" now; user signs ONE tx: claim yesterday + commit today
    let before = env.bal(&a_ata);
    let ixs = [
        env.ix_claim(&a.pubkey(), &a_ata, d),
        env.ix_commit(&a.pubkey(), &a_ata, d + 1, 55 * SKR, Exercise::Pushup, 30, None),
    ];
    let r = send(&mut env.svm, &ixs, &a, &[]).unwrap();
    println!(
        "CU [claim(d-1), commit(d)] non-SGT: total {} (claim {}, commit {}), tx size {} bytes",
        r.cu, r.ix_cu[0], r.ix_cu[1], r.size
    );
    // payout: 40 + (60 * 0.95) = 97 SKR; then 55 staked
    assert_eq!(env.bal(&a_ata), before + 97 * SKR - 55 * SKR);
    // the missed user can batch close_missed(d-1) + commit(d) the same way
    let ixs = [
        env.ix_close_missed(&b.pubkey(), &b.pubkey(), d),
        env.ix_commit(&b.pubkey(), &b_ata, d + 1, 5 * SKR, Exercise::Plank, 30, None),
    ];
    let r = send(&mut env.svm, &ixs, &b, &[]).unwrap();
    println!("CU [close_missed(d-1), commit(d)]: total {} bytes {}", r.cu, r.size);
}

#[test]
fn attestor_and_authority_checks() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let (m, _) = env.user(1);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    let started = env.day_start(d) + 20;
    env.warp(env.day_start(d) + 30);
    // non-attestor attest
    expect_err(env.send(&[env.ix_attest(&m.pubkey(), &a.pubkey(), d, 10, started)], &m), 6002);
    // the authority is not the attestor either
    expect_err(env.send_admin(&[env.ix_attest(&env.admin.pubkey(), &a.pubkey(), d, 10, started)]), 6002);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, started)]).unwrap();
    // revoke by a random signer
    expect_err(env.send(&[env.ix_revoke(&m.pubkey(), &a.pubkey(), d)], &m), 6001);
    // void by a random signer / by the attestor
    expect_err(env.send(&[env.ix_void(&m.pubkey(), d)], &m), 6001);
    expect_err(env.send_attestor(&[env.ix_void(&env.attestor.pubkey(), d)]), 6001);
    // update_config / propose / withdraw by non-authority
    expect_err(env.send(&[env.ix_update(&m.pubkey(), UpdateConfigParams { paused: Some(true), ..Default::default() })], &m), 6001);
    expect_err(env.send(&[env.ix_propose(&m.pubkey(), m.pubkey())], &m), 6001);
    let m_ata = fund_ata(&mut env.svm, &env.admin.insecure_clone(), &env.mint, &m.pubkey(), 0);
    expect_err(env.send(&[env.ix_withdraw(&m.pubkey(), &m_ata, 0)], &m), 6001);
    // revoke by attestor: a becomes Revoked (refund-only); it cannot be revoked or attested again
    env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &a.pubkey(), d)]).unwrap();
    assert_eq!(env.commitment(&a.pubkey(), d).unwrap().status, CommitmentStatus::Revoked);
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &a.pubkey(), d)]), 6013);
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, started)]), 6013);
    // revoke by the authority
    let (b, b_ata) = env.user(100);
    let (c, c_ata) = env.user(100);
    env.warp(env.day_start(d) + 10);
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 20 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.send(&[env.ix_commit(&c.pubkey(), &c_ata, d, 30 * SKR, Exercise::Pushup, 10, None)], &c).unwrap();
    env.warp(env.day_start(d) + 30);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 10, started)]).unwrap();
    env.send_admin(&[env.ix_revoke(&env.admin.pubkey(), &b.pubkey(), d)]).unwrap();
    let ds = env.day_state(d).unwrap();
    assert_eq!((ds.completed_count, ds.completed_stake, ds.completed_weight), (0, 0, 0));
    assert_eq!((ds.revoked_count, ds.revoked_stake), (2, 30 * SKR));
    // revoke/attest after the deadline (before finalize): window closed
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &c.pubkey(), d, 10, started)]).unwrap();
    env.warp(deadline(&env, d) + 1);
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &c.pubkey(), d)]), 6008);
    expect_err(env.send_admin(&[env.ix_revoke(&env.admin.pubkey(), &c.pubkey(), d)]), 6008);
    // a revoked commitment cannot be claimed before finalize
    expect_err(env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a), 6011);
    env.send(&[env.ix_finalize(&m.pubkey(), d)], &m).unwrap();
    // attest / revoke / void / finalize after finalize
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &c.pubkey(), d, 10, started)]), 6010);
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &c.pubkey(), d)]), 6010);
    expect_err(env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]), 6010);
    expect_err(env.send(&[env.ix_finalize(&m.pubkey(), d)], &m), 6010);
    // close_missed on a completed or a revoked commitment
    expect_err(env.send(&[env.ix_close_missed(&m.pubkey(), &c.pubkey(), d)], &m), 6013);
    expect_err(env.send(&[env.ix_close_missed(&m.pubkey(), &a.pubkey(), d)], &m), 6013);
    // nothing was forfeited: revoked users get exactly their principal back, c exactly its stake
    let ds = env.day_state(d).unwrap();
    assert_eq!((ds.fee, ds.distributable), (0, 0));
    for (u, ata) in [(&a, a_ata), (&b, b_ata), (&c, c_ata)] {
        env.send(&[env.ix_claim(&u.pubkey(), &ata, d)], u).unwrap();
    }
    assert_eq!((env.bal(&a_ata), env.bal(&b_ata), env.bal(&c_ata)), (100 * SKR, 100 * SKR, 100 * SKR));
    env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m).unwrap();
    assert_eq!(env.vault_balance(), 0);
}

#[test]
fn authority_transfer_two_step() {
    let mut env = short_env();
    let new = Keypair::new();
    env.svm.airdrop(&new.pubkey(), 1_000_000_000).unwrap();
    let (m, _) = env.user(1);
    env.send_admin(&[env.ix_propose(&env.admin.pubkey(), new.pubkey())]).unwrap();
    expect_err(env.send(&[env.ix_accept(&m.pubkey())], &m), 6003);
    env.send(&[env.ix_accept(&new.pubkey())], &new).unwrap();
    let p = env.pool_state();
    assert_eq!((p.authority, p.pending_authority), (new.pubkey(), Pubkey::default()));
    // old authority lost its powers; accepting again is impossible (pending cleared)
    expect_err(env.send_admin(&[env.ix_update(&env.admin.pubkey(), UpdateConfigParams::default())]), 6001);
    expect_err(env.send_admin(&[env.ix_accept(&env.admin.pubkey())]), 6003);
    env.send(&[env.ix_update(&new.pubkey(), UpdateConfigParams { fee_bps: Some(100), ..Default::default() })], &new).unwrap();
}

#[test]
fn commit_window_and_bounds() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(20_000);
    let c = |env: &Env, day: u32, amt: u64, ex: Exercise, goal: u32| {
        env.ix_commit(&a.pubkey(), &a_ata, day, amt, ex, goal, None)
    };
    // day must be today or tomorrow
    expect_err(env.send(&[c(&env, d - 1, 10 * SKR, Exercise::Pushup, 10)], &a), 6006);
    expect_err(env.send(&[c(&env, d + 2, 10 * SKR, Exercise::Pushup, 10)], &a), 6006);
    // stake bounds: min 1 SKR, max 10_000 SKR (inclusive)
    expect_err(env.send(&[c(&env, d, SKR - 1, Exercise::Pushup, 10)], &a), 6023);
    expect_err(env.send(&[c(&env, d, 10_000 * SKR + 1, Exercise::Pushup, 10)], &a), 6023);
    expect_err(env.send(&[c(&env, d, 0, Exercise::Pushup, 10)], &a), 6023);
    // goal bounds per exercise (push-ups 10..=1000, squats 15..=1000, plank 30..=3600 s)
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Pushup, 9)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Squat, 14)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Plank, 29)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Pushup, 1_001)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Plank, 3_601)], &a), 6024);
    // new exercises use their own row: wall sit 30..=3600 s, pull-ups 3..=1000,
    // mountain climbers / jumping jacks / high knees 20..=3000, pike push-ups 5..=1000
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::WallSit, 29)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::WallSit, 3_601)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Pullup, 2)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::Burpee, 1_001)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::PikePushup, 4)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::MountainClimber, 19)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::JumpingJack, 3_001)], &a), 6024);
    expect_err(env.send(&[c(&env, d, 10 * SKR, Exercise::HighKnees, 3_001)], &a), 6024);
    // exercise byte 16 (one past HighKnees) does not deserialize (InstructionDidNotDeserialize = 102)
    let mut bad = c(&env, d, 10 * SKR, Exercise::Pushup, 10);
    let ex_off = 8 + 4 + 8;
    assert_eq!(bad.data[ex_off], 0);
    for byte in [16u8, 255] {
        bad.data[ex_off] = byte;
        expect_err(env.send(&[bad.clone()], &a), 102);
    }
    // every code 0..=15 deserializes and its exact bounds are accepted (one fresh user each)
    for (code, ex) in Exercise::ALL.into_iter().enumerate() {
        let g = MAINNET_GOALS[code];
        for goal in [g.min, g.max] {
            let (u, u_ata) = env.user(100);
            env.send(&[env.ix_commit(&u.pubkey(), &u_ata, d + 1, 10 * SKR, ex, goal, None)], &u).unwrap();
            let cm = env.commitment(&u.pubkey(), d + 1).unwrap();
            assert_eq!((cm.exercise, cm.goal_target), (ex, goal));
            let raw = env.svm.get_account(&env.commitment_pda(&u.pubkey(), d + 1)).unwrap().data;
            assert_eq!((raw[79], u32::from_le_bytes(raw[80..84].try_into().unwrap())), (code as u8, goal));
        }
    }
    // exact bounds are accepted: max stake today, min stake + max plank tomorrow
    env.send(&[c(&env, d, 10_000 * SKR, Exercise::Plank, 3_600)], &a).unwrap();
    env.send(&[c(&env, d + 1, SKR, Exercise::Squat, 15)], &a).unwrap();
    // cutoff: commits for today stop at day_start + 500; tomorrow is still open
    let (b, b_ata) = env.user(100);
    env.warp(env.day_start(d) + 500);
    expect_err(env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &b), 6007);
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d + 1, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    // double commit for the same (user, day): Commitment PDA already in use
    assert!(env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d + 1, 10 * SKR, Exercise::Pushup, 10, None)], &b).is_err());
    // insufficient token balance: SPL token error 1 (InsufficientFunds)
    let (poor, poor_ata) = env.user(1);
    expect_err(env.send(&[env.ix_commit(&poor.pubkey(), &poor_ata, d + 1, 2 * SKR, Exercise::Pushup, 10, None)], &poor), 1);
    // stored commitment data
    let cm = env.commitment(&a.pubkey(), d).unwrap();
    assert_eq!((cm.amount, cm.exercise, cm.goal_target, cm.version), (10_000 * SKR, Exercise::Plank, 3_600, 1));
}

#[test]
fn pause_blocks_commit_attest_finalize_not_exits() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let (b, b_ata) = env.user(100);
    let (x, x_ata) = env.user(100); // never works out
    for (u, ata) in [(&a, a_ata), (&b, b_ata), (&x, x_ata)] {
        env.send(&[env.ix_commit(&u.pubkey(), &ata, d, 10 * SKR, Exercise::Pushup, 10, None)], u).unwrap();
    }
    env.warp(env.day_start(d) + 40);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, env.day_start(d) + 30)]).unwrap();
    let pause = |v: bool| UpdateConfigParams { paused: Some(v), ..Default::default() };
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(true))]).unwrap();
    let paused_at = now(&env.svm);
    let (c, c_ata) = env.user(100);
    expect_err(env.send(&[env.ix_commit(&c.pubkey(), &c_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &c), 6000);
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 10, env.day_start(d) + 30)]), 6000);
    // the attestor cannot revoke while paused (the authority can, see regression.rs)
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &a.pubkey(), d)]), 6000);
    // finalize is blocked while paused, even long after the nominal deadline
    env.warp(deadline(&env, d) + 1);
    expect_err(env.send(&[env.ix_finalize(&c.pubkey(), d)], &c), 6000);
    // unpause: the attest window is extended by the time spent paused, so b still gets attested
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(false))]).unwrap();
    let paused_for = now(&env.svm) - paused_at;
    assert_eq!(env.pool_state().total_paused_secs, paused_for);
    expect_err(env.send(&[env.ix_finalize(&c.pubkey(), d)], &c), 6009);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 10, env.day_start(d) + 30)]).unwrap();
    env.warp(deadline(&env, d) + paused_for);
    expect_err(env.send(&[env.ix_finalize(&c.pubkey(), d)], &c), 6009);
    env.warp(deadline(&env, d) + paused_for + 1);
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &x.pubkey(), d, 10, env.day_start(d) + 30)]), 6008);
    env.send(&[env.ix_finalize(&c.pubkey(), d)], &c).unwrap();
    // claim, close_missed, sweep and withdraw all work while paused
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(true))]).unwrap();
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b).unwrap();
    env.send(&[env.ix_close_missed(&c.pubkey(), &x.pubkey(), d)], &c).unwrap();
    env.send(&[env.ix_sweep(&c.pubkey(), &a.pubkey(), d)], &c).unwrap();
    // x forfeited 10: fee 0.5, a and b get 4.75 each
    assert_eq!(env.bal(&a_ata), 100 * SKR + 4_750_000);
    assert_eq!(env.bal(&b_ata), 100 * SKR + 4_750_000);
    let admin_ata = env.admin_ata;
    env.send_admin(&[env.ix_withdraw(&env.admin.pubkey(), &admin_ata, 500_000)]).unwrap();
}

#[test]
fn claims_close_and_sweep_errors() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let (b, b_ata) = env.user(100);
    let (m, _) = env.user(1);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 30 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.warp(env.day_start(d) + 40);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 12, env.day_start(d) + 30)]).unwrap();
    // before finalize: claim / close_missed / sweep -> NotFinalized
    expect_err(env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a), 6011);
    expect_err(env.send(&[env.ix_close_missed(&m.pubkey(), &b.pubkey(), d)], &m), 6011);
    expect_err(env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m), 6011);
    env.warp(deadline(&env, d) + 1);
    env.send(&[env.ix_finalize(&m.pubkey(), d)], &m).unwrap();
    // payout to the vault itself is rejected
    let vault = env.vault;
    expect_err(env.send(&[env.ix_claim(&a.pubkey(), &vault, d)], &a), 6028);
    // missed user cannot claim
    expect_err(env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b), 6013);
    // sweep before everything is resolved
    expect_err(env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m), 6018);
    // sweep with the wrong rent payer (Anchor ConstraintAddress = 2012)
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_close_missed(&m.pubkey(), &b.pubkey(), d)], &m).unwrap();
    expect_err(env.send(&[env.ix_sweep(&m.pubkey(), &m.pubkey(), d)], &m), 2012);
    // double claim / double close: Commitment account is gone (AccountNotInitialized = 3012)
    expect_err(env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a), 3012);
    expect_err(env.send(&[env.ix_close_missed(&m.pubkey(), &b.pubkey(), d)], &m), 3012);
    // payout: 10 + 30 * 0.95 = 38.5 SKR; fee 1.5 SKR
    assert_eq!(env.bal(&a_ata), 90 * SKR + 38 * SKR + SKR / 2);
    env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m).unwrap();
    // withdraw: more than accrued, to the vault, then exactly the fee
    let admin = env.admin.pubkey();
    let admin_ata = env.admin_ata;
    expect_err(env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 1_500_001)]), 6019);
    expect_err(env.send_admin(&[env.ix_withdraw(&admin, &vault, 1)]), 6028);
    env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, 1_500_000)]).unwrap();
    let p = env.pool_state();
    assert_eq!((env.vault_balance(), p.outstanding, p.reserve, p.treasury_accrued), (0, 0, 0, 0));
}

#[test]
fn session_time_rules() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let att = env.attestor.pubkey();
    // commit for tomorrow at day_start(d)+10
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d + 1, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    let committed_at = now(&env.svm);
    env.warp(env.day_start(d + 1) + 100);
    // session started before the day began (but after commit)
    expect_err(env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), d + 1, 10, committed_at + 1)]), 6014);
    // session in the future
    expect_err(env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), d + 1, 10, env.day_start(d + 1) + 101)]), 6014);
    // same-day commit: session before committed_at
    let (b, b_ata) = env.user(100);
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d + 1, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    expect_err(env.send_attestor(&[env.ix_attest(&att, &b.pubkey(), d + 1, 10, env.day_start(d + 1) + 99)]), 6014);
    // goal not met
    expect_err(env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), d + 1, 9, env.day_start(d + 1) + 50)]), 6025);
    env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), d + 1, 10, env.day_start(d + 1) + 50)]).unwrap();
    // grace period: session must still have started inside the day
    env.warp(env.day_end(d + 1) + 30);
    expect_err(env.send_attestor(&[env.ix_attest(&att, &b.pubkey(), d + 1, 10, env.day_end(d + 1))]), 6014);
    env.send_attestor(&[env.ix_attest(&att, &b.pubkey(), d + 1, 10, env.day_end(d + 1) - 1)]).unwrap();
    // wrong DayState for the commitment's day (Anchor ConstraintSeeds = 2006)
    let mut wrong = env.ix_attest(&att, &a.pubkey(), d + 1, 10, env.day_start(d + 1) + 50);
    wrong.accounts[3].pubkey = env.day_pda(d);
    assert!(env.send_attestor(&[wrong]).is_err());
}

#[test]
fn void_refunds_everyone_then_sweeps() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let (b, b_ata) = env.user(100);
    let (m, _) = env.user(1);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 17 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 23 * SKR + 5, Exercise::Squat, 15, None)], &b).unwrap();
    env.warp(env.day_start(d) + 50);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, env.day_start(d) + 20)]).unwrap();
    env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]).unwrap();
    // voided: void again / attest / revoke / finalize / commit are rejected
    expect_err(env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]), 6012);
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 15, env.day_start(d) + 20)]), 6012);
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &a.pubkey(), d)]), 6012);
    let (c, c_ata) = env.user(100);
    expect_err(env.send(&[env.ix_commit(&c.pubkey(), &c_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &c), 6012);
    // everyone (completed or not) gets exactly their principal back
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b).unwrap();
    assert_eq!((env.bal(&a_ata), env.bal(&b_ata)), (100 * SKR, 100 * SKR));
    // close_missed is not the exit on a voided day
    // (commitments are already closed; the day is not finalized)
    // sweep must wait for the deadline so the DayState cannot be re-created by a new commit
    expect_err(env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m), 6009);
    // a re-commit by `a` for the voided day is still rejected while the DayState exists
    expect_err(env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &a), 6012);
    env.warp(deadline(&env, d) + 1);
    expect_err(env.send(&[env.ix_finalize(&m.pubkey(), d)], &m), 6012);
    env.send(&[env.ix_sweep(&m.pubkey(), &a.pubkey(), d)], &m).unwrap();
    // after the sweep, the day can never be committed again (its commit window is over)
    expect_err(env.send(&[env.ix_commit(&c.pubkey(), &c_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &c), 6006);
    let p = env.pool_state();
    assert_eq!((env.vault_balance(), p.outstanding, p.reserve, p.treasury_accrued), (0, 0, 0, 0));
}

#[test]
fn config_changes_never_touch_existing_days() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    let before = env.day_state(d).unwrap();
    assert_eq!((before.fee_bps, before.attest_deadline), (500, env.day_end(d) + GRACE));
    // authority raises the fee to the max, removes grace and streak bonus mid-day
    let up = UpdateConfigParams {
        fee_bps: Some(2_000),
        attest_grace_secs: Some(0),
        streak_bonus_bps: Some(0),
        max_streak_bonus_bps: Some(0),
        ..Default::default()
    };
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), up)]).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    let after = env.day_state(d).unwrap();
    assert_eq!((after.fee_bps, after.attest_deadline, after.streak_bonus_bps), (500, before.attest_deadline, 500));
    // attestation inside the ORIGINAL grace period still lands
    env.warp(env.day_end(d) + GRACE);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, env.day_end(d) - 5)]).unwrap();
    env.warp(env.day_end(d) + GRACE + 1);
    env.send(&[env.ix_finalize(&b.pubkey(), d)], &b).unwrap();
    assert_eq!(env.day_state(d).unwrap().fee, 5 * SKR); // 5% of 100, not 20%
    // the next day uses the new config
    let d2 = d + 1;
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d2, 10 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    let n = env.day_state(d2).unwrap();
    assert_eq!((n.fee_bps, n.attest_deadline), (2_000, env.day_end(d2)));
}

#[test]
fn update_config_validation() {
    let mut env = short_env();
    let admin = env.admin.pubkey();
    let before = env.pool_state();
    let bad = [
        UpdateConfigParams { fee_bps: Some(2_001), ..Default::default() },
        UpdateConfigParams { min_stake: Some(0), ..Default::default() },
        UpdateConfigParams { min_stake: Some(10_001 * SKR), ..Default::default() }, // > max_stake
        UpdateConfigParams { max_stake: Some(1_000_000 * SKR + 1), ..Default::default() }, // > hard ceiling
        UpdateConfigParams { commit_cutoff_secs: Some(LEN - LEN / 24 + 1), ..Default::default() },
        UpdateConfigParams { attest_grace_secs: Some(LEN + 1), ..Default::default() },
        UpdateConfigParams { streak_bonus_bps: Some(5_001), ..Default::default() },
        UpdateConfigParams { max_streak_bonus_bps: Some(10_001), streak_bonus_bps: Some(0), ..Default::default() },
        UpdateConfigParams {
            goal_limits: Some(goals_with(0, GoalLimits { min: 0, max: 10 })),
            ..Default::default()
        },
        UpdateConfigParams {
            goal_limits: Some(goals_with(1, GoalLimits { min: 15, max: 1_001 })),
            ..Default::default()
        },
        UpdateConfigParams { goal_limits: Some(goals_with(7, GoalLimits { min: 30, max: 3_601 })), ..Default::default() },
        UpdateConfigParams { goal_limits: Some(goals_with(11, GoalLimits { min: 5, max: 1_001 })), ..Default::default() },
        UpdateConfigParams { goal_limits: Some(goals_with(14, GoalLimits { min: 20, max: 3_001 })), ..Default::default() },
        UpdateConfigParams { goal_limits: Some(goals_with(15, GoalLimits { min: 0, max: 50 })), ..Default::default() },
        UpdateConfigParams { goal_limits: Some(goals_with(13, GoalLimits { min: 41, max: 40 })), ..Default::default() },
        UpdateConfigParams { attestor: Some(Pubkey::default()), ..Default::default() },
        // audit fixes
        UpdateConfigParams { attestor: Some(admin), ..Default::default() },
        UpdateConfigParams { daily_sponsor_amount: Some(10_000 * SKR + 1), ..Default::default() },
        UpdateConfigParams { daily_sponsor_amount: Some(u64::MAX), ..Default::default() },
        UpdateConfigParams { max_stake: Some(SKR), daily_sponsor_amount: Some(2 * SKR), ..Default::default() },
        UpdateConfigParams { finalize_delay_secs: Some(LEN + 1), ..Default::default() },
        UpdateConfigParams { finalize_delay_secs: Some(-1), ..Default::default() },
    ];
    for p in bad {
        expect_err(env.send_admin(&[env.ix_update(&admin, p)]), 6004);
    }
    let after = env.pool_state();
    assert_eq!((after.fee_bps, after.min_stake, after.max_stake), (before.fee_bps, before.min_stake, before.max_stake));
    // valid: raise the max to the hard ceiling, tighten goals, rotate attestor
    let new_att = Keypair::new().pubkey();
    let good = UpdateConfigParams {
        max_stake: Some(1_000_000 * SKR),
        min_stake: Some(1_000_000 * SKR),
        goal_limits: Some({
            let mut g = goals_with(0, GoalLimits { min: 20, max: 20 });
            g[15] = GoalLimits { min: 1, max: 3_000 };
            g
        }),
        attestor: Some(new_att),
        ..Default::default()
    };
    env.send_admin(&[env.ix_update(&admin, good)]).unwrap();
    let p = env.pool_state();
    assert_eq!((p.min_stake, p.max_stake, p.attestor, p.goal_limits[0].min), (1_000_000 * SKR, 1_000_000 * SKR, new_att, 20));
    assert_eq!(p.goal_limits[15], GoalLimits { min: 1, max: 3_000 });
    assert_eq!(p.goal_limits[1..15], MAINNET_GOALS[1..15]);
    // day length / offset are immutable (not in UpdateConfigParams at all)
    assert_eq!((p.day_length_secs, p.day_offset_secs), (LEN, 0));
    // fund_reserve(0) is rejected
    let (f, f_ata) = env.user(10);
    expect_err(env.send(&[env.ix_fund(&f.pubkey(), &f_ata, 0)], &f), 6004);
}

#[test]
fn initialize_pool_guards() {
    let so = so_bytes();
    // 1. only the upgrade authority can create a pool (front-running the canonical PDA is impossible)
    let mut env = Env::bare(&so);
    let (mallory, _) = env.user(1);
    let p = InitPoolParams { attestor: env.attestor.pubkey(), ..params(Default::default(), 86_400) };
    expect_err(env.send(&[env.ix_init(&mallory.pubkey(), p.clone())], &mallory), 6027);
    // 2. invalid params are rejected
    for bad in [
        InitPoolParams { day_length_secs: 299, ..p.clone() },
        InitPoolParams { day_length_secs: 86_401, ..p.clone() },
        InitPoolParams { day_offset_secs: 86_400, ..p.clone() },
        InitPoolParams { commit_cutoff_secs: 82_801, ..p.clone() },
        InitPoolParams { attest_grace_secs: 21_601, ..p.clone() },
        InitPoolParams { day_length_secs: 600, commit_cutoff_secs: 0, attest_grace_secs: 601, ..p.clone() },
        InitPoolParams { fee_bps: 2_001, ..p.clone() },
        InitPoolParams { min_stake: 0, ..p.clone() },
        InitPoolParams { min_stake: 2, max_stake: 1, ..p.clone() },
        InitPoolParams { attestor: Pubkey::default(), ..p.clone() },
        // audit fixes: the authority cannot be the attestor; the sponsor tap is capped at
        // max_stake; the finalize review window is bounded
        InitPoolParams { attestor: env.admin.pubkey(), ..p.clone() },
        InitPoolParams { daily_sponsor_amount: p.max_stake + 1, ..p.clone() },
        InitPoolParams { finalize_delay_secs: 43_201, ..p.clone() },
        InitPoolParams { finalize_delay_secs: -1, ..p.clone() },
    ] {
        expect_err(env.send_admin(&[env.ix_init(&env.admin.pubkey(), bad)]), 6004);
    }
    env.send_admin(&[env.ix_init(&env.admin.pubkey(), p.clone())]).unwrap();
    let pool = env.pool_state();
    assert_eq!((pool.version, pool.mint_decimals, pool.day_length_secs, pool.authority), (1, 6, 86_400, env.admin.pubkey()));
    // second init of the same mint fails (PDA in use)
    assert!(env.send_admin(&[env.ix_init(&env.admin.pubkey(), p.clone())]).is_err());

    // 3. immutable program (no upgrade authority): nobody can create a pool
    let mut env2 = Env::bare(&so);
    deploy_upgradeable(&mut env2.svm, &so, None);
    let p2 = InitPoolParams { attestor: env2.attestor.pubkey(), ..p.clone() };
    expect_err(env2.send_admin(&[env2.ix_init(&env2.admin.pubkey(), p2)]), 6027);

    // 4. mint with 10 decimals is rejected
    let admin = env.admin.insecure_clone();
    env.mint = create_mint(&mut env.svm, &admin, 10);
    env.pool = pool_pda(&env.mint, 0);
    env.vault = pda(&[fitr_vault::VAULT_SEED, env.pool.as_ref()]);
    expect_err(env.send_admin(&[env.ix_init(&admin.pubkey(), p.clone())]), 6026);
}

/// Token-2022 stake mints: inert extensions are accepted, dangerous ones (PermanentDelegate,
/// TransferFee, ...) are rejected by the allow-list.
#[test]
fn token_2022_mint_extensions() {
    use token_2022::spl_token_2022::{self, extension::ExtensionType, state::Mint};
    let so = so_bytes();
    let mut env = Env::bare(&so);
    let admin = env.admin.insecure_clone();
    let p = InitPoolParams { attestor: env.attestor.pubkey(), ..params(Default::default(), 86_400) };
    let mut try_mint = |ext: ExtensionType| -> Result<TxOk, TxErr> {
        let mint = Keypair::new();
        let space = ExtensionType::try_calculate_account_len::<Mint>(&[ext]).unwrap();
        let rent = env.svm.minimum_balance_for_rent_exemption(space);
        let ext_ix = match ext {
            ExtensionType::PermanentDelegate => spl_token_2022::instruction::initialize_permanent_delegate(
                &token_2022::ID,
                &mint.pubkey(),
                &admin.pubkey(),
            )
            .unwrap(),
            ExtensionType::MintCloseAuthority => spl_token_2022::instruction::initialize_mint_close_authority(
                &token_2022::ID,
                &mint.pubkey(),
                Some(&admin.pubkey()),
            )
            .unwrap(),
            _ => unreachable!(),
        };
        send(
            &mut env.svm,
            &[
                system_instruction::create_account(&admin.pubkey(), &mint.pubkey(), rent, space as u64, &token_2022::ID),
                ext_ix,
                spl_token_2022::instruction::initialize_mint2(&token_2022::ID, &mint.pubkey(), &admin.pubkey(), None, 6)
                    .unwrap(),
            ],
            &admin,
            &[&mint],
        )
        .unwrap();
        let pool = pool_pda(&mint.pubkey(), 0);
        let vault = pda(&[fitr_vault::VAULT_SEED, pool.as_ref()]);
        let init = Instruction {
            program_id: fitr_vault::ID,
            accounts: acc::InitializePool {
                authority: admin.pubkey(),
                mint: mint.pubkey(),
                pool,
                vault,
                program_data: program_data_address(),
                token_program: token_2022::ID,
                system_program: SYS,
            }
            .to_account_metas(None),
            data: ix::InitializePool { p: p.clone() }.data(),
        };
        send(&mut env.svm, &[init], &admin, &[])
    };
    try_mint(ExtensionType::MintCloseAuthority).unwrap();
    expect_err(try_mint(ExtensionType::PermanentDelegate), 6005);
}

#[test]
fn clock_before_offset() {
    let p = InitPoolParams { day_offset_secs: 3_600, ..params(Default::default(), 86_400) };
    let mut env = Env::new(p);
    let (a, a_ata) = env.user(10);
    env.warp(100); // LiteSVM-only: a clock earlier than the pool's day offset
    expect_err(env.send(&[env.ix_commit(&a.pubkey(), &a_ata, 0, SKR, Exercise::Pushup, 10, None)], &a), 6022);
}

#[test]
fn account_substitution_is_rejected() {
    let mut env = short_env();
    let d = env.today();
    let (a, a_ata) = env.user(100);
    // commit with a vault that is not the pool's vault (has_one vault -> ConstraintHasOne = 2001)
    let (_, other_ata) = env.user(1);
    let mut c = env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[4].pubkey = other_ata;
    expect_err(env.send(&[c], &a), 2001);
    // commit paying from someone else's token account (token::authority -> ConstraintTokenOwner = 2015)
    let mut c = env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[3].pubkey = other_ata;
    expect_err(env.send(&[c], &a), 2015);
    // commitment PDA for another user (ConstraintSeeds = 2006)
    let mut c = env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[6].pubkey = env.commitment_pda(&Keypair::new().pubkey(), d);
    expect_err(env.send(&[c], &a), 2006);
    // a mint that is not the pool's mint
    let other_mint = create_mint(&mut env.svm, &env.admin.insecure_clone(), 6);
    let mut c = env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[2].pubkey = other_mint;
    assert!(env.send(&[c], &a).is_err());
    // SPL token program swapped for Token-2022 with a classic mint (mint::token_program = 2022-mismatch)
    let mut c = env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None);
    c.accounts[10].pubkey = token_2022::ID;
    assert!(env.send(&[c], &a).is_err());
}
