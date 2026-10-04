//! Seeded, model-based randomized invariant test (property/fuzz style, fully deterministic).
//!
//! MULTI-POOL: every scenario runs the global pool (crew 0) plus crews created along the way with
//! create_crew (random ids incl. duplicates, random fixed exercise/goal, some invalid), each with its
//! own independent model. Every step acts on one pool; the same wallets stake in several pools.
//! Cross-pool attacks (another pool's vault / pool account) are injected and must fail. After every
//! transaction ALL pools are checked, so an action in one pool can never change another pool.
//!
//! Each scenario draws a random pool config (day length 300..86_400 s, offset, cutoff, grace,
//! fee, streak, stake and goal bounds, sponsor), N users and a random sequence of
//! commit / attest / revoke / finalize / void / claim / close_missed / sweep / fund_reserve /
//! withdraw_treasury / update_config / [claim, commit] batches, interleaved with clock warps.
//! Many actions are deliberately invalid (wrong day, out-of-bounds stake/goal, bad session time,
//! wrong signer, too early, double claim, ...).
//!
//! An independent Rust model predicts whether each transaction must succeed; a mismatch fails the
//! test. After EVERY transaction the on-chain state is compared field-by-field with the model and
//! the SPEC.md invariants are asserted:
//!   I1  vault.amount == outstanding + reserve + rollover + treasury_accrued (no direct donations)
//!   I1b outstanding == sum over live DayStates of their remaining liability
//!   I2  each commitment pays out at most once
//!   I3  paid out for day d (principal + bonus) <= total_staked_d + sponsor_d + rollover_d
//!   I4  authority receives tokens only via withdraw_treasury, never more than fees accrued;
//!       the attestor never receives tokens
//!   I5  completed_count/stake/weight, fee, sponsor, distributable immutable after finalize
//!   I6  bonus_paid <= distributable; completed/resolved <= committed; completed_stake <= total
//!   I7  token conservation: users + all vaults + authority + funder == minted, at every step
//!   I8  exact payouts: every balance equals the model's floor-division result to the base unit
//! At the end every day is driven to settlement (a random subset of commitments stays unclaimed)
//! and the vault must hold exactly reserve + treasury + the model's unclaimed liabilities.
//!
//! Scale with FITR_FUZZ_SCENARIOS (per test fn, default 64 -> 256 scenarios total) and
//! FITR_FUZZ_SEED (base seed).
mod common;
use anchor_lang::{prelude::Pubkey, solana_program::instruction::Instruction};
use common::*;
use fitr_vault::{CommitmentStatus, Exercise, GoalLimits, InitPoolParams, UpdateConfigParams};
use solana_keypair::Keypair;
use solana_signer::Signer;
use std::collections::{BTreeMap, BTreeSet};

const STAKE_CEILING: u64 = 1_000_000 * SKR;
/// All 16 exercises, in on-chain code order (independent of Exercise::ALL).
const EXERCISES: [Exercise; 16] = [
    Exercise::Pushup,
    Exercise::Squat,
    Exercise::Plank,
    Exercise::Lunge,
    Exercise::Situp,
    Exercise::LegRaise,
    Exercise::GluteBridge,
    Exercise::WallSit,
    Exercise::PikePushup,
    Exercise::JumpSquat,
    Exercise::Pullup,
    Exercise::Dip,
    Exercise::Burpee,
    Exercise::MountainClimber,
    Exercise::JumpingJack,
    Exercise::HighKnees,
];
/// Independent copy of the hard goal ceilings: 3,600 s for Plank/WallSit, 3,000 reps for
/// MountainClimber/JumpingJack/HighKnees, 1,000 reps otherwise.
const GOAL_CEIL: [u32; 16] = [
    1_000, 1_000, 3_600, 1_000, 1_000, 1_000, 1_000, 3_600, 1_000, 1_000, 1_000, 1_000, 1_000, 3_000, 3_000, 3_000,
];

// ------------------------------------------------------------------ model

#[derive(Clone, Debug, PartialEq)]
struct Cfg {
    len: i64,
    off: i64,
    cutoff: i64,
    grace: i64,
    min_stake: u64,
    max_stake: u64,
    fee_bps: u16,
    streak_bps: u16,
    max_streak_bps: u16,
    goals: [GoalLimits; 16],
    sponsor: u64,
    paused: bool,
    /// finalize_delay_secs
    delay: i64,
}

impl Cfg {
    /// Independent re-implementation of Pool::validate.
    fn valid(&self) -> bool {
        let len = self.len;
        (300..=86_400).contains(&len)
            && (0..len).contains(&self.off)
            && self.cutoff >= 0
            && self.cutoff <= len - len / 24
            && self.grace >= 0
            && self.grace <= len.min(21_600)
            && self.fee_bps <= 2_000
            && self.max_streak_bps <= 10_000
            && self.streak_bps <= self.max_streak_bps
            && self.min_stake > 0
            && self.min_stake <= self.max_stake
            && self.max_stake <= STAKE_CEILING
            && (0..16).all(|i| {
                let g = self.goals[i];
                g.min >= 1 && g.min <= g.max && g.max <= GOAL_CEIL[i]
            })
            && self.delay >= 0
            && self.delay <= len.min(43_200)
            && self.sponsor <= self.max_stake
    }
    fn start(&self, d: u32) -> i64 {
        d as i64 * self.len + self.off
    }
    fn end(&self, d: u32) -> i64 {
        self.start(d + 1)
    }
    fn today(&self, now: i64) -> u32 {
        ((now - self.off) / self.len) as u32
    }
}

type Frozen = (u32, u64, u64, u64, u64, u64);

#[derive(Clone, Debug, Default)]
struct MDay {
    live: bool,
    finalized: bool,
    voided: bool,
    fee_bps: u16,
    streak_bps: u16,
    max_streak_bps: u16,
    deadline: i64,
    sponsor_cap: u64,
    delay: i64,
    paused_base: i64,
    /// Crew days: the global pool's total paused seconds at creation.
    g_paused_base: i64,
    /// Crew rollover released into this day at finalize (part of distributable).
    rollover: u64,
    committed: u32,
    completed: u32,
    revoked: u32,
    resolved: u32,
    total_staked: u64,
    completed_stake: u64,
    revoked_stake: u64,
    completed_weight: u64,
    fee: u64,
    sponsor: u64,
    distributable: u64,
    principal_paid: u64,
    bonus_paid: u64,
    rent_payer: usize,
    /// (completed_count, completed_stake, completed_weight, fee, sponsor, distributable) at finalize.
    frozen: Option<Frozen>,
}

impl MDay {
    fn liability(&self) -> u64 {
        let gross = if self.voided {
            self.total_staked
        } else if self.finalized {
            self.completed_stake + self.revoked_stake + self.distributable
        } else {
            self.total_staked
        };
        gross - self.principal_paid - self.bonus_paid
    }
}

#[derive(Clone, Debug)]
struct MCommit {
    amount: u64,
    ex: Exercise,
    goal: u32,
    completed: bool,
    /// Revoked after completion: refund-only, never forfeited.
    revoked: bool,
    weight: u64,
    committed_at: i64,
    live: bool,
    payouts: u32,
}

#[derive(Clone, Debug, Default, PartialEq)]
struct MProfile {
    exists: bool,
    cur: u16,
    best: u16,
    has: bool,
    last: u32,
    tc: u32,
    tcomp: u32,
    tmiss: u32,
    bonus: u64,
    /// Completed (attested, not revoked) days, as the on-chain 64-day mask + carry records them.
    done: BTreeSet<u32>,
    last_amount: u64,
}

impl MProfile {
    /// Consecutive completed days ending at `x` (independent of the on-chain bitmap).
    fn streak_at(&self, x: u32) -> u16 {
        let mut n = 0u16;
        let mut d = x as i64;
        while d >= 0 && self.done.contains(&(d as u32)) {
            n += 1;
            d -= 1;
        }
        n
    }
}

/// Wallet balances shared by every pool of the scenario.
#[derive(Clone, Debug)]
struct Bank {
    user_bal: Vec<u64>,
    admin_bal: u64,
    funder_bal: u64,
    withdrawn: u64,
    minted: u64,
}

