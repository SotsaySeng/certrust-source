/**
 * Operational hooks called by the deployment itself, not by users.
 *
 * POST /api/ops/backup is hit by the Cloudflare api Worker's cron trigger
 * (deploy/cloudflare/api/src/index.ts) to run the daily off-site backup
 * inside the container, where pg_dump and the R2 credentials live. It is
 * `auth: false` for the users-permissions layer and authenticated instead
 * by a shared secret header checked in the controller (OPS_TOKEN).
 */

const c = () => strapi.controller('api::ops.ops') as any

export default {
  routes: [
    { method: 'POST', path: '/ops/backup', handler: (ctx: any) => c().backup(ctx), config: { auth: false } },
  ],
}
