/**
 * Overrides the users-permissions plugin's `me` controller so the logged-in
 * user's `role` can actually be populated (e.g. GET /api/users/me?populate=*).
 *
 * Strapi's built-in `me` controller runs the requested `populate` through
 * strapi.contentAPI.validate.query, which doesn't allow `role` by default -
 * so any request that would include it is rejected with a 403, regardless of
 * how the Authenticated role's permissions are actually configured. Fetching
 * the role directly via strapi.db.query bypasses that unrelated validation
 * layer, which only exists to guard content-type relations, not this plugin
 * relation.
 */
export default (plugin: any) => {
  plugin.controllers.user.me = async (ctx: any) => {
    const authUser = ctx.state.user;
    if (!authUser) {
      return ctx.unauthorized();
    }

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: authUser.id },
      populate: ['role'],
    });

    if (!user) {
      return ctx.notFound();
    }

    const { password, resetPasswordToken, confirmationToken, ...safeUser } = user;
    ctx.body = safeUser;
  };

  /**
   * Overrides the users-permissions plugin's `register` controller action
   * to auto-provision an Organization + Profile for every self-registered
   * user (self-service org registration - see
   * api::organization.provisioning for the actual creation logic).
   *
   * Why here and not a user lifecycle hook: a lifecycle hook fires for
   * *every* plugin::users-permissions.user row insert, including
   * credential/services/credential.ts's findOrCreateUser() (which
   * auto-provisions recipient accounts programmatically via
   * strapi.service('plugin::users-permissions.user').add() - the
   * plugin's user *service*, never this auth.register *controller*
   * action). A lifecycle hook has no way to tell those two cases apart;
   * overriding the controller action itself naturally only fires for
   * real self-service registration through
   * POST /api/auth/local/register.
   *
   * IMPORTANT SHAPE DIFFERENCE FROM `user.me` ABOVE (found the hard way,
   * via a live 400 during this rollout's own self-validation, not
   * assumed): plugin.controllers.user is a plain object (verified in
   * @strapi/plugin-users-permissions' installed source,
   * dist/server/controllers/user.js: `user = { me(ctx) {...}, ... }`),
   * so overwriting `plugin.controllers.user.me` directly, as above,
   * mutates the exact object Strapi later uses. plugin.controllers.auth
   * is different - it's a *factory function*
   * (dist/server/controllers/auth.js: `auth = ({ strapi }) => ({
   * register(ctx) {...}, callback(ctx) {...}, ... })`), not yet called.
   * `plugin.controllers.auth.register` on the un-called factory is
   * `undefined` - assigning to it just tacks an inert property onto the
   * function object itself; Strapi later *calls*
   * plugin.controllers.auth({strapi, ...}) to build the real controller
   * object fresh, with its own closure-scoped `register`, completely
   * unaffected by that stray property. The fix is to wrap the *factory*
   * itself: call the original factory to get the real controller object,
   * override `register` on that result, and return it - same
   * "instantiate then patch" idea as `user.me`, just one level deeper
   * because of the factory indirection.
   *
   * Flow (inside the wrapped register action):
   *  1. Strip organizationName/organizationType out of the request body.
   *     The plugin's own register (verified directly against
   *     @strapi/plugin-users-permissions' installed source) validates
   *     request body keys against an allowlist (username/password/email
   *     + any configured register.allowedFields) and throws a
   *     ValidationError on anything else - these two custom fields would
   *     otherwise 400 every registration attempt that includes them.
   *  2. Delegate to the original register controller action unchanged -
   *     it does its own validation, creates the user row, and (verified
   *     directly) writes its response via ctx.send({...}) rather than a
   *     return value, so the newly-created user is read back off
   *     ctx.body afterward (Koa's ctx.body is a core delegate onto
   *     ctx.response.body, which is exactly what ctx.send(data) sets),
   *     not off a return value from originalRegister itself.
   *  3. Call provisioning.provisionForUser(...) with that user's
   *     id/email/username plus the two stripped fields.
   *
   * All three steps run inside one strapi.db.transaction(...) - verified
   * directly against @strapi/database's transaction-context.js: nested
   * entityService/strapi.db.query calls, including the plugin's own
   * internal user creation (services/user.js's add(), which calls
   * strapi.db.query(...).create() under the hood), auto-join an already-
   * open transaction via AsyncLocalStorage with zero extra plumbing. So
   * if provisionForUser throws (e.g. a bogus organizationType id), the
   * whole transaction rolls back, including the user row the plugin's
   * register already wrote - no orphaned half-registered account. One
   * residual, non-corrupting gap: if email confirmation is enabled, the
   * confirmation email is a side effect of the user row's write and
   * can't be un-sent by a later rollback - worst case is one dead
   * confirmation link, logged loudly below.
   */
  const originalAuthFactory = plugin.controllers.auth;

  plugin.controllers.auth = (params: any) => {
    const authController = originalAuthFactory(params);
    const originalRegister = authController.register;

    authController.register = async (ctx: any) => {
      const body = ctx.request.body || {};
      const { organizationName, organizationType, ...rest } = body;
      ctx.request.body = rest;

      try {
        await strapi.db.transaction(async () => {
          await originalRegister(ctx);

          const createdUser = ctx.body?.user;
          if (!createdUser) {
            // originalRegister completed without throwing but produced no
            // user on ctx.body - nothing to provision. Not expected in
            // practice (register() always ctx.send()s a user on success),
            // but fail safe rather than provisioning against nothing.
            return;
          }

          const provisioning = strapi.service('api::organization.provisioning');
          await provisioning.provisionForUser({
            userId: createdUser.id,
            userEmail: createdUser.email,
            username: createdUser.username,
            organizationName,
            organizationType,
          });
        });
      } catch (err: any) {
        strapi.log.error(`[users-permissions.register] Registration/provisioning failed, rolled back: ${err.message}`);
        throw err;
      }
    };

    return authController;
  };

  return plugin;
};