#[derive(Clone, Debug)]
struct Model {
    crew_id: u64,
    /// Crew rule: fixed exercise and (0 = free) fixed goal.
    fixed: Option<(Exercise, u32)>,
    cfg: Cfg,
    paused_since: i64,
    total_paused: i64,
    /// Live copy of the GLOBAL pool's pause state (crews read it on-chain; audit CREW-1).
    g_paused: bool,
    g_paused_since: i64,
    g_total_paused: i64,
    reserve: u64,
    /// Crews: net forfeits of zero-completer days waiting for the next day with a completer.
    rollover: u64,
    treasury: u64,
    outstanding: u64,
    days: BTreeMap<u32, MDay>,
    commits: BTreeMap<(usize, u32), MCommit>,
    profiles: Vec<MProfile>,
    vault: u64,
    fees_total: u64,
}

fn floor_share(dist: u64, w: u64, total: u64) -> u64 {
    if total == 0 {
        0
    } else {
        (dist as u128 * w as u128 / total as u128) as u64
    }
}

fn weight(amount: u64, basis: u64, streak: u16, bps: u16, max_bps: u16) -> u64 {
    let boost = ((streak.saturating_sub(1) as u64) * bps as u64).min(max_bps as u64);
    amount + (amount.min(basis) as u128 * boost as u128 / 10_000) as u64
}

impl Model {
    fn new(crew_id: u64, fixed: Option<(Exercise, u32)>, cfg: Cfg, n: usize) -> Self {
        Model {
            crew_id,
            fixed,
            cfg,
            paused_since: 0,
            total_paused: 0,
            g_paused: false,
            g_paused_since: 0,
            g_total_paused: 0,
            reserve: 0,
            rollover: 0,
            treasury: 0,
            outstanding: 0,
            days: BTreeMap::new(),
            commits: BTreeMap::new(),
            profiles: vec![MProfile::default(); n],
            vault: 0,
            fees_total: 0,
        }
    }
    fn crew_allows(&self, ex: Exercise, goal: u32) -> bool {
        match self.fixed {
            None => true,
            Some((fe, fg)) => ex == fe && (fg == 0 || goal == fg),
        }
    }
    fn is_crew(&self) -> bool {
        self.crew_id != 0
    }
    /// Copies the global model's pause state (call after every global pause change).
    fn sync_global(&mut self, g: &Model) {
        self.g_paused = g.cfg.paused;
        self.g_paused_since = g.paused_since;
        self.g_total_paused = g.total_paused;
    }
    /// commit / attest / finalize / attestor-revoke are blocked: own pause or, for crews, global pause.
    fn blocked(&self) -> bool {
        self.cfg.paused || (self.is_crew() && self.g_paused)
    }
    fn paused_total(&self, now: i64) -> i64 {
        self.total_paused + if self.cfg.paused { (now - self.paused_since).max(0) } else { 0 }
    }
    fn g_paused_total(&self, now: i64) -> i64 {
        self.g_total_paused + if self.g_paused { (now - self.g_paused_since).max(0) } else { 0 }
    }
    /// Attest/revoke window end: nominal deadline + time paused since the day was created
    /// (own pauses, plus global pauses for a crew day).
    fn eff_deadline(&self, day: &MDay, now: i64) -> i64 {
        let g = if self.is_crew() { (self.g_paused_total(now) - day.g_paused_base).max(0) } else { 0 };
        day.deadline + (self.paused_total(now) - day.paused_base).max(0) + g
    }
    /// A fixed-goal crew only accepts configs that keep its fixed goal inside the limits (CREW-3).
    fn fixed_ok(&self, c: &Cfg) -> bool {
        match self.fixed {
            Some((e, fg)) if fg != 0 => fg >= c.goals[e as usize].min && fg <= c.goals[e as usize].max,
            _ => true,
        }
    }
    fn can_finalize(&self, day: &MDay, now: i64) -> bool {
        !self.blocked() && !day.finalized && !day.voided && now > self.eff_deadline(day, now) + day.delay
    }
    fn set_paused(&mut self, v: bool, now: i64) {
        if v == self.cfg.paused {
            return;
        }
        if v {
            self.paused_since = now;
        } else {
            self.total_paused += (now - self.paused_since).max(0);
            self.paused_since = 0;
        }
        self.cfg.paused = v;
    }
    fn finalize(&mut self, d: u32) -> u64 {
        let reserve = self.reserve;
        let rollover = self.rollover;
        let crew = self.is_crew();
        let day = self.days.get_mut(&d).unwrap();
        let slashed = day.total_staked - day.completed_stake - day.revoked_stake;
        let fee = (slashed as u128 * day.fee_bps as u128 / 10_000) as u64;
        let net = slashed - fee;
        // nobody completed: global -> reserve, crew -> rollover; else sponsor + whole rollover join
        let (sponsor, roll_in, dist, to_reserve, to_rollover) = if day.completed == 0 {
            if crew { (0, 0, 0, 0, net) } else { (0, 0, 0, net, 0) }
        } else {
            let sp = day.sponsor_cap.min(reserve);
            (sp, rollover, net + sp + rollover, 0, 0)
        };
        day.fee = fee;
        day.sponsor = sponsor;
        day.rollover = roll_in;
        day.distributable = dist;
        day.finalized = true;
        day.frozen = Some((day.completed, day.completed_stake, day.completed_weight, fee, sponsor, dist));
        self.outstanding = self.outstanding - fee - to_reserve - to_rollover + sponsor + roll_in;
        self.treasury += fee;
        self.fees_total += fee;
        self.reserve = self.reserve - sponsor + to_reserve;
        self.rollover = self.rollover - roll_in + to_rollover;
        fee
    }
    fn day_live(&self, d: u32) -> Option<&MDay> {
        self.days.get(&d).filter(|x| x.live)
    }
    fn commit_live(&self, u: usize, d: u32) -> Option<&MCommit> {
        self.commits.get(&(u, d)).filter(|c| c.live)
    }

    fn pred_commit(&self, bank: &Bank, now: i64, u: usize, d: u32, amount: u64, ex: Exercise, goal: u32) -> bool {
        let c = &self.cfg;
        let today = c.today(now);
        let g = c.goals[ex as usize];
        let day_ok = match self.days.get(&d) {
            None => true,
            Some(x) if x.live => !x.finalized && !x.voided,
            Some(_) => false, // swept: only possible after its deadline, so the window is closed anyway
        };
        !self.blocked()
            && (d == today || d == today + 1)
            && now < c.start(d) + c.cutoff
            && amount >= c.min_stake
            && amount <= c.max_stake
            && goal >= g.min
            && goal <= g.max
            && self.crew_allows(ex, goal)
            && !self.commits.contains_key(&(u, d))
            && day_ok
            && bank.user_bal[u] >= amount
    }

    #[allow(clippy::too_many_arguments)]
    fn apply_commit(&mut self, bank: &mut Bank, now: i64, u: usize, d: u32, amount: u64, ex: Exercise, goal: u32) {
        let c = self.cfg.clone();
        let day = self.days.entry(d).or_insert_with(|| MDay {
            live: true,
            fee_bps: c.fee_bps,
            streak_bps: c.streak_bps,
            max_streak_bps: c.max_streak_bps,
            deadline: c.end(d) + c.grace,
            sponsor_cap: c.sponsor,
            delay: c.delay,
            paused_base: self.total_paused,
            g_paused_base: if self.crew_id != 0 { self.g_total_paused } else { 0 },
            rent_payer: u,
            ..Default::default()
        });
        assert!(day.live, "commit into a swept day");
        day.committed += 1;
        day.total_staked += amount;
        self.commits.insert(
            (u, d),
            MCommit { amount, ex, goal, completed: false, revoked: false, weight: 0, committed_at: now, live: true, payouts: 0 },
        );
        let p = &mut self.profiles[u];
        p.exists = true;
        p.tc += 1;
        self.outstanding += amount;
        bank.user_bal[u] -= amount;
        self.vault += amount;
    }

    fn pred_claim(&self, u: usize, d: u32) -> Option<(u64, u64)> {
        let day = self.day_live(d)?;
        let c = self.commit_live(u, d)?;
        if day.voided {
            return Some((c.amount, 0));
        }
        if !day.finalized {
            return None;
        }
        if c.revoked {
            return Some((c.amount, 0));
        }
        if !c.completed {
            return None;
        }
        Some((c.amount, floor_share(day.distributable, c.weight, day.completed_weight)))
    }

