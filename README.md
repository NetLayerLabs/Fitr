# Fitr

A fitness **commitment** app for the Solana Seeker. You pick a daily goal (one of 16 exercises,
reps or seconds), stake the amount of $SKR you choose, and show up. On-device pose AI (MediaPipe
Pose Landmarker, in the browser) counts every rep; Fitr's verification server re-checks the
session, including live challenges, and marks the day complete onchain. Hit the goal and your
stake comes back plus a pro-rata share of what others forfeited. Miss it and your stake goes to
the people who showed up. Fitr's only fee is 5% of forfeited stakes (read from the onchain
pool). It is a commitment device, not an investment, and it is cheat-resistant, not cheat-proof.
Video never leaves the phone.

Product spec: [`FITR_PROJECT_SPEC.md`](./FITR_PROJECT_SPEC.md) · Vault program:
[`anchor/SPEC.md`](./anchor/SPEC.md), [`anchor/MAINNET_RUNBOOK.md`](./anchor/MAINNET_RUNBOOK.md) ·
Hosting: [`docs/deploy.md`](./docs/deploy.md) · Android APK: [`docs/android.md`](./docs/android.md) ·
Vision & business plan: [`docs/VISION.md`](./docs/VISION.md).

<img width="2980" height="1688" alt="image" src="https://github.com/user-attachments/assets/a5440536-3947-4cea-8c5c-5971b7905fa6" />


## The problem, and how Fitr solves it

Wanting to get fit is easy; showing up is the hard part. Most fitness goals don't fail for lack of
a plan. They fail because skipping today costs nothing and nobody checks the work.

| The problem | The evidence | How Fitr solves it |
| --- | --- | --- |
| **We pay, then don't show up.** Good intentions are cheap. | Members on flat monthly gym plans averaged 4.3 visits a month, paying over $17 a visit when a $10 pass was on offer (DellaVigna & Malmendier, "Paying Not to Go to the Gym", *American Economic Review*, 2006). | You put your own SKR on today's goal. Show up and it comes back; skip it and it is gone. |
| **Nobody checks the reps.** Workout logs count whatever you tell them, so a streak proves very little. | A half-rep, a skipped set or yesterday's video logs the same as the real thing in a self-reported log. | On-device pose AI holds every rep to a joint-angle standard; the server replays the session and issues random live challenges that a pre-recorded clip cannot answer. |
| **Skipping costs nothing.** So "tomorrow" keeps winning. | Losses weigh about twice as much as equal gains (Tversky & Kahneman, 1992), and commitment contracts with money at stake have helped people keep promises they kept breaking (Giné, Karlan & Zinman, "Put Your Money Where Your Butt Is", *AEJ: Applied*, 2010). | Every day settles onchain by rules nobody can bend: finishers get their stake back plus a share of what the no-shows forfeited, and crews add friends who see whether you showed up. |

Fitr is a commitment device, not an investment: if everyone shows up, everyone simply gets their
own stake back.

## Where Fitr goes next

Fitr is built for the Seeker, not ported to it: one Seeker = one stake (Seeker Genesis Token),
every stake signed in Seed Vault, and real, recurring utility for **SKR** (locked daily, recycled
to the people who show up, topped up by sponsors). It is a habit people open every day, and a reason
to own a Seeker.

| Revenue stream | How |
| --- | --- |
| **Gym partnerships** | Gyms pay monthly to run Fitr challenges: crew leaderboards, AI-verified home workouts, a view of who is slipping. First pilot: gyms in Nigeria. |
| **Sponsored challenges** | Brands or gyms fund the bonus for finishers (the live sponsor feature), with no user money at stake. |
| **Fitr Pro** | Subscription: programs, advanced stats, more crews; free tier keeps rep counting and streaks. |
| **Corporate wellness** | Employers sponsor staff challenges. |
| **Money commitments** | The 5% fee on forfeited stakes, live in SKR today; fiat only after legal review. |

Roadmap: dApp Store listing and Seeker crew seasons → a 30-day gym pilot in Nigeria → phone sign-in,
Play Store, subscriptions and stablecoin stakes → corporate wellness, iOS and independent
attestors. Full plan, metrics, risks and what Solana Mobile support would unlock:
[`docs/VISION.md`](./docs/VISION.md).

## Live on Solana mainnet

Fitr runs with real $SKR on mainnet, not devnet. Everything below can be checked onchain.

