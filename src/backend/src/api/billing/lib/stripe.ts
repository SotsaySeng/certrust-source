/**
 * Stripe client + price <-> plan mapping.
 *
 * Prices live in the Stripe dashboard (one Price per paid tier x
 * interval); this app only knows their ids, via env vars. That keeps
 * Stripe the single source of truth for what a plan costs - changing a
 * price is a Stripe-dashboard edit plus an env var swap, never a code
 * change.
 *
 * Everything here reads process.env lazily (not at import time) so the
 * backend still boots with billing unconfigured - checkout/portal then
 * answer 503 and the rest of the app is unaffected.
 */

import Stripe from 'stripe'

export type PaidTier = 'pro' | 'enterprise'
export type BillingInterval = 'month' | 'year'

export const PAID_TIERS: PaidTier[] = ['pro', 'enterprise']
export const INTERVALS: BillingInterval[] = ['month', 'year']

const PRICE_ENV: Record<PaidTier, Record<BillingInterval, string>> = {
  pro: { month: 'STRIPE_PRICE_PRO_MONTHLY', year: 'STRIPE_PRICE_PRO_YEARLY' },
  enterprise: { month: 'STRIPE_PRICE_ENT_MONTHLY', year: 'STRIPE_PRICE_ENT_YEARLY' },
}

let client: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  if (!client) client = new Stripe(key)
  return client
}

export function priceIdFor(tier: PaidTier, interval: BillingInterval): string | null {
  return process.env[PRICE_ENV[tier]?.[interval]] || null
}

/** Reverse lookup: which tier/interval a Stripe Price id belongs to. */
export function planForPriceId(priceId: string | null | undefined): { tier: PaidTier; interval: BillingInterval } | null {
  if (!priceId) return null
  for (const tier of PAID_TIERS) {
    for (const interval of INTERVALS) {
      if (priceIdFor(tier, interval) === priceId) return { tier, interval }
    }
  }
  return null
}

/** Only for tests - drops the memoized client so a new key is picked up. */
export function resetStripeClient() {
  client = null
}

/**
 * Webhook signature verification is pure HMAC and needs no API key, so
 * it works even before STRIPE_SECRET_KEY is set (e.g. tests, stripe CLI).
 */
export function constructWebhookEvent(rawBody: string | Buffer, signature: string, secret: string) {
  const verifier = client ?? new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_webhook_verification_only')
  return verifier.webhooks.constructEvent(rawBody, signature, secret)
}