    fn apply_claim(&mut self, bank: &mut Bank, u: usize, d: u32, principal: u64, bonus: u64) {
        let day = self.days.get_mut(&d).unwrap();
        day.principal_paid += principal;
        day.bonus_paid += bonus;
        day.resolved += 1;
        let c = self.commits.get_mut(&(u, d)).unwrap();
        c.live = false;
        c.payouts += 1;
        self.outstanding -= principal + bonus;
        self.vault -= principal + bonus;
        bank.user_bal[u] += principal + bonus;
        self.profiles[u].bonus += bonus;
    }
}

// ------------------------------------------------------------------ chain vs model

struct World {
    env: Env,
    /// action name -> (succeeded, attempted)
    counts: BTreeMap<String, (usize, usize)>,
    users: Vec<Keypair>,
    atas: Vec<Pubkey>,
    funder: Keypair,
    funder_ata: Pubkey,
    seed: u64,
    step: usize,
    txs: usize,
    oks: usize,
}

impl World {
    fn exec(&mut self, ixs: &[Instruction], payer: &Keypair, expect_ok: bool, what: &str) -> bool {
        self.txs += 1;
        let key = what.split('(').next().unwrap_or(what).trim_start_matches('[').to_string();
        let e = self.counts.entry(key).or_default();
        e.1 += 1;
        if expect_ok {
            e.0 += 1;
        }
        let r = send(&mut self.env.svm, ixs, payer, &[]);
        match (r, expect_ok) {
            (Ok(_), true) => {
                self.oks += 1;
                true
            }
            (Err(_), false) => false,
            (Ok(_), false) => panic!("seed {} step {}: {what} unexpectedly SUCCEEDED", self.seed, self.step),
            (Err(e), true) => panic!("seed {} step {}: {what} unexpectedly FAILED: {e}", self.seed, self.step),
        }
    }

    /// Checks every pool against its model, then the wallet balances (I4, I7, I8) globally.
    fn check(&mut self, models: &[Model], bank: &Bank, what: &str) {
        let cur = self.env.pool;
        let mut vaults = 0u64;
        let mut fees_total = 0u64;
        for m in models {
            self.env.use_crew(m.crew_id);
            vaults += self.check_pool(m, what);
            fees_total += m.fees_total;
        }
        self.env.pool = cur;
        self.env.vault = vault_pda(&cur);
        let ctx = format!("seed {} step {} after {what}", self.seed, self.step);
        let env = &self.env;
        // balances (I8), I4, I7
        let mut sum = vaults;
        for (i, ata) in self.atas.iter().enumerate() {
            let b = env.bal(ata);
            assert_eq!(b, bank.user_bal[i], "{ctx}: I8 user {i} balance");
            sum += b;
        }
        let admin_bal = env.bal(&env.admin_ata);
        assert_eq!(admin_bal, bank.admin_bal, "{ctx}: authority balance");
        assert!(admin_bal == bank.withdrawn && bank.withdrawn <= fees_total, "{ctx}: I4");
        let attestor_ata = anchor_spl::associated_token::get_associated_token_address(&env.attestor.pubkey(), &env.mint);
        assert!(!exists(&env.svm, &attestor_ata), "{ctx}: I4 attestor holds tokens");
        let fb = env.bal(&self.funder_ata);
        assert_eq!(fb, bank.funder_bal, "{ctx}: funder balance");
        sum += admin_bal + fb;
        assert_eq!(sum, bank.minted, "{ctx}: I7 conservation");
    }

    /// Checks the pool the env points at against `m`; returns its vault balance.
    fn check_pool(&self, m: &Model, what: &str) -> u64 {
        let ctx = format!("seed {} step {} after {what} [crew {}]", self.seed, self.step, m.crew_id);
        let env = &self.env;
        let p = env.pool_state();
        let (fixed_ex, fixed_goal) = match m.fixed {
            Some((e, g)) => (Some(e), g),
            None => (None, 0),
        };
        assert_eq!(
            (p.crew_id, p.has_fixed_exercise, p.has_fixed_exercise.then_some(p.fixed_exercise), p.fixed_goal_target),
            (m.crew_id, m.fixed.is_some(), fixed_ex, fixed_goal),
            "{ctx}: crew fields"
        );
        assert_eq!((p.authority, p.mint, p.vault), (env.admin.pubkey(), env.mint, env.vault), "{ctx}: pool keys");
        assert_eq!(
            (p.reserve, p.rollover, p.treasury_accrued, p.outstanding),
            (m.reserve, m.rollover, m.treasury, m.outstanding),
            "{ctx}: pool accounting"
        );
        if !m.is_crew() {
            assert_eq!(p.rollover, 0, "{ctx}: the global pool never holds a rollover");
        }
        let c = &m.cfg;
        assert_eq!(
            (p.min_stake, p.max_stake, p.fee_bps, p.streak_bonus_bps, p.max_streak_bonus_bps),
            (c.min_stake, c.max_stake, c.fee_bps, c.streak_bps, c.max_streak_bps),
            "{ctx}: config"
        );
        assert_eq!(
            (p.commit_cutoff_secs, p.attest_grace_secs, p.daily_sponsor_amount, p.paused, p.goal_limits),
            (c.cutoff, c.grace, c.sponsor, c.paused, c.goals),
            "{ctx}: config"
        );
        assert_eq!((p.day_length_secs, p.day_offset_secs), (c.len, c.off), "{ctx}: immutable day geometry");
        assert_eq!(
            (p.finalize_delay_secs, p.paused_since, p.total_paused_secs, p.attestor),
            (c.delay, m.paused_since, m.total_paused, env.attestor.pubkey()),
            "{ctx}: delay / pause accounting"
        );
        let vault = env.vault_balance();
        assert_eq!(vault, m.vault, "{ctx}: vault balance");
        // I1
        assert_eq!(vault, p.outstanding + p.reserve + p.rollover + p.treasury_accrued, "{ctx}: I1");
        // days
        let mut liab = 0u64;
        for (d, md) in &m.days {
            let on = env.day_state(*d);
            if !md.live {
                assert!(on.is_none(), "{ctx}: swept day {d} still exists");
                continue;
            }
            let ds = on.unwrap_or_else(|| panic!("{ctx}: day {d} missing"));
            assert_eq!(
                (ds.finalized, ds.voided, ds.fee_bps, ds.streak_bonus_bps, ds.max_streak_bonus_bps, ds.attest_deadline),
                (md.finalized, md.voided, md.fee_bps, md.streak_bps, md.max_streak_bps, md.deadline),
                "{ctx}: day {d} flags/snapshot"
            );
            assert_eq!(
                (ds.attestor, ds.sponsor_cap, ds.finalize_delay_secs, ds.paused_secs_base, ds.revoked_count, ds.revoked_stake),
                (env.attestor.pubkey(), md.sponsor_cap, md.delay, md.paused_base, md.revoked, md.revoked_stake),
                "{ctx}: day {d} trust snapshot / revocations"
            );
            assert_eq!(
                (ds.committed_count, ds.completed_count, ds.resolved_count, ds.total_staked, ds.completed_stake, ds.completed_weight),
                (md.committed, md.completed, md.resolved, md.total_staked, md.completed_stake, md.completed_weight),
                "{ctx}: day {d} aggregates"
            );
            assert_eq!(
                (ds.fee, ds.sponsor, ds.distributable, ds.principal_paid, ds.bonus_paid),
                (md.fee, md.sponsor, md.distributable, md.principal_paid, md.bonus_paid),
                "{ctx}: day {d} settlement"
            );
            assert_eq!(ds.rent_payer, self.users[md.rent_payer].pubkey(), "{ctx}: day {d} rent payer");
            assert_eq!((ds.rollover, ds.global_paused_secs_base), (md.rollover, md.g_paused_base), "{ctx}: day {d} crew fields");
            // I3, I6
            assert!(
                ds.principal_paid + ds.bonus_paid <= ds.total_staked + ds.sponsor + ds.rollover,
                "{ctx}: I3 day {d}"
            );
            assert!(ds.bonus_paid <= ds.distributable, "{ctx}: I6 bonus day {d}");
            assert!(ds.completed_count <= ds.committed_count && ds.resolved_count <= ds.committed_count, "{ctx}: I6 counts");
            assert!(ds.completed_stake + ds.revoked_stake <= ds.total_staked, "{ctx}: I6 stake");
            // I5
            if let Some(fr) = md.frozen {
                assert_eq!(
                    (ds.completed_count, ds.completed_stake, ds.completed_weight, ds.fee, ds.sponsor, ds.distributable),
                    fr,
                    "{ctx}: I5 day {d} changed after finalize"
                );
            }
            liab += md.liability();
            assert_eq!(ds.liability().unwrap(), md.liability(), "{ctx}: day {d} liability");
        }
        // I1b
        assert_eq!(p.outstanding, liab, "{ctx}: I1b outstanding != sum of day liabilities");
        // commitments
        for ((u, d), mc) in &m.commits {
            let on = env.commitment(&self.users[*u].pubkey(), *d);
            assert!(mc.payouts <= 1, "{ctx}: I2");
            if !mc.live {
                assert!(on.is_none(), "{ctx}: closed commitment ({u},{d}) exists");
                continue;
            }
            let oc = on.unwrap_or_else(|| panic!("{ctx}: commitment ({u},{d}) missing"));
            let st = if mc.revoked {
                CommitmentStatus::Revoked
            } else if mc.completed {
                CommitmentStatus::Completed
            } else {
                CommitmentStatus::Committed
            };
            assert_eq!(
                (oc.amount, oc.status, oc.weight, oc.exercise, oc.goal_target, oc.committed_at, oc.day_index, oc.version),
                (mc.amount, st, mc.weight, mc.ex, mc.goal, mc.committed_at, *d, 1),
                "{ctx}: commitment ({u},{d})"
            );
            if mc.completed {
                assert!(oc.reps >= oc.goal_target, "{ctx}: completed below goal");
            }
        }
        // profiles
        for (i, mp) in m.profiles.iter().enumerate() {
            let on = env.profile(&self.users[i].pubkey());
            if !mp.exists {
                assert!(on.is_none());
                continue;
            }
            let op = on.unwrap();
            let got = MProfile {
                exists: true,
                cur: op.current_streak,
                best: op.best_streak,
                has: op.has_completed,
                last: op.last_completed_day,
                tc: op.total_committed,
                tcomp: op.total_completed,
                tmiss: op.total_missed,
                bonus: op.total_bonus_earned,
                done: mp.done.clone(),
                last_amount: op.last_completed_amount,
            };
            if mp.has {
                // the on-chain mask/carry must describe exactly the model's completed-day set
                for back in 0..64u32 {
                    let x = mp.last - back;
                    let on = op.completed_days_mask >> back & 1 == 1;
                    assert_eq!(on, mp.done.contains(&x), "{ctx}: profile {i} completed day {x}");
                }
                // below the window only the run ending at last - 64 is recorded (the carry)
                assert_eq!(op.streak_carry, mp.streak_at(mp.last - 64), "{ctx}: profile {i} carry");
            }
            // last_completed_day is only meaningful once has_completed
            let norm = |mut x: MProfile| {
                if !x.has {
                    x.last = 0;
                    x.last_amount = 0;
                }
                x
            };
            assert_eq!(norm(got), norm(mp.clone()), "{ctx}: profile {i}");
        }
        vault
    }
}

