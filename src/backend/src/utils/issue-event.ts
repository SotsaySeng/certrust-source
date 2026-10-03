/**
 * The event a credential is issued for (optional). The credential keeps a
 * copy of the event's details, so editing or deleting the event later never
 * changes a certificate already issued.
 */
import { errors } from '@strapi/utils'

export interface EventSnapshot {
  name: string
  startDate: string | null
  endDate: string | null
  location: string | null
}

export interface IssueEvent {
  id: number
  snapshot: EventSnapshot
}

/** null when no event was chosen; throws when the event can't be used for this achievement. */
export async function resolveIssueEvent(eventDocumentId: unknown, achievement: any, organization: any): Promise<IssueEvent | null> {
  if (eventDocumentId == null || eventDocumentId === '') return null
  const event: any = await strapi.documents('api::event.event').findOne({
    documentId: String(eventDocumentId),
    populate: ['organization', 'achievement'],
  } as any)
  if (!event) throw new errors.ValidationError('The selected event no longer exists. Choose another event.')
  if (!organization || event.organization?.documentId !== organization.documentId) {
    throw new errors.ForbiddenError('The selected event belongs to another organization.')
  }
  if (event.achievement && event.achievement.documentId !== achievement.documentId) {
    throw new errors.ValidationError('The selected event is for a different achievement.')
  }
  return {
    id: event.id,
    snapshot: {
      name: event.name,
      startDate: event.startDate ?? null,
      endDate: event.endDate ?? null,
      location: event.location ?? null,
    },
  }
}
