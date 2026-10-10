# Fitr architecture

How the app, the server, the Android shell and the onchain vault fit together. For the short
version, see the [README](../README.md); for security, [SECURITY.md](./SECURITY.md); for running the
production system, [OPERATIONS.md](./OPERATIONS.md).

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
`{placeholder}`. Conventions: [`src/lib/i18n/README.md`](../src/lib/i18n/README.md). The voice
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
- Minimal permissions: internet, camera (rep counting; video never leaves the phone), and
  notifications + boot (optional reminders). No microphone, location, contacts or storage. Each
  one is justified in [`docs/android.md`](./android.md#permissions-for-the-dapp-store-submission).

The voice coach (`src/components/workout/voiceCoach.ts`) also works in a browser through the Web
Speech API; it is on by default and can be switched off on the You tab.

**Updating the app.** Screens and features come from the server, so most changes reach installed
apps without a new APK (close and reopen Fitr). A new APK is only needed for native changes
(`android/fitr-shell/gradle.properties`: `SOLANA_MOBILE_VERSION_NAME` / `_CODE`); build it with
`android/build-release.sh` (release keystore from `~/.fitr/keys`, never in git) and publish it to
`/var/www/fitr/download/fitr.apk`. It installs over the previous version (same signing key). The
You tab shows the installed version ("Fitr 1.2.0").

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
