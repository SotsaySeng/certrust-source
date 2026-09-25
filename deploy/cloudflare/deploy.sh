#!/usr/bin/env bash
# Deploy Certrust to Cloudflare: backup first, then the API (Worker + Strapi
# container), then the website.
#
#   deploy/cloudflare/deploy.sh             # normal deploy
#   deploy/cloudflare/deploy.sh --first     # very first deploy (no live data to back up yet)
#   deploy/cloudflare/deploy.sh --api-only | --web-only   [--skip-source: emergencies only]
#
# Needs: Docker Desktop running (the container image is built locally, for
# linux/amd64), `wrangler login` done, secrets pushed (push-secrets.sh), and
# the local PostgreSQL 18 pg_dump (/Library/PostgreSQL/18/bin) for the
# pre-deploy backup.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WRANGLER="$ROOT/deploy/cloudflare/api/node_modules/.bin/wrangler"
PROD_ENV="$ROOT/src/backend/.env.production"
PG_BIN="${PG_BIN:-/Library/PostgreSQL/18/bin}"  # EDB PostgreSQL 18 installer
# Node 22: the backend toolchain does not support the newer default node.
export PATH="/usr/local/bin:$PG_BIN:$PATH"

FIRST=0; DO_API=1; DO_WEB=1; PUBLISH_SOURCE=1
for arg in "$@"; do
  case "$arg" in
    --first) FIRST=1 ;;
    --skip-source) PUBLISH_SOURCE=0 ;;
    --api-only) DO_WEB=0 ;;
    --web-only) DO_API=0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

[ -x "$WRANGLER" ] || { echo "Run 'npm install' in deploy/cloudflare/api first." >&2; exit 1; }

# 0. AGPL-3.0 s.13: publish the source of exactly what is being deployed
#    (scripts/publish-source.sh - refuses on uncommitted changes or secrets).
if [ "$PUBLISH_SOURCE" = "1" ]; then
  echo "==> Publishing Corresponding Source"
  "$ROOT/scripts/publish-source.sh"
else
  echo "WARNING: --skip-source: the public source mirror will not match this deploy. Run scripts/publish-source.sh as soon as possible." >&2
fi

# 1. Backup before anything changes. Strapi syncs the database schema on
#    boot, so a deploy that drops a field or content type deletes that data.
if [ "$DO_API" = "1" ] && [ "$FIRST" = "0" ]; then
  [ -f "$PROD_ENV" ] || { echo "Missing $PROD_ENV (needed for the pre-deploy backup)." >&2; exit 1; }
  echo "==> Pre-deploy backup"
  ( cd "$ROOT/src/backend" && \
    DATABASE_CLIENT=postgres BACKUP_S3_BUCKET=certrust-backups S3_BUCKET=certrust-files \
    S3_REGION=auto S3_FORCE_PATH_STYLE=true \
    node --env-file="$PROD_ENV" scripts/backup-offsite.js --label predeploy )
fi

# 2. API: builds src/backend/Dockerfile and rolls out the container.
if [ "$DO_API" = "1" ]; then
  docker info >/dev/null 2>&1 || { echo "Docker is not running - open Docker Desktop first." >&2; exit 1; }
  echo "==> Deploying certrust-api"
  ( cd "$ROOT/deploy/cloudflare/api" && "$WRANGLER" deploy )
fi

# 3. Website: the public URLs are baked in at build time.
if [ "$DO_WEB" = "1" ]; then
  echo "==> Building certrust-web"
  ( cd "$ROOT/src/frontend" && rm -rf .output && \
    NITRO_PRESET=cloudflare_module \
    NUXT_PUBLIC_API_URL=https://api.certrust.app \
    NUXT_PUBLIC_WEBSITE_URL=https://certrust.app \
    npx nuxt build )
  echo "==> Deploying certrust-web"
  ( cd "$ROOT/deploy/cloudflare/web" && "$WRANGLER" deploy )
fi

# 4. Smoke check. A cold backend can take up to ~2 minutes to boot.
if [ "$DO_API" = "1" ]; then
  echo "==> Waiting for https://api.certrust.app/_health"
  for _ in $(seq 1 30); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://api.certrust.app/_health || true)"
    [ "$code" = "204" ] && { echo "API healthy."; break; }
    sleep 5
  done
  [ "$code" = "204" ] || { echo "API did not report healthy (last status: $code) - check 'wrangler tail' in deploy/cloudflare/api." >&2; exit 1; }
fi
if [ "$DO_WEB" = "1" ]; then
  echo "Website: $(curl -s -o /dev/null -w '%{http_code}' https://certrust.app/) https://certrust.app/"
fi
