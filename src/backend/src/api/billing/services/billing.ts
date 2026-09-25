/**
 * Billing service - trials, Stripe Checkout/Portal, and webhook handling.
 *
 * `organization.tier` stays the *effective* tier that every existing
 * limit check already reads (credential/design-template/achievement
 * beforeCreate hooks via organization/services/usage.ts). Billing only
 * ever writes that one field plus its own bookkeeping fields, so no
 * limit-enforcement code had to change.
 *
 * All organization writes go through updateOrg(), which uses
 * strapi.db.query().updateMany({ where: { documentId } }) - an in-place
 * write to both the draft and published rows. organization is
 * draftAndPublish, and entityService.update()/documents().update() on a
 * draftAndPublish type republishes by deleting the published row and
 * cloning the draft under a new numeric id, orphaning everything that
 * pointed at the old one (profiles, design templates, events). Never
 * use those for billing writes.
 *
 * Webhook handlers read everything they need from the event payload
 * (subscription metadata carries orgDocumentId/tier/interval) and make
 * no Stripe API calls, so they are deterministic and testable offline.
 */

import type Stripe from 'stripe'
import { errors } from '@strapi/utils'
import {
  getStripe,
  isStripeConfigured,
  planForPriceId,
  priceIdFor,
  type BillingInterval,
  type PaidTier,
} from '../lib/stripe'
import { generateBillingEmail, type BillingEmailParams } from '../templates/billing-emails'

const { ApplicationError, ValidationError } = errors

const ORG_UID = 'api::organization.organization'
const PAYMENT_UID = 'api::payment.payment'
const DAY_MS = 24 * 60 * 60 * 1000

export interface BillingSettings {
  trialDays: number
  trialTier: PaidTier
  trialRequiresCard: boolean
  trialReminderDays: number[]
  renewalReminderDays: number[]
  pastDueGraceDays: number
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  trialDays: 14,
  trialTier: 'pro',
  trialRequiresCard: false,
  trialReminderDays: [7, 3, 1],
  renewalReminderDays: [30, 7, 1],
  pastDueGraceDays: 7,
}

const toDays = (value: unknown, fallback: number[]): number[] => {
  if (!Array.isArray(value)) return fallback
  const days = value.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
  return days.length ? Array.from(new Set(days)).sort((a, b) => a - b) : fallback
}

export const unixToDate = (s: number | null | undefined): Date | null => (s ? new Date(s * 1000) : null)

export const daysUntil = (date: Date | string, now: Date): number =>
  Math.ceil((new Date(date).getTime() - now.getTime()) / DAY_MS)

/** Stripe subscription status -> this app's subscriptionStatus. null = leave unchanged. */
export function mapSubscriptionStatus(status: string): 'trialing' | 'active' | 'past_due' | 'canceled' | null {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      // 'incomplete' / 'paused': first payment not done yet - don't grant or revoke anything.
      return null
  }
}

/** The plan a subscription is on, from its first item's price (falls back to metadata). */
export function planForSubscription(sub: any): { tier: PaidTier; interval: BillingInterval } | null {
  const item = sub?.items?.data?.[0]
  const fromPrice = planForPriceId(item?.price?.id)
  if (fromPrice) return fromPrice
  const tier = sub?.metadata?.tier
  const interval = sub?.metadata?.interval ?? item?.price?.recurring?.interval
  if ((tier === 'pro' || tier === 'enterprise') && (interval === 'month' || interval === 'year')) {
    return { tier, interval }
  }
  return null
}

/** Invoice fields moved around across Stripe API versions - read both shapes. */
export function invoiceSubscriptionInfo(invoice: any): { subscriptionId: string | null; metadata: Record<string, string> } {
  const details = invoice?.parent?.subscription_details
  const sub = details?.subscription ?? invoice?.subscription ?? null
  return {
    subscriptionId: typeof sub === 'string' ? sub : sub?.id ?? null,
    metadata: details?.metadata ?? invoice?.subscription_details?.metadata ?? {},
  }
}

const customerIdOf = (c: any): string | null => (typeof c === 'string' ? c : c?.id ?? null)

export type BannerKind = 'trial_ending' | 'trial_ended' | 'past_due' | 'canceling'

