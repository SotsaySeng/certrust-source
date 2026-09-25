import billingFactory, { mapSubscriptionStatus, invoiceSubscriptionInfo, DEFAULT_BILLING_SETTINGS } from '../billing'
import { constructWebhookEvent } from '../../lib/stripe'
import Stripe from 'stripe'

function makeStrapi(orgs: any[]) {
  const payments: any[] = []
  const audit: any[] = []
  const orgQuery = {
    findOne: jest.fn(async ({ where }) => orgs.find((o) => (where.documentId ? o.documentId === where.documentId : o.stripeCustomerId === where.stripeCustomerId)) ?? null),
    updateMany: jest.fn(async ({ where, data }) => {
      const o = orgs.find((x) => x.documentId === where.documentId)
      Object.assign(o, data)
    }),
  }
  const paymentQuery = {
    findOne: jest.fn(async ({ where }) => payments.find((p) => p.stripeInvoiceId === where.stripeInvoiceId) ?? null),
    create: jest.fn(async ({ data }) => payments.push({ id: payments.length + 1, ...data })),
    update: jest.fn(async ({ where, data }) => Object.assign(payments.find((p) => p.id === where.id), data)),
  }
  const auditQuery = {
    findOne: jest.fn(async ({ where }) => audit.find((a) => a.action === where.action && a.entityId === where.entityId) ?? null),
    create: jest.fn(async ({ data }) => audit.push(data)),
  }
  const profileQuery = { findMany: jest.fn(async () => [{ owner: { email: 'owner@org.one' } }, { owner: { email: 'owner@org.one' } }]) }
  const send = jest.fn()
  const strapi: any = {
    db: { query: (uid: string) => (uid.includes('organization') ? orgQuery : uid.includes('payment') ? paymentQuery : uid.includes('profile') ? profileQuery : auditQuery) },
    documents: () => ({ findFirst: async () => null }),
    config: { get: () => 'http://localhost:3000' },
    plugins: { email: { services: { email: { send } } } },
    log: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  }
  return { strapi, payments, send }
}

const sub = (status: string, extra: any = {}) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status,
  metadata: { orgDocumentId: 'org1', tier: 'pro', interval: 'year' },
  items: { data: [{ price: { id: 'price_x', recurring: { interval: 'year' } }, current_period_end: 1790000000 }] },
  cancel_at_period_end: false,
  trial_end: null,
  ...extra,
})

describe('billing helpers', () => {
  it('maps Stripe statuses', () => {
    expect(mapSubscriptionStatus('active')).toBe('active')
    expect(mapSubscriptionStatus('unpaid')).toBe('past_due')
    expect(mapSubscriptionStatus('incomplete_expired')).toBe('canceled')
    expect(mapSubscriptionStatus('incomplete')).toBeNull()
  })

  it('reads the subscription from both invoice shapes', () => {
    expect(invoiceSubscriptionInfo({ parent: { subscription_details: { subscription: 'sub_new', metadata: { a: '1' } } } })).toEqual({ subscriptionId: 'sub_new', metadata: { a: '1' } })
    expect(invoiceSubscriptionInfo({ subscription: 'sub_old' }).subscriptionId).toBe('sub_old')
  })
})

