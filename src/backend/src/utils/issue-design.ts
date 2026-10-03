/**
 * Design Studio x issuance: which designs a credential gets, the snapshot
 * stored on it, the custom attribute values, and the placeholder data a
 * credential renders with.
 *
 * Snapshots: at issuance the chosen certificate/badge design is copied onto
 * the credential with the organization's brand baked in, so editing (or
 * deleting) the template later never changes a certificate already issued.
 */
import { errors } from '@strapi/utils'
import type { Design, PlaceholderData } from './design-core'
import { applyBrandKit, formatDate, isEmptyDesign, validateDesign } from './design-core'
import { callerContext, orgBrandKit } from './design-studio'
import { issuerDisplayName } from './issuer-display-name'

const DT = 'api::design-template.design-template'

export interface IssueDesigns {
  certificate: Design | null
  badge: Design | null
  /** documentId of the certificate design used (reference only). */
  templateId: string | null
}

async function loadDesign(documentId: string, organization: any): Promise<{ design: Design, kind: 'certificate' | 'badge' } | null> {
  const tpl: any = await strapi.documents(DT).findOne({ documentId, populate: ['organization'] } as any)
  if (!tpl) throw new errors.ValidationError('The selected design no longer exists. Choose another design.')
  const ownerOrg = tpl.organization?.id ?? null
  if (ownerOrg != null && String(ownerOrg) !== String(organization?.id)) {
    throw new errors.ForbiddenError('The selected design belongs to another organization.')
  }
  if (ownerOrg == null && tpl.isPremium) {
    const limits = await strapi.service('api::organization.usage').getDesignLimits(organization)
    if (!limits.premiumTemplates) throw new errors.ForbiddenError('The selected design is a Premium template. Upgrade your plan to issue with it.')
  }
  if (isEmptyDesign(tpl.layoutConfig)) return null
  const r = validateDesign(tpl.layoutConfig)
  if (!r.ok) throw new errors.ValidationError(`The selected design can't be used: ${r.error}`)
  const design = r.design as Design
  return { design, kind: design.kind }
}

export interface DesignOverrides {
  /** undefined: the achievement's default; null: none; string: that design. */
  certificate?: string | null
  badge?: string | null
}

/** Overrides from an issue request body (designTemplateId is the older single-override name). */
export function overridesFromBody(data: any): DesignOverrides {
  const pick = (v: unknown) => (v === undefined ? undefined : v === null || v === '' ? null : String(v))
  return {
    certificate: pick(data?.certificateDesignId !== undefined ? data.certificateDesignId : data?.designTemplateId),
    badge: pick(data?.badgeDesignId),
  }
}

/**
 * The designs for an issuance: per kind, the override from the issue page
 * if given, otherwise the achievement's default.
 */
export async function resolveIssueDesigns(achievement: any, organization: any, overrides: DesignOverrides = {}): Promise<IssueDesigns> {
  const brand = await orgBrandKit(organization?.id ?? null)
  const out: IssueDesigns = { certificate: null, badge: null, templateId: null }
  for (const kind of ['certificate', 'badge'] as const) {
    const id = overrides[kind] !== undefined ? overrides[kind] : (kind === 'certificate' ? achievement?.certificateDesignId : achievement?.badgeDesignId) || null
    if (!id) continue
    const loaded = await loadDesign(id, organization)
    if (!loaded) continue
    if (loaded.kind !== kind) {
      throw new errors.ValidationError(kind === 'certificate' ? 'The chosen certificate design is a badge design.' : 'The chosen badge design is a certificate design.')
    }
    out[kind] = applyBrandKit(loaded.design, brand)
    if (kind === 'certificate') out.templateId = id
  }
  return out
}

export interface CustomAttributeDef {
  key: string
  label: string
  type: 'text' | 'date' | 'number'
  required: boolean
}

