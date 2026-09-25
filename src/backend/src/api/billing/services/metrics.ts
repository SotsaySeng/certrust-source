/**
 * Revenue metrics for the platform-admin dashboard.
 *
 * computeMetrics() is a pure function over organizations + the payment
 * ledger (api::payment.payment, written by the Stripe webhook), so the
 * maths is unit-tested without a database. All money is in cents (USD).
 *
 * - Revenue: sum of paid ledger rows, bucketed by paidAt.
 * - MRR: each subscribed org's most recent paid invoice, normalised to a
 *   month (yearly / 12). Uses what they actually paid (after coupons),
 *   and needs no Stripe API call.
 * - Conversion: of orgs that ever had a trial, the share that has paid.
 * - Churn (selected year): subscriptions canceled that year divided by
 *   subscriptions that were live at some point that year.
 */

const SUBSCRIBED = ['active', 'past_due']

export interface MetricsInput {
  orgs: any[]
  payments: any[]
  year: number
  now?: Date
}

const yearOf = (d: any) => new Date(d).getUTCFullYear()

export function computeMetrics({ orgs, payments, year, now = new Date() }: MetricsInput) {
  const paid = payments.filter((p) => p.status === 'paid' && p.paidAt)

  const revenueByMonth = Array.from({ length: 12 }, () => 0)
  const revenueByYearMap = new Map<number, number>()
  for (const p of paid) {
    const d = new Date(p.paidAt)
    const y = d.getUTCFullYear()
    revenueByYearMap.set(y, (revenueByYearMap.get(y) ?? 0) + p.amount)
    if (y === year) revenueByMonth[d.getUTCMonth()] += p.amount
  }
  const revenueByYear = Array.from(revenueByYearMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([y, amount]) => ({ year: y, amount }))

  // Latest paid invoice per org, and lifetime totals.
  const latestByOrg = new Map<string, any>()
  const totalByOrg = new Map<string, number>()
  for (const p of paid) {
    const key = p.organizationDocumentId
    if (!key) continue
    totalByOrg.set(key, (totalByOrg.get(key) ?? 0) + p.amount)
    const prev = latestByOrg.get(key)
    if (!prev || new Date(p.paidAt) > new Date(prev.paidAt)) latestByOrg.set(key, p)
  }

  const subscribed = orgs.filter((o) => SUBSCRIBED.includes(o.subscriptionStatus) && o.stripeSubscriptionId)
  let mrr = 0
  const subsByPlan = { pro: { month: 0, year: 0 }, enterprise: { month: 0, year: 0 } }
  for (const o of subscribed) {
    const last = latestByOrg.get(o.documentId)
    const interval = o.billingInterval ?? last?.interval ?? 'month'
    const tier = o.billedTier ?? last?.tier
    if (tier && subsByPlan[tier]) subsByPlan[tier][interval === 'year' ? 'year' : 'month']++
    if (last) mrr += interval === 'year' ? last.amount / 12 : last.amount
  }
  mrr = Math.round(mrr)

  const trialing = orgs.filter((o) => o.subscriptionStatus === 'trialing')
  const weekAhead = now.getTime() + 7 * 24 * 60 * 60 * 1000
  const trialsEndingSoon = trialing.filter((o) => o.trialEndsAt && new Date(o.trialEndsAt).getTime() <= weekAhead).length

  const everTrialed = orgs.filter((o) => o.trialUsed || o.trialEndsAt)
  const converted = everTrialed.filter((o) => totalByOrg.has(o.documentId)).length
  // Trials still running haven't had a chance to convert yet.
  const finishedTrials = everTrialed.filter((o) => !(o.subscriptionStatus === 'trialing' && !o.stripeSubscriptionId)).length

  const canceledThisYear = orgs.filter((o) => o.canceledAt && yearOf(o.canceledAt) === year).length
  const paidThisYear = new Set(paid.filter((p) => yearOf(p.paidAt) === year).map((p) => p.organizationDocumentId).filter(Boolean))
  for (const o of subscribed) paidThisYear.add(o.documentId)
  const liveThisYear = new Set([...paidThisYear, ...orgs.filter((o) => o.canceledAt && yearOf(o.canceledAt) === year).map((o) => o.documentId)])

  const failedThisYear = payments.filter((p) => p.status === 'failed' && p.periodStart && yearOf(p.periodStart) === year).length

  return {
    year,
    currency: 'usd',
    revenueThisYear: revenueByMonth.reduce((a, b) => a + b, 0),
    revenueAllTime: paid.reduce((a, p) => a + p.amount, 0),
    revenueByMonth,
    revenueByYear,
    mrr,
    arr: mrr * 12,
    activeSubscriptions: subscribed.length,
    subsByPlan,
    activeTrials: trialing.length,
    trialsEndingSoon,
    trialConversionRate: finishedTrials ? converted / finishedTrials : null,
    trialsConverted: converted,
    trialsFinished: finishedTrials,
    canceledThisYear,
    churnRate: liveThisYear.size ? canceledThisYear / liveThisYear.size : null,
    pastDue: orgs.filter((o) => o.subscriptionStatus === 'past_due').length,
    failedPaymentsThisYear: failedThisYear,
    availableYears: Array.from(new Set([now.getUTCFullYear(), ...revenueByYear.map((r) => r.year)])).sort((a, b) => b - a),
  }
}

