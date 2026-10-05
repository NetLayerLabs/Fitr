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
Hosting: [`docs/deploy.md`](./docs/deploy.md) · Android APK: [`docs/android.md`](./docs/android.md).

## The app: five tabs

| Tab | Route | What it does |
| --- | --- | --- |
| Today | `/` | Greeting and streak, one adaptive card (commit, today's goal with Start, verifying, verified, claim, missed, verification withdrawn), today's activity, quick start |
| Workouts | `/workouts` | All 16 exercises by muscle group (`?c=` / `?eq=none` filters); `/workout/<kind>` is the workout screen with form guide, 3-2-1 countdown and HUD |
| Commit | `/commit` | Connect wallet (MWA), pick exercise, goal and stake, sign one transaction. Claims and settles past days in the same transaction. Solo / Crew switch; `/crew/<id>` is a crew's page |
| Progress | `/progress` | Stats, streak calendar, personal records, awards (including "Verified onchain"), full history |
| You | `/you` | Profile and wallet, settings (default camera, haptics, voice coach, clock-in reminders in the Android app, form guides), and the Verification, Privacy and Credits pages |

`/history` and `/wallet` permanently redirect to `/progress` and `/you`.

## Two hosts, one server

The same Next server answers both hosts behind nginx:

- **https://fitr.day** is public: the landing page and nothing that opens the app in a browser.
  `next.config.ts` rewrites `/`, `/verification`, `/privacy`, `/credits` to `/landing/*` there, and
  redirects app screens (`/commit`, `/workout/*`, `/you`, `/crew/*`, ...) back to `/`. It also
  serves the public routes below: `/pool`, `/s/<wallet>/<day>`, `/c/<crewId>`, `/actions.json`,
  `/api/actions/*`. The APK is served at `/download/fitr.apk` (by nginx, not by Next).
- **https://app.fitr.day** is the app, opened by the Android app (nginx keeps browsers out).

## Crews (group commitments)

A crew is its own onchain pool `["pool", mint, crew_id]` (anchor/SPEC.md §2.7). Anyone creates
one with `create_crew` (about 0.005 SOL rent, no special powers for the creator), optionally
with a fixed exercise and goal. Friends join by link (`https://fitr.day/c/<id>`, which opens
`/crew/<id>` in the app), stake their own SKR on the same day, and the no-shows fund the members
who showed up. If nobody in a crew completes a day, its stakes roll over to the crew's next day
someone completes. The crew page shows today's members, a crew streak and a leaderboard read from
the chain. A wallet can hold the global stake and crew stakes on the same day; each workout
verifies one of them (`/workout/<kind>?crew=<id>`). Code: `src/lib/solana/vault/crews.ts`,
`src/components/crews/`.

The global pool stays in charge: its pause stops every crew, every new day records the global
attestor, and the server crank sends the permissionless `sync_crew` to crews whose copied
authority / attestor went stale.

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
  `scheduleReminders` (clock-in reminders 2 h and 30 min before the stake deadline) and
  `updateWidget` (the "Fitr · Today" home-screen widget).
- `src/components/native/NativeSync.tsx` (mounted in the root layout) keeps the widget and reminders
  in step with today's commitment; it does nothing in a browser.
- App shortcuts (long-press the icon) and verified App Links for `app.fitr.day` and `fitr.day/c/*`.

The voice coach (`src/components/workout/voiceCoach.ts`) also works in a browser through the Web
Speech API; it is on by default and can be switched off on the You tab.

## Staking and verification

- **Vault program** (`anchor/programs/fitr-vault`): one pool per mint, with the goal and stake
  bounds, fee, attestor key and review window all set onchain. Each day goes commit → attest →
  finalize → claim / close_missed → sweep. The TypeScript client in
  `src/lib/solana/vault/generated` is generated from the IDL (`npm run codegen:vault`).
- **Client** (`src/lib/solana/vault/{read,status,instructions,errors}.ts`, `src/components/stake/`):
  reads the pool and the user's recent days, derives each day's status, and builds one
  wallet-signed transaction per day (finalize? + claim/close? + register_device? + commit). It
  simulates through `/api/rpc` first, sizes compute and the priority fee, then MWA signs and sends.
- **Verification** (`src/lib/attest/`, `/api/attest/{start,chunk,finish}`): a staked workout
  streams pose landmarks (never video) to the server. The server replays them through the same rep
  engine, checks the live challenges, then sends `attest_completion` with the attestor key
  (`src/lib/attest/onchain.ts`, `src/lib/solana/server/attestor.ts`).
- **Crank** (`POST /api/crank`, `Authorization: Bearer $CRON_SECRET`): for the global pool and
  then every crew, finalizes past days after the review window, closes missed commitments, sweeps
  empty days, and syncs stale crews (`sync_crew`). A systemd timer calls it
  (`ops/fitr-crank.{service,timer}`).
- `/api/rpc` is an allow-listed Helius proxy (the API key stays on the server); `/api/seeker`
  checks Seeker Genesis Token ownership.

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

Server setup (systemd, Caddy/nginx, crank timer): `ops/` and [`docs/deploy.md`](./docs/deploy.md).
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
- `anchor/`: vault program. `android/fitr-shell`: the Android web-shell APK. `ops/`: VPS (Caddy, systemd).

Requires a Node host (not `output: "export"`): the API routes, the service worker, the pose
assets and the Digital Asset Links headers are served by Next.