describe('billing webhook handling', () => {
  let orgs: any[]
  beforeEach(() => {
    orgs = [{ documentId: 'org1', name: 'Org One', tier: 'pro', subscriptionStatus: 'trialing', billingEmail: 'billing@org.one', members: [] }]
  })

  it('activates, records payment once, and handles duplicate deliveries', async () => {
    const { strapi, payments, send } = makeStrapi(orgs)
    const billing = billingFactory({ strapi })

    await billing.handleEvent({ id: 'evt_1', type: 'customer.subscription.updated', data: { object: sub('active') } })
    expect(orgs[0]).toMatchObject({ subscriptionStatus: 'active', tier: 'pro', billedTier: 'pro', billingInterval: 'year', stripeSubscriptionId: 'sub_1' })

    const invoice = {
      id: 'in_1', customer: 'cus_1', amount_paid: 29000, amount_due: 29000, currency: 'usd',
      status_transitions: { paid_at: 1780000000 },
      parent: { subscription_details: { subscription: 'sub_1', metadata: { orgDocumentId: 'org1', tier: 'pro', interval: 'year' } } },
      lines: { data: [{ period: { start: 1780000000, end: 1811536000 } }] },
    }
    await billing.handleEvent({ id: 'evt_2', type: 'invoice.paid', data: { object: invoice } })
    const dup = await billing.handleEvent({ id: 'evt_2', type: 'invoice.paid', data: { object: invoice } })
    expect(dup.duplicate).toBe(true)
    expect(payments).toHaveLength(1)
    expect(payments[0]).toMatchObject({ amount: 29000, status: 'paid', tier: 'pro', interval: 'year', organizationDocumentId: 'org1' })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].to).toBe('billing@org.one')
  })

  it('does not record $0 trial invoices as revenue', async () => {
    const { strapi, payments } = makeStrapi(orgs)
    const billing = billingFactory({ strapi })
    await billing.handleEvent({ id: 'evt_0', type: 'invoice.paid', data: { object: { id: 'in_0', customer: 'cus_1', amount_paid: 0, parent: { subscription_details: { subscription: 'sub_1', metadata: {} } }, lines: { data: [] } } } })
    expect(payments).toHaveLength(0)
  })

  it('marks past due on failure, and a cancellation downgrades to Free', async () => {
    const { strapi, send } = makeStrapi(orgs)
    const billing = billingFactory({ strapi })
    await billing.handleEvent({ id: 'e1', type: 'customer.subscription.updated', data: { object: sub('past_due') } })
    expect(orgs[0].subscriptionStatus).toBe('past_due')
    expect(orgs[0].pastDueSince).toBeInstanceOf(Date)
    expect(orgs[0].tier).toBe('pro') // grace period: tier kept

    await billing.handleEvent({ id: 'e2', type: 'customer.subscription.deleted', data: { object: sub('canceled', { ended_at: 1790000000 }) } })
    expect(orgs[0]).toMatchObject({ subscriptionStatus: 'canceled', tier: 'free' })
    expect(send.mock.calls.at(-1)[0].subject).toMatch(/Free plan/)
  })

  it('falls back to profile owners when there is no billing email or members', async () => {
    const { strapi } = makeStrapi(orgs)
    const billing = billingFactory({ strapi })
    expect(await billing.recipientsFor({ documentId: 'org1', members: [] })).toEqual(['owner@org.one'])
    expect(await billing.recipientsFor({ documentId: 'org1', billingEmail: 'b@x.test' })).toEqual(['b@x.test'])
  })

  it('reports a local trial ending soon in the status banner', () => {
    const { strapi } = makeStrapi(orgs)
    const billing = billingFactory({ strapi })
    const now = new Date('2026-09-22T00:00:00Z')
    const s = billing.statusFor({ ...orgs[0], trialEndsAt: '2026-09-25T00:00:00Z' }, DEFAULT_BILLING_SETTINGS, now)
    expect(s.banner).toEqual({ kind: 'trial_ending', daysLeft: 3, date: '2026-09-25T00:00:00Z' })
    expect(s.isLocalTrial).toBe(true)
  })
})

describe('webhook signature', () => {
  it('accepts a correctly signed payload and rejects a tampered one', () => {
    const secret = 'whsec_test'
    const payload = JSON.stringify({ id: 'evt_sig', type: 'invoice.paid', data: { object: {} } })
    const header = new Stripe('sk_test_x').webhooks.generateTestHeaderString({ payload, secret })
    expect(constructWebhookEvent(payload, header, secret).id).toBe('evt_sig')
    expect(() => constructWebhookEvent(payload.replace('evt_sig', 'evt_bad'), header, secret)).toThrow()
  })
})
