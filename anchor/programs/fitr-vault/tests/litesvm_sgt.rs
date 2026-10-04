//! SGT gating against a REAL mainnet Seeker Genesis Token mint (fixture cloned via getAccountInfo).
//! Token account owner is rewritten to a test wallet (test-only, like `solana-test-validator --clone` + edit).
mod common;
use anchor_lang::{
    prelude::Pubkey,
    solana_program::{program_pack::Pack, system_instruction},
};
use anchor_spl::{associated_token, token::spl_token, token_2022};
use common::*;
use fitr_vault::{Exercise, InitPoolParams};
use solana_keypair::Keypair;
use solana_signer::Signer;
use std::str::FromStr;

const DAY: u32 = 20_721;
const SGT_MINT: &str = "3SSQo28JgsmT3EHhSSBHTNGCRvEApRHRT27eCdzjxk9q";

fn fixture(name: &str) -> Vec<u8> {
    std::fs::read(format!("{}/tests/fixtures/{name}.bin", env!("CARGO_MANIFEST_DIR"))).unwrap()
}
fn raw_account(data: Vec<u8>, owner: Pubkey) -> solana_account::Account {
    solana_account::Account { lamports: 10_000_000, data, owner, executable: false, rent_epoch: 0 }
}
/// Put an SGT token account (frozen, as on mainnet) holding `amount` owned by `owner` at `addr`.
fn plant_sgt_account(env: &mut Env, addr: Pubkey, owner: Pubkey, amount: u64) {
    let mut data = fixture("8spLgJeVtV8PM4AwGT2hMbpk7zpk6rDqVrFRY1TRXsYj");
    data[32..64].copy_from_slice(owner.as_ref()); // Account.owner
    data[64..72].copy_from_slice(&amount.to_le_bytes()); // Account.amount
    env.svm.set_account(addr, raw_account(data, token_2022::ID)).unwrap();
}
fn sgt_env() -> (Env, Pubkey) {
    let p = InitPoolParams { require_sgt: true, commit_cutoff_secs: 64_800, ..params(Default::default(), 86_400) };
    let mut env = Env::new(p);
    env.warp(DAY as i64 * 86_400 + 3_600);
    let sgt_mint = Pubkey::from_str(SGT_MINT).unwrap();
    env.svm.set_account(sgt_mint, raw_account(fixture(SGT_MINT), token_2022::ID)).unwrap();
    (env, sgt_mint)
}

