#!/usr/bin/env bash
# Build Fitr locally and ship it to the VPS (SSH host alias 'fitr-vps', user 'fitr').
#
#   ops/deploy.sh             build, upload, install, switch, restart, health-check
#   ops/deploy.sh --yes       same, without the confirmation prompt
#   ops/deploy.sh --rollback  point 'current' back at the previous release and restart
#
# Layout on the VPS:
#   /srv/fitr/releases/<UTC timestamp>-<git sha>/   one directory per deploy (last 5 kept)
#   /srv/fitr/current -> releases/<...>             what fitr.service runs
#
# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so they come from THIS
# machine: the shell env or .env.production(.local) in the repo root (Next loads those files during
# `next build`). Server secrets live only on the VPS in /etc/fitr/fitr.env.
#
# Why not ship this Mac's node_modules: native packages (sharp/@img, @next/swc) are per-platform,
# so the VPS runs `npm ci --omit=dev` against the uploaded package-lock.json instead.
set -euo pipefail

HOST="${FITR_DEPLOY_HOST:-fitr-vps}"
APP_DIR="/srv/fitr"
URL="${FITR_PUBLIC_URL:-https://fitr.day}"
KEEP=5

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"

remote() { ssh -o BatchMode=yes "$HOST" "$@"; }

health_check() {
  local tries=30
  for ((i = 1; i <= tries; i++)); do
    if curl -fsS -o /dev/null --max-time 10 "$URL/" \
      && curl -fsS -o /dev/null --max-time 10 "$URL/manifest.webmanifest"; then
      echo "Health check OK: $URL"
      return 0
    fi
    sleep 2
  done
  echo "Health check FAILED: $URL" >&2
  return 1
}

switch_to() { # $1 = release dir name
  remote "set -e; cd $APP_DIR && ln -sfn releases/$1 current.tmp && mv -Tf current.tmp current && sudo -n /usr/bin/systemctl restart fitr"
}

if [[ "${1:-}" == "--rollback" ]]; then
  current="$(remote "basename \"\$(readlink -f $APP_DIR/current)\"")"
  previous="$(remote "ls -1 $APP_DIR/releases | sort | grep -B1 -x '$current' | head -1")"
  if [[ -z "$previous" || "$previous" == "$current" ]]; then
    echo "No earlier release to roll back to (current: $current)." >&2
    exit 1
  fi
  echo "Rolling back $current -> $previous"
  switch_to "$previous"
  health_check
  exit 0
fi

assume_yes=0
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && assume_yes=1

# --- Preflight -------------------------------------------------------------------------------
command -v rsync >/dev/null || { echo "rsync is required." >&2; exit 1; }
remote true || { echo "Cannot ssh to '$HOST'. Configure the alias in ~/.ssh/config (docs/deploy.md)." >&2; exit 1; }

public_var() { # value from env, else .env.production.local, else .env.production
  local name="$1" v="${!1:-}"
  for f in .env.production.local .env.production; do
    [[ -n "$v" ]] && break
    [[ -f "$f" ]] && v="$(sed -n "s/^${name}=//p" "$f" | tail -1)"
  done
  printf '%s' "$v"
}
cluster="$(public_var NEXT_PUBLIC_SOLANA_CLUSTER)"
echo "Build-time public config:"
echo "  NEXT_PUBLIC_SOLANA_CLUSTER   = ${cluster:-<unset: app default (mainnet)>}"
echo "  NEXT_PUBLIC_VAULT_PROGRAM_ID = $(public_var NEXT_PUBLIC_VAULT_PROGRAM_ID)"
if [[ -n "$cluster" && "$cluster" != "mainnet" ]]; then
  echo "WARNING: building for '$cluster', not mainnet. Production at $URL is mainnet." >&2
fi

sha="$(git rev-parse --short HEAD 2>/dev/null || echo nogit)"
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  sha="${sha}-dirty"
  echo "NOTE: working tree has uncommitted changes; deploying them as '$sha'."
fi
release="$(date -u +%Y%m%dT%H%M%SZ)-$sha"

if [[ $assume_yes -ne 1 ]]; then
  read -r -p "Deploy release $release to $HOST ($URL)? [y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "Aborted."; exit 1; }
fi

# --- Build -----------------------------------------------------------------------------------
echo "==> Building (npm run build)"
NEXT_TELEMETRY_DISABLED=1 npm run build

# --- Upload ----------------------------------------------------------------------------------
echo "==> Uploading release $release"
remote "mkdir -p $APP_DIR/releases/$release"
rsync -az --delete \
  --exclude '.next/cache/' \
  .next public package.json package-lock.json next.config.ts tsconfig.json \
  "$HOST:$APP_DIR/releases/$release/"

# --- Install production dependencies on the VPS ------------------------------------------------
echo "==> npm ci --omit=dev on the VPS"
remote "set -e; cd $APP_DIR/releases/$release && NEXT_TELEMETRY_DISABLED=1 npm ci --omit=dev --no-audit --no-fund"

# --- Switch + restart ------------------------------------------------------------------------
previous="$(remote "readlink $APP_DIR/current 2>/dev/null | xargs -r basename" || true)"
echo "==> Switching current -> $release (previous: ${previous:-none})"
switch_to "$release"

if ! health_check; then
  if [[ -n "$previous" ]]; then
    echo "==> Rolling back to $previous" >&2
    switch_to "$previous"
    health_check || true
  fi
  echo "Recent logs:" >&2
  remote "journalctl -u fitr --no-pager -n 60" >&2 || true
  exit 1
fi

# --- Prune old releases ----------------------------------------------------------------------
remote "cd $APP_DIR/releases && ls -1 | sort | head -n -$KEEP | xargs -r rm -rf"
echo "==> Deployed $release"
