/**
 * Facts the legal documents (Terms, Privacy Policy, DPA, sub-processors)
 * share. Change them here, not in the documents, so the four stay
 * consistent. Bump LEGAL_EFFECTIVE_DATE whenever the text of any document
 * changes materially - the Terms promise 30 days' notice of material
 * changes, so also email customers before publishing.
 */
export const LEGAL = {
  effectiveDate: '2026-09-25',
  company: 'Zettabyte Lab & Consulting Sole Co., Ltd.',
  companyShort: 'Zettabyte Lab',
  // TODO(legal): replace with the registered street address in Vientiane.
  address: 'Vientiane, Lao PDR',
  product: 'Certrust',
  website: 'https://certrust.app',
  supportEmail: 'support@certrust.app',
  privacyEmail: 'privacy@certrust.app',
  sourceCodeUrl: 'https://github.com/SotsaySeng/certrust-source',
  upstreamUrl: 'https://github.com/schroedinger-hat/certo',
  governingLaw: 'the Republic of Singapore',
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
