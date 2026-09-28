import type { Design, PlaceholderData } from './types'

/**
 * Placeholders are written `{{namespace.key}}` inside text content. The
 * editor shows them as `[namespace.key]` (the convention issuers already
 * know from other certificate tools) and as friendly chips in the panels.
 */
export const PLACEHOLDER_RE = /\{\{\s*([a-z][\w.-]*)\s*\}\}/gi

export interface PlaceholderDef {
  key: string
  group: 'recipient' | 'credential' | 'issuer' | 'achievement' | 'custom'
  /** i18n key suffix under designStudio.attributes.* - UI supplies the label. */
  label: string
  kind: 'text' | 'date' | 'email'
}

export const BUILT_IN_PLACEHOLDERS: PlaceholderDef[] = [
  { key: 'recipient.name', group: 'recipient', label: 'recipientName', kind: 'text' },
  { key: 'credential.id', group: 'credential', label: 'credentialId', kind: 'text' },
  { key: 'credential.issued_on', group: 'credential', label: 'issueDate', kind: 'date' },
  { key: 'credential.expires_on', group: 'credential', label: 'expiryDate', kind: 'date' },
  { key: 'issuer.name', group: 'issuer', label: 'issuerName', kind: 'text' },
  { key: 'issuer.organization', group: 'issuer', label: 'issuerOrganization', kind: 'text' },
  { key: 'issuer.support_email', group: 'issuer', label: 'issuerSupportEmail', kind: 'email' },
  { key: 'achievement.name', group: 'achievement', label: 'achievementName', kind: 'text' },
  { key: 'achievement.description', group: 'achievement', label: 'achievementDescription', kind: 'text' },
]

export function customKey(key: string): string {
  return `custom.${key}`
}

/** Replace placeholders with values. Unknown/empty values become ''. */
export function fillPlaceholders(text: string, data: PlaceholderData): string {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => {
    const v = data[key]
    return v == null ? '' : String(v)
  })
}

/** Template view: `{{recipient.name}}` -> `[recipient.name]`. */
export function showPlaceholderTokens(text: string): string {
  return text.replace(PLACEHOLDER_RE, (_, key: string) => `[${key}]`)
}

export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER_RE)].map(m => m[1])
}

export function placeholdersInDesign(design: Design): Set<string> {
  const keys = new Set<string>()
  for (const el of design.elements) {
    if (el.type === 'text') {
      for (const k of placeholdersIn(el.content)) {
        keys.add(k)
      }
    }
  }
  return keys
}

/** Sample recipients for the editor's "Show sample data" toggle and previews. */
export const SAMPLE_RECIPIENTS = [
  'Alex Morgan',
  'Maximilian Alexander Featherstonehaugh-Worthington',
  'ສົມສະໄໝ ພົມມະວົງ',
]

export function sampleData(opts: {
  recipientName?: string
  issuerName?: string
  organization?: string
  supportEmail?: string
  achievementName?: string
  achievementDescription?: string
  custom?: Record<string, string>
} = {}): PlaceholderData {
  const data: PlaceholderData = {
    'recipient.name': opts.recipientName ?? SAMPLE_RECIPIENTS[0],
    'credential.id': 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'credential.issued_on': formatDate(new Date()),
    'credential.expires_on': formatDate(new Date(Date.now() + 365 * 86400000)),
    'issuer.name': opts.issuerName ?? 'Jordan Lee',
    'issuer.organization': opts.organization ?? 'Your Organization',
    'issuer.support_email': opts.supportEmail ?? 'support@example.com',
    'achievement.name': opts.achievementName ?? 'Advanced Leadership Program',
    'achievement.description': opts.achievementDescription
      ?? 'For successfully completing all modules and the final assessment with distinction.',
  }
  for (const [k, v] of Object.entries(opts.custom ?? {})) {
    data[customKey(k)] = v
  }
  return data
}

/** Certificate date format, e.g. "25 September 2026". */
export function formatDate(value: Date | string | null | undefined, locale = 'en-GB'): string {
  if (!value) {
    return ''
  }
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) {
    return String(value)
  }
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
}
