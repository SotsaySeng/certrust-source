/**
 * Custom route for creating achievements with proper tag handling
 *
 * Was auth: false (a second, fully public achievement-creation path
 * alongside the default create action) - fixed as part of the
 * multi-tenancy rollout, same as achievement.ts's create/update/delete.
 *
 * handler is a function, not the usual 'controller.action' string, and
 * auth.scope is explicitly []. Reason (verified directly, not assumed -
 * see the fuller version of this comment in
 * src/api/organization/routes/organization-usage.ts): a string handler
 * gets an implicit default auth.scope of
 * ['api::achievement.achievement.createAchievement']
 * (register-routes.js's createRouteScopeGenerator), which
 * permissions-setup.ts's AUTHENTICATED_PERMISSIONS never grants - it
 * lists 'api::achievement.achievement.create' (the *default* create
 * action, used by achievement.ts's route) but not the createAchievement
 * action this route uses. While this route was auth: false, that gap was
 * invisible (no scope check ever ran); requiring real auth here without
 * addressing it would leave this endpoint unusable by anyone, including
 * legitimate authenticated users - a functional regression, not a fix.
 * permissions-setup.ts is outside this policy's file scope, so - same
 * technique as organization-usage.ts - a function handler bypasses the
 * scope generator (gated on `typeof route.handler === 'string'`) and
 * compose-endpoint.js's getAction() explicitly supports function
 * handlers. auth.scope: [] is required to be *present* once
 * auth.strategies is set (routing.js's route-config schema), and stays
 * empty for a function handler (defaultsDeep never runs to fill it),
 * which users-permissions' verify() treats as "authenticated, no
 * specific scope needed" - the is-in-organization policy below still
 * fully applies and is the real gate here, exactly as for the default
 * create action on achievement.ts.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/achievements/create',
      handler: (ctx: any, next: any) => strapi.controller('api::achievement.achievement').createAchievement(ctx, next),
      config: {
        auth: { strategies: ['users-permissions'], scope: [] },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'body', field: 'creator' } },
        ],
      },
    },
  ],
}