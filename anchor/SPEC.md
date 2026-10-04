# fitr-vault program specification

Fitr's on-chain commitment vault (Anchor 0.31.1, Solana 2.1 toolchain). A user stakes an amount of
the pool mint that they choose ($SKR on mainnet) on a workout goal that they choose for one pool day.
Fitr's verification server (the **attestor**) re-checks the session and marks the day complete. After
the day:
- completers get their stake back, plus a pro-rata (stake × streak weight) share of what
  non-completers forfeited;
- the protocol keeps a fee on the **forfeited** part only (5 % on mainnet).

The product is a commitment device, not an earning product. Cheating is limited by the rules below, the
attestor's checks and the Seeker device gate. It is cheat-resistant, not cheat-proof (§8).

- Program id: `9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY` (from `anchor keys sync`; the keypair is NOT in the repo).
- Source: `programs/fitr-vault/src/{lib,contexts,state,math,token_checks,constants,error,events}.rs`.
- Generated TS client: `src/lib/solana/vault/generated/` (`npm run codegen:vault`).

## 1. Build and test

```bash
npm run anchor:build      # anchor build -> target/deploy/fitr_vault.so + target/idl/fitr_vault.json
npm run anchor:test       # anchor build, then all Rust tests (unit + LiteSVM integration)
npm run codegen:vault     # copy the IDL into the app and render the @solana/kit client
npm run codegen:vault -- --check   # CI: fails when the IDL or the generated client are stale
```

Toolchain facts the build depends on:
- anchor-cli 0.31.1 (avm also has 1.2.0; do not switch).
- solana-cli 2.1.0, whose platform-tools v1.43 bundle cargo/rustc **1.79**.
- `rust-version = "1.79"` in `programs/fitr-vault/Cargo.toml`, plus the committed `Cargo.lock`:
  - generated with `CARGO_RESOLVER_INCOMPATIBLE_RUST_VERSIONS=fallback cargo generate-lockfile`;
  - `blake3` pinned with `cargo update -p blake3 --precise 1.5.5`.
  - Together these keep edition-2024 crates out of the SBF build.
- After changing dependencies, re-run with that environment variable and commit the lockfile.
- Never add `solana-program` as a direct dependency.

Tests (LiteSVM 0.6.1, Rust) load `target/deploy/fitr_vault.so`, so build first:

| File | What it covers |
|---|---|
| `src/math.rs`, `src/state.rs` unit tests | Day math, including short days and offsets. Finalize/bonus math and dust bounds. Streak weights. Every config bound. Account sizes. Exercise encoding (all 16 codes frozen) and per-exercise units/ceilings. DeviceLock day tracking. |
| `tests/litesvm_flow.rs` | Full day with 3 users (worked example §5). Variable-stake, multi-goal flow. |
| `tests/litesvm_edge.rs` | Short-day end-to-end flow (600 s day). One-tx `[claim(d-1), commit(d)]` with one signer. Every reachable error path (§7). Config snapshots. Pause semantics. Void. Account substitution. Token-2022 mint allow-list. Upgrade-authority-gated init. |
| `tests/litesvm_sgt.rs` | Real mainnet SGT fixtures: gate on/off, counterfeit mint, one device one commit per day, SGT path in the one-tx daily loop. |
| `tests/litesvm_invariants.rs` | Seeded, model-based randomized test: 4 × 64 = 256 scenarios, ≈ 28k transactions. Invariants §6 are checked after EVERY transaction. The model covers revocation (refund-only), pause accounting and deadline extension, the finalize review window, per-day trust snapshots and the order-independent streak (an independent completed-day set checked bit by bit against the on-chain mask). `FITR_FUZZ_SCENARIOS` / `FITR_FUZZ_SEED` scale it. |
| `tests/regression.rs` | The 2026-10 audit PoCs (AUD-AT-1, F1–F4, SM-1–SM-3), ported and inverted: each attack must now fail and honest users keep their principal (§11). |

LiteSVM uses the old default rent of 6,960 lamports per byte. Mainnet uses 5,080. Tests never assert
rent-dependent lamports.

## 2. Accounts and PDAs

All sizes include the 8-byte Anchor discriminator. Every account has a `version` byte (currently 1)
and zeroed `reserved` padding for future fields.

Rent figures use mainnet's 5,080 lamports per byte: `(128 + size) × 5080`. Clients must call
`getMinimumBalanceForRentExemption` rather than hardcode a rate.

