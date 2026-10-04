//! Regression tests for the 2026-10 audit findings. Each one is the auditors' PoC
//! (~/.fitr/audit/<lens>/programs/fitr-vault/tests/audit_<lens>.rs) ported here and INVERTED:
//! the attack must now fail, and honest users must keep their principal.
//! Run after `anchor build`: CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS=fallback cargo test --test regression
mod common;
use common::*;
use fitr_vault::{CommitmentStatus, Exercise, InitPoolParams, UpdateConfigParams};
use solana_keypair::Keypair;
use solana_signer::Signer;

const LEN: i64 = 600;
const GRACE: i64 = 60;

/// 600 s days, 60 s grace, commits during the first 500 s, `delay` s review window before finalize.
fn env_with_delay(delay: i64) -> Env {
    let p = InitPoolParams {
        day_length_secs: LEN,
        attest_grace_secs: GRACE,
        commit_cutoff_secs: 500,
        finalize_delay_secs: delay,
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

fn pause(v: bool) -> UpdateConfigParams {
    UpdateConfigParams { paused: Some(v), ..Default::default() }
}

/// Seeds the reserve with 950 SKR from a zero-completer day (as in the AUD-AT-1 PoC) and returns
/// with the clock at the start of the next day.
fn seed_reserve(env: &mut Env) {
    let d0 = env.today();
    let (x, x_ata) = env.user(1_000);
    let (y, y_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&x.pubkey(), &x_ata, d0, 500 * SKR, Exercise::Pushup, 10, None)], &x).unwrap();
    env.send(&[env.ix_commit(&y.pubkey(), &y_ata, d0, 500 * SKR, Exercise::Pushup, 10, None)], &y).unwrap();
    let fd = env.day_state(d0).unwrap().finalize_delay_secs;
    env.warp(deadline(env, d0) + fd + 1);
    env.send(&[env.ix_finalize(&x.pubkey(), d0)], &x).unwrap();
    assert_eq!(env.pool_state().reserve, 950 * SKR);
    let d1 = env.today();
    env.warp(env.day_start(d1) + 10);
}

/// AUD-AT-1 (high): the pool authority alone tried to redirect honest principal and the whole
/// reserve with [update_config{attestor: authority, sponsor: MAX}, revoke(A), revoke(B), attest(sock)].
/// Now: the authority cannot be the attestor, the sponsor tap is capped at max_stake, the attestor
/// and sponsor cap are snapshotted per day, and a revoked stake is refunded, never forfeited.
#[test]
fn aud_at_1_authority_cannot_steal_principal_and_reserve() {
    let mut env = env_with_delay(0);
    seed_reserve(&mut env);
    let d1 = env.today();
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d1, 1_000 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d1, 1_000 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    let (sock, sock_ata) = env.user(1);
    env.send(&[env.ix_commit(&sock.pubkey(), &sock_ata, d1, SKR, Exercise::Pushup, 10, None)], &sock).unwrap();
    env.warp(env.day_start(d1) + 100);
    let started = env.day_start(d1) + 50;
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d1, 10, started)]).unwrap();
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d1, 10, started)]).unwrap();

    let admin = env.admin.pubkey();
    // 1. the exact PoC bundle is rejected as a whole: attestor == authority, unbounded sponsor
    let bundle = |env: &Env| {
        vec![
            env.ix_update(
                &admin,
                UpdateConfigParams { attestor: Some(admin), daily_sponsor_amount: Some(u64::MAX), ..Default::default() },
            ),
            env.ix_revoke(&admin, &a.pubkey(), d1),
            env.ix_revoke(&admin, &b.pubkey(), d1),
            env.ix_attest(&admin, &sock.pubkey(), d1, 10, started),
        ]
    };
    expect_err(env.send_admin(&bundle(&env)), 6004);
    for p in [
        UpdateConfigParams { attestor: Some(admin), ..Default::default() },
        UpdateConfigParams { daily_sponsor_amount: Some(u64::MAX), ..Default::default() },
        UpdateConfigParams { daily_sponsor_amount: Some(10_000 * SKR + 1), ..Default::default() },
    ] {
        expect_err(env.send_admin(&[env.ix_update(&admin, p)]), 6004);
    }

    // 2. strongest variant still allowed: rotate to an authority-controlled key that is not the
    //    authority itself and open the tap to the cap. Neither touches the live day d1.
    let evil = Keypair::new();
    env.svm.airdrop(&evil.pubkey(), 1_000_000_000).unwrap();
    env.send_admin(&[env.ix_update(
        &admin,
        UpdateConfigParams { attestor: Some(evil.pubkey()), daily_sponsor_amount: Some(10_000 * SKR), ..Default::default() },
    )])
    .unwrap();
    let ds = env.day_state(d1).unwrap();
    assert_eq!((ds.attestor, ds.sponsor_cap), (env.attestor.pubkey(), 0));
    // the rotated-in key cannot attest the sock on a day that existed before the rotation
    expect_err({ let ix = env.ix_attest(&evil.pubkey(), &sock.pubkey(), d1, 10, started); send(&mut env.svm, &[ix], &evil, &[]) }, 6002);
    // the authority may still revoke, but a revocation is refund-only
    env.send_admin(&[env.ix_revoke(&admin, &a.pubkey(), d1), env.ix_revoke(&admin, &b.pubkey(), d1)]).unwrap();
    assert_eq!(env.commitment(&a.pubkey(), d1).unwrap().status, CommitmentStatus::Revoked);

    env.warp(deadline(&env, d1) + 1);
    env.send(&[env.ix_finalize(&sock.pubkey(), d1)], &sock).unwrap();
    let ds = env.day_state(d1).unwrap();
    // only the sock's own 1 SKR was forfeited; no sponsor draw
    assert_eq!((ds.revoked_stake, ds.sponsor, ds.distributable), (2_000 * SKR, 0, 0));
    expect_err(env.send(&[env.ix_claim(&sock.pubkey(), &sock_ata, d1)], &sock), 6013);
    env.send(&[env.ix_close_missed(&sock.pubkey(), &sock.pubkey(), d1)], &sock).unwrap();
    // honest A and B get every base unit of principal back; the reserve is intact
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d1)], &a).unwrap();
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d1)], &b).unwrap();
    assert_eq!((env.bal(&a_ata), env.bal(&b_ata), env.bal(&sock_ata)), (1_000 * SKR, 1_000 * SKR, 0));
    assert_eq!(env.pool_state().reserve, 950 * SKR + 950_000);
}

