#!/usr/bin/env bash
# Publish the Corresponding Source of what is about to be deployed.
#
# Certrust is a modified version of Certo, licensed under the AGPL-3.0.
# Section 13 requires offering users of the network service the source of
# the version they interact with. This script mirrors a snapshot of HEAD
# (no git history) to the public repository linked from the website footer
# and the Terms, as one commit per deploy tagged `deploy-<sha>`.
#
#   scripts/publish-source.sh          # publish HEAD
#   DRY_RUN=1 scripts/publish-source.sh
#
# It refuses to publish if the working tree has uncommitted changes (what
# is deployed must be what is published) or if the secret scan finds
# anything: private keys, cloud/payment tokens, database URLs with
# passwords, or any value from the local .env files.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_REPO="${PUBLIC_SOURCE_REPO:-https://github.com/SotsaySeng/certrust-source.git}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$ROOT"
if [ -n "$(git status --porcelain --untracked-files=no -- . ':!src/backend/src/extensions/documentation')" ]; then
  echo "Uncommitted changes - commit first, so the published source matches what is deployed." >&2
  git status --short --untracked-files=no >&2
  exit 1
fi
SHA="$(git rev-parse --short HEAD)"

echo "==> Snapshot of $SHA"
mkdir -p "$WORK/snapshot"
git archive HEAD | tar -x -C "$WORK/snapshot"

echo "==> Secret scan"
fail=0
if find "$WORK/snapshot" -type f \( -name '.env' -o -name '.env.production' -o -name '.env.local' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name 'id_rsa*' -o -name '*.dump' -o -name '*.db' \) | grep -q .; then
  echo "Refusing: secret-looking files in the snapshot:" >&2
  find "$WORK/snapshot" -type f \( -name '.env' -o -name '.env.production' -o -name '.env.local' -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name 'id_rsa*' -o -name '*.dump' -o -name '*.db' \) >&2
  fail=1
fi
if grep -rIlE 'BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{10,}|rk_live_|whsec_[0-9a-zA-Z]{10,}|ghp_[0-9A-Za-z]{30,}|xox[baprs]-[0-9A-Za-z-]{10,}|postgres(ql)?://[^:@/ ]+:[^@/ ]{6,}@|npg_[0-9A-Za-z]{8,}' "$WORK/snapshot" >"$WORK/hits" 2>/dev/null; then
  echo "Refusing: secret patterns found in:" >&2
  sed "s#$WORK/snapshot/##" "$WORK/hits" >&2
  fail=1
fi
# Every real value from the local env files (never printed).
python3 - "$WORK/snapshot" "$ROOT" <<'PY' || fail=1
import os, re, sys
snap, root = sys.argv[1], sys.argv[2]
vals = set()
for f in ('src/backend/.env', 'src/backend/.env.production', 'src/frontend/.env'):
    p = os.path.join(root, f)
    if not os.path.exists(p):
        continue
    for line in open(p, errors='ignore'):
        m = re.match(r'\s*[A-Z0-9_]+\s*=\s*(.*)$', line)
        if not m:
            continue
        v = m.group(1).strip().strip('"').strip("'")
        if len(v) >= 12 and not v.startswith('http') and '@' not in v:
            vals.update(x for x in v.split(',') if len(x) >= 12)
bad = []
for dp, _, files in os.walk(snap):
    for fn in files:
        try:
            data = open(os.path.join(dp, fn), errors='ignore').read()
        except OSError:
            continue
        if any(v in data for v in vals):
            bad.append(os.path.relpath(os.path.join(dp, fn), snap))
if bad:
    print('Refusing: local .env secret values found in: ' + ', '.join(bad), file=sys.stderr)
    sys.exit(1)
print(f'   {len(vals)} env values checked, none present')
PY
[ "$fail" = "0" ] || exit 1

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY_RUN: would publish $SHA to $PUBLIC_REPO"
  exit 0
fi

echo "==> Publishing to $PUBLIC_REPO"
git clone --quiet --depth 1 "$PUBLIC_REPO" "$WORK/public" 2>/dev/null || {
  echo "Cannot clone $PUBLIC_REPO - create it on GitHub first (public, empty, no README)." >&2
  exit 1
}
cd "$WORK/public"
git rm -rq --ignore-unmatch . >/dev/null
cp -R "$WORK/snapshot/." .
git add -A
if git diff --cached --quiet; then
  echo "   already up to date"
else
  git -c user.name="Zettabyte Lab" -c user.email="support@certrust.app" commit -q -m "Source of certrust.app as deployed ($SHA)

Corresponding Source under AGPL-3.0 section 13. Certrust is a modified
version of Certo (https://github.com/schroedinger-hat/certo); see NOTICE.md."
fi
git tag -f "deploy-$SHA" >/dev/null
# GitHub answers a large HTTPS push with HTTP 400 unless the buffer is raised.
git -c http.postBuffer=524288000 push -q origin HEAD:main
git -c http.postBuffer=524288000 push -q -f origin "deploy-$SHA"
echo "   published $SHA"