| Account | Seeds | Size | Rent (lamports) | Created / closed by |
|---|---|---|---|---|
| `Pool` | `["pool", mint]` | 476 | 3,068,320 | `initialize_pool` (upgrade authority pays); never closed |
| vault token account | `["vault", pool]` (authority = pool PDA) | 165 | 1,488,440 | `initialize_pool`; never closed |
| `DayState` | `["day", pool, day_index u32 LE]` | 270 | 2,021,840 | the day's first `commit` (that user pays); closed by `sweep_day`, rent → `rent_payer` |
| `Commitment` | `["commitment", pool, user, day_index u32 LE]` | 224 | 1,788,160 | `commit` (user pays); closed by `claim` / `close_missed`, rent → user |
| `UserProfile` | `["profile", pool, user]` | 153 | 1,427,480 | first `commit` (user pays); never closed |
| `DeviceLock` | `["device", pool, sgt_mint]` | 134 | 1,330,960 | `register_device` (user pays); never closed |

A user's very first commit on a new day creates three accounts: DayState (if they are first),
Commitment and UserProfile. That is about 0.0052 SOL of rent at most; the Commitment and DayState
parts come back later. The wallet needs that SOL in addition to the stake.

### 2.1 Pool (476 bytes)
`version u8, bump u8, vault_bump u8, paused bool, require_sgt bool, mint_decimals u8,`
`authority, pending_authority, attestor, mint, vault: Pubkey,`
`day_length_secs i64 (IMMUTABLE), day_offset_secs i64 (IMMUTABLE), commit_cutoff_secs i64, attest_grace_secs i64,`
`min_stake u64, max_stake u64, fee_bps u16, streak_bonus_bps u16, max_streak_bonus_bps u16,`
`goal_limits [GoalLimits{min u32, max u32}; 16] (indexed by Exercise code 0..15, §2.6),`
`daily_sponsor_amount u64, reserve u64, treasury_accrued u64, outstanding u64,`
`finalize_delay_secs i64, paused_since i64, total_paused_secs i64, reserved [u8; 64]`

Layout notes: `goal_limits` grew from 3 to 16 entries (348 → 452 bytes), and the audit fixes
appended `finalize_delay_secs`, `paused_since` and `total_paused_secs` (452 → 476), all **before**
any mainnet deploy, so `version` stays 1. After deploy, layouts are append-only (reserved bytes +
version bump).

Pool byte offsets (incl. discriminator; changed when goal_limits grew from 3 to 16 entries, so
fields after it moved by +104): authority 14, pending_authority 46, attestor 78, mint 110, vault 142,
day_length_secs 174, day_offset_secs 182, commit_cutoff_secs 190, attest_grace_secs 198,
min_stake 206, max_stake 214, fee_bps 222, streak_bonus_bps 224, max_streak_bonus_bps 226,
**goal_limits 228** (8 bytes per exercise: min u32 LE, max u32 LE), daily_sponsor_amount 356, reserve 364,
treasury_accrued 372, outstanding 380, finalize_delay_secs 388, paused_since 396,
total_paused_secs 404, reserved 412..476. Read the Pool with the generated decoder, not by offset.

The accounting fields mean:
- `outstanding`: the sum over live days of what is still owed to that day's committers.
- `reserve`: sponsor deposits, plus the net forfeits of days with zero completers, plus rounding dust.
- `treasury_accrued`: fees. It is the ONLY balance the authority can ever withdraw.
- `paused_since` / `total_paused_secs`: pause accounting. `paused_since` is the start of the
  current pause (0 when not paused); `total_paused_secs` sums every finished pause. Together they
  extend the attest window of live days (§3).

### 2.2 DayState (270 bytes)
`version u8, bump u8, finalized bool, voided bool, pool Pubkey, day_index u32, rent_payer Pubkey,`
`fee_bps u16, streak_bonus_bps u16, max_streak_bonus_bps u16, attest_deadline i64,` (a rules snapshot, taken when the day is created)
`committed_count u32, completed_count u32, resolved_count u32, total_staked u64, completed_stake u64, completed_weight u64,`
`fee u64, sponsor u64, distributable u64,` (fixed at finalize)
`principal_paid u64, bonus_paid u64,`
`attestor Pubkey, sponsor_cap u64, finalize_delay_secs i64, paused_secs_base i64,` (trust snapshot, taken when the day is created)
`revoked_count u32, revoked_stake u64, reserved [u8; 32]`

Offsets (incl. discriminator) of the appended fields: attestor 170, sponsor_cap 202,
finalize_delay_secs 210, paused_secs_base 218, revoked_count 226, revoked_stake 230, reserved 238..270.
Everything before them is unchanged (pool 12, day_index 44).

