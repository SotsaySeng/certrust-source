/**
 * Issuance jobs: issue to a large group in the background and poll for
 * progress. See services/issuance-job.ts.
 *
 * Open to signed-in members and to API keys with the `issue` scope
 * (reading a job also works with `read`). A caller only ever sees its own
 * organization's jobs.
 */
import { factories } from '@strapi/strapi'
import { callerContext } from '../../../utils/design-studio'
import { BatchIssueError } from '../../../utils/batch-issue'

const UID = 'api::issuance-job.issuance-job'

async function organizationOf(ctx: any): Promise<number | null> {
  if (!ctx.state.user) {
    ctx.unauthorized('You must be logged in.')
    return null
  }
  const caller = await callerContext(ctx.state.user.id)
  if (caller.organizationId == null) {
    ctx.forbidden('You must belong to an organization.')
    return null
  }
  return caller.organizationId
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async create(ctx) {
    const organizationId = await organizationOf(ctx)
    if (organizationId == null) return
    try {
      const job = await strapi.service(UID).create({
        organizationId,
        userId: ctx.state.user.id,
        apiKey: ctx.state.apiKey ? { documentId: ctx.state.apiKey.documentId, name: ctx.state.apiKey.name } : null,
        data: (ctx.request.body as any)?.data,
      })
      ctx.status = 202
      return { data: job }
    }
    catch (error) {
      if (!(error instanceof BatchIssueError)) throw error
      if (error.status === 404) return ctx.notFound(error.message)
      if (error.status === 403) return ctx.forbidden(error.message)
      return ctx.badRequest(error.message)
    }
  },

  async list(ctx) {
    const organizationId = await organizationOf(ctx)
    if (organizationId == null) return
    return { data: await strapi.service(UID).list(organizationId) }
  },

  async get(ctx) {
    const organizationId = await organizationOf(ctx)
    if (organizationId == null) return
    const job = await strapi.service(UID).get(organizationId, String(ctx.params.id))
    if (!job) return ctx.notFound('Job not found')
    return { data: job }
  },

  async cancel(ctx) {
    const organizationId = await organizationOf(ctx)
    if (organizationId == null) return
    const job = await strapi.service(UID).cancel(organizationId, String(ctx.params.id))
    if (!job) return ctx.notFound('Job not found')
    return { data: job }
  },
}))
