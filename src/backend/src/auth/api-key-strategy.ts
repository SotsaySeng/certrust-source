/**
 * Content API auth strategy for organization API keys
 * (`Authorization: Bearer crt_...`).
 *
 * Registered after Strapi's own strategies (admin API tokens, then
 * users-permissions JWTs). Both of those pass on a token they don't
 * recognise, so a `crt_` key reaches this one; anything else is left
 * alone here.
 *
 * Once a key checks out, the request runs as the member who created it:
 * ctx.state.user is that user, so the existing tenancy checks (policies,
 * controllers) apply unchanged, and verify() applies that user's role
 * permissions exactly as users-permissions does. On top of that, the key's
 * scopes must list the route (utils/api-key-access.ts); any other route is
 * refused with 403, before the controller runs.
 *
 * ctx.state.apiKey carries { id, documentId, name, scopes, organizationId }
 * for audit logging and idempotency.
 */
import { errors } from '@strapi/utils'
import { isRouteAllowed, keyFromAuthorization } from '../utils/api-key-access'
import { requestContextStorage } from '../utils/request-context'

export const API_KEY_STRATEGY = 'api-key'

export function createApiKeyStrategy(strapi: any) {
  return {
    name: API_KEY_STRATEGY,

    async authenticate(ctx: any) {
      const token = keyFromAuthorization(ctx.request?.header?.authorization)
      if (!token) return { authenticated: false }

      const result = await strapi.service('api::api-key.api-key').resolve(token)
      if ('error' in result) return { error: result.error }
      const { key } = result

      const route = ctx.state?.route
      if (!route || !isRouteAllowed(route.method, route.path, key.scopes)) {
        throw new errors.ForbiddenError('This API key is not allowed to call this endpoint.')
      }

      const permissions = await strapi.plugin('users-permissions').service('permission')
        .findRolePermissions(key.user.role.id)
      const ability = await strapi.contentAPI.permissions.engine.generateAbility(
        permissions.map(strapi.plugin('users-permissions').service('permission').toContentAPIPermission),
      )

      ctx.state.user = key.user
      ctx.state.apiKey = {
        id: key.id,
        documentId: key.documentId,
        name: key.name,
        scopes: key.scopes,
        organizationId: key.organizationId,
      }
      const store = requestContextStorage.getStore()
      if (store) store.apiKey = { documentId: key.documentId, name: key.name, prefix: key.prefix }
      return { authenticated: true, credentials: key.user, ability }
    },

    // Same rule as users-permissions: every action in the route's scope
    // must be granted to the user's role.
    async verify(auth: any, config: any) {
      const { ability } = auth
      if (!ability) throw new errors.UnauthorizedError()
      const scope = config?.scope == null ? [] : [].concat(config.scope)
      if (!scope.every((s: string) => ability.can(s))) throw new errors.ForbiddenError()
    },
  }
}
