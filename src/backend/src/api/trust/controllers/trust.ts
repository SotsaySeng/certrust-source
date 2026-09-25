/**
 * Trust & safety: issuer verification and reports (Terms s.7).
 *
 * - An organisation asks to be verified for an official domain. If the
 *   member asking signed up with an email on that domain, the domain is
 *   recorded as proven; otherwise they are told to send official documents
 *   to the privacy inbox. A platform admin decides either way.
 * - Anyone can report a credential or account (impersonation, false
 *   credential, privacy). Reports are stored, forwarded to the privacy
 *   inbox and acknowledged to the reporter.
 * - Platform admins review verifications and reports, and can suspend an
 *   organisation (its credentials then fail verification with "suspended
 *   pending review" and it cannot issue).
 *
 * Organisation writes go through billing.updateOrg (in-place, draft and
 * published rows) - see the header of api/billing/services/billing.ts.
 */

const ORG_UID = 'api::organization.organization'
const REPORT_UID = 'api::trust.report'
const CATEGORIES = ['impersonation', 'false-credential', 'privacy', 'other']
const DOMAIN_RE = /^(?=.{3,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/

// Best-effort flood control for the anonymous report form. The API runs as
// a single container instance, so in-process state is enough.
const reportHits = new Map<string, number[]>()
function tooManyReports(key: string, max = 5, windowMs = 60 * 60 * 1000): boolean {
  const now = Date.now()
  const hits = (reportHits.get(key) || []).filter(t => now - t < windowMs)
  hits.push(now)
  reportHits.set(key, hits)
  if (reportHits.size > 10_000) reportHits.clear()
  return hits.length > max
}

function normaliseDomain(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const domain = input.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
  return DOMAIN_RE.test(domain) ? domain : null
}

function emailDomainMatches(email: string | undefined, domain: string): boolean {
  const at = (email || '').toLowerCase().split('@')[1]
  return !!at && (at === domain || at.endsWith(`.${domain}`))
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

async function send(strapi: any, message: { to: string; subject: string; text: string; replyTo?: string }) {
  if (!message.to) return
  try {
    await strapi.plugins['email'].services.email.send(message)
  } catch (err) {
    strapi.log.error(`[trust] email to ${message.to} failed: ${(err as Error).message}`)
  }
}

// Routes use `auth.scope: []`, which lets anonymous requests through to the
// handler (see api/billing/routes/billing.ts) - so check for a user here.
function requireUser(ctx: any): boolean {
  if (ctx.state?.user) return true
  ctx.unauthorized('You must be logged in.')
  return false
}

async function callerOrganization(strapi: any, userId: number) {
  const orgId = await strapi.service('api::profile.multi-tenancy').getUserOrganizationId(userId)
  if (!orgId) return null
  return strapi.db.query(ORG_UID).findOne({ where: { id: orgId } })
}

/** Emails of everyone who can sign in for the organisation: explicit
 *  members plus owners of its profiles (how self-service sign-up links them). */
async function organisationContacts(strapi: any, org: any): Promise<string[]> {
  const profiles = await strapi.db.query('api::profile.profile').findMany({
    where: { organization: { documentId: org.documentId }, owner: { id: { $notNull: true } } },
    populate: { owner: { select: ['email'] } },
  })
  const emails = [
    ...(org.members || []).map((m: any) => m.email),
    ...profiles.map((p: any) => p.owner?.email),
  ].filter(Boolean)
  return [...new Set(emails)] as string[]
}

function publicStatus(org: any) {
  return {
    verificationStatus: org.verificationStatus || 'unverified',
    verificationDomain: org.verificationDomain || null,
    verificationDomainProven: !!org.verificationDomainProven,
    verificationRequestedAt: org.verificationRequestedAt || null,
    verifiedAt: org.verifiedAt || null,
    suspended: !!org.suspendedAt,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  /** GET /trust/verification - the caller's organisation's status. */
  async myVerification(ctx: any) {
    if (!requireUser(ctx)) return
    const org = await callerOrganization(strapi, ctx.state.user.id)
    if (!org) return ctx.notFound('You are not a member of an organisation')
    return { data: publicStatus(org) }
  },

  /** POST /trust/verification { domain } */
  async requestVerification(ctx: any) {
    if (!requireUser(ctx)) return
    const org = await callerOrganization(strapi, ctx.state.user.id)
    if (!org) return ctx.notFound('You are not a member of an organisation')
    if (org.verificationStatus === 'verified') return ctx.badRequest('Your organisation is already verified')

    const domain = normaliseDomain((ctx.request.body as any)?.domain)
    if (!domain) return ctx.badRequest('Enter your organisation\'s official website domain, for example example.edu')

    const proven = emailDomainMatches(ctx.state.user.email, domain)
    const now = new Date()
    await strapi.service('api::billing.billing').updateOrg(org.documentId, {
      verificationStatus: 'pending',
      verificationDomain: domain,
      verificationDomainProven: proven,
      verificationRequestedAt: now,
    })

    const privacyEmail = strapi.config.get('custom.privacyEmail', '')
    await send(strapi, {
      to: privacyEmail,
      replyTo: ctx.state.user.email,
      subject: `Issuer verification request: ${org.name}`,
      text: [
        `Organisation: ${org.name} (id ${org.id})`,
        `Requested by: ${ctx.state.user.email}`,
        `Domain: ${domain}`,
        `Email on that domain: ${proven ? 'yes - domain control proven by a confirmed sign-up email' : 'no - ask for official documents'}`,
        '',
        'Review it in the Certrust admin page (Trust tab).',
      ].join('\n'),
    })

    await strapi.service('api::audit-log-entry.audit-log').record({
      action: 'organization.verification.request',
      entityType: 'organization',
      entityId: String(org.id),
      actorId: ctx.state.user.id,
      metadata: { domain, proven },
    })

    return { data: { ...publicStatus({ ...org, verificationStatus: 'pending', verificationDomain: domain, verificationDomainProven: proven, verificationRequestedAt: now }) } }
  },

  /** POST /trust/reports - anonymous. */
  async submitReport(ctx: any) {
    const body = (ctx.request.body as any)?.data ?? ctx.request.body ?? {}
    // Honeypot: real users never see or fill this field.
    if (body.website) return { data: { received: true } }

    const ip = ctx.request.ip || 'unknown'
    if (tooManyReports(ip)) return ctx.tooManyRequests('Too many reports from this address. Please email us instead.')

    const category = CATEGORIES.includes(body.category) ? body.category : null
    const details = clean(body.details, 5000)
    const reporterEmail = clean(body.reporterEmail, 254)
    const reporterName = clean(body.reporterName, 200)
    const targetUrl = clean(body.targetUrl, 500)
    if (!category) return ctx.badRequest('Choose what you are reporting')
    if (details.length < 10) return ctx.badRequest('Please describe the problem (at least 10 characters)')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reporterEmail)) return ctx.badRequest('Enter a valid email address so we can reply')

    const report = await strapi.db.query(REPORT_UID).create({
      data: { category, details, reporterEmail, reporterName, targetUrl, status: 'open' },
    })

    const privacyEmail = strapi.config.get('custom.privacyEmail', '')
    await send(strapi, {
      to: privacyEmail,
      replyTo: reporterEmail,
      subject: `Report #${report.id} (${category})${targetUrl ? `: ${targetUrl}` : ''}`,
      text: `Category: ${category}\nTarget: ${targetUrl || '(none given)'}\nFrom: ${reporterName || '(no name)'} <${reporterEmail}>\n\n${details}\n\nAcknowledge within 2 business days; decide within 5.`,
    })
    await send(strapi, {
      to: reporterEmail,
      replyTo: privacyEmail || undefined,
      subject: `We received your report (#${report.id})`,
      text: `Thank you for your report about ${targetUrl || 'a Certrust credential or account'}.\n\nWe aim to review reports within 5 business days and will reply to this address if we need more information or when we have acted on it.\n\nReference: #${report.id}\n\nCertrust Trust & Safety`,
    })

    return { data: { received: true, reference: report.id } }
  },

  /** GET /trust/admin/verifications - organisations awaiting or holding verification. */
  async adminVerifications(ctx: any) {
    const orgs = await strapi.db.query(ORG_UID).findMany({
      where: { publishedAt: { $notNull: true }, verificationStatus: { $in: ['pending', 'verified', 'rejected'] } },
      populate: { members: { select: ['id', 'email', 'username'] } },
      orderBy: { verificationRequestedAt: 'desc' },
    })
    const contacts = await Promise.all(orgs.map((o: any) => organisationContacts(strapi, o)))
    return {
      data: orgs.map((o: any, i: number) => ({
        id: o.id,
        documentId: o.documentId,
        name: o.name,
        members: contacts[i],
        suspendedAt: o.suspendedAt,
        suspensionReason: o.suspensionReason,
        verificationNote: o.verificationNote,
        ...publicStatus(o),
      })),
    }
  },

  /** POST /trust/admin/organizations/:id/verification { status, note } */
  async adminSetVerification(ctx: any) {
    const { status, note } = (ctx.request.body as any) || {}
    if (!['verified', 'rejected', 'unverified'].includes(status)) return ctx.badRequest('status must be verified, rejected or unverified')
    const org = await strapi.db.query(ORG_UID).findOne({ where: { id: ctx.params.id }, populate: ['members'] })
    if (!org) return ctx.notFound('Organisation not found')

    await strapi.service('api::billing.billing').updateOrg(org.documentId, {
      verificationStatus: status,
      verifiedAt: status === 'verified' ? new Date() : null,
      verificationNote: clean(note, 2000) || null,
    })
    await strapi.service('api::audit-log-entry.audit-log').record({
      action: 'organization.verification.decide',
      entityType: 'organization',
      entityId: String(org.id),
      actorId: ctx.state.user.id,
      metadata: { status },
    })

    const recipients = await organisationContacts(strapi, org)
    if (recipients.length && status !== 'unverified') {
      await send(strapi, {
        to: recipients.join(','),
        subject: status === 'verified' ? `${org.name} is now a verified issuer` : `Your issuer verification request for ${org.name}`,
        text: status === 'verified'
          ? `Your organisation ${org.name} has been verified${org.verificationDomain ? ` for ${org.verificationDomain}` : ''}. Credentials you issue now show the "Verified issuer" mark.\n\nCertrust`
          : `We could not verify ${org.name} with the information provided.${note ? `\n\n${clean(note, 2000)}` : ''}\n\nReply to this email if you would like to send more evidence.\n\nCertrust`,
      })
    }
    return { data: { id: org.id, verificationStatus: status } }
  },

  /** POST /trust/admin/organizations/:id/suspension { suspended, reason } */
  async adminSetSuspension(ctx: any) {
    const { suspended, reason } = (ctx.request.body as any) || {}
    const org = await strapi.db.query(ORG_UID).findOne({ where: { id: ctx.params.id } })
    if (!org) return ctx.notFound('Organisation not found')
    await strapi.service('api::billing.billing').updateOrg(org.documentId, {
      suspendedAt: suspended ? new Date() : null,
      suspensionReason: suspended ? clean(reason, 2000) || null : null,
    })
    await strapi.service('api::audit-log-entry.audit-log').record({
      action: suspended ? 'organization.suspend' : 'organization.unsuspend',
      entityType: 'organization',
      entityId: String(org.id),
      actorId: ctx.state.user.id,
      metadata: {},
    })
    return { data: { id: org.id, suspended: !!suspended } }
  },

  /** GET /trust/admin/reports */
  async adminReports(ctx: any) {
    const reports = await strapi.db.query(REPORT_UID).findMany({ orderBy: { createdAt: 'desc' }, limit: 200 })
    return { data: reports }
  },

  /** POST /trust/admin/reports/:id { status, resolution } */
  async adminUpdateReport(ctx: any) {
    const { status, resolution } = (ctx.request.body as any) || {}
    if (!['open', 'acknowledged', 'actioned', 'dismissed'].includes(status)) return ctx.badRequest('Invalid status')
    const report = await strapi.db.query(REPORT_UID).update({
      where: { id: ctx.params.id },
      data: {
        status,
        resolution: clean(resolution, 5000) || null,
        resolvedAt: ['actioned', 'dismissed'].includes(status) ? new Date() : null,
      },
    })
    if (!report) return ctx.notFound('Report not found')
    return { data: report }
  },
})
