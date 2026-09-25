import { computeMetrics, orgRows, rowsToCsv } from '../metrics'

const now = new Date('2026-09-22T00:00:00Z')

const orgs = [
  { documentId: 'a', name: 'Alpha', tier: 'pro', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_a', billedTier: 'pro', billingInterval: 'month', trialUsed: true },
  { documentId: 'b', name: 'Beta', tier: 'enterprise', subscriptionStatus: 'active', stripeSubscriptionId: 'sub_b', billedTier: 'enterprise', billingInterval: 'year', trialUsed: true },
  { documentId: 'c', name: 'Gamma', tier: 'pro', subscriptionStatus: 'trialing', trialEndsAt: '2026-09-25T00:00:00Z', trialUsed: true },
  { documentId: 'd', name: 'Delta', tier: 'free', subscriptionStatus: 'canceled', canceledAt: '2026-05-01T00:00:00Z', trialUsed: true },
  { documentId: 'e', name: 'Epsilon', tier: 'free', subscriptionStatus: 'none', trialUsed: true, trialEndsAt: '2026-08-01T00:00:00Z' },
]

const payments = [
  { organizationDocumentId: 'a', amount: 2900, status: 'paid', paidAt: '2026-08-10T00:00:00Z', interval: 'month', tier: 'pro' },
  { organizationDocumentId: 'a', amount: 2900, status: 'paid', paidAt: '2026-09-10T00:00:00Z', interval: 'month', tier: 'pro' },
  { organizationDocumentId: 'b', amount: 120000, status: 'paid', paidAt: '2026-02-01T00:00:00Z', interval: 'year', tier: 'enterprise' },
  { organizationDocumentId: 'd', amount: 2900, status: 'paid', paidAt: '2025-12-01T00:00:00Z', interval: 'month', tier: 'pro' },
  { organizationDocumentId: 'a', amount: 2900, status: 'failed', periodStart: '2026-07-10T00:00:00Z', paidAt: null },
]

describe('computeMetrics', () => {
  const m = computeMetrics({ orgs, payments, year: 2026, now })

  it('buckets paid revenue by month and year, ignoring failed payments', () => {
    expect(m.revenueByMonth[1]).toBe(120000)
    expect(m.revenueByMonth[7]).toBe(2900)
    expect(m.revenueByMonth[8]).toBe(2900)
    expect(m.revenueThisYear).toBe(125800)
    expect(m.revenueByYear).toEqual([{ year: 2025, amount: 2900 }, { year: 2026, amount: 125800 }])
    expect(m.revenueAllTime).toBe(128700)
  })

  it('normalises yearly plans to MRR from the latest paid invoice', () => {
    expect(m.mrr).toBe(2900 + 10000)
    expect(m.arr).toBe(12900 * 12)
    expect(m.activeSubscriptions).toBe(2)
    expect(m.subsByPlan).toEqual({ pro: { month: 1, year: 0 }, enterprise: { month: 0, year: 1 } })
  })

  it('counts trials, conversion (excluding running trials) and churn', () => {
    expect(m.activeTrials).toBe(1)
    expect(m.trialsEndingSoon).toBe(1)
    // a, b, d paid; e did not; c still running
    expect(m.trialsFinished).toBe(4)
    expect(m.trialsConverted).toBe(3)
    expect(m.trialConversionRate).toBeCloseTo(0.75)
    expect(m.canceledThisYear).toBe(1)
    expect(m.churnRate).toBeCloseTo(1 / 3)
    expect(m.failedPaymentsThisYear).toBe(1)
  })

  it('handles an empty ledger', () => {
    const e = computeMetrics({ orgs: [], payments: [], year: 2026, now })
    expect(e.mrr).toBe(0)
    expect(e.trialConversionRate).toBeNull()
    expect(e.churnRate).toBeNull()
    expect(e.availableYears).toEqual([2026])
  })
})

describe('orgRows / rowsToCsv', () => {
  it('sorts by lifetime revenue and escapes CSV + formula injection', () => {
    const rows = orgRows([...orgs, { documentId: 'x', name: '=HYPERLINK("evil")', tier: 'free' }], payments)
    expect(rows[0].name).toBe('Beta')
    expect(rows.find((r) => r.documentId === 'a')!.totalPaid).toBe(5800)
    const csv = rowsToCsv(rows)
    expect(csv.split('\n')[0]).toContain('Organization')
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`)
  })
})