/// F2 (economics-goals): authority rotates the attestor to itself, opens the reserve tap, commits
/// dust and attests only itself. Now every step fails or is confined to future days.
#[test]
fn f2_authority_cannot_capture_principal_or_reserve_via_attestor_rotation() {
    let mut env = env_with_delay(0);
    seed_reserve(&mut env);
    let d1 = env.today();
    let (h1, h1_ata) = env.user(1_000);
    let (h2, h2_ata) = env.user(1_000);
    env.send(&[env.ix_commit(&h1.pubkey(), &h1_ata, d1, 1_000 * SKR, Exercise::Pushup, 10, None)], &h1).unwrap();
    env.send(&[env.ix_commit(&h2.pubkey(), &h2_ata, d1, 1_000 * SKR, Exercise::Pushup, 10, None)], &h2).unwrap();
    let admin = env.admin.pubkey();
    let admin_ata = fund_ata(&mut env.svm, &env.admin.insecure_clone(), &env.mint, &admin, SKR);
    expect_err(
        env.send_admin(&[env.ix_update(
            &admin,
            UpdateConfigParams { attestor: Some(admin), daily_sponsor_amount: Some(u64::MAX), ..Default::default() },
        )]),
        6004,
    );
    env.send_admin(&[env.ix_commit(&admin, &admin_ata, d1, SKR, Exercise::Pushup, 10, None)]).unwrap();
    env.warp(env.day_start(d1) + 300);
    // the authority is not the day's attestor
    expect_err(env.send_admin(&[env.ix_attest(&admin, &admin, d1, 10, env.day_start(d1) + 200)]), 6002);
    // the real attestor key keeps working for the live day
    for h in [&h1, &h2] {
        env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &h.pubkey(), d1, 50, env.day_start(d1) + 100)])
            .unwrap();
    }
    env.warp(deadline(&env, d1) + 1);
    env.send(&[env.ix_finalize(&h1.pubkey(), d1)], &h1).unwrap();
    expect_err(env.send_admin(&[env.ix_claim(&admin, &admin_ata, d1)]), 6013);
    env.send(&[env.ix_claim(&h1.pubkey(), &h1_ata, d1)], &h1).unwrap();
    env.send(&[env.ix_claim(&h2.pubkey(), &h2_ata, d1)], &h2).unwrap();
    // the authority's own 1 SKR is the only forfeit: 0.05 fee, 0.475 to each honest user
    assert_eq!((env.bal(&h1_ata), env.bal(&h2_ata)), (1_000 * SKR + 475_000, 1_000 * SKR + 475_000));
    let fees = env.pool_state().treasury_accrued;
    env.send_admin(&[env.ix_withdraw(&admin, &admin_ata, fees)]).unwrap();
    // the authority only ever receives fees: 50 SKR from the seed day + 0.05 SKR of its own forfeit
    assert_eq!(env.bal(&admin_ata), 50 * SKR + 50_000);
    assert_eq!(env.pool_state().reserve, 950 * SKR);
}