Because of the snapshot, `update_config` can never change the fee, streak, deadline, attestor,
sponsor cap or finalize delay of a day that already has stakes. `paused_secs_base` is
`pool.total_paused_secs` at creation, so only pauses after the day exists extend it.

### 2.3 Commitment (224 bytes)
`bump u8, status CommitmentStatus{Committed=0, Completed=1, Revoked=2}, pool Pubkey, user Pubkey, day_index u32,`
`version u8, exercise Exercise (one byte, code 0..15, §2.6), goal_target u32, amount u64, weight u64,`
`committed_at i64, attested_at i64, session_started_at i64, reps u32, session_hash [u8; 32], device Pubkey, reserved [u8; 32]`

- `goal_target` and `reps` are **seconds** for the timed holds (Plank, WallSit) and reps for every
  other exercise (one rep per leg for Lunge/HighKnees, one per knee drive for MountainClimber).
- `weight` is 0 until attested, and 0 again once revoked.
- `Revoked` (2) is a completion undone by `revoke_completion`. It is never forfeited: `claim`
  returns the principal only, with no bonus.
- `device` is the SGT mint used, or the default pubkey when SGT is off.

### 2.4 Commitment byte offsets (FROZEN; used by getProgramAccounts memcmp)

| Offset | Size | Field |
|---|---|---|
| 0 | 8 | discriminator `sha256("account:Commitment")[..8]` |
| 8 | 1 | bump |
| 9 | 1 | status (0 Committed, 1 Completed, 2 Revoked) |
| **10** | 32 | **pool** |
| 42 | 32 | user |
| **74** | 4 | **day_index** (u32 little-endian) |
| 78 | 1 | version |
| 79 | 1 | exercise |
| 80 | 4 | goal_target (u32 LE) |
| 84 | 8 | amount (u64 LE) |
| 92 | 8 | weight |
| 100 | 8 | committed_at |
| 108 | 8 | attested_at |
| 116 | 8 | session_started_at |
| 124 | 4 | reps |
| 128 | 32 | session_hash |
| 160 | 32 | device |
| 192 | 32 | reserved |

To find all commitments of pool P for day d, filter on:
- `dataSize = 224`;
- `memcmp {offset 10, bytes P}`;
- `memcmp {offset 74, bytes u32le(d)}`.

Add `memcmp {offset 9, bytes [0]}` to keep only unattested ones (the `close_missed` crank).

For DayState, pool is at offset 12 and day_index at 44. For UserProfile, pool is at 10 and user at 42.

### 2.5 UserProfile (153) and DeviceLock (134)
- `UserProfile`: `version, bump, pool, user, current_streak u16, best_streak u16, has_completed bool, last_completed_day u32, total_committed u32, total_completed u32, total_missed u32, total_bonus_earned u64, completed_days_mask u64, streak_carry u16, last_completed_amount u64, reserved [u8;32]`.
  - `completed_days_mask` bit i is set when day `last_completed_day − i` is completed (attested and
    not revoked); `streak_carry` is the exact streak ending at `last_completed_day − 64`, just below
    the window. The streak ending at any recent day is read from these, so the order in which the
    attestor submits days does not matter (an attestation more than 63 days behind the newest one
    counts as streak 1).
  - `last_completed_amount` is the stake completed on `last_completed_day`: the streak-boost basis
    for the next day (§5).
- `DeviceLock`: `version, bump, pool, sgt_mint, last_wallet, commit_count u32, recent_days [u32; 2], reserved [u8;16]`.
  - It keeps the two highest committed days.
  - Commits are only possible for today or tomorrow, so checking those two days is exact.

### 2.6 Exercise codes (FROZEN; Borsh enum = one byte)

The code is stored in `Commitment.exercise` (offset 79) and indexes `Pool.goal_limits`. Variants are
only ever appended; never reorder. An unknown byte (16..=255) fails instruction deserialization
(Anchor error 102).

| Code | Variant | Unit | Hard ceiling | Mainnet min |
|---|---|---|---|---|
| 0 | Pushup | reps | 1,000 | 10 |
| 1 | Squat | reps | 1,000 | 15 |
| 2 | Plank | seconds | 3,600 | 30 |
| 3 | Lunge | reps (each leg 1) | 1,000 | 10 |
| 4 | Situp | reps | 1,000 | 10 |
| 5 | LegRaise | reps | 1,000 | 10 |
| 6 | GluteBridge | reps | 1,000 | 10 |
| 7 | WallSit | seconds | 3,600 | 30 |
| 8 | PikePushup | reps | 1,000 | 5 |
| 9 | JumpSquat | reps | 1,000 | 10 |
| 10 | Pullup | reps | 1,000 | 3 |
| 11 | Dip | reps | 1,000 | 5 |
| 12 | Burpee | reps | 1,000 | 5 |
| 13 | MountainClimber | reps (each knee drive 1) | 3,000 | 20 |
| 14 | JumpingJack | reps | 3,000 | 20 |
| 15 | HighKnees | reps (each knee 1) | 3,000 | 20 |

