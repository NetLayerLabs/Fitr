# fitr-vault mainnet runbook

This program holds **real user money (SKR) on Solana mainnet**. Every step below that touches mainnet is
run by the founder, by hand, after reading it. Agents and CI never deploy, never transact on mainnet and
never hold mainnet keys.

- Program id: `9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY`
- Stake mint: `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` (SKR, classic SPL Token, 6 decimals)
- Spec: `anchor/SPEC.md`. Parameters: SPEC §9.

---

## 0. What the FOUNDER must do (checklist)

1. **Secure the program keypair now.**
   - Where it is: `/private/tmp/claude-501/…/scratchpad/keys/fitr_vault-program-keypair.json`.
   - Why it is urgent: macOS deletes `/private/tmp` files after a few days. That is how the first
     prototype's sources were lost.
   - What to do: copy it into a password manager or an encrypted offline drive, then delete the tmp
     copy.
   - Whoever holds this file before the first deploy can deploy to the program id; it does not grant
     upgrade rights afterwards.
2. **Create a Squads v4 multisig** at app.squads.so:
   - members: your Seeker wallet, a hardware wallet and one more device you control;
   - threshold 2-of-3;
   - note the **vault (index 0) address**; that is `SQUADS_VAULT` below;
   - fund the vault with about 0.05 SOL for multisig transaction fees.
3. **Create a fresh deployer keypair** (`DEPLOYER`) on your own machine:
   ```
   solana-keygen new -o ~/fitr-keys/deployer.json
   ```
   Fund it with **3.6 SOL** (§3). It is a hot key used once, for about one minute. Afterwards, empty
   it back to your wallet.
4. **Generate the attestor key on the VPS** (never on a laptop, never in the repo). Put it in
   `ATTESTOR_KEYPAIR` in the server env and give its **public key** to step 6. Fund it with about
   0.1 SOL for attest and crank fees.
5. Install `solana-verify` (`cargo install solana-verify`) and keep Docker running.
6. Run §4 to §7, in order, in one sitting (about 30 minutes).
7. Push the exact deployed commit to the public GitHub repo, then run §8 (verification).
8. Do the §9 canary with **your own** 1 SKR before telling anyone the app is live.
9. Re-audit: one full audit round was budgeted. Any later program change goes through the same
   build, verify and Squads-upgrade path (§10.5).

---

## 1. Pre-flight (local, no network)

```bash
cd /path/to/fitr
npm run anchor:test                 # all unit + LiteSVM tests green (incl. 256 randomized scenarios)
npm run codegen:vault -- --check    # IDL + generated TS client in sync
git status                          # clean, on the commit you will deploy
solana-keygen pubkey anchor/target/deploy/fitr_vault-keypair.json
#   must print 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY (restore the keypair there from your backup)
grep -n declare_id anchor/programs/fitr-vault/src/lib.rs   # same id
```

Optional but recommended: rehearse §4 to §7 on `solana-test-validator`. Use a local test mint for SKR
and `require_sgt = false`.

## 2. Verifiable build (Docker)

Mainnet must run a binary that anyone can rebuild from the public repo.

```bash
cd anchor
solana-verify build --library-name fitr_vault --base-image solanafoundation/solana-verifiable-build:2.1.0
#   Builds the workspace inside Docker with Solana 2.1.0 (same toolchain as local),
#   output: target/deploy/fitr_vault.so (replaces the `anchor build` artifact)
solana-verify get-executable-hash target/deploy/fitr_vault.so    # record this hash
ls -l target/deploy/fitr_vault.so                                # record the size (bytes)
```

- I did not run `solana-verify` here: it is not installed, and the `--base-image` flag spelling was
  not checked. If your version rejects that flag, drop it and let `solana-verify` pick its Solana
  2.1.x image. Do not change the toolchain to make the build pass.
- The committed `Cargo.lock` and `rust-version = "1.79"` make the build reproducible. Never run
  `cargo update` before a deploy.
- Deploy **this** `.so`, not the one `anchor build` produced. The IDL is unaffected:
  `anchor/target/idl/fitr_vault.json` from `npm run anchor:build`.

## 3. Cost (exact formula; mainnet rent = 5,080 lamports per byte incl. 128-byte header)

The `anchor build` binary is **595,808 bytes** (16-exercise build). Re-run the formula with the verifiable build's size.

