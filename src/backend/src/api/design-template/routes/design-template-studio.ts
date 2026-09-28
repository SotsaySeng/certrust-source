/**
 * Design Studio routes on design templates. This file sorts before
 * design-template.ts so the literal paths (/limits, /render-preview) are
 * registered before the core router's /design-templates/:id.
 *
 * String handlers get Strapi's implicit route scope
 * (api::design-template.design-template.<action>), granted to signed-in
 * roles in bootstrap/permissions-setup.ts. The Admin > Design library
 * routes use function handlers with `scope: []` and are guarded by
 * global::is-platform-admin instead (same as api/trust/routes/trust.ts).
 */
const c = () => strapi.controller('api::design-template.design-template') as any
const platformAdmin = { auth: { strategies: ['users-permissions'], scope: [] }, policies: ['global::is-platform-admin'] }

export default {
  routes: [
    { method: 'GET', path: '/design-templates/admin/library', handler: (ctx: any) => c().adminLibrary(ctx), config: platformAdmin },
    { method: 'PUT', path: '/design-templates/admin/order', handler: (ctx: any) => c().adminReorder(ctx), config: platformAdmin },
    { method: 'PUT', path: '/design-templates/admin/:id', handler: (ctx: any) => c().adminUpdate(ctx), config: platformAdmin },
    {
      method: 'GET',
      path: '/design-templates/limits',
      handler: 'design-template.limits',
      config: { auth: { strategies: ['users-permissions'] } },
    },
    {
      method: 'POST',
      path: '/design-templates/render-preview',
      handler: 'design-template.renderPreview',
      config: { auth: { strategies: ['users-permissions'] } },
    },
    {
      method: 'POST',
      path: '/design-templates/:id/use',
      handler: 'design-template.use',
      config: { auth: { strategies: ['users-permissions'] } },
    },
  ],
}