/** One row per organization for the admin table / CSV export. */
export function orgRows(orgs: any[], payments: any[]) {
  const paid = payments.filter((p) => p.status === 'paid' && p.paidAt)
  return orgs
    .map((o) => {
      const mine = paid.filter((p) => p.organizationDocumentId === o.documentId)
      const last = mine.reduce((acc: any, p: any) => (!acc || new Date(p.paidAt) > new Date(acc.paidAt) ? p : acc), null)
      return {
        documentId: o.documentId,
        name: o.name,
        tier: o.tier,
        subscriptionStatus: o.subscriptionStatus ?? 'none',
        billedTier: o.billedTier ?? null,
        billingInterval: o.billingInterval ?? null,
        trialEndsAt: o.trialEndsAt ?? null,
        currentPeriodEnd: o.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(o.cancelAtPeriodEnd),
        totalPaid: mine.reduce((a: number, p: any) => a + p.amount, 0),
        lastPaymentAt: last?.paidAt ?? null,
        createdAt: o.createdAt ?? null,
      }
    })
    .sort((a, b) => b.totalPaid - a.totalPaid || String(a.name).localeCompare(String(b.name)))
}

const csvCell = (v: any) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v)
  // Neutralise spreadsheet formula injection from org names.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function rowsToCsv(rows: ReturnType<typeof orgRows>): string {
  const header = ['Organization', 'Tier', 'Status', 'Plan', 'Interval', 'Trial ends', 'Renews / ends', 'Cancel at period end', 'Total paid (USD)', 'Last payment', 'Created']
  const lines = rows.map((r) =>
    [
      r.name,
      r.tier,
      r.subscriptionStatus,
      r.billedTier,
      r.billingInterval,
      r.trialEndsAt,
      r.currentPeriodEnd,
      r.cancelAtPeriodEnd ? 'yes' : 'no',
      (r.totalPaid / 100).toFixed(2),
      r.lastPaymentAt,
      r.createdAt,
    ]
      .map(csvCell)
      .join(',')
  )
  return [header.join(','), ...lines].join('\n') + '\n'
}

export default ({ strapi }: { strapi: any }) => ({
  async load() {
    const [orgs, payments] = await Promise.all([
      strapi.db.query('api::organization.organization').findMany({ where: { publishedAt: { $notNull: true } } }),
      strapi.db.query('api::payment.payment').findMany({ orderBy: { paidAt: 'asc' } }),
    ])
    return { orgs, payments }
  },

  async metrics(year: number, now = new Date()) {
    const { orgs, payments } = await this.load()
    return computeMetrics({ orgs, payments, year, now })
  },

  async rows() {
    const { orgs, payments } = await this.load()
    return orgRows(orgs, payments)
  },
})