| Item | Formula | Lamports | SOL |
|---|---|---|---|
| ProgramData account at 1× size (CLI default `--max-len`) | (128 + 45 + 595,808) × 5,080 | 3,027,583,480 | **3.0276** |
| Program account | (128 + 36) × 5,080 | 833,120 | 0.0008 |
| Temporary buffer | (128 + 37 + 595,808) × 5,080 | 3,027,542,840 | 3.0275, drained back to the payer inside the deploy instruction |
| Write transactions | about 590 txs × 5,000 lamports + priority fee | about 3,000,000 plus priority | 0.003 to 0.05 |
| `initialize_pool` (Pool 452 B + vault 165 B rent) | (580 + 293) × 5,080 | 4,434,840 | 0.0044 |
| **Fund the deployer with** | | | **3.6 SOL**, net spend about 3.04 SOL |

- If the deploy aborts midway, the buffer keeps its SOL. Resume with `--buffer <BUFFER_KEYPAIR>`,
  or recover with `solana program close <BUFFER_ADDRESS>`.
- Later upgrades auto-extend ProgramData if the binary grows. The cost is 5,080 lamports per extra
  byte, and each upgrade needs a temporary buffer of the new size (refunded when the upgrade lands).
- Optional on-chain IDL (`anchor idl init`): about 0.1 SOL.

## 4. Deploy

Use a paid RPC (e.g. Helius) as `$RPC`. Never put the API key in shell history you share.

```bash
cd anchor
solana program deploy target/deploy/fitr_vault.so \
  --url "$RPC" \
  --keypair ~/fitr-keys/deployer.json \
  --program-id target/deploy/fitr_vault-keypair.json \
  --upgrade-authority ~/fitr-keys/deployer.json \
  --with-compute-unit-price 50000 \
  --use-rpc
# expect: Program Id: 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY
solana program show 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY --url "$RPC"
#   Authority must be the deployer pubkey (for the next ~minute only)
```

## 5. Initialize the pool (immediately)

`initialize_pool` only accepts the **program upgrade authority** as signer. The program checks
`program_data.upgrade_authority_address`, so nobody can front-run the canonical
`["pool", SKR]` PDA. Run it now, while the deployer is still the upgrade authority.

The init-pool script is written by the ops package. It is built on the generated client
(`getInitializePoolInstructionAsync`). Pass exactly the SPEC §9 values:

```jsonc
{
  "attestor": "<ATTESTOR_PUBKEY from the VPS>",
  "min_stake": 1000000,            // 1 SKR
  "max_stake": 10000000000,        // 10,000 SKR
  "fee_bps": 500,
  "streak_bonus_bps": 500,
  "max_streak_bonus_bps": 5000,
  "day_length_secs": 86400,        // IMMUTABLE
  "day_offset_secs": 0,            // IMMUTABLE (00:00 UTC day boundary)
  "commit_cutoff_secs": 64800,
  "attest_grace_secs": 3600,
  // 16 entries, index = Exercise code (SPEC §2.6). Order is FROZEN.
  "goal_limits": [
    {"min":10,"max":1000},  //  0 Pushup
    {"min":15,"max":1000},  //  1 Squat
    {"min":30,"max":3600},  //  2 Plank (s)
    {"min":10,"max":1000},  //  3 Lunge
    {"min":10,"max":1000},  //  4 Situp
    {"min":10,"max":1000},  //  5 LegRaise
    {"min":10,"max":1000},  //  6 GluteBridge
    {"min":30,"max":3600},  //  7 WallSit (s)
    {"min":5,"max":1000},   //  8 PikePushup
    {"min":10,"max":1000},  //  9 JumpSquat
    {"min":3,"max":1000},   // 10 Pullup
    {"min":5,"max":1000},   // 11 Dip
    {"min":5,"max":1000},   // 12 Burpee
    {"min":20,"max":3000},  // 13 MountainClimber
    {"min":20,"max":3000},  // 14 JumpingJack
    {"min":20,"max":3000}   // 15 HighKnees
  ],
  "daily_sponsor_amount": 0,       // must be <= max_stake
  "require_sgt": true,
  "finalize_delay_secs": 14400     // 4 h review window after the attest deadline (<= 12 h)
}
```

`attestor` must differ from the deployer and from the Squads vault: the program rejects
`attestor == authority` at init, on every `update_config` and on `accept_authority`.

The signer and payer is the deployer. The accounts are: mint = SKR, token_program = classic SPL Token
`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`, and program_data = the PDA of `[program_id]` under
`BPFLoaderUpgradeab1e11111111111111111111111` (the generated client derives it).

