/**
 * Trust & safety routes. Function handlers + `auth.scope: []` for the same
 * reason as api/billing/routes/billing.ts: authorisation is done in the
 * controller (callers act on their own organisation) and by
 * global::is-platform-admin for the admin routes.
 */

const c = () => strapi.controller('api::trust.trust') as any

const authed = { auth: { strategies: ['users-permissions'], scope: [] } }
const platformAdmin = { ...authed, policies: ['global::is-platform-admin'] }

export default {
  routes: [
    { method: 'GET', path: '/trust/verification', handler: (ctx: any) => c().myVerification(ctx), config: authed },
    { method: 'POST', path: '/trust/verification', handler: (ctx: any) => c().requestVerification(ctx), config: authed },
    { method: 'POST', path: '/trust/verification/documents', handler: (ctx: any) => c().uploadVerificationDocuments(ctx), config: authed },
    { method: 'DELETE', path: '/trust/verification/documents/:id', handler: (ctx: any) => c().deleteVerificationDocument(ctx), config: authed },
    { method: 'POST', path: '/trust/reports', handler: (ctx: any) => c().submitReport(ctx), config: { auth: false } },

    { method: 'GET', path: '/trust/admin/verifications', handler: (ctx: any) => c().adminVerifications(ctx), config: platformAdmin },
    { method: 'GET', path: '/trust/admin/verification-documents/:id', handler: (ctx: any) => c().adminDownloadDocument(ctx), config: platformAdmin },
    { method: 'POST', path: '/trust/admin/organizations/:id/verification', handler: (ctx: any) => c().adminSetVerification(ctx), config: platformAdmin },
    { method: 'POST', path: '/trust/admin/organizations/:id/suspension', handler: (ctx: any) => c().adminSetSuspension(ctx), config: platformAdmin },
    { method: 'GET', path: '/trust/admin/reports', handler: (ctx: any) => c().adminReports(ctx), config: platformAdmin },
    { method: 'POST', path: '/trust/admin/reports/:id', handler: (ctx: any) => c().adminUpdateReport(ctx), config: platformAdmin },
  ],
}
