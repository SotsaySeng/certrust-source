# Deploying Certrust on Cloudflare

| What | Where |
|---|---|
| Website (Nuxt) | `https://certrust.app`: Worker `certrust-web` ([web/wrangler.jsonc](web/wrangler.jsonc)) |
| Backend (Strapi) | `https://api.certrust.app`: Worker `certrust-api` in front of one Cloudflare Container ([api/](api/)) |
| Database | Neon Postgres 18 |
| Uploaded images | R2 bucket `certrust-files`, served at `https://files.certrust.app` |
| Backups | R2 bucket `certrust-backups`: daily and pre-deploy DB dumps, plus a mirror of every upload |
| Email | Cloudflare Email Service SMTP, sending from `certificates@certrust.app`; `support@certrust.app` forwards to Gmail |

**Nothing important is stored on the container's disk.** Cloudflare wipes it on every sleep, redeploy and rebuild. The backend refuses to start in production unless the database is Postgres and uploads go to R2 ([persistence-guard.ts](../../src/backend/src/bootstrap/persistence-guard.ts)).

## One-time setup

### 1. Wrangler

```bash
cd deploy/cloudflare/api && npm install && npx wrangler login
```

### 2. Email (Cloudflare dashboard → certrust.app)

- **Email → Email Routing:** enable it, add your Gmail as a destination (confirm the verification email), then create the rule `support@certrust.app` → your Gmail.
- **Email → Email Sending:** onboard `certrust.app`. This adds the SPF, DKIM and DMARC DNS records. Check the daily sending quota it shows: new accounts start conservative.
- **My Profile → API Tokens → Create Token:** permission **Email Sending: Edit**. This becomes `SMTP_PASSWORD`.

### 3. Neon

Create a project on **Postgres 18** (the local database and the container's `pg_dump` are both 18), in the region nearest your users (Sydney, `aws-ap-southeast-2`, for New Zealand; the R2 buckets are in Oceania too). Copy the **direct** connection string (pooling switched off). This becomes `DATABASE_URL`.

### 4. R2

```bash
cd deploy/cloudflare/api
# Done 2026-09-24. Oceania (oc) placement, next to a Sydney Neon database.
npx wrangler r2 bucket create certrust-files --location oc
npx wrangler r2 bucket create certrust-backups --location oc
# public URL for uploads (certrust.app zone id)
npx wrangler r2 bucket domain add certrust-files --domain files.certrust.app --zone-id c768ccb9a063e1bfdcf04b113d3ed5b2 --min-tls 1.2
# backup retention: 30+ daily, 3 monthly, pre-deploy dumps for 90 days (Privacy Policy: deleted data leaves backups within 90 days)
npx wrangler r2 bucket lifecycle add certrust-backups daily db/daily/ --expire-days 35
npx wrangler r2 bucket lifecycle add certrust-backups monthly db/monthly/ --expire-days 90
npx wrangler r2 bucket lifecycle add certrust-backups predeploy db/predeploy/ --expire-days 90
# nothing (including a leaked key) can delete a DB backup younger than 30 days
npx wrangler r2 bucket lock add certrust-backups db-30d db/ --retention-days 30
```

Both buckets stay private on their S3 endpoint (r2.dev access is off). Only `certrust-files` is public, through `files.certrust.app`.

Then **R2 → Manage API tokens → Create API token** with **Object Read & Write** on both buckets. It provides `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`. The endpoint is `https://96a6b2385ef6ca96d3ecd5efa9175528.r2.cloudflarestorage.com` (`S3_ENDPOINT`).

### 5. Secrets

```bash
cp deploy/cloudflare/env.production.example src/backend/.env.production   # gitignored
# fill in DATABASE_URL, SMTP_PASSWORD, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
DRY_RUN=1 deploy/cloudflare/push-secrets.sh   # checks, lists key names only
deploy/cloudflare/push-secrets.sh
```

APP_KEYS, the JWT secrets and `ENCRYPTION_KEY` are copied from `src/backend/.env` automatically. They must stay identical to the data: `ENCRYPTION_KEY` decrypts every issuer's signing key. **Keep a copy of `.env.production` and `.env` in a password manager.** Without `ENCRYPTION_KEY`, a database backup cannot issue or verify anything.

## First deploy

1. Copy the local data into Neon. This is a one-off, run from `src/backend`:
   ```bash
   /Library/PostgreSQL/18/bin/pg_dump --format=custom --no-owner --no-acl \
     -h localhost -U <DATABASE_USERNAME> -d certrust -f /tmp/certrust.dump
   /Library/PostgreSQL/18/bin/pg_restore --no-owner --no-acl -d "<DATABASE_URL>" /tmp/certrust.dump
   ```
   Then upload the files the database references to `certrust-files`, and point their URLs at `https://files.certrust.app/`.
2. Start Docker Desktop. The image is built locally for linux/amd64; on Apple Silicon the first build runs under emulation and takes a while.
3. `deploy/cloudflare/deploy.sh --first`

## Every deploy after that

```bash
deploy/cloudflare/deploy.sh        # pre-deploy backup → API → website → health check
```

The backup runs first because Strapi syncs the database schema on boot: removing a field or content type from the code deletes that column's data.

## Backups and restore

- **Daily:** the `30 14 * * *` cron (02:30 NZ) calls `POST /api/ops/backup` inside the container, which dumps Neon to `db/daily/…` and mirrors new or changed uploads to `uploads/…`.
- **Manual, from this Mac:**
  ```bash
  cd src/backend
  DATABASE_CLIENT=postgres BACKUP_S3_BUCKET=certrust-backups S3_BUCKET=certrust-files S3_REGION=auto \
    PATH=/Library/PostgreSQL/18/bin:$PATH node --env-file=.env.production scripts/backup-offsite.js --label manual
  ```
- **Restore:** download a dump from `certrust-backups`. Restore it into a **new Neon branch** first and check it (`npm run restore -- --from <dir> --yes` with `DATABASE_URL` pointing at the branch). Only then promote the branch or restore into the main one.

## Useful commands

```bash
cd deploy/cloudflare/api
npx wrangler tail            # live logs from the API Worker and container
npx wrangler containers list # container status
```