export async function orgCustomAttributes(organizationId: number | string | null): Promise<CustomAttributeDef[]> {
  if (organizationId == null) return []
  return strapi.db.query('api::custom-attribute.custom-attribute').findMany({
    where: { organization: { id: organizationId } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  }) as any
}

/**
 * Clean one recipient's custom attribute values against the organization's
 * definitions: unknown keys are dropped, values trimmed, dates normalised
 * to YYYY-MM-DD, numbers checked. Throws a readable error naming the
 * attribute when a required one is missing or a value is invalid.
 */
export function cleanCustomFields(input: unknown, defs: CustomAttributeDef[]): Record<string, string> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const def of defs) {
    const raw = src[def.key] ?? src[def.label]
    const value = raw == null ? '' : String(raw).trim().slice(0, 500)
    if (!value) {
      if (def.required) throw new errors.ValidationError(`“${def.label}” is required.`)
      continue
    }
    if (def.type === 'number') {
      if (!Number.isFinite(Number(value.replace(',', '.')))) throw new errors.ValidationError(`“${def.label}” must be a number (got “${value}”).`)
      out[def.key] = value
    }
    else if (def.type === 'date') {
      const d = parseDate(value)
      if (!d) throw new errors.ValidationError(`“${def.label}” must be a date, e.g. 2026-08-19 (got “${value}”).`)
      out[def.key] = d
    }
    else {
      out[def.key] = value
    }
  }
  return out
}

/** Accepts YYYY-MM-DD, DD/MM/YYYY, D.M.YYYY and anything Date can parse; returns YYYY-MM-DD. */
function parseDate(v: string): string | null {
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/)
  if (m) return iso(+m[3], +m[2], +m[1])
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}
function iso(y: number, mo: number, d: number): string | null {
  const date = new Date(Date.UTC(y, mo - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Placeholder values for rendering an issued credential. */
export function credentialPlaceholderData(credential: any, defs: CustomAttributeDef[] = []): PlaceholderData {
  const frontendUrl = strapi.config.get('frontend.url', 'http://localhost:3000')
  const issuer = credential.issuer
  const data: PlaceholderData = {
    'recipient.name': credential.recipient?.name || '',
    'credential.id': String(credential.credentialId || '').replace(/^urn:uuid:/, ''),
    'credential.issued_on': formatDate(credential.issuanceDate),
    'credential.expires_on': formatDate(credential.expirationDate),
    'credential.verify_url': `${frontendUrl}/credentials/${encodeURIComponent(credential.credentialId)}`,
    'issuer.name': issuerDisplayName(issuer, ''),
    'issuer.organization': issuer?.organization?.name || issuer?.name || '',
    'issuer.support_email': issuer?.email || '',
    'achievement.name': credential.achievement?.name || credential.name || '',
    'achievement.description': credential.achievement?.description || credential.description || '',
  }
  const types = new Map(defs.map(d => [d.key, d.type]))
  for (const [k, v] of Object.entries(credential.customFields || {})) {
    data[`custom.${k}`] = types.get(k) === 'date' ? formatDate(String(v)) : String(v)
  }
  return data
}

/**
 * Validate an achievement's certificateDesignId / badgeDesignId as set by
 * the caller (create/update): the design must be one their organization can
 * use, of the right kind. Empty values clear the field. Mutates `data`.
 */
export async function validateAchievementDesigns(data: any, userId: number): Promise<void> {
  if (!data || typeof data !== 'object') return
  const fields = [['certificateDesignId', 'certificate'], ['badgeDesignId', 'badge']] as const
  if (!fields.some(([f]) => f in data)) return
  const caller = await callerContext(userId)
  for (const [field, kind] of fields) {
    if (!(field in data)) continue
    const id = data[field] ? String(data[field]).trim() : ''
    if (!id) {
      data[field] = null
      continue
    }
    const loaded = await loadDesign(id, caller.organization)
    const actual = loaded?.kind ?? (await strapi.documents(DT).findOne({ documentId: id } as any) as any)?.kind
    if (actual && actual !== kind) {
      throw new errors.ValidationError(kind === 'certificate' ? 'Choose a certificate design for the certificate.' : 'Choose a badge design for the badge.')
    }
    data[field] = id
  }
}