Day geometry can never be changed afterwards. Double-check `day_offset_secs` before signing.

## 6. Move upgrade authority to Squads (immediately after §5)

```bash
solana program set-upgrade-authority 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY \
  --url "$RPC" --keypair ~/fitr-keys/deployer.json \
  --upgrade-authority ~/fitr-keys/deployer.json \
  --new-upgrade-authority <SQUADS_VAULT> \
  --skip-new-upgrade-authority-signer-check
solana program show 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY --url "$RPC"   # Authority == SQUADS_VAULT
```

`--skip-new-upgrade-authority-signer-check` is required because a PDA cannot sign. **Paste the vault
address from the Squads UI; a typo here is unrecoverable.**

## 7. Move pool authority to Squads

1. Deployer signs `propose_authority(new_authority = SQUADS_VAULT)`.
2. In Squads, create a custom transaction calling `accept_authority` with accounts
   `[new_authority = SQUADS_VAULT (signer), pool = <POOL_PDA> (writable)]`. Approve it 2-of-3 and
   execute it.
3. Check that `Pool.authority == SQUADS_VAULT` and `pending_authority == 11111111111111111111111111111111`.
4. Empty the deployer back to your wallet:
   ```
   solana transfer <YOUR_WALLET> ALL --keypair ~/fitr-keys/deployer.json --url "$RPC"
   ```
   It no longer controls anything.

From here on, pause, void, attestor rotation, config and fee withdrawal are all Squads transactions.

## 8. Post-deploy checks

| Check | Expected |
|---|---|
| `solana program show <ID>` | Authority = SQUADS_VAULT; data length = .so size |
| `solana-verify get-program-hash <ID> --url $RPC` | == the hash recorded in §2 |
| `solana-verify verify-from-repo --remote --program-id <ID> https://github.com/<you>/fitr --library-name fitr_vault --mount-path anchor --commit-hash <deployed commit>` | Verified (the OtterSec API shows the "verified" badge on explorers) |
| Pool PDA `["pool", SKR]` decoded with the generated `fetchPool` | every field equals §5; `version 1`, `paused false`, `reserve = treasury_accrued = outstanding = 0`, `paused_since = total_paused_secs = 0`, `finalize_delay_secs = 14400`, `authority = SQUADS_VAULT`, `attestor = server key` |
| Vault PDA `["vault", pool]` | SPL token account, mint = SKR, owner = pool PDA, amount 0 |
| App `.env` | `NEXT_PUBLIC_*` program id / mint / cluster point at mainnet; the server's attestor pubkey == `Pool.attestor` |

## 9. Canary (founder's own money, before launch)

1. In the app on your Seeker: register the device, then commit 1 SKR for today (push-ups, 10).
2. Do the workout. The server attests: check that `CompletionAttested` is in the tx logs.
3. Second wallet, second Seeker if available (otherwise set `require_sgt` off just for the canary
   via Squads): commit 1 SKR and skip the workout.
4. After `day_end + 1 h` (grace) `+ 4 h` (review window) the crank runs `finalize_day`. Then claim:
   - expected payout = 1 + (1 × 0.95) = 1.95 SKR;
   - `treasury_accrued` = 0.05 SKR.
5. Run `close_missed` and `sweep_day`, then check `vault.amount == outstanding + reserve + treasury_accrued`.

## 10. Operations playbooks (all via Squads unless noted)

### 10.1 Pause (incident, suspected exploit)
- Call `update_config{ paused: Some(true) }`.
- This blocks `commit`, `attest_completion`, attestor-signed `revoke_completion` and
  **`finalize_day`**. Claims, `close_missed`, sweep and authority-signed revoke/void keep working,
  so users can always exit from days that are already final.
- Time spent paused is added to the attest window of every live day (the program tracks
  `paused_since` / `total_paused_secs`). A pause therefore never forfeits a user whose attestation
  was pending: after unpausing, the attestor still has the rest of the window.
- Unpause with `paused: Some(false)`. Before unpausing, `void_day` any live day you do not trust.

### 10.2 Attestor compromised or misbehaving
1. Pause (10.1). The attestor can then neither attest nor revoke, and nobody can finalize.
2. For a fake completion on a live day, the authority may `revoke_completion` it. Revocation is
   refund-only (status Revoked): the user gets the principal back without a bonus, so revoking can
   never hurt an honest user's principal.
