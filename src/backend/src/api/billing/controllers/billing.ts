/**
 * Billing controller - see services/billing.ts for the model and
 * routes/billing.ts for auth.
 */

import { getStripe, isStripeConfigured, PAID_TIERS, INTERVALS, priceIdFor, constructWebhookEvent } from '../lib/stripe'
import { rowsToCsv } from '../services/metrics'

const UNPARSED = Symbol.for('unparsedBody')

// Price amounts rarely change; avoid a Stripe round-trip per page view.
let plansCache: { at: number; value: any } | null = null
const PLANS_TTL_MS = 10 * 60 * 1000

export default ({ strapi }: { strapi: any }) => {
  const billing = () => strapi.service('api::billing.billing')

  async function ownOrg(ctx: any) {
    if (!ctx.state.user) {
      ctx.unauthorized('You must be logged in.')
      return null
    }
    const org = await billing().findOrgForUser(ctx.state.user.id)
    if (!org) ctx.notFound('You are not part of an organization.')
    return org
  }

  return {
    async status(ctx: any) {
      const org = await ownOrg(ctx)
      if (!org) return
      ctx.body = billing().statusFor(org, await billing().getSettings())
    },

    async plans(ctx: any) {
      if (plansCache && Date.now() - plansCache.at < PLANS_TTL_MS) {
        ctx.body = plansCache.value
        return
      }
      const plans: any[] = []
      for (const tier of PAID_TIERS) {
        for (const interval of INTERVALS) {
          const id = priceIdFor(tier, interval)
          let amount: number | null = null
          let currency = 'usd'
          if (id && isStripeConfigured()) {
            try {
              const price = await getStripe().prices.retrieve(id)
              amount = price.unit_amount
              currency = price.currency
            } catch (err: any) {
              strapi.log.warn(`[billing] could not load price ${id}: ${err.message}`)
            }
          }
          plans.push({ tier, interval, available: Boolean(id) && isStripeConfigured(), amount, currency })
        }
      }
      const value = { stripeConfigured: isStripeConfigured(), plans }
      if (isStripeConfigured()) plansCache = { at: Date.now(), value }
      ctx.body = value
    },

    async checkout(ctx: any) {
      const org = await ownOrg(ctx)
      if (!org) return
      const { tier, interval } = ctx.request.body ?? {}
      ctx.body = { url: await billing().createCheckout(org, ctx.state.user, tier, interval) }
    },

    async portal(ctx: any) {
      const org = await ownOrg(ctx)
      if (!org) return
      ctx.body = { url: await billing().createPortal(org) }
    },

    async webhook(ctx: any) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (!secret) {
        ctx.status = 503
        ctx.body = { error: 'Stripe webhook secret is not configured' }
        return
      }
      const raw = ctx.request.body?.[UNPARSED]
      const signature = ctx.request.headers['stripe-signature']
      if (!raw || !signature) {
        ctx.status = 400
        ctx.body = { error: 'Missing body or Stripe-Signature header' }
        return
      }
      let event: any
      try {
        event = constructWebhookEvent(raw, signature, secret)
      } catch (err: any) {
        ctx.status = 400
        ctx.body = { error: `Invalid signature: ${err.message}` }
        return
      }
      try {
        const result = await billing().handleEvent(event)
        ctx.body = { received: true, ...result }
      } catch (err: any) {
        // 500 makes Stripe retry later; the event isn't marked processed.
        strapi.log.error(`[billing] webhook ${event.type} ${event.id} failed: ${err.message}`)
        ctx.status = 500
        ctx.body = { error: 'Webhook handling failed' }
      }
    },

    async adminMetrics(ctx: any) {
      const year = Number.parseInt(ctx.query?.year, 10) || new Date().getUTCFullYear()
      ctx.body = await strapi.service('api::billing.metrics').metrics(year)
    },

    async adminOrgs(ctx: any) {
      ctx.body = { data: await strapi.service('api::billing.metrics').rows() }
    },

    async adminExport(ctx: any) {
      const rows = await strapi.service('api::billing.metrics').rows()
      ctx.set('Content-Type', 'text/csv; charset=utf-8')
      ctx.set('Content-Disposition', `attachment; filename="certrust-billing-${new Date().toISOString().slice(0, 10)}.csv"`)
      ctx.body = rowsToCsv(rows)
    },

    async adminRunScanner(ctx: any) {
      ctx.body = await strapi.service('api::billing.billing-scanner').runDailyCheck()
    },
  }
}