/// F1 (economics-goals) / AUD-AT-2: a pause across the attest deadline used to let any cranker
/// finalize and forfeit the pending honest user, after which void was impossible.
/// Now finalize is blocked while paused, so the authority can still void.
#[test]
fn f1_pause_through_deadline_cannot_forfeit_and_void_still_works() {
    let mut env = env_with_delay(0);
    let d = env.today();
    let (a, a_ata) = env.user(1_000);
    let (b, b_ata) = env.user(1_000);
    let (cranker, _) = env.user(0);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    env.send(&[env.ix_commit(&b.pubkey(), &b_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &b).unwrap();
    env.warp(env.day_start(d) + 300);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, env.day_start(d) + 200)]).unwrap();
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(true))]).unwrap();
    expect_err(
        env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &b.pubkey(), d, 10, env.day_start(d) + 250)]),
        6000,
    );
    env.warp(deadline(&env, d) + 1);
    expect_err(env.send(&[env.ix_finalize(&cranker.pubkey(), d)], &cranker), 6000); // Paused
    // the authority can still rescue B
    env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]).unwrap();
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b).unwrap();
    assert_eq!((env.bal(&a_ata), env.bal(&b_ata)), (1_000 * SKR, 1_000 * SKR));
    assert_eq!(env.pool_state().treasury_accrued, 0);
}

/// SM-2 (statemachine): an incident pause that runs past the deadline used to forfeit the honest
/// user whose attestation was pending. Now the pause extends the attest window, so after unpausing
/// the attestor still lands the attestation and nobody loses principal.
#[test]
fn sm2_pause_across_deadline_extends_the_attest_window() {
    let mut env = env_with_delay(0);
    let d = env.today();
    let (h, h_ata) = env.user(100);
    let (w, w_ata) = env.user(100);
    env.send(&[env.ix_commit(&h.pubkey(), &h_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &h).unwrap();
    env.send(&[env.ix_commit(&w.pubkey(), &w_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &w).unwrap();
    let att = env.attestor.pubkey();
    env.warp(env.day_start(d) + 60);
    env.send_attestor(&[env.ix_attest(&att, &w.pubkey(), d, 10, env.day_start(d) + 30)]).unwrap();
    env.warp(env.day_end(d) - 10);
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(true))]).unwrap();
    expect_err(env.send_attestor(&[env.ix_attest(&att, &h.pubkey(), d, 10, env.day_end(d) - 100)]), 6000);
    let dl = deadline(&env, d);
    env.warp(dl + 1);
    expect_err(env.send(&[env.ix_finalize(&w.pubkey(), d)], &w), 6000);
    // pause lifted 1 h later; the window is extended by the 1 h + 71 s spent paused
    env.warp(dl + 3_600);
    env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(false))]).unwrap();
    expect_err(env.send(&[env.ix_finalize(&w.pubkey(), d)], &w), 6009);
    env.send_attestor(&[env.ix_attest(&att, &h.pubkey(), d, 10, env.day_end(d) - 100)]).unwrap();
    let paused_for = env.pool_state().total_paused_secs;
    assert_eq!(paused_for, 3_600 + 70);
    env.warp(dl + paused_for + 1);
    env.send(&[env.ix_finalize(&w.pubkey(), d)], &w).unwrap();
    env.send(&[env.ix_claim(&h.pubkey(), &h_ata, d)], &h).unwrap();
    env.send(&[env.ix_claim(&w.pubkey(), &w_ata, d)], &w).unwrap();
    assert_eq!((env.bal(&h_ata), env.bal(&w_ata)), (100 * SKR, 100 * SKR));
    assert_eq!(env.pool_state().treasury_accrued, 0);
}