export default ({ strapi }: { strapi: any }) => ({
  async getSettings(): Promise<BillingSettings> {
    const s: any = await strapi.documents('api::billing-settings.billing-settings').findFirst().catch(() => null)
    if (!s) return { ...DEFAULT_BILLING_SETTINGS }
    return {
      trialDays: Number.isFinite(s.trialDays) ? s.trialDays : DEFAULT_BILLING_SETTINGS.trialDays,
      trialTier: s.trialTier === 'enterprise' ? 'enterprise' : 'pro',
      trialRequiresCard: Boolean(s.trialRequiresCard),
      trialReminderDays: toDays(s.trialReminderDays, DEFAULT_BILLING_SETTINGS.trialReminderDays),
      renewalReminderDays: toDays(s.renewalReminderDays, DEFAULT_BILLING_SETTINGS.renewalReminderDays),
      pastDueGraceDays: Number.isFinite(s.pastDueGraceDays) ? s.pastDueGraceDays : DEFAULT_BILLING_SETTINGS.pastDueGraceDays,
    }
  },

  // ---------------------------------------------------------------- orgs

  /** The published organization row by documentId. */
  async findOrg(documentId: string | null | undefined): Promise<any | null> {
    if (!documentId) return null
    return strapi.db.query(ORG_UID).findOne({
      where: { documentId, publishedAt: { $notNull: true } },
      populate: ['members'],
    })
  },

  async findOrgByCustomer(customerId: string | null | undefined): Promise<any | null> {
    if (!customerId) return null
    return strapi.db.query(ORG_UID).findOne({
      where: { stripeCustomerId: customerId, publishedAt: { $notNull: true } },
      populate: ['members'],
    })
  },

  /** The calling user's own organization (same tenancy rule as the rest of the app). */
  async findOrgForUser(userId: number): Promise<any | null> {
    const orgId = await strapi.service('api::profile.multi-tenancy').getUserOrganizationId(userId)
    if (!orgId) return null
    const row: any = await strapi.db.query(ORG_UID).findOne({ where: { id: orgId } })
    return row ? this.findOrg(row.documentId) : null
  },

  async listOrgs(): Promise<any[]> {
    return strapi.db.query(ORG_UID).findMany({ where: { publishedAt: { $notNull: true } } })
  },

  /** In-place write to draft + published rows. See the header comment for why. */
  async updateOrg(documentId: string, data: Record<string, any>) {
    await strapi.db.query(ORG_UID).updateMany({ where: { documentId }, data })
  },

  /** Fields for a brand-new organization (used by self-service provisioning). */
  async initialBillingFields(now = new Date()): Promise<Record<string, any>> {
    const settings = await this.getSettings()
    if (settings.trialDays <= 0 || settings.trialRequiresCard) {
      return { tier: 'free', subscriptionStatus: 'none' }
    }
    return {
      tier: settings.trialTier,
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(now.getTime() + settings.trialDays * DAY_MS),
      trialUsed: true,
    }
  },

  /**
   * One-off launch migration (idempotent): organizations that predate
   * billing have subscriptionStatus = null. Free orgs get a fresh trial;
   * orgs already on pro/enterprise were granted that by hand, so they are
   * marked 'none' and keep their tier (a trial would downgrade them when
   * it ended).
   */
  async migrateExistingOrgs(now = new Date()): Promise<{ trials: number; kept: number }> {
    const rows: any[] = await strapi.db.query(ORG_UID).findMany({
      where: { publishedAt: { $notNull: true }, subscriptionStatus: { $null: true } },
    })
    let trials = 0
    let kept = 0
    for (const org of rows) {
      if (org.tier === 'free' || !org.tier) {
        const fields = await this.initialBillingFields(now)
        await this.updateOrg(org.documentId, fields)
        if (fields.subscriptionStatus === 'trialing') trials++
        else kept++
      } else {
        await this.updateOrg(org.documentId, { subscriptionStatus: 'none' })
        kept++
      }
    }
    return { trials, kept }
  },

  // ------------------------------------------------------------- status

  statusFor(org: any, settings: BillingSettings, now = new Date()) {
    const status = org.subscriptionStatus || 'none'
    const isLocalTrial = status === 'trialing' && !org.stripeSubscriptionId
    const trialDaysLeft = org.trialEndsAt ? Math.max(0, daysUntil(org.trialEndsAt, now)) : null

    let banner: { kind: BannerKind; daysLeft?: number | null; date?: string | null } | null = null
    if (isLocalTrial && trialDaysLeft != null && trialDaysLeft <= Math.max(7, ...settings.trialReminderDays)) {
      banner = { kind: 'trial_ending', daysLeft: trialDaysLeft, date: org.trialEndsAt }
    } else if (status === 'past_due') {
      const graceEnd = org.pastDueSince ? new Date(new Date(org.pastDueSince).getTime() + settings.pastDueGraceDays * DAY_MS) : null
      banner = { kind: 'past_due', daysLeft: graceEnd ? Math.max(0, daysUntil(graceEnd, now)) : null, date: graceEnd?.toISOString() ?? null }
    } else if (status === 'none' && org.tier === 'free' && org.trialUsed && org.trialEndsAt && new Date(org.trialEndsAt) <= now && daysUntil(org.trialEndsAt, now) > -30) {
      banner = { kind: 'trial_ended', date: org.trialEndsAt }
    } else if (status === 'active' && org.cancelAtPeriodEnd) {
      banner = { kind: 'canceling', date: org.currentPeriodEnd, daysLeft: org.currentPeriodEnd ? daysUntil(org.currentPeriodEnd, now) : null }
    }

    const hasSubscription = Boolean(org.stripeSubscriptionId) && ['trialing', 'active', 'past_due'].includes(status)

    return {
      organization: { documentId: org.documentId, name: org.name },
      tier: org.tier,
      subscriptionStatus: status,
      billedTier: org.billedTier ?? null,
      billingInterval: org.billingInterval ?? null,
      trialEndsAt: org.trialEndsAt ?? null,
      trialDaysLeft,
      isLocalTrial,
      currentPeriodEnd: org.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: Boolean(org.cancelAtPeriodEnd),
      hasSubscription,
      canManageBilling: Boolean(org.stripeCustomerId),
      // A manually granted plan: paid tier with no Stripe subscription behind it.
      isManualPlan: status === 'none' && org.tier !== 'free',
      banner,
      stripeConfigured: isStripeConfigured(),
      trialRequiresCard: settings.trialRequiresCard,
      trialDays: settings.trialDays,
    }
  },

  // ----------------------------------------------------- Stripe sessions

  frontendUrl(): string {
    return String(strapi.config.get('frontend.url', 'http://localhost:3000')).replace(/\/$/, '')
  },

  async ensureCustomer(org: any, fallbackEmail: string): Promise<string> {
    if (org.stripeCustomerId) return org.stripeCustomerId
    const customer = await getStripe().customers.create({
      name: org.name,
      email: org.billingEmail || fallbackEmail,
      metadata: { orgDocumentId: org.documentId },
    })
    await this.updateOrg(org.documentId, { stripeCustomerId: customer.id })
    return customer.id
  },

  async createCheckout(org: any, user: any, tier: string, interval: string): Promise<string> {
    if (!isStripeConfigured()) throw new ApplicationError('Online payments are not set up yet.')
    if (tier !== 'pro' && tier !== 'enterprise') throw new ValidationError('tier must be pro or enterprise')
    if (interval !== 'month' && interval !== 'year') throw new ValidationError('interval must be month or year')
    const price = priceIdFor(tier, interval)
    if (!price) throw new ApplicationError(`No Stripe price is configured for ${tier} (${interval}ly).`)

    if (org.stripeSubscriptionId && ['trialing', 'active', 'past_due'].includes(org.subscriptionStatus)) {
      throw new ApplicationError('This organization already has a subscription. Use "Manage billing" to change it.')
    }

    const settings = await this.getSettings()
    const now = new Date()
    const customer = await this.ensureCustomer(org, user.email)

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: { orgDocumentId: org.documentId, tier, interval },
    }
    // Paying mid-trial keeps the rest of the trial: first charge happens
    // when it would have ended. Stripe needs trial_end >= 48h out.
    if (org.subscriptionStatus === 'trialing' && org.trialEndsAt && new Date(org.trialEndsAt).getTime() - now.getTime() > 2 * DAY_MS) {
      subscriptionData.trial_end = Math.floor(new Date(org.trialEndsAt).getTime() / 1000)
    } else if (settings.trialRequiresCard && !org.trialUsed && settings.trialDays > 0) {
      subscriptionData.trial_period_days = settings.trialDays
    }

    const base = this.frontendUrl()
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: org.documentId,
      line_items: [{ price, quantity: 1 }],
      subscription_data: subscriptionData,
      allow_promotion_codes: true,
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/billing?checkout=cancel`,
    })
    if (!session.url) throw new ApplicationError('Stripe did not return a checkout URL.')
    return session.url
  },

  async createPortal(org: any): Promise<string> {
    if (!isStripeConfigured()) throw new ApplicationError('Online payments are not set up yet.')
    if (!org.stripeCustomerId) throw new ApplicationError('This organization has no billing account yet.')
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${this.frontendUrl()}/billing`,
    })
    return session.url
  },

  // ------------------------------------------------------------ webhooks

  /**
   * Stripe retries deliveries, so each event id is handled once. The
   * marker is written only after the handler succeeds: a failed handler
   * returns 500 and Stripe's retry gets a clean second attempt.
   */
  async isEventProcessed(eventId: string): Promise<boolean> {
    const existing = await strapi.db.query('api::audit-log-entry.audit-log-entry').findOne({
      where: { action: 'billing.stripe_event', entityId: eventId },
    })
    return Boolean(existing)
  },

  async recordEvent(eventId: string, type: string) {
    await strapi.db.query('api::audit-log-entry.audit-log-entry').create({
      data: { action: 'billing.stripe_event', entityType: 'stripe_event', entityId: eventId, actorType: 'system', metadata: { type } },
    })
  },

  async handleEvent(event: { id: string; type: string; data: { object: any } }): Promise<{ handled: boolean; duplicate?: boolean }> {
    const obj = event.data.object
    const handlers: Record<string, () => Promise<void>> = {
      'checkout.session.completed': () => this.onCheckoutCompleted(obj),
      'customer.subscription.created': () => this.applySubscription(obj),
      'customer.subscription.updated': () => this.applySubscription(obj),
      'customer.subscription.deleted': () => this.onSubscriptionDeleted(obj),
      'invoice.paid': () => this.onInvoice(obj, 'paid'),
      'invoice.payment_failed': () => this.onInvoice(obj, 'failed'),
    }
    const handler = handlers[event.type]
    if (!handler) return { handled: false }
    if (await this.isEventProcessed(event.id)) return { handled: true, duplicate: true }
    await handler()
    await this.recordEvent(event.id, event.type)
    return { handled: true }
  },

  async resolveOrg(metadata: Record<string, any> | null | undefined, customer: any): Promise<any | null> {
    return (await this.findOrg(metadata?.orgDocumentId)) ?? (await this.findOrgByCustomer(customerIdOf(customer)))
  },

  async onCheckoutCompleted(session: any) {
    const org = (await this.findOrg(session.client_reference_id)) ?? (await this.findOrgByCustomer(customerIdOf(session.customer)))
    if (!org) return
    const customer = customerIdOf(session.customer)
    const subscription = customerIdOf(session.subscription)
    await this.updateOrg(org.documentId, {
      ...(customer ? { stripeCustomerId: customer } : {}),
      ...(subscription ? { stripeSubscriptionId: subscription } : {}),
    })
  },

  async applySubscription(sub: any) {
    const org = await this.resolveOrg(sub.metadata, sub.customer)
    if (!org) {
      strapi.log.warn(`[billing] subscription ${sub.id}: no matching organization`)
      return
    }
    // An old subscription's late event must not clobber the current one.
    if (org.stripeSubscriptionId && org.stripeSubscriptionId !== sub.id && ['active', 'trialing'].includes(org.subscriptionStatus) && sub.status !== 'active' && sub.status !== 'trialing') {
      return
    }
    const status = mapSubscriptionStatus(sub.status)
    const plan = planForSubscription(sub)
    const item = sub.items?.data?.[0]
    const periodEnd = unixToDate(item?.current_period_end ?? sub.current_period_end)

    const data: Record<string, any> = {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerIdOf(sub.customer) ?? org.stripeCustomerId,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end || sub.cancel_at),
      currentPeriodEnd: periodEnd,
    }
    if (plan) {
      data.billedTier = plan.tier
      data.billingInterval = plan.interval
    }

    if (status === 'trialing') {
      Object.assign(data, { subscriptionStatus: 'trialing', trialEndsAt: unixToDate(sub.trial_end), trialUsed: true, pastDueSince: null })
      if (plan) data.tier = plan.tier
    } else if (status === 'active') {
      Object.assign(data, { subscriptionStatus: 'active', pastDueSince: null, canceledAt: null })
      if (plan) data.tier = plan.tier
    } else if (status === 'past_due') {
      Object.assign(data, { subscriptionStatus: 'past_due', pastDueSince: org.pastDueSince ?? new Date() })
    } else if (status === 'canceled') {
      Object.assign(data, { subscriptionStatus: 'canceled', tier: 'free', canceledAt: unixToDate(sub.ended_at) ?? new Date() })
    }
    await this.updateOrg(org.documentId, data)
  },

  async onSubscriptionDeleted(sub: any) {
    const org = await this.resolveOrg(sub.metadata, sub.customer)
    if (!org) return
    if (org.stripeSubscriptionId && org.stripeSubscriptionId !== sub.id) return
    await this.updateOrg(org.documentId, {
      subscriptionStatus: 'canceled',
      tier: 'free',
      cancelAtPeriodEnd: false,
      canceledAt: unixToDate(sub.ended_at) ?? new Date(),
      pastDueSince: null,
    })
    this.notifyInBackground(org, { kind: 'downgraded' })
  },

  async onInvoice(invoice: any, status: 'paid' | 'failed') {
    const { subscriptionId, metadata } = invoiceSubscriptionInfo(invoice)
    if (!subscriptionId) return // one-off invoices are not subscription revenue
    const org = await this.resolveOrg(metadata, invoice.customer)
    const line = invoice.lines?.data?.[0]
    const plan =
      planForPriceId(line?.pricing?.price_details?.price ?? line?.price?.id) ??
      (metadata.tier ? { tier: metadata.tier as PaidTier, interval: metadata.interval as BillingInterval } : null)
    const amount = status === 'paid' ? invoice.amount_paid : invoice.amount_due

    // $0 invoices (trial start) are not revenue.
    if (amount > 0) {
      const data = {
        stripeInvoiceId: invoice.id,
        stripeSubscriptionId: subscriptionId,
        organizationDocumentId: org?.documentId ?? null,
        organizationName: org?.name ?? invoice.customer_name ?? null,
        amount,
        currency: invoice.currency ?? 'usd',
        status,
        tier: plan?.tier ?? null,
        interval: plan?.interval ?? null,
        paidAt: status === 'paid' ? unixToDate(invoice.status_transitions?.paid_at) ?? new Date() : null,
        periodStart: unixToDate(line?.period?.start ?? invoice.period_start),
        periodEnd: unixToDate(line?.period?.end ?? invoice.period_end),
      }
      const existing = await strapi.db.query(PAYMENT_UID).findOne({ where: { stripeInvoiceId: invoice.id } })
      if (existing) await strapi.db.query(PAYMENT_UID).update({ where: { id: existing.id }, data })
      else await strapi.db.query(PAYMENT_UID).create({ data })
    }

    if (!org) return
    if (status === 'paid') {
      if (amount > 0) {
        this.notifyInBackground(org, {
          kind: 'payment_received',
          amount,
          currency: invoice.currency,
          tier: plan?.tier ?? org.billedTier,
          date: unixToDate(line?.period?.end),
        })
      }
    } else {
      if (!org.pastDueSince) await this.updateOrg(org.documentId, { pastDueSince: new Date() })
      this.notifyInBackground(org, { kind: 'payment_failed', amount, currency: invoice.currency, tier: plan?.tier ?? org.billedTier })
    }
  },

  // -------------------------------------------------------------- email

  /**
   * billingEmail, else the org's members, else the owners of its profiles.
   * Self-registered orgs have no `members` rows - ownership runs through
   * profile.owner (see organization/services/provisioning.ts) - and orgs
   * created before billing have no billingEmail, so the last fallback is
   * what reaches most of them.
   */
  async recipientsFor(org: any): Promise<string[]> {
    if (org.billingEmail) return [org.billingEmail]
    const members = (org.members ?? []).map((m: any) => m.email).filter(Boolean)
    if (members.length) return Array.from(new Set(members))
    const profiles: any[] = await strapi.db.query('api::profile.profile').findMany({
      where: { organization: { documentId: org.documentId }, publishedAt: { $notNull: true } },
      populate: ['owner'],
    })
    return Array.from(new Set(profiles.map((p) => p.owner?.email).filter(Boolean)))
  },

  /**
   * Webhook handlers must answer Stripe quickly (it times out after ~10s
   * and retries), so their emails don't hold up the response. notify()
   * logs its own failures.
   */
  notifyInBackground(org: any, params: Omit<BillingEmailParams, 'organizationName' | 'frontendUrl'>) {
    this.notify(org, params).catch(() => {})
  },

  async notify(org: any, params: Omit<BillingEmailParams, 'organizationName' | 'frontendUrl'>): Promise<boolean> {
    const withMembers = org.members ? org : await this.findOrg(org.documentId)
    const to = await this.recipientsFor(withMembers ?? org)
    if (!to.length) {
      strapi.log.warn(`[billing] no billing email or members for organization ${org.documentId}; skipped ${params.kind}`)
      return false
    }
    const email = generateBillingEmail({ ...params, organizationName: org.name, frontendUrl: this.frontendUrl() })
    try {
      await strapi.plugins['email'].services.email.send({ to: to.join(','), subject: email.subject, text: email.text, html: email.html })
      return true
    } catch (err: any) {
      strapi.log.error(`[billing] failed to send ${params.kind} to ${org.documentId}: ${err.message}`)
      return false
    }
  },
})
