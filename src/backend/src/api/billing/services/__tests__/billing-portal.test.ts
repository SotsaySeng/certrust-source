const createSession = jest.fn(async (_params: Record<string, unknown>) => ({ url: 'https://billing.stripe.com/p/session/test' }))

jest.mock('../../lib/stripe', () => ({
  ...jest.requireActual('../../lib/stripe'),
  isStripeConfigured: () => true,
  getStripe: () => ({ billingPortal: { sessions: { create: createSession } } }),
}))

import billingFactory from '../billing'

const strapi: any = { config: { get: () => 'https://certrust.app' } }
const org = { documentId: 'org1', stripeCustomerId: 'cus_1' }

describe('createPortal', () => {
  const saved = process.env.STRIPE_PORTAL_CONFIGURATION
  afterEach(() => {
    createSession.mockClear()
    if (saved === undefined) delete process.env.STRIPE_PORTAL_CONFIGURATION
    else process.env.STRIPE_PORTAL_CONFIGURATION = saved
  })

  it('uses the configured portal configuration', async () => {
    process.env.STRIPE_PORTAL_CONFIGURATION = 'bpc_123'
    const url = await billingFactory({ strapi }).createPortal(org)
    expect(url).toBe('https://billing.stripe.com/p/session/test')
    expect(createSession).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus_1', configuration: 'bpc_123' }))
  })

  it('falls back to the dashboard default when none is set', async () => {
    delete process.env.STRIPE_PORTAL_CONFIGURATION
    await billingFactory({ strapi }).createPortal(org)
    expect(createSession.mock.calls[0][0]).not.toHaveProperty('configuration')
  })
})
