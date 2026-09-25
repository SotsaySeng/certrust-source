/**
 * Billing routes.
 *
 * Function handlers + `auth.scope: []` for the authenticated routes, for
 * the same reason as organization/routes/organization-usage.ts (read
 * its header): a string handler would get an implicit per-action scope
 * that no role is granted, 403-ing everyone. Authorization is done in
 * the controller (org routes act only on the caller's own organization)
 * and by the global::is-platform-admin policy (admin routes).
 *
 * The webhook is public (`auth: false`); it is authenticated by Stripe's
 * signature over the raw request body instead (see config/middlewares.ts
 * `includeUnparsed`).
 */

const c = () => strapi.controller('api::billing.billing') as any

const authed = { auth: { strategies: ['users-permissions'], scope: [] } }
const platformAdmin = { ...authed, policies: ['global::is-platform-admin'] }

export default {
  routes: [
    { method: 'GET', path: '/billing/status', handler: (ctx: any) => c().status(ctx), config: authed },
    { method: 'GET', path: '/billing/plans', handler: (ctx: any) => c().plans(ctx), config: authed },
    { method: 'POST', path: '/billing/checkout', handler: (ctx: any) => c().checkout(ctx), config: authed },
    { method: 'POST', path: '/billing/portal', handler: (ctx: any) => c().portal(ctx), config: authed },
    { method: 'POST', path: '/billing/webhook', handler: (ctx: any) => c().webhook(ctx), config: { auth: false } },

    { method: 'GET', path: '/billing/admin/metrics', handler: (ctx: any) => c().adminMetrics(ctx), config: platformAdmin },
    { method: 'GET', path: '/billing/admin/orgs', handler: (ctx: any) => c().adminOrgs(ctx), config: platformAdmin },
    { method: 'GET', path: '/billing/admin/export', handler: (ctx: any) => c().adminExport(ctx), config: platformAdmin },
    { method: 'POST', path: '/billing/admin/run-scanner', handler: (ctx: any) => c().adminRunScanner(ctx), config: platformAdmin },
  ],
}
