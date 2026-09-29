/**
 * Facts the legal documents (Terms, Privacy Policy, DPA, sub-processors)
 * share. Change them here, not in the documents, so the four stay
 * consistent. Bump LEGAL_EFFECTIVE_DATE whenever the text of any document
 * changes materially - the Terms promise 30 days' notice of material
 * changes, so also email customers before publishing.
 */
export const LEGAL = {
  effectiveDate: '2026-09-29',
  // The contracting party: a New Zealand sole trader (IRD-registered),
  // the same legal name as on the Stripe account that receives payments.
  operator: 'Sotsay Sengvong, trading as Certrust',
  operatorType: 'a sole trader',
  // Published contact address. City and country only, to keep the
  // operator's home address private.
  address: 'Auckland, New Zealand',
  // Technology consultant that designs, develops, maintains and supports
  // the platform. Not a party to the Terms; a sub-processor, because its
  // staff administer the live system.
  consultant: 'Zettabyte Lab & Consulting Sole Co., Ltd.',
  consultantShort: 'Zettabyte Lab',
  consultantAddress: 'Vientiane, Lao PDR',
  product: 'Certrust',
  website: 'https://certrust.app',
  supportEmail: 'support@certrust.app',
  privacyEmail: 'privacy@certrust.app',
  sourceCodeUrl: 'https://github.com/SotsaySeng/certrust-source',
  upstreamUrl: 'https://github.com/schroedinger-hat/certo',
  governingLaw: 'New Zealand',
  breachNoticeHours: 48,
  backupRetentionDays: 90,
  noticeDays: 30,
} as const

export interface LegalSection {
  /** Anchor id, stable across revisions so links to a clause keep working. */
  id: string
  title: string
  /** Trusted, static HTML (rendered with v-html). */
  paragraphs?: string[]
  items?: string[]
  /** Paragraphs rendered after the list. */
  after?: string[]
}

export interface LegalDocument {
  title: string
  summary: string
  lastUpdated: string
  sections: LegalSection[]
}

export const mailto = (address: string) => `<a href="mailto:${address}">${address}</a>`
export const link = (href: string, text: string) =>
  href.startsWith('/')
    ? `<a href="${href}">${text}</a>`
    : `<a href="${href}" target="_blank" rel="noopener">${text}</a>`