// ------------------------------------------------------------------ scenario

#[derive(Default, Debug, Clone)]
struct Stats {
    counts: BTreeMap<String, (usize, usize)>,
    scenarios: usize,
    pools: usize,
    txs: usize,
    oks: usize,
    claims: usize,
    finalized_days: usize,
    swept_days: usize,
    voided_days: usize,
    dust_days: usize,
}

fn random_goals(rng: &mut Rng) -> [GoalLimits; 16] {
    let mut g = [GoalLimits::default(); 16];
    for i in 0..16 {
        let min = rng.range(1, (GOAL_CEIL[i] / 4) as u64) as u32;
        let max = rng.range(min as u64, GOAL_CEIL[i] as u64) as u32;
        g[i] = GoalLimits { min, max };
    }
    g
}

fn run_scenario(seed: u64, so: &[u8]) -> Stats {
    let mut rng = Rng(seed ^ 0xF17A_5EED_0000_0000);
    // ---- random valid config
    let len = *rng.pick(&[300i64, 600, 3_600, 86_400]);
    let max_cut = len - len / 24;
    let min_stake = rng.range(1, 50 * SKR);
    let max_streak_bps = rng.range(0, 10_000) as u16;
    let cfg = Cfg {
        len,
        off: rng.irange(0, len - 1),
        cutoff: if rng.chance(70) { rng.irange(len / 2, max_cut) } else { rng.irange(0, max_cut) },
        grace: rng.irange(0, len.min(21_600)),
        min_stake,
        max_stake: rng.range(min_stake, min_stake + 5_000 * SKR),
        fee_bps: rng.range(0, 2_000) as u16,
        streak_bps: rng.range(0, max_streak_bps as u64) as u16,
        max_streak_bps,
        goals: random_goals(&mut rng),
        sponsor: 0, // set below (<= max_stake)
        paused: false,
        delay: if rng.chance(50) { 0 } else { rng.irange(0, len.min(43_200)) },
    };
    let mut cfg = cfg;
    cfg.sponsor = if rng.chance(50) { 0 } else { rng.range(0, (100 * SKR).min(cfg.max_stake)) };
    assert!(cfg.valid());
    let p = InitPoolParams {
        attestor: Pubkey::default(),
        min_stake: cfg.min_stake,
        max_stake: cfg.max_stake,
        fee_bps: cfg.fee_bps,
        streak_bonus_bps: cfg.streak_bps,
        max_streak_bonus_bps: cfg.max_streak_bps,
        day_length_secs: cfg.len,
        day_offset_secs: cfg.off,
        commit_cutoff_secs: cfg.cutoff,
        attest_grace_secs: cfg.grace,
        goal_limits: cfg.goals,
        daily_sponsor_amount: cfg.sponsor,
        require_sgt: false,
        finalize_delay_secs: cfg.delay,
    };
    let mut env = Env::with_so(so, p);
    let n = rng.range(2, 7) as usize;
    let mut users = vec![];
    let mut atas = vec![];
    let mut user_bal = vec![];
    for i in 0..n {
        let skr = if i == 0 && rng.chance(30) { 5 } else { 100_000 };
        let (u, a) = env.user(skr);
        env.svm.airdrop(&u.pubkey(), 20_000_000_000).unwrap();
        users.push(u);
        atas.push(a);
        user_bal.push(skr * SKR);
    }
    let (funder, funder_ata) = env.user(1_000_000);
    let minted = user_bal.iter().sum::<u64>() + 1_000_000 * SKR;
    let mut bank = Bank { user_bal, admin_bal: 0, funder_bal: 1_000_000 * SKR, withdrawn: 0, minted };
    let mut models = vec![Model::new(0, None, cfg.clone(), n)];
    let start_day = cfg.today(T0) + 1;
    let mut now = cfg.start(start_day) + rng.irange(0, len - 1);
    env.warp(now);
    let mut w = World { env, counts: BTreeMap::new(), users, atas, funder, funder_ata, seed, step: 0, txs: 0, oks: 0 };
    w.check(&models, &bank, "setup");
    let mut stats = Stats { scenarios: 1, ..Default::default() };
    let admin = w.env.admin.insecure_clone();
    let attestor = w.env.attestor.insecure_clone();
    // one or two crews from the start, more may be created during the run
    for _ in 0..rng.range(1, 2) {
        let what = crew_action(&mut w, &mut rng, &mut models, n);
        w.check(&models, &bank, &what);
    }

    let steps = rng.range(60, 160) as usize;
    for step in 0..steps {
        w.step = step;
        let roll = rng.range(0, 104);
        if roll >= 100 {
            let what = if roll <= 101 && models.len() <= MAX_CREWS {
                crew_action(&mut w, &mut rng, &mut models, n)
            } else {
                cross_pool_attack(&mut w, &mut rng, &models, now, n)
            };
            w.check(&models, &bank, &what);
            continue;
        }
        // the pool this step acts on: the global pool or one of the crews
        let k = if models.len() == 1 || rng.chance(40) { 0 } else { rng.range(1, models.len() as u64 - 1) as usize };
        w.env.use_crew(models[k].crew_id);
        let mut m = models[k].clone();
        let what: String;
        let u = rng.range(0, n as u64 - 1) as usize;
        let today = m.cfg.today(now);
        // Day-bound actions target, with 75% probability, a (user, day) the model says is valid for
        // that action; otherwise any known pair / day (mostly invalid -> negative coverage).
        let known: Vec<(usize, u32)> = m.commits.keys().cloned().collect();
        let pick_pair = |rng: &mut Rng, valid: &dyn Fn(&(usize, u32)) -> bool| -> (usize, u32) {
            let cands: Vec<(usize, u32)> = known.iter().filter(|k| valid(k)).cloned().collect();
            if !cands.is_empty() && rng.chance(75) {
                *rng.pick(&cands)
            } else if !known.is_empty() && rng.chance(85) {
                *rng.pick(&known)
            } else {
                (rng.range(0, n as u64 - 1) as usize, today)
            }
        };
        let day_keys: Vec<u32> = m.days.keys().cloned().collect();
        let pick_day = |rng: &mut Rng, valid: &dyn Fn(&MDay) -> bool| -> u32 {
            let cands: Vec<u32> = m.days.iter().filter(|(_, x)| x.live && valid(x)).map(|(d, _)| *d).collect();
            if !cands.is_empty() && rng.chance(75) {
                *rng.pick(&cands)
            } else if !day_keys.is_empty() && rng.chance(85) {
                *rng.pick(&day_keys)
            } else {
                today + rng.range(0, 1) as u32
            }
        };
        let open_day =
            |d: u32| m.day_live(d).map(|x| !x.finalized && !x.voided && now <= m.eff_deadline(x, now)).unwrap_or(false);
        match roll {
            // ---------------------------------------------------------- commit
            0..=25 => {
                let d = match rng.range(0, 9) {
                    0 => today - 1,
                    1 => today + 2,
                    2..=5 => today,
                    _ => today + 1,
                };
                let (amount, ex, goal) = random_commit_args(&mut rng, &m);
                let ok = m.pred_commit(&bank, now, u, d, amount, ex, goal);
                what = format!("commit(u{u}, d{d}, {amount}, {ex:?}, {goal}) ok={ok}");
                let ix = w.env.ix_commit(&w.users[u].pubkey(), &w.atas[u], d, amount, ex, goal, None);
                let payer = w.users[u].insecure_clone();
                if w.exec(&[ix], &payer, ok, &what) {
                    m.apply_commit(&mut bank, now, u, d, amount, ex, goal);
                }
            }
            // ---------------------------------------------------------- attest
            26..=45 => {
                let (u, d) = pick_pair(&mut rng, &|&(u, d)| {
                    open_day(d) && m.commit_live(u, d).map(|c| !c.completed && !c.revoked).unwrap_or(false)
                });
                let by_attestor = rng.chance(93);
                let ds = m.cfg.start(d);
                let de = m.cfg.end(d);
                let mc = m.commit_live(u, d).cloned();
                let (started, reps) = match &mc {
                    Some(c) => {
                        let lo = c.committed_at.max(ds);
                        let hi = now.min(de - 1);
                        let started = if lo <= hi && rng.chance(85) {
                            rng.irange(lo, hi)
                        } else {
                            *rng.pick(&[c.committed_at - 1, now + 1, de, ds - 1, lo])
                        };
                        let reps = if rng.chance(88) {
                            c.goal + rng.range(0, 20) as u32
                        } else {
                            c.goal.saturating_sub(rng.range(1, 3) as u32)
                        };
                        (started, reps)
                    }
                    None => (now, 50),
                };
                let ok = by_attestor
                    && !m.blocked()
                    && match (m.day_live(d), &mc) {
                        (Some(day), Some(c)) => {
                            !day.finalized
                                && !day.voided
                                && now <= m.eff_deadline(day, now)
                                && !c.completed
                                && !c.revoked
                                && started >= c.committed_at
                                && started >= ds
                                && started < de
                                && started <= now
                                && reps >= c.goal
                        }
                        _ => false,
                    };
                what = format!("attest(u{u}, d{d}, reps {reps}, started {started}, attestor {by_attestor}) ok={ok}");
                let signer = if by_attestor { attestor.insecure_clone() } else { w.users[u].insecure_clone() };
                let ix = w.env.ix_attest(&signer.pubkey(), &w.users[u].pubkey(), d, reps, started);
                if w.exec(&[ix], &signer, ok, &what) {
                    let c = m.commits.get_mut(&(u, d)).unwrap();
                    let prof = &mut m.profiles[u];
                    // Independent streak model: a set of completed days. Basis (audit F3) is
                    // yesterday's completed stake, known only when d directly follows `last`.
                    let mut basis = 0;
                    if !prof.has || d > prof.last {
                        if prof.has && d == prof.last + 1 && prof.done.contains(&prof.last) {
                            basis = prof.last_amount;
                        }
                        prof.done.insert(d);
                        prof.last = d;
                        prof.last_amount = c.amount;
                    } else if prof.last - d < 64 {
                        prof.done.insert(d);
                    }
                    prof.has = true;
                    let streak = if prof.last - d < 64 { prof.streak_at(d).max(1) } else { 1 };
                    prof.cur = prof.streak_at(prof.last);
                    prof.best = prof.best.max(prof.cur);
                    let day = m.days.get_mut(&d).unwrap();
                    let wgt = weight(c.amount, basis, streak, day.streak_bps, day.max_streak_bps);
                    c.completed = true;
                    c.weight = wgt;
                    day.completed += 1;
                    day.completed_stake += c.amount;
                    day.completed_weight += wgt;
                    prof.tcomp += 1;
                }
            }
            // ---------------------------------------------------------- revoke
            46..=49 => {
                let (u, d) = pick_pair(&mut rng, &|&(u, d)| open_day(d) && m.commit_live(u, d).map(|c| c.completed).unwrap_or(false));
                let who = rng.range(0, 9);
                let signer = match who {
                    0..=4 => attestor.insecure_clone(),
                    5..=8 => admin.insecure_clone(),
                    _ => w.users[u].insecure_clone(),
                };
                // the attestor cannot revoke while paused; the authority can
                let ok = (who >= 5 && who <= 8 || who <= 4 && !m.blocked())
                    && match (m.day_live(d), m.commit_live(u, d)) {
                        (Some(day), Some(c)) => {
                            !day.finalized && !day.voided && now <= m.eff_deadline(day, now) && c.completed
                        }
                        _ => false,
                    };
                what = format!("revoke(u{u}, d{d}, who {who}) ok={ok}");
                let ix = w.env.ix_revoke(&signer.pubkey(), &w.users[u].pubkey(), d);
                if w.exec(&[ix], &signer, ok, &what) {
                    let c = m.commits.get_mut(&(u, d)).unwrap();
                    let day = m.days.get_mut(&d).unwrap();
                    day.completed -= 1;
                    day.completed_stake -= c.amount;
                    day.completed_weight -= c.weight;
                    day.revoked += 1;
                    day.revoked_stake += c.amount;
                    c.completed = false;
                    c.revoked = true;
                    c.weight = 0;
                    let prof = &mut m.profiles[u];
                    if prof.has && d <= prof.last && prof.last - d < 64 {
                        prof.done.remove(&d);
                    }
                    prof.cur = prof.streak_at(prof.last);
                    prof.tcomp = prof.tcomp.saturating_sub(1);
                }
            }
            // ---------------------------------------------------------- finalize
            50..=57 => {
                let d = pick_day(&mut rng, &|x| m.can_finalize(x, now));
                let ok = m.day_live(d).map(|x| m.can_finalize(x, now)).unwrap_or(false);
                what = format!("finalize(d{d}) ok={ok}");
                let cranker = w.users[u].insecure_clone();
                let ix = w.env.ix_finalize(&cranker.pubkey(), d);
                if w.exec(&[ix], &cranker, ok, &what) {
                    stats.finalized_days += 1;
                    m.finalize(d);
                }
            }
            // ---------------------------------------------------------- void
            58 => {
                let d = pick_day(&mut rng, &|x| !x.finalized && !x.voided);
                let by_admin = rng.chance(90);
                let ok = by_admin && m.day_live(d).map(|x| !x.finalized && !x.voided).unwrap_or(false);
                what = format!("void(d{d}, admin {by_admin}) ok={ok}");
                let signer = if by_admin { admin.insecure_clone() } else { w.users[u].insecure_clone() };
                let ix = w.env.ix_void(&signer.pubkey(), d);
                if w.exec(&[ix], &signer, ok, &what) {
                    stats.voided_days += 1;
                    m.days.get_mut(&d).unwrap().voided = true;
                }
            }
            // ---------------------------------------------------------- claim
            59..=67 => {
                let (u, d) = pick_pair(&mut rng, &|&(u, d)| m.pred_claim(u, d).is_some());
                let pred = m.pred_claim(u, d);
                what = format!("claim(u{u}, d{d}) pred={pred:?}");
                let ix = w.env.ix_claim(&w.users[u].pubkey(), &w.atas[u], d);
                let payer = w.users[u].insecure_clone();
                if w.exec(&[ix], &payer, pred.is_some(), &what) {
                    let (pr, bo) = pred.unwrap();
                    m.apply_claim(&mut bank, u, d, pr, bo);
                    stats.claims += 1;
                }
            }
            // ---------------------------------------------------------- [claim(d-1), commit(d)] (MWA batch)
            68..=70 => {
                let (u, d0) = pick_pair(&mut rng, &|&(u, d)| m.pred_claim(u, d).is_some());
                let d = today + rng.range(0, 1) as u32;
                let (amount, ex, goal) = random_commit_args(&mut rng, &m);
                let pred = m.pred_claim(u, d0);
                let mut m2 = m.clone();
                let mut bank2 = bank.clone();
                let ok = match pred {
                    Some((pr, bo)) => {
                        m2.apply_claim(&mut bank2, u, d0, pr, bo);
                        if m2.pred_commit(&bank2, now, u, d, amount, ex, goal) {
                            m2.apply_commit(&mut bank2, now, u, d, amount, ex, goal);
                            true
                        } else {
                            false
                        }
                    }
                    None => false,
                };
                what = format!("[claim(u{u}, d{d0}), commit(d{d}, {amount})] ok={ok}");
                let ixs = [
                    w.env.ix_claim(&w.users[u].pubkey(), &w.atas[u], d0),
                    w.env.ix_commit(&w.users[u].pubkey(), &w.atas[u], d, amount, ex, goal, None),
                ];
                let payer = w.users[u].insecure_clone();
                if w.exec(&ixs, &payer, ok, &what) {
                    m = m2;
                    bank = bank2;
                    stats.claims += 1;
                }
            }
            // ---------------------------------------------------------- close_missed
            71..=75 => {
                let (u, d) = pick_pair(&mut rng, &|&(u, d)| {
                    m.day_live(d).map(|x| x.finalized).unwrap_or(false)
                        && m.commit_live(u, d).map(|c| !c.completed && !c.revoked).unwrap_or(false)
                });
                let ok = match (m.day_live(d), m.commit_live(u, d)) {
                    (Some(day), Some(c)) => day.finalized && !c.completed && !c.revoked,
                    _ => false,
                };
                what = format!("close_missed(u{u}, d{d}) ok={ok}");
                let cranker = w.users[rng.range(0, n as u64 - 1) as usize].insecure_clone();
                let ix = w.env.ix_close_missed(&cranker.pubkey(), &w.users[u].pubkey(), d);
                if w.exec(&[ix], &cranker, ok, &what) {
                    m.days.get_mut(&d).unwrap().resolved += 1;
                    m.commits.get_mut(&(u, d)).unwrap().live = false;
                    let prof = &mut m.profiles[u];
                    prof.tmiss += 1;
                    if !prof.has || d > prof.last {
                        prof.cur = 0;
                    }
                }
            }
            // ---------------------------------------------------------- sweep
            76..=80 => {
                let d = pick_day(&mut rng, &|x| (x.finalized || x.voided) && now > x.deadline && x.resolved == x.committed);
                let right_payer = rng.chance(95);
                let payer_idx = match m.days.get(&d) {
                    Some(x) if right_payer => x.rent_payer,
                    Some(x) => (x.rent_payer + 1) % n,
                    None => u,
                };
                let ok = m
                    .day_live(d)
                    .map(|x| {
                        (x.finalized || x.voided) && now > x.deadline && x.resolved == x.committed && payer_idx == x.rent_payer
                    })
                    .unwrap_or(false);
                what = format!("sweep(d{d}) ok={ok}");
                let cranker = w.users[u].insecure_clone();
                let ix = w.env.ix_sweep(&cranker.pubkey(), &w.users[payer_idx].pubkey(), d);
                if w.exec(&[ix], &cranker, ok, &what) {
                    stats.swept_days += 1;
                    let day = m.days.get_mut(&d).unwrap();
                    let dust = if day.voided { 0 } else { day.distributable - day.bonus_paid };
                    if dust > 0 {
                        stats.dust_days += 1;
                    }
                    day.live = false;
                    m.outstanding -= dust;
                    if m.is_crew() {
                        m.rollover += dust;
                    } else {
                        m.reserve += dust;
                    }
                }
            }
            // ---------------------------------------------------------- fund_reserve
            81..=82 => {
                let amount = if rng.chance(10) { 0 } else { rng.range(1, 50 * SKR) };
                // a closed sponsor tap refuses deposits (audit CREW-2)
                let ok = amount > 0 && m.cfg.sponsor > 0 && bank.funder_bal >= amount;
                what = format!("fund_reserve({amount}) ok={ok}");
                let funder = w.funder.insecure_clone();
                let ix = w.env.ix_fund(&funder.pubkey(), &w.funder_ata, amount);
                if w.exec(&[ix], &funder, ok, &what) {
                    m.reserve += amount;
                    bank.funder_bal -= amount;
                    m.vault += amount;
                }
            }
            // ---------------------------------------------------------- withdraw_treasury
            83..=84 => {
                let amount = match rng.range(0, 3) {
                    0 => m.treasury,
                    1 => m.treasury + 1,
                    _ => rng.range(0, m.treasury),
                };
                let by_admin = rng.chance(90);
                let ok = by_admin && amount <= m.treasury;
                what = format!("withdraw({amount}, admin {by_admin}) ok={ok}");
                let signer = if by_admin { admin.insecure_clone() } else { w.users[u].insecure_clone() };
                let dest = w.env.admin_ata;
                let ix = w.env.ix_withdraw(&signer.pubkey(), &dest, amount);
                if w.exec(&[ix], &signer, ok, &what) {
                    m.treasury -= amount;
                    bank.admin_bal += amount;
                    m.vault -= amount;
                    bank.withdrawn += amount;
                }
            }
            // ---------------------------------------------------------- update_config
            85..=88 => {
                let (up, new_cfg) = random_update(&mut rng, &m.cfg);
                let by_admin = rng.chance(95);
                let ok = by_admin && new_cfg.valid() && m.fixed_ok(&new_cfg);
                what = format!("update_config({new_cfg:?}, admin {by_admin}) ok={ok}");
                let signer = if by_admin { admin.insecure_clone() } else { w.users[u].insecure_clone() };
                let ix = w.env.ix_update(&signer.pubkey(), up);
                if w.exec(&[ix], &signer, ok, &what) {
                    let paused = new_cfg.paused;
                    m.cfg = Cfg { paused: m.cfg.paused, ..new_cfg };
                    m.set_paused(paused, now);
                }
            }
            // ---------------------------------------------------------- clock warp
            _ => {
                let dt = if rng.chance(70) { rng.irange(1, (len / 4).max(1)) } else { rng.irange(len / 4, 3 * len / 2) };
                now += dt;
                w.env.warp(now);
                what = format!("warp +{dt}");
            }
        }
        models[k] = m;
        if k == 0 {
            let g = models[0].clone();
            for c in models.iter_mut().skip(1) {
                c.sync_global(&g);
            }
        }
        w.check(&models, &bank, &format!("[crew {}] {what}", models[k].crew_id));
    }

    // ---------------------------------------------------------- drain: settle every pool
    w.step = usize::MAX;
    // finalize is blocked while paused: unpause first (this also closes the pause interval)
    for k in 0..models.len() {
        if models[k].cfg.paused {
            w.env.use_crew(models[k].crew_id);
            let ix = w.env.ix_update(&admin.pubkey(), UpdateConfigParams { paused: Some(false), ..Default::default() });
            w.exec(&[ix], &admin, true, "drain unpause");
            models[k].set_paused(false, now);
            if k == 0 {
                let g = models[0].clone();
                for c in models.iter_mut().skip(1) {
                    c.sync_global(&g);
                }
            }
            w.check(&models, &bank, "drain unpause");
        }
    }
    let last_finalize = models
        .iter()
        .flat_map(|m| m.days.values().filter(|d| d.live).map(move |d| m.eff_deadline(d, now) + d.delay))
        .max()
        .unwrap_or(now);
    now = now.max(last_finalize) + 1;
    w.env.warp(now);
    let cr = w.users[0].insecure_clone();
    for k in 0..models.len() {
        w.env.use_crew(models[k].crew_id);
        let mut m = models[k].clone();
        let open: Vec<u32> = m.days.iter().filter(|(_, x)| x.live && !x.finalized && !x.voided).map(|(d, _)| *d).collect();
        for d in open {
            let ix = w.env.ix_finalize(&cr.pubkey(), d);
            w.exec(&[ix], &cr, true, "drain finalize");
            stats.finalized_days += 1;
            m.finalize(d);
            models[k] = m.clone();
            w.check(&models, &bank, "drain finalize");
        }
        let live: Vec<(usize, u32)> = m.commits.iter().filter(|(_, c)| c.live).map(|(k, _)| *k).collect();
        for (u, d) in live {
            if !rng.chance(85) {
                continue; // stays unclaimed
            }
            let payer = w.users[u].insecure_clone();
            if let Some((pr, bo)) = m.pred_claim(u, d) {
                let ix = w.env.ix_claim(&payer.pubkey(), &w.atas[u], d);
                w.exec(&[ix], &payer, true, "drain claim");
                m.apply_claim(&mut bank, u, d, pr, bo);
                stats.claims += 1;
            } else {
                let ix = w.env.ix_close_missed(&payer.pubkey(), &payer.pubkey(), d);
                w.exec(&[ix], &payer, true, "drain close_missed");
                m.days.get_mut(&d).unwrap().resolved += 1;
                m.commits.get_mut(&(u, d)).unwrap().live = false;
                let prof = &mut m.profiles[u];
                prof.tmiss += 1;
                if !prof.has || d > prof.last {
                    prof.cur = 0;
                }
            }
            models[k] = m.clone();
            w.check(&models, &bank, "drain resolve");
        }
        let live_days: Vec<u32> = m.days.iter().filter(|(_, x)| x.live).map(|(d, _)| *d).collect();
        for d in live_days {
            let day = m.days[&d].clone();
            let ok = day.resolved == day.committed;
            let ix = w.env.ix_sweep(&cr.pubkey(), &w.users[day.rent_payer].pubkey(), d);
            if w.exec(&[ix], &cr, ok, "drain sweep") {
                stats.swept_days += 1;
                let dust = if day.voided { 0 } else { day.distributable - day.bonus_paid };
                if dust > 0 {
                    stats.dust_days += 1;
                }
                m.days.get_mut(&d).unwrap().live = false;
                m.outstanding -= dust;
                if m.is_crew() {
                    m.rollover += dust;
                } else {
                    m.reserve += dust;
                }
            }
            models[k] = m.clone();
            w.check(&models, &bank, "drain sweep");
        }
        let t = m.treasury;
        let dest = w.env.admin_ata;
        let ix = w.env.ix_withdraw(&admin.pubkey(), &dest, t);
        w.exec(&[ix], &admin, true, "drain withdraw");
        m.treasury = 0;
        bank.admin_bal += t;
        m.vault -= t;
        bank.withdrawn += t;
        models[k] = m.clone();
        w.check(&models, &bank, "drain withdraw");

        // ------------------------------------------------------ final accounting, computed independently
        // Unclaimed liability = for every still-open commitment: principal (+ its floor share if it
        // completed on a finalized day); plus, per unswept finalized day, the rounding dust
        // distributable - sum of ALL completers' floor shares.
        let mut unclaimed = 0u64;
        for (d, day) in m.days.iter().filter(|(_, x)| x.live) {
            let completers: Vec<&MCommit> =
                m.commits.iter().filter(|((_, dd), c)| dd == d && c.completed).map(|(_, c)| c).collect();
            if day.voided {
                unclaimed += m.commits.iter().filter(|((_, dd), c)| dd == d && c.live).map(|(_, c)| c.amount).sum::<u64>();
            } else {
                let shares: u64 =
                    completers.iter().map(|c| floor_share(day.distributable, c.weight, day.completed_weight)).sum();
                assert!(day.distributable - shares < completers.len().max(1) as u64, "dust < number of completers");
                unclaimed += day.distributable - shares;
                for c in completers.iter().filter(|c| c.live) {
                    unclaimed += c.amount + floor_share(day.distributable, c.weight, day.completed_weight);
                }
                unclaimed +=
                    m.commits.iter().filter(|((_, dd), c)| dd == d && c.live && c.revoked).map(|(_, c)| c.amount).sum::<u64>();
            }
        }
        let p = w.env.pool_state();
        let crew = m.crew_id;
        assert_eq!(p.outstanding, unclaimed, "seed {seed} crew {crew}: outstanding != independently computed unclaimed");
        assert_eq!(
            w.env.vault_balance(),
            p.reserve + p.rollover + p.treasury_accrued + unclaimed,
            "seed {seed} crew {crew}: final vault"
        );
        assert_eq!(p.treasury_accrued, 0);
    }
    stats.pools += models.len();
    stats.txs = w.txs;
    stats.oks = w.oks;
    stats.counts = w.counts;
    stats
}