Ceilings are hard-coded (`Exercise::goal_ceiling`): `GOAL_SECS_CEILING` 3,600 for timed holds,
`GOAL_HIGH_VOLUME_REPS_CEILING` 3,000 for the three high-volume cardio/limb counters, and
`GOAL_REPS_CEILING` 1,000 for everything else. `EXERCISE_COUNT = 16`.

## 3. Day windows

```
day_index_at(ts) = floor((ts - day_offset_secs) / day_length_secs)      (ts < offset -> ClockBeforeOffset)
day_start(d)     = d * day_length_secs + day_offset_secs
day_end(d)       = day_start(d + 1)
commit  d:  d ∈ {today, today+1}  and  now < day_start(d) + commit_cutoff_secs
pause_ext(d)        = paused_secs_total(now) − DayState.paused_secs_base
                      (paused_secs_total = total_paused_secs + (now − paused_since if paused))
effective_deadline  = DayState.attest_deadline + pause_ext(d)
                      (attest_deadline = day_end(d) + attest_grace_secs at day creation)
attest  d:  !paused and now <= effective_deadline, signer == DayState.attestor,
            and committed_at <= session_started_at, day_start(d) <= session_started_at < day_end(d),
            session_started_at <= now, reps >= goal_target
revoke  d:  now <= effective_deadline; signer == pool.authority (any time) or DayState.attestor (not while paused)
review  d:  effective_deadline < now <= effective_deadline + DayState.finalize_delay_secs:
            attest/revoke closed, void_day open, finalize not yet
finalize d: !paused and now > effective_deadline + DayState.finalize_delay_secs (permissionless)
void    d:  any time before finalize (authority)
sweep d:    (finalized or voided) and now > attest_deadline and resolved_count == committed_count
```

A pause therefore never runs out a pending attestation: it blocks attest and finalize, and when it
ends every live day's attest window has grown by the time spent paused.

Bounds, checked by `Pool::validate` on init and after every `update_config`:

| Field | Rule |
|---|---|
| `day_length_secs` | 300 ≤ len ≤ 86,400. Immutable. |
| `day_offset_secs` | 0 ≤ offset < len. Immutable. |
| `commit_cutoff_secs` | 0 ≤ cutoff ≤ len − len/24. For a 24 h day that is 23 h, so 1/24 of the day always remains to work out. |
| `attest_grace_secs` | 0 ≤ grace ≤ min(6 h, len) |
| `finalize_delay_secs` | 0 ≤ delay ≤ min(12 h, len) |
| `daily_sponsor_amount` | ≤ `max_stake` (one day can never drain more than one max stake from the reserve) |
| `attestor` | ≠ default and **≠ `authority`** (also re-checked by `accept_authority`) |

The bank clock is a stake-weighted median of validator votes and can drift from wall time by up to
25 % fast or 150 % slow relative to PoH-expected time. Keep the grace ≥ 30 min. Cranks retry
`DayNotOver` (6009).

## 4. Instructions

