import scannerFactory, { reminderWindow } from '../billing-scanner'
import { DEFAULT_BILLING_SETTINGS } from '../billing'

describe('reminderWindow', () => {
  it('picks the smallest window reached', () => {
    expect(reminderWindow(10, [7, 3, 1])).toBeNull()
    expect(reminderWindow(7, [7, 3, 1])).toBe(7)
    expect(reminderWindow(5, [7, 3, 1])).toBe(7)
    expect(reminderWindow(2, [7, 3, 1])).toBe(3)
    expect(reminderWindow(0, [7, 3, 1])).toBe(1)
  })
})

describe('billing scanner processOrg', () => {
  const now = new Date('2026-09-22T12:00:00Z')
  let sentKeys: Set<string>
  let billing: any
  let scanner: any

  beforeEach(() => {
    sentKeys = new Set()
    billing = { updateOrg: jest.fn(), notify: jest.fn().mockResolvedValue(true) }
    const audit = {
      findOne: jest.fn(async ({ where }) => (sentKeys.has(where.action) ? { id: 1 } : null)),
      create: jest.fn(async ({ data }) => sentKeys.add(data.action)),
    }
    const strapi: any = { service: () => billing, db: { query: () => audit }, log: { info: jest.fn(), error: jest.fn() } }
    scanner = scannerFactory({ strapi })
  })

  it('sends a trial reminder once per window', async () => {
    const org = { documentId: 'o1', name: 'O', tier: 'pro', subscriptionStatus: 'trialing', trialEndsAt: '2026-09-25T00:00:00Z' }
    await scanner.processOrg(org, DEFAULT_BILLING_SETTINGS, now)
    await scanner.processOrg(org, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.notify).toHaveBeenCalledTimes(1)
    expect(billing.notify.mock.calls[0][1]).toMatchObject({ kind: 'trial_ending', daysLeft: 3 })
  })

  it('expires a local trial to Free and emails once', async () => {
    const org = { documentId: 'o2', name: 'O', tier: 'pro', subscriptionStatus: 'trialing', trialEndsAt: '2026-09-21T00:00:00Z' }
    await scanner.processOrg(org, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.updateOrg).toHaveBeenCalledWith('o2', { tier: 'free', subscriptionStatus: 'none', trialUsed: true })
    expect(billing.notify.mock.calls[0][1]).toMatchObject({ kind: 'trial_ended' })
  })

  it('does not expire a card-backed Stripe trial (Stripe converts it)', async () => {
    const org = { documentId: 'o3', tier: 'pro', subscriptionStatus: 'trialing', stripeSubscriptionId: 'sub', trialEndsAt: '2026-09-23T00:00:00Z' }
    await scanner.processOrg(org, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.updateOrg).not.toHaveBeenCalled()
    expect(billing.notify.mock.calls[0][1]).toMatchObject({ kind: 'renewal_upcoming' })
  })

  it('sends renewal reminders for active subs but not ones set to cancel', async () => {
    const org = { documentId: 'o4', tier: 'pro', subscriptionStatus: 'active', currentPeriodEnd: '2026-09-29T00:00:00Z' }
    await scanner.processOrg(org, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.notify.mock.calls[0][1]).toMatchObject({ kind: 'renewal_upcoming', daysLeft: 7 })
    billing.notify.mockClear()
    await scanner.processOrg({ ...org, documentId: 'o5', cancelAtPeriodEnd: true }, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.notify).not.toHaveBeenCalled()
  })

  it('reminds daily during past-due grace, then downgrades to Free', async () => {
    const inGrace = { documentId: 'o6', tier: 'pro', subscriptionStatus: 'past_due', pastDueSince: '2026-09-20T00:00:00Z' }
    await scanner.processOrg(inGrace, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.notify.mock.calls[0][1]).toMatchObject({ kind: 'past_due_reminder' })
    expect(billing.updateOrg).not.toHaveBeenCalled()

    const expired = { documentId: 'o7', tier: 'pro', subscriptionStatus: 'past_due', pastDueSince: '2026-09-10T00:00:00Z' }
    await scanner.processOrg(expired, DEFAULT_BILLING_SETTINGS, now)
    expect(billing.updateOrg).toHaveBeenCalledWith('o7', { tier: 'free' })
  })
})