/// Up to this many crews per scenario (besides the global pool).
const MAX_CREWS: usize = 4;

/// create_crew with a random (sometimes duplicate or zero) id, a random fixed exercise/goal and,
/// rarely, an invalid name or goal. The crew's model copies the global model's CURRENT config.
fn crew_action(w: &mut World, rng: &mut Rng, models: &mut Vec<Model>, n: usize) -> String {
    let u = rng.range(0, n as u64 - 1) as usize;
    let id = if rng.chance(12) { rng.pick(models).crew_id } else { rng.range(1, u64::MAX) };
    let ex = if rng.chance(40) { None } else { Some(*rng.pick(&EXERCISES)) };
    let g = models[0].cfg.clone();
    let goal = match (ex, rng.range(0, 9)) {
        (_, 0..=4) => None,
        (None, 5) => Some(20), // a goal without an exercise: invalid
        (None, _) => None,
        (Some(e), 5) => Some(g.goals[e as usize].min - 1),
        (Some(e), 6) => Some(g.goals[e as usize].max + 1),
        (Some(e), _) => Some(rng.range(g.goals[e as usize].min as u64, g.goals[e as usize].max as u64) as u32),
    };
    let bad_name = rng.chance(5);
    let name = if bad_name { [0u8; 32] } else { crew_name(&format!("crew {}", id % 10_000)) };
    let goal_ok = match (ex, goal) {
        (_, None) => true,
        (None, Some(_)) => false,
        (Some(e), Some(v)) => v >= g.goals[e as usize].min && v <= g.goals[e as usize].max,
    };
    let exists = models.iter().any(|m| m.crew_id == id);
    let ok = id != 0 && !exists && !bad_name && goal_ok && !g.paused;
    let what = format!("create_crew(u{u}, {id}, {ex:?}, {goal:?}, bad_name {bad_name}) ok={ok}");
    let creator = w.users[u].insecure_clone();
    let ix = w.env.ix_create_crew(&creator.pubkey(), id, name, ex, goal);
    if w.exec(&[ix], &creator, ok, &what) {
        let fixed = ex.map(|e| (e, goal.unwrap_or(0)));
        let mut m = Model::new(id, fixed, Cfg { paused: false, ..g }, n);
        m.sync_global(&models[0]);
        models.push(m);
    }
    what
}