/// SM-1 (statemachine): the attestor key alone used to revoke honest completers in the last
/// second (even while paused) and finalize at deadline + 1, routing their principal to a sybil.
/// Now: revocation is refund-only, the attestor cannot revoke while paused, and finalize waits for
/// the review window (finalize_delay_secs) during which the authority can void.
#[test]
fn sm1_attestor_revoke_cannot_steal_honest_principal() {
    const DELAY: i64 = 120;
    for scenario in ["paused_then_void", "unpaused_no_void"] {
        let mut env = env_with_delay(DELAY);
        let d = env.today();
        let (h1, h1_ata) = env.user(100);
        let (h2, h2_ata) = env.user(100);
        let (s, s_ata) = env.user(100);
        for (u, a) in [(&h1, &h1_ata), (&h2, &h2_ata), (&s, &s_ata)] {
            env.send(&[env.ix_commit(&u.pubkey(), a, d, 100 * SKR, Exercise::Pushup, 10, None)], u).unwrap();
        }
        let att = env.attestor.pubkey();
        env.warp(env.day_start(d) + 100);
        env.send_attestor(&[env.ix_attest(&att, &h1.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
        env.send_attestor(&[env.ix_attest(&att, &h2.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
        env.send_attestor(&[env.ix_attest(&att, &s.pubkey(), d, 10, env.day_start(d) + 60)]).unwrap();
        let dl = deadline(&env, d);
        if scenario == "paused_then_void" {
            env.send_admin(&[env.ix_update(&env.admin.pubkey(), pause(true))]).unwrap();
            env.warp(dl);
            expect_err(env.send_attestor(&[env.ix_revoke(&att, &h1.pubkey(), d)]), 6000);
            env.warp(dl + DELAY + 1);
            expect_err(env.send(&[env.ix_finalize(&s.pubkey(), d)], &s), 6000);
            // the authority revokes the sybil's fake completion (allowed while paused), then voids
            env.send_admin(&[env.ix_revoke(&env.admin.pubkey(), &s.pubkey(), d)]).unwrap();
            env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]).unwrap();
        } else {
            env.warp(dl); // last second of the attest window
            env.send_attestor(&[env.ix_revoke(&att, &h1.pubkey(), d)]).unwrap();
            env.send_attestor(&[env.ix_revoke(&att, &h2.pubkey(), d)]).unwrap();
            // deadline + 1: still inside the review window, finalize is not possible yet
            env.warp(dl + 1);
            expect_err(env.send(&[env.ix_finalize(&s.pubkey(), d)], &s), 6009);
            expect_err(env.send_attestor(&[env.ix_revoke(&att, &s.pubkey(), d)]), 6008); // window closed
            env.warp(dl + DELAY);
            expect_err(env.send(&[env.ix_finalize(&s.pubkey(), d)], &s), 6009);
            env.warp(dl + DELAY + 1);
            env.send(&[env.ix_finalize(&s.pubkey(), d)], &s).unwrap();
        }
        for (u, a) in [(&h1, &h1_ata), (&h2, &h2_ata), (&s, &s_ata)] {
            env.send(&[env.ix_claim(&u.pubkey(), a, d)], u).unwrap();
        }
        // no forfeits: everyone, sybil included, gets exactly its 100 SKR back
        assert_eq!((env.bal(&h1_ata), env.bal(&h2_ata), env.bal(&s_ata)), (100 * SKR, 100 * SKR, 100 * SKR), "{scenario}");
        assert_eq!(env.pool_state().treasury_accrued, 0, "{scenario}");
    }
}

/// The review window also lets the authority void a day whose attestations look wrong only after
/// the deadline (e.g. the attestor withheld honest users and attested a sybil).
#[test]
fn review_window_allows_void_after_deadline() {
    let mut env = env_with_delay(300);
    let d = env.today();
    let (h, h_ata) = env.user(100);
    let (s, s_ata) = env.user(100);
    env.send(&[env.ix_commit(&h.pubkey(), &h_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &h).unwrap();
    env.send(&[env.ix_commit(&s.pubkey(), &s_ata, d, 100 * SKR, Exercise::Pushup, 10, None)], &s).unwrap();
    env.warp(env.day_start(d) + 100);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &s.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
    env.warp(deadline(&env, d) + 200);
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &h.pubkey(), d, 10, env.day_start(d) + 50)]), 6008);
    expect_err(env.send(&[env.ix_finalize(&s.pubkey(), d)], &s), 6009);
    env.send_admin(&[env.ix_void(&env.admin.pubkey(), d)]).unwrap();
    env.send(&[env.ix_claim(&h.pubkey(), &h_ata, d)], &h).unwrap();
    env.send(&[env.ix_claim(&s.pubkey(), &s_ata, d)], &s).unwrap();
    assert_eq!((env.bal(&h_ata), env.bal(&s_ata)), (100 * SKR, 100 * SKR));
}

/// Attestor rotation applies to days created afterwards only; live days keep their attestor.
#[test]
fn attestor_rotation_is_snapshotted_per_day() {
    let mut env = env_with_delay(0);
    let d = env.today();
    let (a, a_ata) = env.user(100);
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    let new_att = Keypair::new();
    env.svm.airdrop(&new_att.pubkey(), 1_000_000_000).unwrap();
    let admin = env.admin.pubkey();
    env.send_admin(&[env.ix_update(&admin, UpdateConfigParams { attestor: Some(new_att.pubkey()), ..Default::default() })])
        .unwrap();
    // d + 1 is created after the rotation
    env.send(&[env.ix_commit(&a.pubkey(), &a_ata, d + 1, 10 * SKR, Exercise::Pushup, 10, None)], &a).unwrap();
    assert_eq!(env.day_state(d).unwrap().attestor, env.attestor.pubkey());
    assert_eq!(env.day_state(d + 1).unwrap().attestor, new_att.pubkey());
    env.warp(env.day_start(d) + 100);
    let started = env.day_start(d) + 50;
    expect_err({ let ix = env.ix_attest(&new_att.pubkey(), &a.pubkey(), d, 10, started); send(&mut env.svm, &[ix], &new_att, &[]) }, 6002);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d, 10, started)]).unwrap();
    env.warp(env.day_start(d + 1) + 100);
    let started = env.day_start(d + 1) + 50;
    expect_err(env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &a.pubkey(), d + 1, 10, started)]), 6002);
    { let ix = env.ix_attest(&new_att.pubkey(), &a.pubkey(), d + 1, 10, started); send(&mut env.svm, &[ix], &new_att, &[]) }.unwrap();
    // revoke: the old attestor can no longer touch d + 1; the new one cannot touch d
    expect_err(env.send_attestor(&[env.ix_revoke(&env.attestor.pubkey(), &a.pubkey(), d + 1)]), 6001);
    // the attestor can never become the authority either
    env.send_admin(&[env.ix_propose(&admin, new_att.pubkey())]).unwrap();
    expect_err({ let ix = env.ix_accept(&new_att.pubkey()); send(&mut env.svm, &[ix], &new_att, &[]) }, 6004);
}

