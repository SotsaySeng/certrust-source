/**
 * Custom route for the current user's organization usage/tier info.
 *
 * Named organization-usage.ts (sorting before organization.ts) to match
 * this codebase's existing profile-me.ts / profile.ts precedent for the
 * same GET-literal-vs-GET-:id-core-router ordering concern - see
 * src/api/profile/routes/profile-me.ts (/profiles/me vs /profiles/:id).
 *
 * auth.scope: [] + a function handler (not the usual 'controller.action'
 * string) - three things had to line up here, each verified directly
 * against this repo's installed @strapi/core rather than assumed:
 *
 * 1. Every api route with a *string* handler gets an implicit default
 *    auth.scope of ['api::organization.organization.usage']
 *    (register-routes.js's createRouteScopeGenerator: `if (typeof
 *    route.handler === 'string') { _.defaultsDeep(route, { config: {
 *    auth: { scope: [...] } } }) }`), which users-permissions' strategy
 *    verify() then checks against the caller's role permissions
 *    (strategies/users-permissions.js). No role has (or, per this
 *    rollout's no-auto-provisioning design, should need) an explicit
 *    content-API permission grant for organization actions -
 *    organizations are admin-panel-managed - and there's no
 *    permissions-setup.ts-equivalent available to add one from a file in
 *    this policy's scope (permissions-setup.ts is the only thing that
 *    actually seeds role permissions - config/functions/bootstrap.ts's
 *    own apiActions loop is never invoked from src/index.ts). So the
 *    implicit scope would 403 every caller, including legitimate org
 *    members.
 * 2. A *function* handler sidesteps that generator entirely (same file,
 *    same condition: scope injection is gated on `typeof route.handler
 *    === 'string'`), and compose-endpoint.js's getAction() explicitly
 *    supports function handlers as a first-class case (`if (typeof
 *    handler === 'function') return handler`) - not an implementation
 *    detail, a documented alternate path.
 * 3. But routing.js's own route-config schema requires `auth.scope` to
 *    be *present* once `auth.strategies` is given, regardless of handler
 *    type (boots with "Invalid route config config.auth.scope is a
 *    required field" otherwise) - so it must be supplied explicitly.
 *    `[]` satisfies "present" and, critically, *stays* `[]` for a
 *    function handler (defaultsDeep never runs to fill it - confirmed
 *    the opposite is true for a string handler: defaultsDeep merges
 *    arrays element-by-index, so an empty array's missing index 0 still
 *    gets filled with the default scope string via a standalone lodash
 *    repro against this project's installed version). users-permissions'
 *    verify() then runs `every(scope => ability.can(scope))` over that
 *    empty array, which is vacuously true for *any* authenticated
 *    ability - equivalent to "authenticated, no specific scope needed."
 *
 * With no effective scope requirement, any authenticated (real JWT, not
 * the anonymous "public role" identity - see is-in-organization.ts's
 * header comment on that distinction) user reaches organization.usage(),
 * which does its own authorization by resolving only ctx.state.user's
 * *own* organization.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/organizations/usage',
      handler: (ctx: any, next: any) => strapi.controller('api::organization.organization').usage(ctx, next),
      config: {
        auth: {
          strategies: ['users-permissions'],
          scope: [],
        },
      },
    },
  ],
}