| What | Address / link |
| --- | --- |
| Website and APK download | https://fitr.day (APK: https://fitr.day/download/fitr.apk, Android app 1.2.0) |
| Vault program | [`9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY`](https://explorer.solana.com/address/9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY) |
| Global staking pool | [`2bbEw4ST1SbgJ3biXNf6cu4g78NorW6qEAhYQcGEQukz`](https://explorer.solana.com/address/2bbEw4ST1SbgJ3biXNf6cu4g78NorW6qEAhYQcGEQukz) |
| Pool's SKR vault (token account) | [`F6bsJ6BhPUd33MaEvEohLDr6myZXyzUoMFZbZgY4xmVw`](https://explorer.solana.com/address/F6bsJ6BhPUd33MaEvEohLDr6myZXyzUoMFZbZgY4xmVw) |
| Admin: Squads multisig (2-of-3) | multisig [`GtigawLF6vHyf7H6ZRXh7U2BWDi7Y5UCYmTDeTUJLK39`](https://explorer.solana.com/address/GtigawLF6vHyf7H6ZRXh7U2BWDi7Y5UCYmTDeTUJLK39), vault [`62idAiYpT9tTdCdcH86wFzWJCAcmkNGUsAXc5q1rYqu9`](https://explorer.solana.com/address/62idAiYpT9tTdCdcH86wFzWJCAcmkNGUsAXc5q1rYqu9) |
| Staked mint | $SKR [`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`](https://explorer.solana.com/address/SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3) |
| Public pool dashboard | https://fitr.day/pool |

**Global pool rules as deployed** (all read from the pool account, changeable only by the
multisig, and each day keeps the rules it started with):

| Rule | Value |
| --- | --- |
| Stake per commitment | 1 to 10,000 SKR, chosen by the user |
| Goal | one of 16 exercises, at least the per-exercise minimum (e.g. 10 push-ups, 15 squats, 30 s plank) |
| Who can stake | wallets holding a Seeker Genesis Token; one commitment per Seeker per day per pool |
| Fee | 5% of forfeited stakes only (nothing when you show up) |
| Sponsor bonus | up to 10 SKR per day from the sponsor reserve, to the people who finish |
| Streak bonus | +5% weight per consecutive day, up to +50% |

**A day, end to end** (UTC; CEST is UTC+2):

| UTC | What happens |
| --- | --- |
| 00:00 | The day starts. Commit any time before 18:00 (one transaction: stake, plus claiming yesterday's payout if there is one). |
| until 24:00 | Do the workout. The phone counts reps and streams pose points; the server checks them and marks the day complete onchain (`attest_completion`). |
| 24:00 → 01:00 | Grace hour: late verifications can still land. |
| 01:00 → 02:00 | Review window: results are frozen; the multisig can void the day if something went wrong. |
| from 02:00 | The crank (every 10 minutes) finalizes the day and marks no-shows missed. Finishers claim their stake plus their share in the app. |

## The app: five tabs

| Tab | Route | What it does |
| --- | --- | --- |
| Today | `/` | Greeting and streak, one adaptive card (commit, today's goal with Start, verifying, verified, claim, missed, verification withdrawn), today's activity, quick start |
| Workouts | `/workouts` | All 16 exercises by muscle group (`?c=` / `?eq=none` filters); `/workout/<kind>` is the workout screen with form guide, 3-2-1 countdown and HUD |
| Commit | `/commit` | Connect wallet (MWA), pick exercise, goal and stake, sign one transaction. Claims and settles past days in the same transaction. Solo / Crew switch; `/crew/<id>` is a crew's page |
| Progress | `/progress` | Stats, streak calendar, personal records, awards (including "Verified onchain"), full history |
| You | `/you` | Profile and wallet, settings (language, default camera, haptics, voice coach, clock-in reminders in the Android app, form guides), a link to the website, and the Verification, Privacy and Credits pages |

`/history` and `/wallet` permanently redirect to `/progress` and `/you`.

**Languages.** The app is translated into English, 简体中文, 日本語, 한국어, Italiano, Español, Français,
Português and Deutsch (You → Settings → Language). Every screen, the voice coach, transaction
errors, reminders and the in-app info pages switch at once; the choice is stored in a cookie so the
server renders the right language from the first paint. About 1,220 texts per language live in
`src/lib/i18n/messages/<language>/`; a test fails if any language misses a text or a
`{placeholder}`. Conventions: [`src/lib/i18n/README.md`](./src/lib/i18n/README.md). The voice
coach speaks the chosen language where the phone has a voice for it (Android app 1.2.0+), English
otherwise. The public website stays in English.

## Two hosts, one server

The same Next server answers both hosts behind nginx:

- **https://fitr.day** is public: the landing page and nothing that opens the app in a browser.
  `next.config.ts` rewrites `/`, `/verification`, `/privacy`, `/credits` to `/landing/*` there, and
  redirects app screens (`/commit`, `/workout/*`, `/you`, `/crew/*`, ...) back to `/`. It also
  serves the public routes below: `/pool`, `/s/<wallet>/<day>`, `/c/<crewId>`, `/actions.json`,
  `/api/actions/*`. The APK is served at `/download/fitr.apk` (by nginx, not by Next).
- **https://app.fitr.day** is the app, opened by the Android app (nginx keeps browsers out).

## Crews (group commitments)

A crew is a group of friends committing together. Each crew is **its own onchain pool**
`["pool", SKR mint, crew_id]` (anchor/SPEC.md §2.7), so a crew's stakes, forfeits and bonuses never
mix with anyone else's. Code: `src/lib/solana/vault/crews.ts`, `src/components/crews/`.

**Create.** Commit tab → **Crew** → *Start a crew*: a name (stored onchain), and optionally a fixed
challenge (one exercise and goal everyone must use, e.g. "20 squats"). The app picks a random
crew id and sends `create_crew` (about 0.005 SOL rent, paid once by the creator). The creator gets
**no special powers onchain**: the crew copies the global pool's rules and authority (the Squads
multisig), so nobody, the creator included, can move members' stakes.

**Invite.** The crew page has an invite link `https://fitr.day/c/<crewId>` and a share button.
- In a browser it opens a public invite page (crew name, challenge, member count, link preview for
  chats) with *Download Fitr* and *Open in Fitr*.
- On a phone with Fitr installed, Android's verified App Links open the crew straight in the app
  (`/crew/<crewId>`). Anyone can also paste the link or the crew number into *Join a crew*.

**Stake and settle.** Members stake their own SKR (same 1 to 10,000 SKR bounds, Seeker-only) on the
same day, on the crew's fixed challenge if it has one. Members who miss fund the members who showed
up, pro rata. If **nobody** in a crew completes a day, its stakes (after the 5% fee) **roll over**
to the crew's next day that someone completes, instead of going anywhere else. A wallet can hold the
global stake and crew stakes on the same day; each workout verifies one of them
(`/workout/<kind>?crew=<id>`).

**Crew page.** Today's challenge and members (verified / committed / missed), a crew streak (days
on which everyone who committed was verified), a leaderboard (verified days, streak, bonus earned)
and the rollover waiting for the next completer, all read from the chain.

**Sponsoring a crew.** Works like the global pool (see Sponsored days), but each crew has its own
tap, closed by default; the multisig opens it per crew.

**Deleting a crew (app-side).** The creator can tap **Delete crew** at the bottom of the crew page.
Their wallet **signs a plain message** (no transaction, no SOL) that `POST /api/crews/closed`
checks: a valid ed25519 signature, less than 10 minutes old, from the wallet that is the crew's
onchain `creator`. The server then records the crew in `closed-crews.json` (in `FITR_DATA_DIR`), and:
- the crew disappears from everyone's *Your crews*;
- its page shows "This crew was deleted", with no invite, stake form or sponsoring;
- its invite link `fitr.day/c/<id>` says the crew was deleted;
- **anyone who already staked can still claim**. Nothing onchain changes: the pool and its funds
  stay exactly as they were, so a deletion can never strand money.

**The global pool stays in charge.** Its pause stops every crew, every new crew day records the
global attestor, and the crank sends the permissionless `sync_crew` to crews whose copied authority
or attestor went stale.

## Share cards, Blinks and the public dashboard

All read from the chain on the server (only `HELIUS_API_KEY` needed), code in `src/lib/actions/`
and `src/components/public/`:

- **Share card** `https://fitr.day/s/<wallet>/<day>[?pool=<crew pool>]` with an image at `.../og`.
  The "Share" button on a verified workout opens the phone's share sheet with it.
- **"Commit with me" Blink** `GET/POST /api/actions/commit?pool=&exercise=&goal=` and
  **"Sponsor a day"** `/api/actions/sponsor?pool=` (Solana Actions 2.4, `/actions.json` maps them).
  POST returns an unsigned, simulated transaction; staking still needs a Seeker Genesis Token.
  Sponsoring stays closed while the pool's `daily_sponsor_amount` is 0. Any wallet can open them
  through `https://dial.to/?action=solana-action:<url>`.
- **Pool dashboard** `https://fitr.day/pool`: SKR at stake today, completion rate, SKR paid to people
  who showed up, crews, sponsor reserve, recent days and top streaks (60 s cache).

`pool=` is always a pool address (omitted = the global pool); in-app links use `?crew=<id>`.

## Sponsored days

A sponsor (a brand, a gym, a community, or the people behind Fitr) can add an **extra bonus for
showing up**: SKR on top of what the no-shows forfeit, paid only to the people who complete their
goal. It is a bonus funded by a sponsor's deposit, never yield.

**How it works (all enforced onchain, `anchor/SPEC.md` §2.7 and §5)**

1. **The tap.** Each pool (the global pool or any crew) has a `daily_sponsor_amount`: the most its
   reserve may pay out per day. On mainnet the global pool's tap is **10 SKR per day** (opened
   by a 2-of-3 Squads vote on 2026-10-05); every crew's tap starts at 0. Only the pool's authority
   can change it (for the global pool, the Squads multisig, 2-of-3). It can never
   be more than `max_stake` (10,000 SKR), so one day can never drain more than that.
2. **Funding.** Anyone can deposit SKR into a pool's reserve with `fund_reserve`: in the app (Commit
   tab → **Sponsor a day** card, or **Sponsor <crew>** on a crew's page, signed with Seed Vault), through
   the **"Sponsor a day" Blink** (`https://fitr.day/api/actions/sponsor?pool=<pool>`, also linked
   from `https://fitr.day/pool`), or from any wallet. While the tap is 0 the deposit is refused
   (`SponsorTapClosed`) and no tokens move, so money can never sit in a reserve nothing draws from.
3. **Paying out.** Each day records the tap's value when it is created. At finalize, a day with at
   least one completer draws `min(daily_sponsor_amount, reserve)` from the reserve and adds it to the
   forfeits being shared. Everyone who completed gets their own stake back plus a share
   proportional to their stake (and streak weight). A day nobody completes draws nothing.
4. **Where else the reserve comes from.** In the global pool, a day with **no completers** has
   nobody to pay, so its forfeits (after the 5% fee) go into the reserve too, as does rounding dust.
   They come back out to future people who show up, through the same tap. In a crew, such forfeits
   roll over to the crew's next day with a completer instead.
5. **Nobody can take it.** The reserve only ever leaves through the sponsor tap to people who
   completed. There is no withdraw instruction for it: not for the admin, not for Fitr.

While a pool's reserve can pay a bonus, its stake form shows a **Sponsored** note with the amount.

**Example.** The tap is 50 SKR. Ten people stake 100 SKR each and seven show up. Forfeits are
300 SKR, Fitr's fee is 15 SKR, the sponsor adds 50 SKR, so the seven share 335 SKR: each gets their
100 SKR back plus about 47.8 SKR.

**Turning it on or off.** Build the Squads transaction, import it in Squads (Developers → TX Builder
→ Import), and approve 2-of-3:

```bash
SQUADS_VAULT=62idAiYpT9tTdCdcH86wFzWJCAcmkNGUsAXc5q1rYqu9 npx tsx scripts/solana/vault-admin.ts sponsor-tx 50   # 50 SKR per day
SQUADS_VAULT=62idAiYpT9tTdCdcH86wFzWJCAcmkNGUsAXc5q1rYqu9 npx tsx scripts/solana/vault-admin.ts sponsor-tx 0    # close the tap
```

A new value applies to days created afterwards; days already running keep the value they started
with. The pool dashboard (`/pool`) shows the reserve, the current tap and each day's sponsored amount.

## Android app and the native bridge

`android/fitr-shell` is a Kotlin Solana Mobile web shell that loads `https://app.fitr.day` (see its
README; `docs/android.md`). On top of MWA, camera and file chooser it adds a native pack:

- `window.FitrNative` (contract in `src/lib/native/bridge.ts`, injected only on the app origin):
  `speak` / `stopSpeaking` (Android text-to-speech for the voice coach), notification permission,
  `scheduleReminders` (clock-in reminders 2 h and 30 min before the stake deadline),
  `updateWidget` (the "Fitr · Today" home-screen widget) and, since 1.2.0, `setSpeechLanguage`
  (the voice coach speaks the app's language when the phone has a voice for it; the web app
  feature-detects it and speaks English on older APKs or when no voice is installed).
- `src/components/native/NativeSync.tsx` (mounted in the root layout) keeps the widget and reminders
  in step with today's commitment; it does nothing in a browser.
- App shortcuts (long-press the icon) and verified App Links for `app.fitr.day` and `fitr.day/c/*`.

The voice coach (`src/components/workout/voiceCoach.ts`) also works in a browser through the Web
Speech API; it is on by default and can be switched off on the You tab.

**Updating the app.** Screens and features come from the server, so most changes reach installed
apps without a new APK (close and reopen Fitr). A new APK is only needed for native changes
(`android/fitr-shell/gradle.properties`: `SOLANA_MOBILE_VERSION_NAME` / `_CODE`); build it with
`android/build-release.sh` (release keystore from `~/.fitr/keys`, never in git) and publish it to
`/var/www/fitr/download/fitr.apk`. It installs over the previous version (same signing key). The
You tab shows the installed version ("Fitr 1.2.0").

## Staking and verification

- **Vault program** (`anchor/programs/fitr-vault`): one pool per mint, with the goal and stake
  bounds, fee, attestor key and review window all set onchain. Each day goes commit → attest →
  finalize → claim / close_missed → sweep. The TypeScript client in
  `src/lib/solana/vault/generated` is generated from the IDL (`npm run codegen:vault`).
- **Client** (`src/lib/solana/vault/{read,status,instructions,errors}.ts`, `src/components/stake/`):
  reads the pool and the user's recent days, derives each day's status, and builds one
  wallet-signed transaction per day (finalize? + claim/close? + register_device? + commit). It
  simulates through `/api/rpc` first at the 1.4M compute-unit maximum, then signs with the measured
  units × 1.2 and a Helius priority fee, so a stale estimate can never block a stake; MWA signs and
  sends. Errors show a friendly sentence plus a collapsible *Technical details* line (failing step
  and raw reason).
- **Verification** (`src/lib/attest/`, `/api/attest/{start,chunk,finish}`): a staked workout
  streams pose landmarks (never video) to the server. The server replays them through the same rep
  engine, checks the live challenges and tracking quality, then sends `attest_completion` with the
  attestor key (`src/lib/attest/onchain.ts`, `src/lib/solana/server/attestor.ts`). The phone needs
  data until the result appears; after that the app can be closed. A rejected workout leaves the
  stake open (train again before the deadline), and the Today card returns to the Start button.
  Every verdict is logged on the server (`journalctl -u fitr`: wallet short form, day, reps,
  reasons, onchain status; never the trace).
- **Crank** (`POST /api/crank`, `Authorization: Bearer $CRON_SECRET`): for the global pool and
  then every crew, finalizes past days after the review window, closes missed commitments, sweeps
  empty days, and syncs stale crews (`sync_crew`). A systemd timer calls it
  (`ops/fitr-crank.{service,timer}`).
- `/api/rpc` is an allow-listed Helius proxy (the API key stays on the server); `/api/seeker`
  checks Seeker Genesis Token ownership.

## Server API

| Route | Host | What it does |
| --- | --- | --- |
| `POST /api/rpc` | app | Allow-listed Helius JSON-RPC proxy (the API key stays on the server) |
| `GET /api/seeker?owner=` | app | Does this wallet hold a genuine Seeker Genesis Token (and which) |
| `POST /api/attest/{start,chunk,finish}` | app | Verification session: streamed pose points, live challenges, then `attest_completion` |
| `POST /api/crank` | local only | Finalize / close missed / sweep / sync crews; `Authorization: Bearer $CRON_SECRET` |
| `GET / POST /api/crews/closed` | app | List of deleted crews; delete a crew with the creator's signed message |
| `GET / POST /api/actions/commit` | public | "Commit with me" Blink |
| `GET / POST /api/actions/sponsor` | public | "Sponsor a day" Blink |
| `GET /actions.json` | public | Solana Actions mapping |

"app" routes are same-origin only and, on the public host fitr.day, `/api/attest`, `/api/rpc`,
`/api/seeker` and `/api/crank` return 404 (nginx). The crank is called by the systemd timer on
`127.0.0.1:3077`.

## Operating the vault

Every admin change is a Squads proposal. `scripts/solana/vault-admin.ts` prints the transaction
(base58, plus the raw instruction for Squads' manual form); import it in Squads (Developers → TX
Builder → Import), approve with two members, execute. It never holds a multisig key.

```bash
export SQUADS_VAULT=62idAiYpT9tTdCdcH86wFzWJCAcmkNGUsAXc5q1rYqu9
npx tsx scripts/solana/vault-admin.ts status          # read the global pool (read-only)
npx tsx scripts/solana/vault-admin.ts pause-tx        # incident: stop new stakes and verifications
npx tsx scripts/solana/vault-admin.ts unpause-tx
npx tsx scripts/solana/vault-admin.ts sponsor-tx 10   # daily sponsor amount in SKR (0 closes the tap)
```

Voiding a day, rotating the attestor, fee withdrawal and program upgrades follow
[`anchor/MAINNET_RUNBOOK.md`](./anchor/MAINNET_RUNBOOK.md) §10.

## Security

Fitr holds other people's money, so it is built so that no single key, server or person can take
it. "Cheat-resistant" is the claim, not "cheat-proof"; the limits are listed at the end.

**Who controls what (onchain)**

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

**Cheat resistance (offchain verification)**

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

**Verifiable build and deployment**

- The deployed binary was built in the official `solanafoundation/solana-verifiable-build:2.1.0`
  Docker image from this repository's `anchor/` directory, so anyone can rebuild it and compare
  hashes: executable hash `648618ba7a61a3a59b367750e07bc512b6a3cf48ef40e6d242c40a4fd3037240`
  (`solana-verify get-program-hash 9eYqN31joVSrEvtXKNYJRNdbP7m4LbdGfFd9n4BmgikY`).
- The deployment followed [`anchor/MAINNET_RUNBOOK.md`](./anchor/MAINNET_RUNBOOK.md) in one sitting:
  deploy; create the pool **paused** in the same transaction as its setup (so nobody could open a
  crew before the multisig took over); only the program's upgrade authority could create it, so it
  could not be front-run; hand the upgrade authority to Squads; hand the pool to Squads through a
  two-step propose / accept (the accept signed 2-of-3 in Squads); check that no crews existed;
  empty the deployer; unpause by a 2-of-3 Squads vote.
- Admin changes from here on are Squads proposals built by `scripts/solana/vault-admin.ts`
  (it prints the transaction for Squads to import; it never holds a multisig key).

**Testing and review**

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

**Server and hosting**

- `app.fitr.day` answers only the Fitr Android app; browsers are sent to the public site. On the
  public host, internal APIs (`/api/attest`, `/api/rpc`, `/api/seeker`, `/api/crank`) return 404.
- The Helius key and the attestor key live only in the server's environment file (mode 640), never
  in git or in the app. `/api/rpc` is an allow-listed proxy (single requests, method allow-list,
  64 KB body cap, per-IP rate limit, same-origin only).
- The crank is called on the local port only, with its secret passed on stdin so it never shows in
  the process list. The app runs as its own user under systemd with memory and CPU caps, next to
  other services it cannot affect. Deploys are staged, health-checked and rolled back on failure.

**Known limits (stated, not hidden)**

- Verification is done by Fitr's server (the attestor). A compromised server could approve fake
  workouts. The review window, per-day snapshots, refund-only revokes and the multisig's pause /
  void limit what it can do, but it is a trust point.
- A determined cheater with a convincing body double or a very good deepfake could still pass;
  live challenges make that expensive, not impossible.
- Crew ids are first-come; the app picks random ids and shows the creator before you join.
- "Delete crew" is enforced by Fitr's server, not onchain: the crew's pool still exists (so stakes
  stay claimable), and a client talking to the chain directly could still stake in it.

## Environment

Copy `.env.example` to `.env.local` for development, or to `/etc/fitr/fitr.env` on the VPS.

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | build | `mainnet` (real SKR) or `devnet` |
| `NEXT_PUBLIC_DEVNET_SKR_MINT` | build | Devnet test mint only |
| `NEXT_PUBLIC_VAULT_PROGRAM_ID` | build | Optional override of the generated program id |
| `HELIUS_API_KEY` | server | RPC proxy, priority fees, attestor sends |
| `ATTESTOR_KEYPAIR` | server | JSON 64-byte secret key. Must be the pool's `attestor`, and it pays crank fees, so it needs some SOL |
| `CRON_SECRET` | server | Bearer secret for `/api/crank` |
| `FITR_DATA_DIR` | server | Folder for small app data that must survive deploys (`closed-crews.json`); `/opt/fitr/data` on the VPS, set by `ops/fitr.service.d/data.conf`. Unset in development: kept in memory |

Without `HELIUS_API_KEY` or `ATTESTOR_KEYPAIR`, verification and the crank answer
`503 not_configured`; workouts still work unstaked. `NEXT_PUBLIC_*` values are inlined at build
time, so rebuild after changing them. Keep keys out of git (locally in `~/.fitr/keys`).

## Develop

```bash
npm install
npm run dev          # also stages the pose wasm + models into public/mediapipe/
```

The camera only works on HTTPS or `localhost`. To test on a phone, use a deployed build or an
HTTPS tunnel. The build fetches Google Fonts (Inter, Inter Tight), so it needs network access.

| Script | What it does |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js 16 (Turbopack). The service worker only registers in production |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest: engines, vault client, attestor, API routes, hooks, components, service worker |
| `npm run assets:pose` | Stage MediaPipe wasm and pose models into `public/mediapipe/` (runs before dev/build; `FITR_SKIP_POSE_MODELS=1` falls back to the CDN) |
| `npm run anchor:build` / `npm run anchor:test` | Build the vault program; run its Rust unit, LiteSVM, regression and fuzz tests |
| `npm run codegen:vault` | Regenerate the TS client from the IDL (`-- --check` fails if it is stale) |

## Deploy

`ops/deploy-vps.sh` is the only deploy path. It runs typecheck, lint, the full test suite and a
mainnet build locally and stops on any failure, then uploads to the VPS, swaps the release, restarts
`fitr.service` and health-checks it, rolling back automatically if the new release is unhealthy.

```bash
ops/deploy-vps.sh                      # FITR_HOST=root@<ip> to override the host
FITR_REINSTALL=1 ops/deploy-vps.sh     # also npm ci on the server (after dependency changes)
```

**As deployed:** nginx (TLS by certbot) in front of `next start` on `127.0.0.1:3077`, systemd unit
`fitr.service` running as user `fitr` from `/opt/fitr/app` (capped at 1.5 GB RAM and 150% CPU on a
shared server), env file `/etc/fitr/fitr.env` (mode 640), data folder `/opt/fitr/data`
(`ops/fitr.service.d/data.conf`), crank `fitr-crank.timer` every 10 minutes
(`ops/fitr-crank.{service,timer}`), APK at `/var/www/fitr/download/fitr.apk`, nginx routing and the
Android-only gate from `ops/nginx-lockdown.py`. More in [`docs/deploy.md`](./docs/deploy.md).
The vault program is deployed separately by following `anchor/MAINNET_RUNBOOK.md`.

## Layout

- `src/app/`: routes (the five tabs, `/workout/[exercise]`, `/crew/[crewId]`, `/you/*`, `/api/*`;
  public: `/landing/*`, `/c/[crewId]`, `/s/[wallet]/[day]`, `/pool`, `/actions.json`, `/api/actions/*`).
- `src/components/ui/`: design system (Button, Chip, Card, StatTile, Ring, Sheet, LimeMoment,
  PageHeader). Colours come only from the tokens in `src/app/globals.css` (lime `#C6F432` on near-black).
- `src/components/{home,workouts,workout,stake,crews,progress,you,wallet,nav}/`: the screens.
  `landing/` and `public/`: the public site. `native/`: the Android bridge sync.
- `src/lib/pose/`: rep engines (`exercises/**`) and the MediaPipe runtime. `src/lib/exercises.ts`
  is the exercise catalogue.
- `src/lib/solana/`: config, MWA, RPC, vault client, and server-only code (`server/`).
- `src/lib/attest/`: the verification service. `src/lib/storage/`: local history, awards, prefs.
  `src/lib/crews/`: app-side crew deletion (signed message format, server store).
- `scripts/solana/vault-admin.ts`: mainnet admin (pool setup, Squads transactions); `codegen-vault.mjs`.
- `anchor/`: vault program. `android/fitr-shell`: the Android web-shell APK. `ops/`: VPS (Caddy, systemd).

Requires a Node host (not `output: "export"`): the API routes, the service worker, the pose
assets and the Digital Asset Links headers are served by Next.