/// F3 (economics-goals): a streak built with 1 SKR/day used to give a 10,000 SKR stake 1.5x
/// weight (5,700 vs 3,800 SKR bonus). Now the boost covers only the stake completed the day before.
#[test]
fn f3_min_stake_streak_does_not_boost_max_stake() {
    let mut env = env_with_delay(0);
    let (w, w_ata) = env.user(20_000);
    for _ in 0..10 {
        let d = env.today();
        env.send(&[env.ix_commit(&w.pubkey(), &w_ata, d, SKR, Exercise::Pushup, 10, None)], &w).unwrap();
        env.warp(env.day_start(d) + 100);
        env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &w.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
        env.warp(env.day_start(d + 1) + 10);
    }
    let d = env.today();
    let (h, h_ata) = env.user(10_000);
    let (m, m_ata) = env.user(10_000);
    for (u, ata) in [(&w, w_ata), (&h, h_ata), (&m, m_ata)] {
        env.send(&[env.ix_commit(&u.pubkey(), &ata, d, 10_000 * SKR, Exercise::Pushup, 10, None)], u).unwrap();
    }
    env.warp(env.day_start(d) + 100);
    for u in [&w, &h] {
        env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
    }
    assert_eq!(env.profile(&w.pubkey()).unwrap().current_streak, 11);
    // boost (+50 %) only on the 1 SKR completed yesterday
    assert_eq!(env.commitment(&w.pubkey(), d).unwrap().weight, 10_000 * SKR + SKR / 2);
    env.warp(deadline(&env, d) + 1);
    env.send(&[env.ix_finalize(&m.pubkey(), d)], &m).unwrap();
    let wb = env.bal(&w_ata);
    let hb = env.bal(&h_ata);
    env.send(&[env.ix_claim(&w.pubkey(), &w_ata, d)], &w).unwrap();
    env.send(&[env.ix_claim(&h.pubkey(), &h_ata, d)], &h).unwrap();
    let w_bonus = env.bal(&w_ata) - wb - 10_000 * SKR;
    let h_bonus = env.bal(&h_ata) - hb - 10_000 * SKR;
    // 9,500 x 10,000.5 / 20,000.5 and 9,500 x 10,000 / 20,000.5 (floors)
    assert_eq!((w_bonus, h_bonus), (4_750_118_747, 4_749_881_252));
    assert!(w_bonus - h_bonus < SKR / 4);
}

