# Fitr

A fitness **commitment** app for the Solana Seeker. You pick a daily goal (one of 16 exercises,
reps or seconds), stake the amount of $SKR you choose, and show up. On-device pose AI (MediaPipe
Pose Landmarker, in the browser) counts every rep; Fitr's verification server re-checks the
session, including live challenges, and marks the day complete on-chain. Hit the goal and your
stake comes back plus a pro-rata share of what others forfeited. Miss it and your stake goes to
the people who showed up. Fitr's only fee is 5% of forfeited stakes (read from the on-chain
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
| Commit | `/commit` | Connect wallet (MWA), pick exercise, goal and stake, sign one transaction. Claims and settles past days in the same transaction |
| Progress | `/progress` | Stats, streak calendar, personal records, awards (including "Verified on-chain"), full history |
| You | `/you` | Profile and wallet, settings (default camera, haptics, form guides), and the Verification, Privacy and Credits pages |

`/history` and `/wallet` permanently redirect to `/progress` and `/you`.

## Staking and verification

- **Vault program** (`anchor/programs/fitr-vault`): one pool per mint, with the goal and stake
  bounds, fee, attestor key and review window all set on-chain. Each day goes commit → attest →
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
- **Crank** (`POST /api/crank`, `Authorization: Bearer $CRON_SECRET`): finalizes past days after
  the review window, closes missed commitments and sweeps empty days. A systemd timer calls it
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

## Layout

- `src/app/`: routes (the five tabs, `/workout/[exercise]`, `/you/*`, `/api/*`).
- `src/components/ui/`: design system (Button, Chip, Card, StatTile, Ring, Sheet, LimeMoment,
  PageHeader). Colours come only from the tokens in `src/app/globals.css` (lime `#C6F432` on near-black).
- `src/components/{home,workouts,workout,stake,progress,you,wallet,nav}/`: the screens.
- `src/lib/pose/`: rep engines (`exercises/**`) and the MediaPipe runtime. `src/lib/exercises.ts`
  is the exercise catalogue.
- `src/lib/solana/`: config, MWA, RPC, vault client, and server-only code (`server/`).
- `src/lib/attest/`: the verification service. `src/lib/storage/`: local history, awards, prefs.
- `anchor/`: vault program. `android/fitr-shell`: the Android web-shell APK. `ops/`: VPS (Caddy, systemd).

Requires a Node host (not `output: "export"`): the API routes, the service worker, the pose
assets and the Digital Asset Links headers are served by Next.
