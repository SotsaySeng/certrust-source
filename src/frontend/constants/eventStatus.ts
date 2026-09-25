/**
 * Event status metadata - mirrors constants/templateTypes.ts's shape for
 * the same reason (one home for the chip-color map instead of duplicating
 * it per page). Labels are NOT included here for the same reason as
 * templateTypes.ts - callers use their own useI18n() `t('events.status.' + status)`.
 */

export type EventStatus = 'draft' | 'scheduled' | 'completed' | 'cancelled'

export const EVENT_STATUSES: EventStatus[] = ['draft', 'scheduled', 'completed', 'cancelled']

export const EVENT_STATUS_CHIP_CLASSES: Record<EventStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-blue-50 text-blue-700',
  completed: 'bg-green-50 text-green-700',
  cancelled: 'bg-red-50 text-red-700',
}

export function getEventStatusChipClass(status: string): string {
  return EVENT_STATUS_CHIP_CLASSES[status as EventStatus] || EVENT_STATUS_CHIP_CLASSES.draft
}
