# Deploying Fitr to the VPS (https://fitr.day)

> **As deployed (October 2026).** The live server differs from the original Caddy plan below:
> nginx (TLS by certbot) proxies to `next start` on `127.0.0.1:3077`; `fitr.service` runs as user
> `fitr` from `/opt/fitr/app` with `/etc/fitr/fitr.env` and the drop-in
> `ops/fitr.service.d/data.conf` (`FITR_DATA_DIR=/opt/fitr/data`); releases go out only through
> `ops/deploy-vps.sh` (checks, staged swap, health check, rollback); nginx routing and the
> Android-only gate come from `ops/nginx-lockdown.py`; the crank timer posts to
> `http://127.0.0.1:3077/api/crank` (nginx returns 404 for `/api/crank` publicly). The short version is in
> [OPERATIONS.md](./OPERATIONS.md#deploy).


Production is one long-running `next start` on the founder's VPS behind Caddy (automatic HTTPS).
Files: `ops/setup-vps.sh`, `ops/Caddyfile`, `ops/fitr.service`, `ops/fitr-crank.service`,
`ops/fitr-crank.timer`, `ops/deploy.sh`.

```
phone / browser ──HTTPS──> Caddy :443 (fitr.day, certs auto) ──> 127.0.0.1:3000 next start (user fitr)
systemd timer (10 min) ──POST /api/crank, Bearer CRON_SECRET──> https://fitr.day
```

## What you need

- Ubuntu **24.04** VPS with a public IPv4 address, root SSH access, and at least 1 GB RAM (2 GB recommended).
- The `fitr.day` domain at Namecheap.
- On your Mac: Node 24+, `rsync`, and an SSH key (`~/.ssh/id_ed25519.pub`).

## 1. DNS at Namecheap

1. Namecheap > **Domain List** > `fitr.day` > **Manage** > **Advanced DNS**.
2. Under **Host Records**, delete the parking records Namecheap adds by default: the
   `CNAME www -> parkingpage.namecheap.com` and the `URL Redirect @` record (and any other `A @`).
3. Add:

   | Type | Host | Value | TTL |
   | --- | --- | --- | --- |
   | A Record | `@` | `<VPS IPv4>` | Automatic (or 5 min) |
   | A Record | `www` | `<VPS IPv4>` | Automatic (or 5 min) |
   | AAAA Record (only if the VPS has IPv6 and it works) | `@` and `www` | `<VPS IPv6>` | Automatic |

4. Make sure **Nameservers** (Domain tab) is "Namecheap BasicDNS". If the domain uses other
   nameservers, add the records there instead.
5. Check it from your Mac (can take a few minutes): `dig +short fitr.day` and `dig +short www.fitr.day`
   both print the VPS IP.

`.day` is an HSTS-preloaded TLD: browsers only ever load `https://fitr.day`, so nothing works until
Caddy has a certificate. Caddy gets one automatically once DNS resolves and ports 80/443 are open.

## 2. SSH alias on your Mac

Add to `~/.ssh/config`:

```
Host fitr-vps
  HostName <VPS IPv4>
  User fitr
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes

Host fitr-vps-root
  HostName <VPS IPv4>
  User root
  IdentityFile ~/.ssh/id_ed25519
```

If the provider gave you a root password instead of a key: `ssh-copy-id fitr-vps-root`.

## 3. One-time server setup

```bash
scp -r ops fitr-vps-root:/root/fitr-ops
ssh fitr-vps-root "FITR_SSH_PUBKEY='$(cat ~/.ssh/id_ed25519.pub)' bash /root/fitr-ops/setup-vps.sh"
```

This installs Node 24 LTS, Caddy, ufw (22/80/443 only), unattended upgrades, 2 GB swap if none
exists, the `fitr` user (`/srv/fitr`, key-only login, password-less `sudo` for
`systemctl restart fitr` only), the systemd units and the Caddyfile. Re-running it is safe.

Then fill in the server secrets:

```bash
ssh fitr-vps-root
nano /etc/fitr/fitr.env      # HELIUS_API_KEY, ATTESTOR_KEYPAIR, CRON_SECRET (openssl rand -hex 32)
```

`/etc/fitr/fitr.env` is `root:fitr`, mode 640. It is the only place server secrets live. Never put
them in the repo or in `NEXT_PUBLIC_*` variables.

Optional hardening once key login as `fitr` works: set `PasswordAuthentication no` in
`/etc/ssh/sshd_config.d/50-fitr.conf` and `systemctl reload ssh`.

## 4. Deploy

Public (build-time) settings go in `.env.production.local` in the repo root on your Mac
(git-ignored). For production:

```bash
NEXT_PUBLIC_SOLANA_CLUSTER=mainnet
NEXT_PUBLIC_VAULT_PROGRAM_ID=<deployed program id>   # optional; defaults to the generated client's id
```

Then:

```bash
ops/deploy.sh          # asks for confirmation; --yes skips it
```

What it does:

1. Prints the public config (warns if the cluster is not mainnet) and the release name
   `<UTC time>-<git sha>[-dirty]`.
2. `npm run build` locally (the `prebuild` hook fetches the pose model files into `public/`).
3. `rsync` `.next/` (without `.next/cache`), `public/`, `package.json`, `package-lock.json`,
   `next.config.ts`, `tsconfig.json` to `/srv/fitr/releases/<release>/`.
4. `npm ci --omit=dev` **on the VPS**, so native packages (sharp, SWC) match Linux. This Mac's
   `node_modules` is never copied.
5. Atomically points `/srv/fitr/current` at the new release and restarts `fitr`.
6. Health check: `https://fitr.day/` and `/manifest.webmanifest` must return 200 within 60 s.
   On failure it switches back to the previous release and prints the service logs.
7. Keeps the last 5 releases.

Roll back by hand: `ops/deploy.sh --rollback`.

The first deploy also starts the service (`systemctl enable` was done by setup; `restart` starts it).

## 5. Crank timer

Once a release with `/api/crank` is live and `CRON_SECRET` is set:

```bash
ssh fitr-vps-root systemctl enable --now fitr-crank.timer
ssh fitr-vps-root systemctl start fitr-crank.service     # run once now
ssh fitr-vps journalctl -u fitr-crank -n 20 --no-pager
```

It runs every 10 minutes (`OnCalendar=*:0/10`, catches up after downtime) and sends
`POST https://fitr.day/api/crank` with header `Authorization: Bearer <CRON_SECRET>` and body `{}`.
The route must accept exactly that header. Any non-2xx response marks the run failed in the journal.
The secret is piped to curl on stdin, so it never shows in `ps`.

## Day-2 operations

| Task | Command |
| --- | --- |
| App logs | `ssh fitr-vps journalctl -u fitr -f` |
| Restart app | `ssh fitr-vps sudo systemctl restart fitr` |
| Caddy logs | `ssh fitr-vps-root journalctl -u caddy -n 100`, access log `/var/log/caddy/fitr.access.log` |
| Edit Caddy | edit `ops/Caddyfile`, `scp` it to `/etc/caddy/Caddyfile`, then `caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy` |
| Change secrets | edit `/etc/fitr/fitr.env`, then `systemctl restart fitr` |
| Change `NEXT_PUBLIC_*` | edit `.env.production.local` and redeploy (they are baked in at build) |
| Check TLS | `curl -I https://fitr.day` and `curl -I http://www.fitr.day` (301 to `https://fitr.day`) |
| Check assetlinks | `curl -s https://fitr.day/.well-known/assetlinks.json` |

## Caching

Next.js already sends `Cache-Control: public, max-age=31536000, immutable` for the content-hashed
files under `/_next/static/`; Caddy sets the same header for that path only. Every other response
keeps Next's own headers (`/sw.js` no-store, `/mediapipe/*` revalidate, dynamic pages no-store).
Caddy is set to `flush_interval -1` so streamed App Router responses are not buffered.

## Why `next start`, not `output: 'standalone'`

`standalone` (see `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md`)
copies a traced subset of `node_modules` into `.next/standalone`. Because we build on macOS and run
on Linux, that traced `node_modules` would carry macOS native binaries (e.g. sharp's `@img/sharp-darwin-arm64`)
and fail at runtime on the VPS. `next start` plus `npm ci --omit=dev` on the VPS avoids the problem and
needs no change to `next.config.ts`. Revisit `standalone` only if builds move to Linux (CI or the VPS itself).