#[test]
fn sgt_gate() {
    let (mut env, sgt_mint) = sgt_env();
    let (alice, a_ata) = env.user(1_000);
    let (bob, b_ata) = env.user(1_000);
    let alice_sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, alice_sgt, alice.pubkey(), 1);
    let device = env.device_pda(&sgt_mint);

    // bob cannot register alice's SGT (token::authority mismatch -> Anchor ConstraintTokenOwner)
    expect_err(env.send(&[env.ix_register(&bob.pubkey(), &sgt_mint, &alice_sgt)], &bob), 2015);
    // alice registers the real SGT; user is the only signer and fee payer
    let r = env.send(&[env.ix_register(&alice.pubkey(), &sgt_mint, &alice_sgt)], &alice).unwrap();
    println!("CU register_device {:>6}", r.cu);
    let dl = env.device(&sgt_mint).unwrap();
    assert_eq!((dl.version, dl.commit_count, dl.last_wallet), (1, 0, alice.pubkey()));
    // registering twice fails (DeviceLock PDA already exists)
    assert!(env.send(&[env.ix_register(&alice.pubkey(), &sgt_mint, &alice_sgt)], &alice).is_err());

    // a counterfeit Token-2022 mint (no SGT group membership) is rejected
    let fake = Keypair::new();
    let space = spl_token::state::Mint::LEN as u64;
    let r = env.svm.minimum_balance_for_rent_exemption(space as usize);
    send(
        &mut env.svm,
        &[
            system_instruction::create_account(&bob.pubkey(), &fake.pubkey(), r, space, &token_2022::ID),
            token_2022::spl_token_2022::instruction::initialize_mint2(&token_2022::ID, &fake.pubkey(), &bob.pubkey(), None, 0)
                .unwrap(),
        ],
        &bob,
        &[&fake],
    )
    .unwrap();
    let fake_ata =
        associated_token::get_associated_token_address_with_program_id(&bob.pubkey(), &fake.pubkey(), &token_2022::ID);
    send(
        &mut env.svm,
        &[
            associated_token::spl_associated_token_account::instruction::create_associated_token_account(
                &bob.pubkey(),
                &bob.pubkey(),
                &fake.pubkey(),
                &token_2022::ID,
            ),
            token_2022::spl_token_2022::instruction::mint_to(&token_2022::ID, &fake.pubkey(), &fake_ata, &bob.pubkey(), &[], 1)
                .unwrap(),
        ],
        &bob,
        &[],
    )
    .unwrap();
    expect_err(env.send(&[env.ix_register(&bob.pubkey(), &fake.pubkey(), &fake_ata)], &bob), 6016);

    // without SGT accounts -> SgtRequired
    let c = env.ix_commit(&alice.pubkey(), &a_ata, DAY, 100 * SKR, Exercise::Pushup, 10, None);
    expect_err(env.send(&[c], &alice), 6015);
    let c = env.ix_commit(&alice.pubkey(), &a_ata, DAY, 100 * SKR, Exercise::Pushup, 10, Some((alice_sgt, device)));
    let r = env.send(&[c], &alice).unwrap();
    println!("CU commit (SGT path, creates DayState+Commitment+Profile) {:>6}", r.cu);
    assert_eq!(env.commitment(&alice.pubkey(), DAY).unwrap().device, sgt_mint);

    // SGT moves to bob's wallet (permissioned Seed Vault transfer); same device, same day -> blocked
    let bob_sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, bob_sgt, bob.pubkey(), 1);
    plant_sgt_account(&mut env, alice_sgt, alice.pubkey(), 0);
    let c = env.ix_commit(&bob.pubkey(), &b_ata, DAY, 100 * SKR, Exercise::Pushup, 10, Some((bob_sgt, device)));
    expect_err(env.send(&[c], &bob), 6017); // DeviceAlreadyCommitted
    // bob cannot use alice's (now empty) SGT token account, nor claim it as his
    let c = env.ix_commit(&bob.pubkey(), &b_ata, DAY + 1, 100 * SKR, Exercise::Pushup, 10, Some((alice_sgt, device)));
    expect_err(env.send(&[c], &bob), 6016);
    // alice's old, now-empty account no longer qualifies for tomorrow either
    let c = env.ix_commit(&alice.pubkey(), &a_ata, DAY + 1, 100 * SKR, Exercise::Pushup, 10, Some((alice_sgt, device)));
    expect_err(env.send(&[c], &alice), 6016);
    // bob (new holder) can pre-commit tomorrow with the device
    let c = env.ix_commit(&bob.pubkey(), &b_ata, DAY + 1, 100 * SKR, Exercise::Pushup, 10, Some((bob_sgt, device)));
    env.send(&[c], &bob).unwrap();
    let dl = env.device(&sgt_mint).unwrap();
    assert_eq!((dl.commit_count, dl.recent_days, dl.last_wallet), (2, [DAY + 1, DAY], bob.pubkey()));
    // a device lock of another pool cannot be substituted: use a program-owned non-DeviceLock account
    let c = env.ix_commit(&bob.pubkey(), &b_ata, DAY, 100 * SKR, Exercise::Pushup, 10, Some((bob_sgt, env.pool)));
    expect_err(env.send(&[c], &bob), 3002); // AccountDiscriminatorMismatch
}