/// Mixes the accounts of two different pools in a token-moving or settling instruction. Must fail.
fn cross_pool_attack(w: &mut World, rng: &mut Rng, models: &[Model], now: i64, n: usize) -> String {
    if models.len() < 2 {
        return "cross_pool skipped (one pool)".into();
    }
    let a = rng.range(0, models.len() as u64 - 1) as usize;
    let b = (a + 1 + rng.range(0, models.len() as u64 - 2) as usize) % models.len();
    let (ma, mb) = (&models[a], &models[b]);
    let pb = pool_pda(&w.env.mint, mb.crew_id);
    let vb = vault_pda(&pb);
    w.env.use_crew(ma.crew_id);
    let keys: Vec<(usize, u32)> = ma.commits.iter().filter(|(_, c)| c.live).map(|(k, _)| *k).collect();
    let (u, d) = if keys.is_empty() {
        (rng.range(0, n as u64 - 1) as usize, ma.cfg.today(now))
    } else {
        *rng.pick(&keys)
    };
    let user = w.users[u].insecure_clone();
    let admin = w.env.admin.insecure_clone();
    let kind = rng.range(0, 5);
    let (mut ix, payer) = match kind {
        0 | 1 => (w.env.ix_claim(&user.pubkey(), &w.atas[u], d), user),
        2 => {
            let (amount, ex, goal) = random_commit_args(rng, ma);
            (w.env.ix_commit(&user.pubkey(), &w.atas[u], d, amount, ex, goal, None), user)
        }
        3 => (w.env.ix_withdraw(&admin.pubkey(), &w.env.admin_ata, mb.treasury.max(1)), admin),
        4 => (w.env.ix_fund(&user.pubkey(), &w.atas[u], SKR), user),
        _ => (w.env.ix_finalize(&user.pubkey(), d), user),
    };
    match kind {
        0 | 3 => ix.accounts[3].pubkey = vb,          // pool a, vault b
        1 => {
            ix.accounts[1].pubkey = pb;              // pool b + vault b, day/commitment of pool a
            ix.accounts[3].pubkey = vb;
        }
        2 | 4 => ix.accounts[4].pubkey = vb,         // pay into pool b's vault through pool a
        _ => ix.accounts[1].pubkey = pb,             // settle pool a's day through pool b
    }
    let what = format!("cross_pool(kind {kind}, crew {} -> crew {}, u{u}, d{d})", ma.crew_id, mb.crew_id);
    w.exec(&[ix], &payer, false, &what);
    what
}

