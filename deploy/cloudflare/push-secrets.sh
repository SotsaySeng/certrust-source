#!/usr/bin/env bash
# Upload the backend's production secrets to the certrust-api Worker.
#
#   deploy/cloudflare/push-secrets.sh
#
# Reads src/backend/.env.production (see env.production.example). Blank
# APP_KEYS/.../ENCRYPTION_KEY are filled from src/backend/.env, because they
# must stay identical to the data being migrated. A blank OPS_TOKEN is
# generated and written back into .env.production.
#
# Values are written to a private temp file for `wrangler secret bulk` and
# never printed. DRY_RUN=1 checks everything and lists the key names only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROD_ENV="${PROD_ENV:-$ROOT/src/backend/.env.production}"
DEV_ENV="$ROOT/src/backend/.env"
WRANGLER="$ROOT/deploy/cloudflare/api/node_modules/.bin/wrangler"

[ -f "$PROD_ENV" ] || { echo "Missing $PROD_ENV - copy deploy/cloudflare/env.production.example there and fill it in." >&2; exit 1; }
[ -x "$WRANGLER" ] || { echo "Run 'npm install' in deploy/cloudflare/api first." >&2; exit 1; }

if ! grep -qE '^OPS_TOKEN=.+' "$PROD_ENV"; then
  token="$(openssl rand -hex 32)"
  if grep -qE '^OPS_TOKEN=' "$PROD_ENV"; then
    sed -i '' "s/^OPS_TOKEN=.*/OPS_TOKEN=$token/" "$PROD_ENV"
  else
    printf '\nOPS_TOKEN=%s\n' "$token" >> "$PROD_ENV"
  fi
  echo "Generated OPS_TOKEN (saved in .env.production)."
fi

tmp="$(mktemp)"
chmod 600 "$tmp"
trap 'rm -f "$tmp"' EXIT

node - "$PROD_ENV" "$DEV_ENV" "$tmp" <<'NODE'
const fs = require('fs')
const [prodPath, devPath, outPath] = process.argv.slice(2)

function parse(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[m[1]] = v
  }
  return out
}

const prod = parse(prodPath)
const dev = parse(devPath)
const CARRY_OVER = ['APP_KEYS', 'API_TOKEN_SALT', 'ADMIN_JWT_SECRET', 'TRANSFER_TOKEN_SALT', 'JWT_SECRET', 'ENCRYPTION_KEY']
const REQUIRED = [...CARRY_OVER, 'DATABASE_URL', 'SMTP_PASSWORD', 'S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'OPS_TOKEN']

const secrets = {}
for (const [k, v] of Object.entries(prod)) if (v !== '') secrets[k] = v
for (const k of CARRY_OVER) if (!secrets[k] && dev[k]) secrets[k] = dev[k]

const missing = REQUIRED.filter(k => !secrets[k])
if (missing.length) {
  console.error(`Missing in .env.production: ${missing.join(', ')}`)
  process.exit(1)
}
fs.writeFileSync(outPath, JSON.stringify(secrets))
console.log(`Uploading ${Object.keys(secrets).length} secrets: ${Object.keys(secrets).sort().join(', ')}`)
NODE

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN=1: nothing uploaded."
  exit 0
fi

cd "$ROOT/deploy/cloudflare/api"
"$WRANGLER" secret bulk "$tmp"
echo "Done. Redeploy (deploy.sh) or wait for the next container start for them to take effect."
