#!/usr/bin/env bash
# One-time (idempotent) setup of a fresh Ubuntu 24.04 VPS for https://fitr.day.
#
# Run as root ON THE VPS from a copy of this ops/ directory (see docs/deploy.md):
#   scp -r ops root@<VPS_IP>:/root/fitr-ops
#   ssh root@<VPS_IP> 'bash /root/fitr-ops/setup-vps.sh'
#
# Installs: Node.js 24 LTS (NodeSource), Caddy (official apt repo), ufw (22/80/443),
# unattended-upgrades, a 'fitr' system user owning /srv/fitr, /etc/fitr/fitr.env (template),
# fitr.service, fitr-crank.timer and the Caddyfile. Safe to re-run; it never overwrites an
# existing /etc/fitr/fitr.env.
#
# Optional env:
#   FITR_SSH_PUBKEY="ssh-ed25519 AAAA... you@mac"   key allowed to log in as 'fitr' (deploys).
#                                                   Default: copy root's authorized_keys.
#   FITR_SWAP_GB=2                                  swap to create when the box has none (0 = skip).
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "Expected Ubuntu (24.04). Found: ${PRETTY_NAME:-unknown}" >&2
  exit 1
fi
[[ "${VERSION_ID:-}" == "24.04" ]] || echo "WARNING: written for Ubuntu 24.04, found ${VERSION_ID:-?}; continuing."

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for f in Caddyfile fitr.service fitr-crank.service fitr-crank.timer; do
  [[ -f "$here/$f" ]] || { echo "Missing $here/$f (copy the whole ops/ directory)." >&2; exit 1; }
done

export DEBIAN_FRONTEND=noninteractive
step() { printf '\n==> %s\n' "$*"; }

step "Base packages"
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg rsync ufw unattended-upgrades \
  debian-keyring debian-archive-keyring apt-transport-https
dpkg-reconfigure -f noninteractive unattended-upgrades || true

step "Swap (helps 'npm ci' on 1-2 GB boxes)"
swap_gb="${FITR_SWAP_GB:-2}"
if [[ "$swap_gb" != "0" ]] && ! swapon --show | grep -q .; then
  fallocate -l "${swap_gb}G" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
else
  echo "swap present or disabled; skipping"
fi

step "Node.js 24 LTS (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v24.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh
  bash /tmp/nodesource_setup.sh
  apt-get install -y nodejs
fi
node -v
npm -v

step "Caddy (official apt repository)"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi
caddy version

step "User 'fitr' and /srv/fitr"
if ! id fitr >/dev/null 2>&1; then
  # Login shell so ops/deploy.sh can rsync/ssh as fitr (key-only; no password is set).
  useradd --system --create-home --home-dir /srv/fitr --shell /bin/bash fitr
fi
install -d -o fitr -g fitr -m 755 /srv/fitr /srv/fitr/releases
install -d -o fitr -g fitr -m 700 /srv/fitr/.ssh
if [[ -n "${FITR_SSH_PUBKEY:-}" ]]; then
  grep -qxF "$FITR_SSH_PUBKEY" /srv/fitr/.ssh/authorized_keys 2>/dev/null \
    || echo "$FITR_SSH_PUBKEY" >> /srv/fitr/.ssh/authorized_keys
elif [[ -s /root/.ssh/authorized_keys && ! -s /srv/fitr/.ssh/authorized_keys ]]; then
  cp /root/.ssh/authorized_keys /srv/fitr/.ssh/authorized_keys
fi
if [[ -f /srv/fitr/.ssh/authorized_keys ]]; then
  chown fitr:fitr /srv/fitr/.ssh/authorized_keys
  chmod 600 /srv/fitr/.ssh/authorized_keys
else
  echo "WARNING: no SSH key for 'fitr' yet. Add one to /srv/fitr/.ssh/authorized_keys before deploying."
fi

# Deploys restart the service without a password, and nothing else.
cat > /etc/sudoers.d/fitr <<'SUDO'
fitr ALL=(root) NOPASSWD: /usr/bin/systemctl restart fitr
SUDO
chmod 440 /etc/sudoers.d/fitr
# Read its own logs without sudo: journalctl -u fitr
usermod -aG systemd-journal fitr
visudo -cf /etc/sudoers.d/fitr

step "/etc/fitr/fitr.env (server secrets)"
install -d -o root -g fitr -m 750 /etc/fitr
if [[ ! -f /etc/fitr/fitr.env ]]; then
  cat > /etc/fitr/fitr.env <<'ENV'
# Fitr server environment, read by fitr.service and fitr-crank.service.
# Owner root:fitr, mode 640. Restart after edits: systemctl restart fitr
# NEXT_PUBLIC_* values are inlined at BUILD time on the deploy machine, not read from here.
NODE_ENV=production
HELIUS_API_KEY=
# Attestor key: JSON array of 64 bytes. Fund it with a little SOL for fees only.
ATTESTOR_KEYPAIR=
# Long random string; generate with: openssl rand -hex 32
CRON_SECRET=
ENV
  chown root:fitr /etc/fitr/fitr.env
  chmod 640 /etc/fitr/fitr.env
  echo "Created /etc/fitr/fitr.env — fill in HELIUS_API_KEY, ATTESTOR_KEYPAIR, CRON_SECRET."
else
  echo "/etc/fitr/fitr.env exists; left unchanged."
fi

step "systemd units"
install -m 644 "$here/fitr.service" /etc/systemd/system/fitr.service
install -m 644 "$here/fitr-crank.service" /etc/systemd/system/fitr-crank.service
install -m 644 "$here/fitr-crank.timer" /etc/systemd/system/fitr-crank.timer
systemctl daemon-reload
systemctl enable fitr.service
# Started by the first deploy (no release exists yet). The crank timer is enabled separately
# once /api/crank is deployed and CRON_SECRET is set: systemctl enable --now fitr-crank.timer

step "Caddy config"
install -d -o caddy -g caddy -m 755 /var/log/caddy
install -m 644 "$here/Caddyfile" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable caddy
systemctl reload caddy || systemctl restart caddy

step "Firewall (22, 80, 443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp   # HTTP/3
ufw --force enable
ufw status verbose

cat <<'DONE'

==> Setup complete.
Next:
  1. Fill /etc/fitr/fitr.env (HELIUS_API_KEY, ATTESTOR_KEYPAIR, CRON_SECRET).
  2. Point DNS at this server (docs/deploy.md); Caddy fetches certificates on its own.
  3. From your Mac: ops/deploy.sh
  4. When /api/crank is live: systemctl enable --now fitr-crank.timer
DONE