fn random_commit_args(rng: &mut Rng, m: &Model) -> (u64, Exercise, u32) {
    let c = &m.cfg;
    // in a crew with a fixed exercise/goal, mostly play by the crew's rule
    let fixed = m.fixed.filter(|_| rng.chance(85));
    let ex = match fixed {
        Some((e, _)) => e,
        None => *rng.pick(&EXERCISES),
    };
    let amount = match rng.range(0, 19) {
        0 => c.min_stake - 1,
        1 => c.max_stake + 1,
        2 => c.min_stake,
        3 => c.max_stake,
        _ => rng.range(c.min_stake, c.max_stake),
    };
    let g = c.goals[ex as usize];
    let goal = match (fixed, rng.range(0, 19)) {
        (_, 0) => g.min - 1,
        (_, 1) => g.max + 1,
        (Some((_, fg)), _) if fg != 0 => fg,
        _ => rng.range(g.min as u64, g.max as u64) as u32,
    };
    (amount, ex, goal)
}

fn random_update(rng: &mut Rng, c: &Cfg) -> (UpdateConfigParams, Cfg) {
    let mut up = UpdateConfigParams::default();
    let mut n = c.clone();
    let len = c.len;
    if rng.chance(25) {
        let v = rng.range(0, 60 * SKR);
        up.min_stake = Some(v);
        n.min_stake = v;
    }
    if rng.chance(25) {
        let v = match rng.range(0, 9) {
            0 => STAKE_CEILING,
            1 => STAKE_CEILING + 1,
            _ => rng.range(0, 6_000 * SKR),
        };
        up.max_stake = Some(v);
        n.max_stake = v;
    }
    if rng.chance(25) {
        let v = rng.range(0, 2_100) as u16;
        up.fee_bps = Some(v);
        n.fee_bps = v;
    }
    if rng.chance(20) {
        let v = rng.range(0, 10_500) as u16;
        up.max_streak_bonus_bps = Some(v);
        n.max_streak_bps = v;
    }
    if rng.chance(20) {
        let v = rng.range(0, 5_500) as u16;
        up.streak_bonus_bps = Some(v);
        n.streak_bps = v;
    }
    if rng.chance(20) {
        let v = rng.irange(-1, len);
        up.commit_cutoff_secs = Some(v);
        n.cutoff = v;
    }
    if rng.chance(20) {
        let v = rng.irange(-1, len.min(21_600) + 1);
        up.attest_grace_secs = Some(v);
        n.grace = v;
    }
    if rng.chance(15) {
        let mut g = random_goals(rng);
        if rng.chance(20) {
            let i = rng.range(0, 15) as usize;
            // over this exercise's ceiling: by 1 (edge) or far above
            g[i].max = if rng.chance(50) { GOAL_CEIL[i] + 1 } else { GOAL_CEIL[i] * 4 };
        }
        up.goal_limits = Some(g);
        n.goals = g;
    }
    if rng.chance(20) {
        let v = if rng.chance(40) { 0 } else { rng.range(0, 200 * SKR) };
        up.daily_sponsor_amount = Some(v);
        n.sponsor = v;
    }
    if rng.chance(12) {
        let v = rng.chance(40);
        up.paused = Some(v);
        n.paused = v;
    }
    if rng.chance(10) {
        let v = rng.irange(-1, len.min(43_200) + 1);
        up.finalize_delay_secs = Some(v);
        n.delay = v;
    }
    (up, n)
}