/// Pre-committing tomorrow and then committing today with the same device must work
/// (the prototype's single last_commit_day rejected it), while a second commit for either day fails.
#[test]
fn device_lock_order_independent() {
    let (mut env, sgt_mint) = sgt_env();
    let (alice, a_ata) = env.user(1_000);
    let sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, sgt, alice.pubkey(), 1);
    env.send(&[env.ix_register(&alice.pubkey(), &sgt_mint, &sgt)], &alice).unwrap();
    let dev = Some((sgt, env.device_pda(&sgt_mint)));
    let commit = |env: &Env, d: u32| env.ix_commit(&alice.pubkey(), &a_ata, d, 10 * SKR, Exercise::Squat, 15, dev);
    env.send(&[commit(&env, DAY + 1)], &alice).unwrap();
    env.send(&[commit(&env, DAY)], &alice).unwrap();
    // same wallet: the Commitment PDA already exists (system program "already in use")
    assert!(env.send(&[commit(&env, DAY)], &alice).is_err());
    // another wallet holding the same device: DeviceAlreadyCommitted for both days
    let (bob, b_ata) = env.user(100);
    let bob_sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, bob_sgt, bob.pubkey(), 1);
    plant_sgt_account(&mut env, sgt, alice.pubkey(), 0);
    for d in [DAY, DAY + 1] {
        let c = env.ix_commit(&bob.pubkey(), &b_ata, d, 10 * SKR, Exercise::Squat, 15, Some((bob_sgt, env.device_pda(&sgt_mint))));
        expect_err(env.send(&[c], &bob), 6017);
    }
    assert_eq!(env.device(&sgt_mint).unwrap().recent_days, [DAY + 1, DAY]);
}

/// The daily MWA transaction on the mainnet configuration (require_sgt = true):
/// `[claim(d-1), commit(d)]`, the user's wallet is the ONLY signer and the fee payer.
#[test]
fn mwa_claim_and_commit_one_tx_with_sgt() {
    let (mut env, sgt_mint) = sgt_env();
    let (alice, a_ata) = env.user(1_000);
    let sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, sgt, alice.pubkey(), 1);
    env.send(&[env.ix_register(&alice.pubkey(), &sgt_mint, &sgt)], &alice).unwrap();
    let dev = Some((sgt, env.device_pda(&sgt_mint)));
    let c = env.ix_commit(&alice.pubkey(), &a_ata, DAY, 123 * SKR + 456, Exercise::Pushup, 25, dev);
    env.send(&[c], &alice).unwrap();
    let att = env.attestor.pubkey();
    env.warp(DAY as i64 * 86_400 + 5_000);
    env.send_attestor(&[env.ix_attest(&att, &alice.pubkey(), DAY, 30, DAY as i64 * 86_400 + 4_000)]).unwrap();
    env.warp((DAY as i64 + 1) * 86_400 + 7_200 + 1); // next day, after day DAY's deadline
    env.send_admin(&[env.ix_finalize(&env.admin.pubkey(), DAY)]).unwrap();

    let before = env.bal(&a_ata);
    let ixs = [
        env.ix_claim(&alice.pubkey(), &a_ata, DAY),
        env.ix_commit(&alice.pubkey(), &a_ata, DAY + 1, 77 * SKR, Exercise::Plank, 45, dev),
    ];
    let r = send(&mut env.svm, &ixs, &alice, &[]).unwrap();
    println!(
        "CU [claim(d-1), commit(d)] SGT path: total {} (claim {}, commit {}), tx size {} bytes, 1 signer",
        r.cu, r.ix_cu[0], r.ix_cu[1], r.size
    );
    assert!(r.size <= 1_232);
    // sole completer, nobody forfeited: principal back, then 77 SKR re-staked
    assert_eq!(env.bal(&a_ata), before + 123 * SKR + 456 - 77 * SKR);
    assert!(env.commitment(&alice.pubkey(), DAY).is_none());
    let c = env.commitment(&alice.pubkey(), DAY + 1).unwrap();
    assert_eq!((c.amount, c.exercise, c.goal_target), (77 * SKR, Exercise::Plank, 45));
}

