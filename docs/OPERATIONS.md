# Operating Fitr

Running the production system: the onchain vault (through the Squads multisig), the server
environment and deploys.

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
[`anchor/MAINNET_RUNBOOK.md`](../anchor/MAINNET_RUNBOOK.md) §10.

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
Android-only gate from `ops/nginx-lockdown.py`. More in [`docs/deploy.md`](./deploy.md).
The vault program is deployed separately by following `anchor/MAINNET_RUNBOOK.md`.

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
