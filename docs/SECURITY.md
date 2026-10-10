# Fitr security

Fitr holds other people's money, so it is built so that no single key, server or person can take
it. "Cheat-resistant" is the claim, not "cheat-proof"; the limits are listed at the end.

## Who controls what (onchain)
- **No single key controls the program or the pool.** Both the program's upgrade authority and the
  pool's admin authority belong to a Squads v4 multisig: 3 member wallets, 2 approvals for any
  change, and no config authority, so members can only
  change by a 2-of-3 vote. The deployer key that published the program was emptied and controls
  nothing.
- **The admin cannot take users' stakes.** Every payout path is fixed in the program. The admin can
  pause, void a day (everyone gets their own stake back) or change rules for *future* days. Each day
  snapshots its fee, deadlines, attestor and sponsor cap when it is created, so a rule change never
  touches a day already in progress.
- **The attestor key (on the server) is a separate, limited key.** It can only mark a workout
  complete, inside that day's window, for a session that started after the stake. It must differ
  from the admin. A revoked completion is refund-only, it can never hand someone else's stake to an
  attacker, and the attestor cannot act while the pool is paused.
- **The review window catches a bad server.** After verification closes there is a one-hour window
  in which the multisig can void the day before anything is claimable. Pausing never forfeits an
  honest user: paused time extends the deadlines.
- **One Seeker, one stake.** Staking checks a real Seeker Genesis Token (Token-2022 group member of
  the official SGT group, owned by the user) and a per-device lock, so one phone commits once per
  day per pool. A drawer of wallets does not multiply stakes.
- **Deleting a crew needs the creator's signature** and never touches funds: it hides the crew in
  the app only (see Crews).
- **Only plain SKR.** The pool accepts classic SPL Token mints, or Token-2022 mints with an
  allow-list of inert extensions, so a future transfer-hook or pausable extension cannot sneak in.

## Cheat resistance (offchain verification)
- Pose tracking runs on the phone; only skeleton points are sent, never video.
- The server replays those points through the same rep engine and rejects half-reps by joint angle.
- Random **live challenges** are revealed by the server at a random moment mid-set and must appear
  in the stream within seconds, which defeats pre-recorded clips. Side-on exercises (14 of 16) ask
  "Raise one hand above your head" (either hand: the far arm is hidden side-on); front-facing ones
  (pull-ups, jumping jacks, high knees) ask for the right or the left hand; squat-type exercises can
  also ask to "stand tall and hold still". A session cannot be reused across pools.
- Tracking-quality checks reject spliced or synthetic traces (joints teleporting across the frame,
  impossible bone lengths, reps faster than a human can do them, a trace running ahead of the
  server's clock) while tolerating the pose model's one-frame left/right swaps when filmed side-on.

## Verifiable build and deployment
- The deployed binary was built in the official `solanafoundation/solana-verifiable-build:2.1.0`
  Docker image from this repository's `anchor/` directory, so anyone can rebuild it and compare
  hashes: executable hash `648618ba7a61a3a59b367750e07bc512b6a3cf48ef40e6d242c40a4fd3037240`
  (`solana-verify get-program-hash 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY`).
- The deployment followed [`anchor/MAINNET_RUNBOOK.md`](../anchor/MAINNET_RUNBOOK.md) in one sitting:
  deploy; create the pool **paused** in the same transaction as its setup (so nobody could open a
  crew before the multisig took over); only the program's upgrade authority could create it, so it
  could not be front-run; hand the upgrade authority to Squads; hand the pool to Squads through a
  two-step propose / accept (the accept signed 2-of-3 in Squads); check that no crews existed;
  empty the deployer; unpause by a 2-of-3 Squads vote.
- Admin changes from here on are Squads proposals built by `scripts/solana/vault-admin.ts`
  (it prints the transaction for Squads to import; it never holds a multisig key).

## Testing and review
- **Vault program:** 79 Rust tests, including LiteSVM tests against real mainnet Seeker Genesis
  Token fixtures, and a seeded, model-based randomized test: 256 scenarios, about 31,000
  transactions across about 870 pools. After every transaction, the money invariants are checked
  for every pool (the vault always holds exactly what is owed). Cross-pool attacks are injected and
  must fail.
- **Two internal security review rounds** (core vault, then crews). Every finding was fixed or
  explicitly accepted, and each attack is kept as an inverted regression test that must now fail
  (`anchor/programs/fitr-vault/tests/regression*.rs`; table in `anchor/SPEC.md` §11).
- **App and server:** about 1,500 Vitest tests (rep engines, vault client, attestor, API routes,
  components). `ops/deploy-vps.sh` refuses to deploy unless typecheck, lint and every test pass.

## Server and hosting
- `app.fitr.day` answers only the Fitr Android app; browsers are sent to the public site. On the
  public host, internal APIs (`/api/attest`, `/api/rpc`, `/api/seeker`, `/api/crank`) return 404.
- The Helius key and the attestor key live only in the server's environment file (mode 640), never
  in git or in the app. `/api/rpc` is an allow-listed proxy (single requests, method allow-list,
  64 KB body cap, per-IP rate limit, same-origin only).
- The crank is called on the local port only, with its secret passed on stdin so it never shows in
  the process list. The app runs as its own user under systemd with memory and CPU caps, next to
  other services it cannot affect. Deploys are staged, health-checked and rolled back on failure.

## Known limits (stated, not hidden)
- Verification is done by Fitr's server (the attestor). A compromised server could approve fake
  workouts. The review window, per-day snapshots, refund-only revokes and the multisig's pause /
  void limit what it can do, but it is a trust point.
- A determined cheater with a convincing body double or a very good deepfake could still pass;
  live challenges make that expensive, not impossible.
- Crew ids are first-come; the app picks random ids and shows the creator before you join.
- "Delete crew" is enforced by Fitr's server, not onchain: the crew's pool still exists (so stakes
  stay claimable), and a client talking to the chain directly could still stake in it.
