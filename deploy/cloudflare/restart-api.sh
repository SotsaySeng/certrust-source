#!/usr/bin/env bash
# Restart the API container so it picks up new secrets (push-secrets.sh).
#
#   deploy/cloudflare/restart-api.sh
#
# A running container keeps the settings it booted with, even across
# deploys. This stops it and waits for a fresh one (a cold start, ~1-3 min
# during which the API is unavailable). OPS_TOKEN comes from
# src/backend/.env.production and is never printed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TOKEN="$(sed -n 's/^OPS_TOKEN=//p' "$ROOT/src/backend/.env.production" | tr -d '"'"'")"
[ -n "$TOKEN" ] || { echo "OPS_TOKEN missing in src/backend/.env.production" >&2; exit 1; }

# After a deploy Cloudflare rolls the new image out first ("provisioning");
# a container restarted before that boots the previous image.
WRANGLER="$ROOT/deploy/cloudflare/api/node_modules/.bin/wrangler"
echo "Waiting for the container rollout..."
until (cd "$ROOT/deploy/cloudflare/api" && "$WRANGLER" containers list 2>/dev/null) | grep certrust-api-strapibackend | grep -vq provisioning; do
  sleep 30
done

curl -fsS -X POST -H "x-ops-token: $TOKEN" https://api.certrust.app/__ops/restart-backend
echo
echo "Waiting for the API to boot..."
for _ in $(seq 1 40); do
  if curl -fsS -o /dev/null --max-time 30 https://api.certrust.app/_health; then
    echo "API healthy."
    exit 0
  fi
  sleep 10
done
echo "API not healthy after ~10 minutes - check 'npx wrangler containers list'." >&2
exit 1