3. For a day with doubtful attestations, call `void_day(d)` (allowed until finalize, including the
   review window and while paused). Everyone then gets principal back.
4. Generate a new attestor key on the VPS, then call `update_config{ attestor: Some(NEW) }`. The
   new key only applies to days **created after** the rotation: every live day keeps the attestor
   it snapshotted, so void the live days the old key could still touch.
5. Update `ATTESTOR_KEYPAIR` on the server and restart it. Unpause.

Finalized days cannot be changed. The review window (`finalize_delay_secs`, 4 h) after each day's
attest deadline is the time to catch abuse: attest/revoke are closed, `void_day` is still open and
nobody can finalize. Monitor the `CompletionAttested` rate and compare each day's completions with
the server's own session log before the window ends.

### 10.3 Attestor or server outage
- Days whose (pause-extended) deadline passes without attestations would forfeit honest users.
  Either pause before the deadline (the window is extended for as long as the pool stays paused,
  and the attestor catches up after unpausing) or call `void_day(d)` before the day is finalized;
  everyone is refunded.

### 10.4 Rotate pool authority (new multisig)
- Run `propose_authority(NEW)` from the old Squads, then `accept_authority` from the new one.
- Call `propose_authority(11111111111111111111111111111111)` to cancel.

### 10.5 Program upgrade
1. Get the code change reviewed and audited.
2. Run `npm run anchor:test`, then the verifiable build (§2).
3. `solana program write-buffer target/deploy/fitr_vault.so --url $RPC --keypair <payer>`.
4. `solana program set-buffer-authority <BUFFER> --new-buffer-authority <SQUADS_VAULT>`.
5. In the Squads "Programs" tab, propose the upgrade, approve it 2-of-3 and execute it.
6. Run `solana-verify verify-from-repo` again on the new commit.

Rules:
- Account layouts are append-only: use `reserved` bytes and bump `version`.
- Error codes are append-only.
- Never reorder enum variants.

### 10.6 Fees
- `withdraw_treasury(amount ≤ treasury_accrued)` to a Squads-owned SKR token account.
- The program re-checks vault solvency after the transfer.

### 10.7 Config changes
- `update_config` affects only days created afterwards: the fee, streak, attest deadline,
  attestor, sponsor cap (`daily_sponsor_amount`) and `finalize_delay_secs` are snapshotted per day.
  The only exception is pausing, which extends live days' attest windows.
- Every field is re-validated against the hard ceilings:
  - fee ≤ 20 %;
  - streak cap ≤ +100 %;
  - stake ≤ 1,000,000 SKR;
  - goals ≤ 1,000 reps (3,000 for MountainClimber/JumpingJack/HighKnees) / 3,600 s (Plank, WallSit);
  - cutoff ≤ 23 h;
  - grace ≤ 6 h;
  - finalize delay ≤ 12 h;
  - daily sponsor ≤ max stake;
  - attestor ≠ authority.

## 11. Monitoring (server cron, read-only)

- **Solvency:** check `vault.amount ≥ Pool.outstanding + Pool.reserve + Pool.treasury_accrued`
  every 5 minutes. On failure, alert and pause.
- **Crank liveness:** every day `d` with `now > attest_deadline + pause extension + finalize_delay_secs`
  must reach `finalized` (never while paused), then every Commitment must be resolved, then the day
  is swept. The crank uses the SPEC §2.4 memcmp filters and retries 6009 `DayNotOver`.
- **Review window:** between a day's attest deadline and its finalize time, compare on-chain
  completions with the server's sessions; on a mismatch, pause and void (10.2).
- **Attestor:** watch the `CompletionAttested` count per hour against the server's own session
  count; a mismatch means a key leak.
- Watch the SOL balance of the attestor and crank key.

## 12. Key inventory

| Key | Where | Controls | After launch |
|---|---|---|---|
| Program keypair `9eYq…` | offline backup only | nothing after the first deploy (only the address) | keep the backup; never in the repo (`anchor/.gitignore` has `*-keypair.json`) |
| Deployer | founder laptop, temporary | upgrade + pool authority for about 1 minute | emptied, discarded |
| Squads vault (2-of-3) | Squads | program upgrades, pool config, pause, void, fees | permanent |
| Attestor | VPS env `ATTESTOR_KEYPAIR` | mark completions (no token access) | rotate via 10.2 |
| Crank payer | VPS | nothing (permissionless ixs) | top up SOL |
