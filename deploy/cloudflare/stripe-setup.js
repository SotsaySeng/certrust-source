#!/usr/bin/env node
// Create (or reuse) the Certrust products, prices and Customer Portal
// configuration in Stripe, and write their ids into the backend env file.
//
//   node deploy/cloudflare/stripe-setup.js test   # src/backend/.env, sk_/rk_test_ key
//   node deploy/cloudflare/stripe-setup.js live   # src/backend/.env.production, sk_/rk_live_ key
//
// Idempotent: prices are found by lookup_key (certrust_<tier>_<interval>ly)
// and the portal configuration by metadata.certrust, so re-running only
// fills gaps and refreshes the portal settings. Prints ids only, never keys.
// A price's amount cannot change once created: to reprice, create a new
// lookup key (or archive the old price in the dashboard) and re-run.
const fs = require('fs')
const path = require('path')

const MODE = process.argv[2]
if (MODE !== 'test' && MODE !== 'live') {
  console.error('Usage: stripe-setup.js test|live')
  process.exit(1)
}
const ROOT = path.resolve(__dirname, '../..')
const BACKEND = path.join(ROOT, 'src/backend')
const ENV_FILE = path.join(BACKEND, MODE === 'test' ? '.env' : '.env.production')
const Stripe = require(path.join(BACKEND, 'node_modules/stripe'))

const env = Object.fromEntries(
  fs.readFileSync(ENV_FILE, 'utf8').split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean)
    .map(m => [m[1], m[2].trim()]),
)
if (!new RegExp(`^(sk|rk)_${MODE}_`).test(env.STRIPE_SECRET_KEY || '')) {
  console.error(`STRIPE_SECRET_KEY in ${path.relative(ROOT, ENV_FILE)} is not a ${MODE} secret key.`)
  process.exit(1)
}
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const SITE = (env.FRONTEND_URL && MODE === 'test') ? env.FRONTEND_URL : 'https://certrust.app'

const PLANS = [
  {
    name: 'Certrust Pro',
    tier: 'pro',
    description: 'For teams issuing credentials regularly, with much higher limits.',
    prices: [['month', 1900, 'STRIPE_PRICE_PRO_MONTHLY'], ['year', 19900, 'STRIPE_PRICE_PRO_YEARLY']],
  },
  {
    name: 'Certrust Enterprise',
    tier: 'enterprise',
    description: 'For large organizations with the highest (or unlimited) limits.',
    prices: [['month', 5900, 'STRIPE_PRICE_ENT_MONTHLY'], ['year', 59900, 'STRIPE_PRICE_ENT_YEARLY']],
  },
]

async function main() {
  console.log(`Stripe ${MODE} mode -> ${path.relative(ROOT, ENV_FILE)}`)
  const ids = {}
  const portalProducts = []

  for (const plan of PLANS) {
    const lookupKeys = plan.prices.map(([interval]) => `certrust_${plan.tier}_${interval}ly`)
    const existing = await stripe.prices.list({ lookup_keys: lookupKeys, active: true, limit: 10 })
    let productId = existing.data[0]?.product
    if (!productId) {
      productId = (await stripe.products.create({ name: plan.name, description: plan.description, metadata: { tier: plan.tier } })).id
    }
    const productPrices = []
    for (const [interval, amount, envName] of plan.prices) {
      const lookupKey = `certrust_${plan.tier}_${interval}ly`
      let price = existing.data.find(p => p.lookup_key === lookupKey)
      if (!price) {
        price = await stripe.prices.create({
          product: productId,
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval },
          lookup_key: lookupKey,
          nickname: `${plan.name} ${interval}ly`,
        })
      }
      if (price.unit_amount !== amount || price.currency !== 'usd') {
        throw new Error(`${lookupKey} exists as ${price.unit_amount} ${price.currency}, expected ${amount} usd`)
      }
      ids[envName] = price.id
      productPrices.push(price.id)
      console.log(`${envName}=${price.id}  (${amount / 100} USD / ${interval})`)
    }
    portalProducts.push({ product: productId, prices: productPrices })
  }

  const portalParams = {
    name: 'Certrust',
    business_profile: {
      headline: 'Manage your Certrust subscription',
      privacy_policy_url: `${SITE}/privacy-policy`,
      terms_of_service_url: `${SITE}/terms-and-conditions`,
    },
    default_return_url: `${SITE}/billing`,
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        proration_behavior: 'none',
        cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'] },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'always_invoice',
        products: portalProducts,
      },
    },
    metadata: { certrust: '1' },
  }
  const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 50 })
  const current = configs.data.find(c => c.metadata?.certrust === '1')
  const portal = current
    ? await stripe.billingPortal.configurations.update(current.id, portalParams)
    : await stripe.billingPortal.configurations.create(portalParams)
  ids.STRIPE_PORTAL_CONFIGURATION = portal.id
  console.log(`STRIPE_PORTAL_CONFIGURATION=${portal.id}`)

  let text = fs.readFileSync(ENV_FILE, 'utf8')
  for (const [key, value] of Object.entries(ids)) {
    const line = new RegExp(`^${key}=.*$`, 'm')
    if (line.test(text)) text = text.replace(line, `${key}=${value}`)
    else text = `${text.replace(/\n*$/, '\n')}${key}=${value}\n`
  }
  fs.writeFileSync(ENV_FILE, text)
  console.log(`Wrote ${Object.keys(ids).length} ids to ${path.relative(ROOT, ENV_FILE)}.`)
}

main().catch((err) => {
  console.error(`Stripe error: ${err.type || ''} ${err.message}`)
  process.exit(1)
})