| # | Instruction | Args | Signer(s) | Notes |
|---|---|---|---|---|
| 1 | `initialize_pool` | `p: InitPoolParams` | authority = the **program upgrade authority** (checked against `program_data`) | Creates Pool and vault. Rejects mints with > 9 decimals and Token-2022 extensions outside the allow-list (MetadataPointer, TokenMetadata, GroupPointer, TokenGroup, GroupMemberPointer, TokenGroupMember, MintCloseAuthority). This blocks transfer fees, transfer hooks, permanent delegates, default-frozen accounts and non-transferable mints. |
| 2 | `update_config` | `p: UpdateConfigParams` (all `Option`) | pool authority | Attestor rotation, stake/goal rails, fee, streak, cutoff, grace, sponsor, `paused` (with pause-time accounting), `require_sgt`, `finalize_delay_secs`. Day geometry is immutable. Re-validates the whole config. Affects only days created afterwards, except that pausing extends live days' attest windows. |
| 3 | `propose_authority` | `new_authority` | pool authority | Two-step transfer. `Pubkey::default()` cancels. |
| 4 | `accept_authority` | – | pending authority | Re-validates, so the attestor can never become the authority. |
| 5 | `register_device` | – | **user only** (payer) | SGT must be a Token-2022 mint that is a member of group `GT22s89n…` and whose metadata pointer is that group. The token account is owned by the user with amount == 1. Frozen SGT accounts are accepted, because real ones are frozen. |
| 6 | `commit` | `day_index u32, amount u64, exercise Exercise, goal_target u32` | **user only** (payer) | Rejected when paused. Window rules from §3. `min_stake ≤ amount ≤ max_stake`. `goal_limits[exercise].min ≤ goal_target ≤ max`. When `require_sgt`: the SGT token account (Token-2022, mint = device.sgt_mint, owner = user, amount 1) plus that device's DeviceLock, at most one commit per device per day. DayState and UserProfile use init-if-needed. Commitment uses `init`, so a double commit fails. `transfer_checked` user → vault. |
| 7 | `attest_completion` | `day_index, reps u32, session_hash [u8;32], session_started_at i64` | the day's snapshotted attestor (`DayState.attestor`) | Rejected when paused. Day must not be finalized or voided, and now ≤ effective deadline. Status must be Committed. Session time rules from §3. **`reps ≥ goal_target` (else `GoalNotMet`)**. Sets the weight (§5) and updates the streak mask. |
| 8 | `revoke_completion` | `day_index` | authority, or the day's attestor when not paused | Only before finalize and the effective deadline. Completed → **Revoked**: aggregates move to `revoked_count/stake`, the day's bit is cleared from the streak mask. A revoked stake is refunded, never forfeited. |
| 9 | `finalize_day` | `day_index` | anyone (crank) | Not while paused; after the effective deadline + `finalize_delay_secs`. Fixes fee, sponsor and distributable (§5). |
| 10 | `void_day` | `day_index` | pool authority | Only before finalize, i.e. also during the review window and while paused. Everyone can then claim principal back, with no forfeits. |
| 11 | `claim` | `day_index` | **user only** (payer) | Voided day: principal. Finalized day: Completed → principal + bonus; Revoked → principal. Closes the Commitment to the user, so it cannot pay twice. The destination is any token account of the mint except the vault. |
| 12 | `close_missed` | `day_index` | anyone; the user can sign alone | Finalized day and a Committed (missed) commitment. Refunds rent only, because the stake was counted as forfeited at finalize. Resets the streak. |
| 13 | `sweep_day` | `day_index` | anyone | Moves dust to the reserve and closes the DayState, with rent going to `rent_payer`. |
| 14 | `fund_reserve` | `amount u64` | anyone | Sponsor deposit. It is drawn only through each day's `sponsor_cap` snapshot of `daily_sponsor_amount` (≤ `max_stake`; 0 on mainnet). |
| 15 | `withdraw_treasury` | `amount u64` | pool authority | `amount ≤ treasury_accrued`. Re-checks vault solvency after the transfer. The destination cannot be the vault. |

The user-facing instructions (`register_device`, `commit`, `claim`, `close_missed`) have the user
wallet as the ONLY signer and the fee payer. That is what MWA `signAndSendTransaction` needs.

The daily habit loop is one transaction, `[claim(d−1), commit(d)]`, or `[close_missed(d−1), commit(d)]`
after a miss. It is tested with one signer.

Compute units measured in LiteSVM (the SBF build is identical):

| Transaction | CU | Size |
|---|---|---|
| `commit`, first ever (creates DayState + Commitment + UserProfile) | 55,560 | |
| `commit`, existing day (new UserProfile) | 53,405 | |
| `commit`, SGT path, first ever | 56,640 | |
| `claim` | 31,824 | |
| `[claim(d−1), commit(d)]`, non-SGT | 78,194 (claim 31,824 + commit 46,370) | 582 B |
| `[claim(d−1), commit(d)]`, SGT path | 79,282 (claim 31,822 + commit 47,460) | 646 B, 1 signer |
| `[close_missed(d−1), commit(d)]` | 52,892 | 579 B |
| `attest_completion` | 16,464 | |
| `register_device` | 19,702 | |
| `finalize_day` | 11,862 | |
| `close_missed` | 13,179 | |
| `sweep_day` | 9,699 | |
| `withdraw_treasury` | 22,542 | |

Re-measured after the audit fixes (Pool 476 B, DayState 270 B, UserProfile 153 B); transaction
sizes are unchanged (no account lists changed). Clients should set the compute-unit limit to about
1.2 × these values: **120,000** covers the daily-loop transaction with a wide margin.

