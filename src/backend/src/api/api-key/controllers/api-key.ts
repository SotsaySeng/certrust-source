/**
 * Organization API keys (Manage > API keys).
 *
 * list/create/revoke are for signed-in members only: a request made with
 * an API key never reaches them (they are not in utils/api-key-access.ts),
 * so a key cannot mint or revoke keys. `me` is the one route every key may
 * call, so an integration can check what its key is.
 */
import { factories } from '@strapi/strapi'
import { callerContext } from '../../../utils/design-studio'
import { SCOPES, routesFor } from '../../../utils/api-key-access'

const UID = 'api::api-key.api-key'

export default factories.createCoreController(UID, ({ strapi }) => ({
  async list(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
    const service = strapi.service(UID)
    return {
      data: await service.listForOrganization(caller.organizationId),
      meta: {
        apiAccess: await strapi.service('api::organization.usage').getApiAccess(caller.organization),
        scopes: SCOPES,
      },
    }
  },

  async create(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
    if (!(await strapi.service('api::organization.usage').getApiAccess(caller.organization))) {
      return ctx.forbidden('API keys are not included in your plan.', { code: 'API_ACCESS_NOT_IN_PLAN' })
    }
    const input: any = (ctx.request.body as any)?.data || {}
    const result = await strapi.service(UID).create({
      organizationId: caller.organizationId,
      userId: ctx.state.user.id,
      name: input.name,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    })
    await strapi.service('api::audit-log-entry.audit-log').record({
      action: 'api-key.create',
      entityType: 'api-key',
      entityId: result.apiKey.documentId,
      actorId: ctx.state.user.id,
      metadata: { name: result.apiKey.name, prefix: result.apiKey.prefix, scopes: result.apiKey.scopes },
    })
    // The only time the key itself is ever returned.
    return { data: { ...result.apiKey, key: result.key } }
  },

  async revoke(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
    const ok = await strapi.service(UID).revoke(caller.organizationId, String(ctx.params.id))
    if (!ok) return ctx.notFound('API key not found')
    await strapi.service('api::audit-log-entry.audit-log').record({
      action: 'api-key.revoke',
      entityType: 'api-key',
      entityId: String(ctx.params.id),
      actorId: ctx.state.user.id,
    })
    return { data: { revoked: true } }
  },

  /** What the calling key is (or, from the website, who is signed in). */
  async me(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const key = ctx.state.apiKey
    if (!key) return ctx.badRequest('This endpoint describes the API key used to call it. Send the key as a Bearer token.')
    const caller = await callerContext(ctx.state.user.id)
    return {
      data: {
        name: key.name,
        scopes: key.scopes,
        organization: caller.organization ? { documentId: caller.organization.documentId, name: caller.organization.name } : null,
        actsAs: { username: ctx.state.user.username, email: ctx.state.user.email },
        issuerProfileId: caller.profileId,
        endpoints: routesFor(key.scopes).map(r => `${r.method} /api${r.path}`),
      },
    }
  },
}))
