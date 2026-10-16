/**
 * Consent screen for connecting an AI app. Anyone who may create API keys
 * may connect an app: a member of an organization whose plan includes API
 * access. The connection then acts as that member, like their keys do.
 */
import { factories } from '@strapi/strapi'
import { callerContext } from '../../../utils/design-studio'
import type { AuthorizeParams } from '../services/oauth'

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const

function pickParams(source: any): AuthorizeParams {
  const out: any = {}
  for (const k of PARAMS) if (typeof source?.[k] === 'string') out[k] = source[k]
  return out
}

export default factories.createCoreController('api::oauth-client.oauth-client', ({ strapi }) => ({
  async describe(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    const request = await strapi.service('api::oauth-client.oauth').describeRequest(pickParams(ctx.query))
    return {
      data: {
        ...request,
        organization: caller.organization ? { name: caller.organization.name } : null,
        apiAccess: caller.organization
          ? await strapi.service('api::organization.usage').getApiAccess(caller.organization)
          : false,
      },
    }
  },

  async decide(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const body: any = ctx.request.body || {}
    const approve = body.approve === true
    const caller = await callerContext(ctx.state.user.id)
    if (approve) {
      if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
      if (!(await strapi.service('api::organization.usage').getApiAccess(caller.organization))) {
        return ctx.forbidden('Connecting apps is not included in your plan.', { code: 'API_ACCESS_NOT_IN_PLAN' })
      }
    }
    const redirect = await strapi.service('api::oauth-client.oauth').decide({
      userId: ctx.state.user.id,
      organizationId: caller.organizationId,
      params: pickParams(body.params),
      approve,
      scopes: body.scopes,
    })
    return { data: { redirect } }
  },
}))