## 5. Reward math (per-day aggregate, pro-rata)

```
weight:    boost   = min((streak − 1) × streak_bonus_bps, max_streak_bonus_bps)     (day snapshot)
           basis   = stake completed on day d − 1 when d directly follows the newest completed day, else 0
           weight  = amount + floor(min(amount, basis) × boost / 10,000)
finalize:  slashed = total_staked − completed_stake − revoked_stake      (revoked stake is refunded)
           fee     = floor(slashed × fee_bps / 10,000)               (fee_bps snapshotted on the day)
           if completed_count == 0:  reserve += slashed − fee;  distributable = 0
           else: sponsor = min(DayState.sponsor_cap, reserve); distributable = slashed − fee + sponsor
           outstanding += sponsor − fee − to_reserve;  treasury_accrued += fee
claim:     Completed: bonus_i = floor(distributable × weight_i / completed_weight)   (u128 intermediates)
                      payout  = amount_i + bonus_i
           Revoked / voided day: payout = amount_i;    outstanding −= payout
sweep:     dust = distributable − bonus_paid  → reserve
```

- The streak boost only covers the part of today's stake that was also completed the day before,
  so a streak built with 1 SKR a day cannot boost a 10,000 SKR stake (audit F3). With
  basis ≥ amount the weight equals the plain floor(amount × (10,000 + boost) / 10,000). An
  attestation that arrives out of order (day d after d + 1) keeps the streak intact but gets no
  boost for itself, because the d − 1 stake is not on record; the attestor submits days in order.

- Every division floors, so Σ bonus ≤ distributable, and the dust is smaller than the number of completers.
- The goal size never enters the weight: a bigger goal earns no bigger share. It only raises the bar the user sets for themselves.
- If everyone completes, the bonus is 0 and everyone gets exactly their stake back.

**Worked example (`full_day_flow`):** 3 users stake 100 SKR each and 2 complete, with the fee at 5 %.
- Slashed 100, fee 5, distributable 95.
- Each completer receives 147.5 SKR.
- The treasury receives 5 SKR.
- After sweep, vault = outstanding = reserve = 0 once the treasury is withdrawn.

## 6. Invariants (asserted after every transaction in `litesvm_invariants.rs`)

| Id | Invariant |
|---|---|
| I1 | `vault.amount == outstanding + reserve + treasury_accrued`. On-chain the program enforces `>=` in `withdraw_treasury`; a direct donation can only make the left side larger. |
| I1b | `outstanding == Σ live DayState.liability()`. |
| I2 | Each commitment pays out at most once: it is closed on claim, and `init` stops re-creation while the commit window is closed. |
| I3 | Paid for day d (principal + bonus) ≤ `total_staked_d + sponsor_d`. |
| I4 | The authority receives tokens only via `withdraw_treasury` and never more than the accrued fees. The attestor never receives tokens. A revocation never creates forfeits. The reserve leaves only through a day's `sponsor_cap` snapshot (≤ `max_stake`). See §8 for what the attestor and authority *can* influence. |
| I5 | `completed_count/stake/weight`, `fee`, `sponsor` and `distributable` are immutable after finalize. Attest and revoke require `!finalized && now ≤ effective deadline`. |
| I6 | `bonus_paid ≤ distributable`. `completed_count`, `resolved_count` ≤ `committed_count`. `completed_stake + revoked_stake ≤ total_staked`. |
| I7 | Token conservation: users + vault + authority + funder == minted. |
| I8 | Every balance equals an independent model's floor-division result to the base unit. Every completed commitment has `reps ≥ goal_target`. |

Day geometry (`day_length_secs`, `day_offset_secs`) never changes.

## 7. Errors (codes = 6000 + index; append-only, never reorder)

| Code | Name | Code | Name |
|---|---|---|---|
| 6000 | Paused | 6015 | SgtRequired |
| 6001 | NotAuthority | 6016 | InvalidSgt |
| 6002 | NotAttestor | 6017 | DeviceAlreadyCommitted |
| 6003 | NotPendingAuthority | 6018 | DayNotResolved |
| 6004 | InvalidConfig | 6019 | InsufficientFunds |
| 6005 | UnsupportedMintExtension | 6020 | InsolventVault |
| 6006 | InvalidDay | 6021 | MathOverflow |
| 6007 | CommitWindowClosed | 6022 | ClockBeforeOffset |
| 6008 | AttestWindowClosed | 6023 | StakeOutOfBounds |
| 6009 | DayNotOver | 6024 | GoalOutOfBounds |
| 6010 | AlreadyFinalized | 6025 | GoalNotMet |
| 6011 | NotFinalized | 6026 | UnsupportedMintDecimals |
| 6012 | DayVoided | 6027 | NotUpgradeAuthority |
| 6013 | InvalidCommitmentState | 6028 | InvalidDestination |
| 6014 | InvalidSessionTime | | |