/// F4 (economics-goals): attesting d3 before d2 used to collapse a 4-day streak to 1.
/// Now the streak is tracked per day, so order does not matter.
#[test]
fn f4_out_of_order_attestation_keeps_the_streak() {
    let mut env = env_with_delay(0);
    let (u, ata) = env.user(1_000);
    let d0 = env.today();
    for d in [d0, d0 + 1] {
        env.warp(env.day_start(d) + 10);
        env.send(&[env.ix_commit(&u.pubkey(), &ata, d, 10 * SKR, Exercise::Pushup, 10, None)], &u).unwrap();
        env.warp(env.day_start(d) + 100);
        env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d, 10, env.day_start(d) + 50)]).unwrap();
    }
    let (d2, d3, d4) = (d0 + 2, d0 + 3, d0 + 4);
    env.warp(env.day_start(d2) + 10);
    env.send(&[env.ix_commit(&u.pubkey(), &ata, d2, 10 * SKR, Exercise::Pushup, 10, None)], &u).unwrap();
    env.send(&[env.ix_commit(&u.pubkey(), &ata, d3, 10 * SKR, Exercise::Pushup, 10, None)], &u).unwrap();
    env.warp(env.day_start(d3) + 30);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d3, 10, env.day_start(d3) + 5)]).unwrap();
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d2, 10, env.day_start(d3) - 20)]).unwrap();
    let p = env.profile(&u.pubkey()).unwrap();
    assert_eq!((p.current_streak, p.best_streak, p.last_completed_day), (4, 4, d3));
    // the next day continues the full streak: streak 5 -> +20 % on yesterday's 10 SKR
    env.send(&[env.ix_commit(&u.pubkey(), &ata, d4, 10 * SKR, Exercise::Pushup, 10, None)], &u).unwrap();
    env.warp(env.day_start(d4) + 100);
    env.send_attestor(&[env.ix_attest(&env.attestor.pubkey(), &u.pubkey(), d4, 10, env.day_start(d4) + 50)]).unwrap();
    assert_eq!(env.commitment(&u.pubkey(), d4).unwrap().weight, 12 * SKR);
    assert_eq!(env.profile(&u.pubkey()).unwrap().current_streak, 5);
}

/// SM-3 (statemachine, accepted, documented in SPEC §8): a completer who never claims keeps the
/// DayState open, but the claim never expires and sweep works as soon as it lands.
#[test]
fn sm3_late_claim_still_pays_and_unblocks_sweep() {
    let mut env = env_with_delay(0);
    let d = env.today();
    let (a, a_ata) = env.user(100);
    let (b, b_ata) = env.user(100);
    let (c, c_ata) = env.user(100);
    for (u, t) in [(&a, &a_ata), (&b, &b_ata), (&c, &c_ata)] {
        env.send(&[env.ix_commit(&u.pubkey(), t, d, 10 * SKR, Exercise::Pushup, 10, None)], u).unwrap();
    }
    let att = env.attestor.pubkey();
    env.warp(env.day_start(d) + 60);
    env.send_attestor(&[env.ix_attest(&att, &a.pubkey(), d, 10, env.day_start(d) + 30)]).unwrap();
    env.send_attestor(&[env.ix_attest(&att, &b.pubkey(), d, 10, env.day_start(d) + 30)]).unwrap();
    env.warp(deadline(&env, d) + 1);
    env.send(&[env.ix_finalize(&a.pubkey(), d)], &a).unwrap();
    env.send(&[env.ix_claim(&a.pubkey(), &a_ata, d)], &a).unwrap();
    env.send(&[env.ix_close_missed(&a.pubkey(), &c.pubkey(), d)], &a).unwrap();
    expect_err(env.send(&[env.ix_sweep(&a.pubkey(), &a.pubkey(), d)], &a), 6018);
    env.warp(deadline(&env, d) + 365 * 86_400);
    env.send(&[env.ix_claim(&b.pubkey(), &b_ata, d)], &b).unwrap();
    assert_eq!(env.bal(&b_ata), 90 * SKR + 10 * SKR + 4_750_000);
    env.send(&[env.ix_sweep(&a.pubkey(), &a.pubkey(), d)], &a).unwrap();
    assert!(!exists(&env.svm, &env.day_pda(d)));
}
