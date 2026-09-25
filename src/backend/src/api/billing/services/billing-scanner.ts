/**
 * Daily billing scanner: trial/renewal reminders, local-trial expiry,
 * and the past-due grace period.
 *
 * Same shape as api::credential.expiration-scanner - run daily from
 * bootstrap (src/index.ts) and on demand via POST
 * /api/billing/admin/run-scanner - and deduplicated the same way,
 * through an audit-log entry per notice, so a rerun (or a restart that
 * re-triggers the startup run) never sends the same email twice.
 *
 * Reminder windows: for each org only the *smallest* window it has
 * reached is sent. A scanner that first sees a trial with 2 days left
 * sends the 3-day reminder once, not the 7-day and 3-day ones together.
 */

import { daysUntil, type BillingSettings } from './billing'

const DAY_MS = 24 * 60 * 60 * 1000
const AUDIT_UID = 'api::audit-log-entry.audit-log-entry'

/** The smallest reminder window `daysLeft` falls within, or null if none yet. */
export function reminderWindow(daysLeft: number, windows: number[]): number | null {
  const reached = windows.filter((w) => daysLeft <= w)
  return reached.length ? Math.min(...reached) : null
}

const iso = (d: any) => new Date(d).toISOString()

export default ({ strapi }: { strapi: any }) => ({
  billing() {
    return strapi.service('api::billing.billing')
  },

  async alreadySent(orgDocumentId: string, key: string): Promise<boolean> {
    const hit = await strapi.db.query(AUDIT_UID).findOne({ where: { action: `billing.notice:${key}`, entityId: orgDocumentId } })
    return Boolean(hit)
  },

  async markSent(orgDocumentId: string, key: string) {
    await strapi.db.query(AUDIT_UID).create({
      data: { action: `billing.notice:${key}`, entityType: 'organization', entityId: orgDocumentId, actorType: 'system', metadata: { sentAt: new Date().toISOString() } },
    })
  },

  /** Send once per (org, key). Marks as sent only when the email actually went out. */
  async noticeOnce(org: any, key: string, params: any): Promise<boolean> {
    if (await this.alreadySent(org.documentId, key)) return false
    const sent = await this.billing().notify(org, params)
    if (sent) await this.markSent(org.documentId, key)
    return sent
  },

  async processOrg(org: any, settings: BillingSettings, now: Date): Promise<{ notified: number; changed: number }> {
    const billing = this.billing()
    const status = org.subscriptionStatus
    let notified = 0
    let changed = 0

    if (status === 'trialing' && org.trialEndsAt) {
      const isLocal = !org.stripeSubscriptionId
      const daysLeft = daysUntil(org.trialEndsAt, now)

      if (isLocal && new Date(org.trialEndsAt) <= now) {
        // Local trial over and never paid: back to Free. Data is untouched.
        await billing.updateOrg(org.documentId, { tier: 'free', subscriptionStatus: 'none', trialUsed: true })
        changed++
        if (await this.noticeOnce(org, `trial_ended:${iso(org.trialEndsAt)}`, { kind: 'trial_ended', date: org.trialEndsAt })) notified++
      } else {
        const w = reminderWindow(daysLeft, settings.trialReminderDays)
        if (w != null) {
          // A card-backed Stripe trial converts automatically, so it gets
          // a "you'll be charged" notice rather than "pick a plan".
          const params = isLocal
            ? { kind: 'trial_ending', daysLeft, date: org.trialEndsAt, tier: org.tier }
            : { kind: 'renewal_upcoming', daysLeft, date: org.trialEndsAt, tier: org.billedTier ?? org.tier }
          if (await this.noticeOnce(org, `trial_ending:${w}d:${iso(org.trialEndsAt)}`, params)) notified++
        }
      }
    } else if (status === 'active' && org.currentPeriodEnd && !org.cancelAtPeriodEnd) {
      const daysLeft = daysUntil(org.currentPeriodEnd, now)
      const w = daysLeft >= 0 ? reminderWindow(daysLeft, settings.renewalReminderDays) : null
      if (w != null) {
        const params = { kind: 'renewal_upcoming', daysLeft, date: org.currentPeriodEnd, tier: org.billedTier ?? org.tier }
        if (await this.noticeOnce(org, `renewal:${w}d:${iso(org.currentPeriodEnd)}`, params)) notified++
      }
    } else if (status === 'past_due') {
      const since = org.pastDueSince ? new Date(org.pastDueSince) : now
      if (!org.pastDueSince) {
        await billing.updateOrg(org.documentId, { pastDueSince: now })
        changed++
      }
      const graceEnd = new Date(since.getTime() + settings.pastDueGraceDays * DAY_MS)
      if (now >= graceEnd) {
        if (org.tier !== 'free') {
          // Stripe keeps retrying the card; if it succeeds later the
          // subscription.updated -> active webhook restores the paid tier.
          await billing.updateOrg(org.documentId, { tier: 'free' })
          changed++
          if (await this.noticeOnce(org, `downgraded:${iso(since)}`, { kind: 'downgraded' })) notified++
        }
      } else {
        const daysLeft = daysUntil(graceEnd, now)
        const day = now.toISOString().slice(0, 10)
        const params = { kind: 'past_due_reminder', daysLeft, date: graceEnd, tier: org.billedTier ?? org.tier }
        // The failure email already went out on the day it failed.
        if (day !== since.toISOString().slice(0, 10) && (await this.noticeOnce(org, `past_due:${day}`, params))) notified++
      }
    }

    return { notified, changed }
  },

  async runDailyCheck(now = new Date()): Promise<{ checked: number; notified: number; changed: number; errors: number }> {
    const billing = this.billing()
    const settings: BillingSettings = await billing.getSettings()
    const orgs: any[] = await strapi.db.query('api::organization.organization').findMany({
      where: { publishedAt: { $notNull: true }, subscriptionStatus: { $in: ['trialing', 'active', 'past_due'] } },
      populate: ['members'],
    })

    let notified = 0
    let changed = 0
    let errors = 0
    for (const org of orgs) {
      try {
        const r = await this.processOrg(org, settings, now)
        notified += r.notified
        changed += r.changed
      } catch (err: any) {
        errors++
        strapi.log.error(`[billing-scanner] ${org.documentId}: ${err.message}`)
      }
    }
    strapi.log.info(`[billing-scanner] ${orgs.length} checked, ${notified} notified, ${changed} changed, ${errors} errors`)
    return { checked: orgs.length, notified, changed, errors }
  },
})