- 6000–6022 keep the prototype's order. 6023–6028 are new.
- Tests reach every code except two defensive ones:
  - 6020 `InsolventVault` is unreachable while the invariants hold;
  - 6021 `MathOverflow` is unreachable because of the stake ceiling: 1,000,000 tokens × 10^9 leaves about 18,000× headroom in u64 sums.

There are 15 events, emitted with `emit!` as program logs:
- `PoolInitialized`, `ConfigUpdated` (full post-update config incl. `finalize_delay_secs`), `AuthorityProposed`, `AuthorityTransferred`, `DeviceRegistered`;
- `Committed{amount, exercise, goal_target, device}`, `CompletionAttested{exercise, goal_target, reps, session_hash, weight, streak}`, `CompletionRevoked`;
- `DayFinalized{total_staked, completed_stake, revoked_stake, slashed, fee, sponsor, distributable, to_reserve}`, `DayVoided`, `Claimed{principal, bonus}`, `MissedSettled`, `DaySwept`;
- `ReserveFunded`, `TreasuryWithdrawn`.

## 8. Trust model and limits

- **Attestor.** It is a trusted key (hot, on the VPS). Each day snapshots the attestor at creation;
  only that key can attest or revoke (with the authority) on that day. What a compromised attestor
  key **can** do on the days it is snapshotted on:
  - mark fake completions, redirecting that day's genuine forfeits (95 %) and its sponsor draw
    (≤ `sponsor_cap`) to colluding completers;
  - **withhold** an honest user's attestation, which turns that user's stake into a forfeit unless
    the authority voids the day before it is finalized.

  What it can **not** do: receive tokens, touch the treasury, change any config, or turn a
  completion into a forfeit (`revoke_completion` makes a commitment Revoked = refund-only, and the
  attestor cannot revoke while paused). Mitigations:
  - the finalize review window (`finalize_delay_secs`, 4 h on mainnet): after the deadline,
    attest/revoke are closed but `void_day` stays open, so monitoring can catch a withheld or faked
    day and the multisig can void it before anyone can finalize;
  - `paused`: blocks attest, attestor revokes and finalize, and extends attest windows by the paused
    time, so pausing never forfeits anyone; then `void_day` or unpause;
  - `update_config{attestor}` rotation (applies to days created afterwards; void live days if the
    old key is compromised);
  - monitoring of `CompletionAttested` (§11 of the runbook).
- **Authority** (a Squads multisig on mainnet). It can:
  - change rails, the attestor, the sponsor tap (≤ `max_stake`) and the review window for days
    created afterwards;
  - pause commits, attests and finalize (never claims, `close_missed` or sweep);
  - revoke a completion (refund-only: the user loses the bonus share, never principal);
  - void an unfinalized day (everyone gets principal back);
  - withdraw fees.

  It cannot be the attestor (`attestor ≠ authority`, checked on every config change and on
  `accept_authority`) and cannot withdraw principal or the reserve. Its **indirect** power: by
  rotating the attestor to another key it controls, it controls attestation of days created
  after the rotation, i.e. the forfeits and sponsor draw (≤ `max_stake` per day) of those days,
  with the same limits as a compromised attestor. Rotations and config changes are public
  (`ConfigUpdated`) and every day's attestor is visible in its DayState, so clients can warn
  before a user commits.
- **Upgrade authority** (a Squads multisig on mainnet). It can replace the program, so it is the
  real root of trust; see MAINNET_RUNBOOK.md.
- **Residual cheating.** A delegated workout, a real-time pose synthesizer or a rooted device can
  still pass the attestor. The SGT gate limits Sybil farming to one commitment per Seeker per day,
  and the per-stake ceiling bounds the damage. Pitch: "cheat-resistant, backed by live challenges
  and on-chain rules", never "un-cheatable".

## 9. Mainnet parameters (InitPoolParams)

