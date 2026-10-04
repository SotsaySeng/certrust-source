/**
 * Issuing one achievement to many recipients. Shared by the batch-issue
 * request (credential controller) and background issuance jobs, so both
 * validate and issue in exactly the same way.
 */
import { cleanCustomFields, orgCustomAttributes, overridesFromBody, resolveIssueDesigns } from './issue-design'
import { resolveIssueEvent } from './issue-event'

// Recipients issued at once.
export const BATCH_ISSUE_CONCURRENCY = 4

/** Like Promise.all(items.map(fn)), with at most `limit` running at once. Keeps order. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** A problem with the batch as a whole (not one recipient), with the HTTP status it maps to. */
export class BatchIssueError extends Error {
  constructor(message: string, readonly status: 400 | 403 | 404) {
    super(message)
  }
}

export interface BatchContext {
  achievement: any
  designs: any
  attributeDefs: any[]
  event: any
}

export type RecipientResult =
  | { success: true, recipient: string, data: any }
  | { success: true, skipped: true, recipient: string, note: string, existing?: { id: number, credentialId: string } }
  | { success: false, recipient: string, error: string }

/**
 * Everything resolved once for the whole batch: the achievement, its
 * designs, the organization's custom attributes and the event. A problem
 * here fails the batch up front instead of every recipient separately.
 * `data` is the request's `data` object (achievementId, eventId and the
 * optional design overrides).
 */
export async function prepareBatchIssue(data: any): Promise<BatchContext> {
  if (!data?.achievementId) throw new BatchIssueError('Achievement ID is required', 400)
  const achievement: any = await strapi.entityService.findOne('api::achievement.achievement', data.achievementId, {
    populate: { creator: { populate: ['organization'] } } as any,
  })
  if (!achievement) throw new BatchIssueError('Achievement not found', 404)
  if (!achievement.creator) throw new BatchIssueError('Achievement creator not found', 400)
  if (achievement.creator?.organization?.suspendedAt) {
    throw new BatchIssueError('Your organisation is suspended pending review and cannot issue credentials', 403)
  }
  const organization = achievement.creator?.organization ?? null
  return {
    achievement,
    designs: await resolveIssueDesigns(achievement, organization, overridesFromBody(data)),
    attributeDefs: await orgCustomAttributes(organization?.id ?? null),
    event: await resolveIssueEvent(data.eventId, achievement, organization),
  }
}

/**
 * Returns the function that issues to one recipient and never throws: a
 * bad recipient gets its own error result and the rest carry on.
 *
 * With skipExisting, anyone already holding an unrevoked credential for
 * this achievement, or listed twice (tracked in `seen`), is skipped, so
 * sending the same list again never issues twice.
 */
export function createRecipientIssuer(
  batch: BatchContext,
  opts: { skipExisting: boolean, evidence?: any[], actorUserId?: number, seen?: Set<string>, logPrefix?: string },
): (recipientData: any) => Promise<RecipientResult> {
  const seen = opts.seen ?? new Set<string>()
  const { achievement, designs, attributeDefs, event } = batch
  return async (recipientData: any) => {
    try {
      const emailKey = String(recipientData?.email ?? '').trim().toLowerCase()
      if (opts.skipExisting && emailKey) {
        if (seen.has(emailKey)) {
          return { success: true, skipped: true, recipient: recipientData.email, note: 'Listed more than once in this upload' }
        }
        seen.add(emailKey)
        const existing = await strapi.db.query('api::credential.credential').findOne({
          select: ['id', 'credentialId'],
          where: {
            achievement: { documentId: achievement.documentId },
            recipient: { email: { $eqi: emailKey } },
            revoked: false,
          },
        })
        if (existing) {
          return { success: true, skipped: true, recipient: recipientData.email, note: 'Already has this credential', existing: { id: existing.id, credentialId: existing.credentialId } }
        }
      }
      const customFields = cleanCustomFields(recipientData.customFields, attributeDefs)
      const recipient = { ...recipientData }
      const expirationDate = recipientData.expirationDate || undefined
      // An expiry that is not in the future issues an already-expired
      // credential (easy to do by typing today's date into the expiry box).
      if (expirationDate) {
        const expires = new Date(expirationDate)
        if (Number.isNaN(expires.getTime())) {
          return { success: false, recipient: recipientData.email, error: `Invalid expiration date "${expirationDate}"` }
        }
        if (expires.getTime() <= Date.now()) {
          return { success: false, recipient: recipientData.email, error: 'Expiration date must be in the future (leave it empty for no expiry)' }
        }
      }
      const credential = await strapi.service('api::credential.credential').issue(
        achievement,
        recipient,
        opts.evidence ?? [],
        expirationDate,
        opts.actorUserId,
        { designs, customFields, event },
      )
      return { success: true, recipient: recipientData.email, data: credential }
    }
    catch (error: any) {
      strapi.log.error(`[${opts.logPrefix ?? 'credential.batchIssue'}] Error issuing to ${recipientData?.email}: ${error.message}`)
      return { success: false, recipient: recipientData?.email, error: error.message }
    }
  }
}