fn run_batch(batch: u64) {
    let per: u64 = std::env::var("FITR_FUZZ_SCENARIOS").ok().and_then(|v| v.parse().ok()).unwrap_or(64);
    let base: u64 = std::env::var("FITR_FUZZ_SEED").ok().and_then(|v| v.parse().ok()).unwrap_or(0x5EED);
    let so = so_bytes();
    let mut total = Stats::default();
    for i in 0..per {
        let seed = base.wrapping_add(batch * 1_000_000 + i);
        let s = run_scenario(seed, &so);
        total.scenarios += s.scenarios;
        total.pools += s.pools;
        total.txs += s.txs;
        total.oks += s.oks;
        total.claims += s.claims;
        total.finalized_days += s.finalized_days;
        total.swept_days += s.swept_days;
        total.voided_days += s.voided_days;
        total.dust_days += s.dust_days;
        for (k, (ok, all)) in s.counts {
            let e = total.counts.entry(k).or_default();
            e.0 += ok;
            e.1 += all;
        }
    }
    let per_action: Vec<String> = total.counts.iter().map(|(k, (ok, all))| format!("{k} {ok}/{all}")).collect();
    println!("batch {batch} per action (ok/attempted): {}", per_action.join(", "));
    println!(
        "batch {batch}: {} scenarios ({} pools), {} txs ({} ok / {} rejected as predicted), {} claims, {} days finalized, {} voided, {} swept ({} with dust)",
        total.scenarios,
        total.pools,
        total.txs,
        total.oks,
        total.txs - total.oks,
        total.claims,
        total.finalized_days,
        total.voided_days,
        total.swept_days,
        total.dust_days
    );
    assert!(total.oks > 0 && total.claims > 0 && total.finalized_days > 0);
    assert!(total.pools > total.scenarios, "crews were created");
    for action in ["create_crew", "cross_pool"] {
        assert!(total.counts.get(action).map(|c| c.1 > 0).unwrap_or(false), "{action} exercised");
    }
    assert!(total.counts["create_crew"].0 > 0, "some crews created");
}

#[test]
fn invariants_batch_0() {
    run_batch(0);
}
#[test]
fn invariants_batch_1() {
    run_batch(1);
}
#[test]
fn invariants_batch_2() {
    run_batch(2);
}
#[test]
fn invariants_batch_3() {
    run_batch(3);
}
