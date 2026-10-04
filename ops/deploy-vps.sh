#!/usr/bin/env bash
# Safe deploy of the Fitr web app to the shared VPS (nginx in front, systemd unit fitr.service,
# app on 127.0.0.1:3077). Never touches other services.
#
#   1. Build locally; abort on any failure (no partial deploys).
#   2. Upload to /opt/fitr/app.new (node_modules hard-linked from the live app, so no reinstall).
#   3. Swap app.new -> app (previous kept as app.prev), restart only fitr.service.
#   4. Health-check http://127.0.0.1:3077/; if it fails, swap back and restart.
#
# Usage: ops/deploy-vps.sh            (host defaults to root@38.49.213.208)
#        FITR_HOST=root@1.2.3.4 ops/deploy-vps.sh
#        FITR_REINSTALL=1 ops/deploy-vps.sh   (run npm ci on the server, e.g. after dependency changes)
set -euo pipefail

HOST="${FITR_HOST:-root@38.49.213.208}"
cd "$(dirname "$0")/.."

echo "==> building"
NEXT_PUBLIC_SOLANA_CLUSTER="${NEXT_PUBLIC_SOLANA_CLUSTER:-mainnet}" npm run build >/tmp/fitr-build.log 2>&1 || {
  tail -30 /tmp/fitr-build.log; echo "BUILD FAILED - nothing deployed"; exit 1; }
test -f .next/BUILD_ID || { echo "no .next/BUILD_ID - nothing deployed"; exit 1; }

echo "==> preparing app.new on $HOST"
ssh -o BatchMode=yes "$HOST" 'set -e; rm -rf /opt/fitr/app.new; mkdir -p /opt/fitr/app.new
  if [ -d /opt/fitr/app/node_modules ]; then cp -al /opt/fitr/app/node_modules /opt/fitr/app.new/node_modules; fi'

echo "==> uploading"
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude '.next/cache' --exclude '.next/dev' \
  --exclude anchor --exclude android --exclude ops --exclude docs --exclude '__tests__' \
  --exclude .env --exclude '.env.local' --exclude '.env.production' \
  ./ "$HOST:/opt/fitr/app.new/"

echo "==> swapping and restarting fitr.service"
ssh -o BatchMode=yes "$HOST" "REINSTALL=${FITR_REINSTALL:-0} bash -s" <<'REMOTE'
set -e
cd /opt/fitr
chown -R fitr:fitr app.new
if [ "$REINSTALL" = "1" ]; then
  sudo -u fitr -H bash -c "cd /opt/fitr/app.new && export npm_config_cache=/opt/fitr/.npm && nice -n 15 npm ci --ignore-scripts --no-audit --no-fund >/dev/null"
fi
rm -rf app.prev
mv app app.prev
mv app.new app
systemctl restart fitr.service
for i in $(seq 1 20); do
  sleep 1
  if curl -fsS -o /dev/null -m 5 http://127.0.0.1:3077/; then echo "healthy after ${i}s"; exit 0; fi
done
echo "UNHEALTHY - rolling back"
rm -rf app.failed; mv app app.failed; mv app.prev app
systemctl restart fitr.service
sleep 5
curl -fsS -o /dev/null -m 5 http://127.0.0.1:3077/ && echo "rolled back to previous release" || echo "ROLLBACK ALSO UNHEALTHY - check journalctl -u fitr"
exit 1
REMOTE

echo "==> public check"
curl -fsS -o /dev/null -w "app.fitr.day %{http_code}\n" https://app.fitr.day/
curl -fsS -o /dev/null -w "fitr.day %{http_code}\n" https://fitr.day/