| Param | Value | Why |
|---|---|---|
| mint | `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` (classic SPL Token, 6 decimals) | $SKR |
| `min_stake` | 1,000,000 (1 SKR) | lowest meaningful commitment |
| `max_stake` | 10,000,000,000 (10,000 SKR) | rail; the hard ceiling is 1,000,000 SKR |
| `fee_bps` | 500 (5 % of forfeited stake only) | founder decision; ceiling 2,000 |
| `streak_bonus_bps` / `max_streak_bonus_bps` | 500 / 5,000 (+5 %/day, capped at +50 %) | founder decision; cap ceiling 10,000 |
| `day_length_secs` | 86,400 (immutable) | calendar day |
| `day_offset_secs` | 0 (days start 00:00 UTC; immutable) | founder may pick another offset **before** init |
| `commit_cutoff_secs` | 64,800 (commits for today close 18:00 UTC; tomorrow is always open) | leaves ≥ 6 h to work out after the last commit |
| `attest_grace_secs` | 3,600 (1 h after day end) | clock-drift and server-latency margin |
| `goal_limits` | 16 entries in code order (§2.6): min = the "Mainnet min" column; max = the hard ceiling (1,000 reps; 3,000 for MountainClimber/JumpingJack/HighKnees; 3,600 s for Plank/WallSit) | founder minimums; ceilings are hard-coded |
| `daily_sponsor_amount` | 0 | no emissions |
| `require_sgt` | true | one commitment per Seeker per day |
| `attestor` | the verification server's public key (≠ authority) | rotate with `update_config`; applies to days created afterwards |
| `finalize_delay_secs` | 14,400 (4 h review window after the attest deadline; finalize from 05:00 UTC) | time for monitoring + the 2-of-3 multisig to void a bad day; ceiling 12 h |

The devnet/localnet demo uses the same values except `day_length_secs = 600`,
`commit_cutoff_secs = 540`, `attest_grace_secs = 60`, `finalize_delay_secs = 60` and
`require_sgt = false`.

## 10. Residual cheating and fairness notes

- A completer (or any committer on a voided day, or a Revoked commitment) who never claims keeps
  that DayState open: `sweep_day` needs every commitment resolved, so the day's dust and the first
  committer's DayState rent (≈ 0.002 SOL) stay locked. Principal is never at risk and claims never
  expire, so a late claim unblocks the sweep at any time. Accepted (audit SM-3): a permissionless
  "push-claim" would add a new fund-moving path for a rent-sized benefit.
- A day's fee and streak rules are snapshotted by whoever creates the DayState (the day's first
  commit, up to about two days ahead). A pending fee change can therefore be front-run for one day.
  Bounded by `MAX_FEE_BPS` (20 %) and one day; clients show the DayState snapshot, not the pool's
  current values, once the day exists. Accepted (audit F5).
- `revoke_completion(d)` does not change a weight already stored on a later day d + 1 that was
  attested before the revoke (its boost used the streak at that time). Bounded by one day's boost.

## 11. Audit fixes (2026-10)

| Finding | Severity | Fix | Regression test (`tests/regression.rs`) |
|---|---|---|---|
| AUD-AT-1: authority alone redirects principal + reserve (attestor rotation + revoke + unbounded sponsor) | high | attestor and sponsor cap snapshotted per day; `attestor ≠ authority`; `daily_sponsor_amount ≤ max_stake`; revoke is refund-only | `aud_at_1_authority_cannot_steal_principal_and_reserve` |
| SM-1: attestor key revokes honest completers, finalizes at deadline + 1 before void | high | revoke → Revoked (refund-only); attestor cannot revoke while paused; finalize review window | `sm1_attestor_revoke_cannot_steal_honest_principal`, `review_window_allows_void_after_deadline` |
| F2: authority captures principal + reserve via attestor rotation | medium | as AUD-AT-1 | `f2_authority_cannot_capture_principal_or_reserve_via_attestor_rotation`, `attestor_rotation_is_snapshotted_per_day` |
| F1 / SM-2 / AUD-AT-2: pause across the deadline forfeits pending honest users | medium / low | finalize blocked while paused; pause time extends attest windows; void stays possible | `f1_pause_through_deadline_cannot_forfeit_and_void_still_works`, `sm2_pause_across_deadline_extends_the_attest_window` |
| F3: streak earned on 1 SKR boosts a 10,000 SKR stake | medium | boost only on min(amount, stake completed the day before) | `f3_min_stake_streak_does_not_boost_max_stake` |
| F4: out-of-order attestation collapses the streak | low | per-day completion mask + carry; order-independent streak | `f4_out_of_order_attestation_keeps_the_streak` |
| F5: front-running a fee change for one day | low | accepted, §10 | – |
| SM-3: a non-claimer blocks sweep forever | low | accepted, §10 | `sm3_late_claim_still_pays_and_unblocks_sweep` |