/// A DeviceLock registered in another pool (other stake mint) cannot be used in this pool.
#[test]
fn device_lock_bound_to_pool() {
    let (mut env, sgt_mint) = sgt_env();
    let (alice, a_ata) = env.user(1_000);
    let sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, sgt, alice.pubkey(), 1);
    // second pool on another mint (same upgrade authority), device registered there only
    let (m1, p1, v1) = (env.mint, env.pool, env.vault);
    let admin = env.admin.insecure_clone();
    env.mint = create_mint(&mut env.svm, &admin, 6);
    env.pool = pool_pda(&env.mint, 0);
    env.vault = pda(&[fitr_vault::VAULT_SEED, env.pool.as_ref()]);
    let p = InitPoolParams { require_sgt: true, attestor: env.attestor.pubkey(), ..params(Default::default(), 86_400) };
    env.send_admin(&[env.ix_init(&admin.pubkey(), p)]).unwrap();
    env.send(&[env.ix_register(&alice.pubkey(), &sgt_mint, &sgt)], &alice).unwrap();
    let foreign_lock = env.device_pda(&sgt_mint);
    (env.mint, env.pool, env.vault) = (m1, p1, v1);
    let c = env.ix_commit(&alice.pubkey(), &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, Some((sgt, foreign_lock)));
    expect_err(env.send(&[c], &alice), 6016); // InvalidSgt: device.pool != pool
}

/// Crews copy require_sgt; the DeviceLock is per pool, so one Seeker commits at most once per day
/// in each pool (the global pool and every crew), and a lock from another pool is never accepted.
#[test]
fn crew_pools_have_their_own_device_lock() {
    let (mut env, sgt_mint) = sgt_env();
    let (alice, a_ata) = env.user(1_000);
    let (mallory, m_ata) = env.user(1_000);
    let alice_sgt = Keypair::new().pubkey();
    plant_sgt_account(&mut env, alice_sgt, alice.pubkey(), 1);
    let mallory_sgt = Keypair::new().pubkey(); // the same device, handed to a second wallet
    plant_sgt_account(&mut env, mallory_sgt, mallory.pubkey(), 1);
    let ap = alice.pubkey();
    env.send(&[env.ix_register(&ap, &sgt_mint, &alice_sgt)], &alice).unwrap();
    let global_lock = env.device_pda(&sgt_mint);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, Some((alice_sgt, global_lock)))], &alice)
        .unwrap();

    let ix = env.ix_create_crew(&ap, 42, crew_name("seekers"), None, None);
    env.send(&[ix], &alice).unwrap();
    env.use_crew(42);
    assert!(env.pool_state().require_sgt);
    // no SGT accounts -> SgtRequired; the global pool's lock -> InvalidSgt (device.pool != pool)
    expect_err(env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, None)], &alice), 6015);
    expect_err(
        env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, Some((alice_sgt, global_lock)))], &alice),
        6016,
    );
    env.send(&[env.ix_register(&ap, &sgt_mint, &alice_sgt)], &alice).unwrap();
    let crew_lock = env.device_pda(&sgt_mint);
    assert_ne!(crew_lock, global_lock);
    env.send(&[env.ix_commit(&ap, &a_ata, DAY, 10 * SKR, Exercise::Pushup, 10, Some((alice_sgt, crew_lock)))], &alice)
        .unwrap();
    // the same Seeker cannot commit a second time in this crew today, even from another wallet
    let mp = mallory.pubkey();
    expect_err(env.send(&[env.ix_commit(&mp, &m_ata, DAY, 10 * SKR, Exercise::Pushup, 10, Some((mallory_sgt, crew_lock)))], &mallory), 6017);
    assert_eq!(env.device(&sgt_mint).unwrap().commit_count, 1);
}
