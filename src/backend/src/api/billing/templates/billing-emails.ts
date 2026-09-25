/**
 * Billing notification emails (trial ending/ended, renewal upcoming,
 * payment failed, payment received). Plain inline-styled HTML, same
 * approach as credential/templates/credential-expiration.ts.
 */

export type BillingEmailKind =
  | 'trial_ending'
  | 'trial_ended'
  | 'renewal_upcoming'
  | 'payment_failed'
  | 'past_due_reminder'
  | 'downgraded'
  | 'payment_received'

export interface BillingEmailParams {
  kind: BillingEmailKind
  organizationName: string
  frontendUrl: string
  daysLeft?: number
  date?: Date | string | null
  tier?: string | null
  amount?: number | null
  currency?: string | null
}

const escapeHtml = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const formatDate = (d?: Date | string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

const formatMoney = (amount?: number | null, currency?: string | null) =>
  amount == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(amount / 100)

const planName = (tier?: string | null) => (tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'paid')

const inDays = (n?: number) => (n == null ? '' : n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

export function generateBillingEmail(p: BillingEmailParams): { subject: string; text: string; html: string } {
  const billingUrl = `${p.frontendUrl}/billing`
  const org = p.organizationName
  let subject: string
  let body: string
  let cta = 'Manage billing'
  let accent = '#1B7A34'

  switch (p.kind) {
    case 'trial_ending':
      subject = `Your Certrust trial ends ${inDays(p.daysLeft)}`
      body = `The ${planName(p.tier)} trial for ${org} ends ${inDays(p.daysLeft)} (${formatDate(p.date)}). Choose a plan to keep your ${planName(p.tier)} limits. If you do nothing, your organization moves to the Free plan. All your data and issued credentials are kept.`
      cta = 'Choose a plan'
      accent = p.daysLeft != null && p.daysLeft <= 1 ? '#c53030' : '#b7791f'
      break
    case 'trial_ended':
      subject = 'Your Certrust trial has ended'
      body = `The trial for ${org} ended on ${formatDate(p.date)}, so it is now on the Free plan. Everything you created is still there and every credential you issued still verifies. Upgrade any time to get your higher limits back.`
      cta = 'Upgrade now'
      break
    case 'renewal_upcoming':
      subject = `Your Certrust ${planName(p.tier)} plan renews ${inDays(p.daysLeft)}`
      body = `The ${planName(p.tier)} subscription for ${org} renews ${inDays(p.daysLeft)} (${formatDate(p.date)}). The card on file will be charged automatically. To change plan, update your card or cancel, open your billing page.`
      break
    case 'payment_failed':
      subject = 'Action needed: your Certrust payment failed'
      body = `We couldn't charge the card on file for ${org}'s ${planName(p.tier)} subscription${p.amount != null ? ` (${formatMoney(p.amount, p.currency)})` : ''}. Please update your payment method to keep your plan.`
      cta = 'Update payment method'
      accent = '#c53030'
      break
    case 'past_due_reminder':
      subject = `Reminder: your Certrust payment is overdue${p.daysLeft != null ? ` (${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left)` : ''}`
      body = `${org}'s ${planName(p.tier)} subscription is still unpaid. Unless payment goes through by ${formatDate(p.date)}, the organization will move to the Free plan. Your data is kept either way.`
      cta = 'Update payment method'
      accent = '#c53030'
      break
    case 'downgraded':
      subject = 'Your organization has moved to the Free plan'
      body = `${org}'s paid subscription has ended, so it is now on the Free plan. Everything you created is still there and every credential you issued still verifies. Upgrade any time to get your higher limits back.`
      cta = 'Upgrade now'
      break
    case 'payment_received':
    default:
      subject = `Payment received: Certrust ${planName(p.tier)}`
      body = `Thank you. We received ${formatMoney(p.amount, p.currency)} for ${org}'s ${planName(p.tier)} subscription.${p.date ? ` Your next renewal is on ${formatDate(p.date)}.` : ''}`
      cta = 'View billing'
      break
  }

  const text = `${body}\n\n${cta}: ${billingUrl}\n\nThank you,\nThe Certrust Team`

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;border-top:4px solid ${accent};">
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#78716c;">Certrust billing</p>
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(subject)}</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#44403c;">${escapeHtml(body)}</p>
          <a href="${escapeHtml(billingUrl)}" style="display:inline-block;background:#1B7A34;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:15px;">${escapeHtml(cta)}</a>
          <p style="margin:32px 0 0;font-size:13px;color:#78716c;">The Certrust Team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
