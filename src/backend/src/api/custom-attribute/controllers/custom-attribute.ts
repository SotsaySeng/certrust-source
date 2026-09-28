/**
 * custom-attribute controller - per-organization recipient fields such as
 * "location" or "training date". Designs reference them as
 * {{custom.<key>}}; issuers fill them per recipient (form or CSV column)
 * and they are stored on credential.customFields.
 *
 * The key is fixed once created (designs and issued credentials refer to
 * it); label, type, required and order can change.
 */
import { factories } from '@strapi/strapi'
import { callerContext } from '../../../utils/design-studio'

const UID = 'api::custom-attribute.custom-attribute'
const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/
const TYPES = ['text', 'date', 'number']
const MAX_PER_ORG = 50

/** "Training Date" -> "training_date" */
export function toAttributeKey(label: string): string {
  return label.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^(\d)/, 'a_$1').slice(0, 40)
}

function toDto(r: any) {
  return { id: r.id, documentId: r.documentId, key: r.key, label: r.label, type: r.type, required: !!r.required, sortOrder: r.sortOrder ?? 0 }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async list(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return { data: [] }
    const rows = await strapi.db.query(UID).findMany({
      where: { organization: { id: caller.organizationId } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    return { data: rows.map(toDto) }
  },

  async add(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
    const input: any = (ctx.request.body as any)?.data || {}
    const label = String(input.label || '').trim().slice(0, 80)
    if (!label) return ctx.badRequest('Give the attribute a name.')
    const key = String(input.key || toAttributeKey(label))
    if (!KEY_RE.test(key)) return ctx.badRequest('The attribute key must start with a letter and use only a-z, 0-9 and _.', { code: 'INVALID_KEY' })
    const type = TYPES.includes(input.type) ? input.type : 'text'

    const existing = await strapi.db.query(UID).findMany({ where: { organization: { id: caller.organizationId } } })
    if (existing.some((r: any) => r.key === key)) return ctx.badRequest(`An attribute with the key "${key}" already exists.`, { code: 'DUPLICATE_KEY' })
    if (existing.length >= MAX_PER_ORG) return ctx.badRequest(`An organization can have up to ${MAX_PER_ORG} custom attributes.`)

    const created: any = await strapi.documents(UID).create({
      data: { key, label, type, required: !!input.required, sortOrder: existing.length, organization: caller.organizationId },
    } as any)
    return { data: toDto(created) }
  },

  async edit(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const row = await ownRow(ctx)
    if (!row) return
    const input: any = (ctx.request.body as any)?.data || {}
    const data: any = {}
    if (typeof input.label === 'string' && input.label.trim()) data.label = input.label.trim().slice(0, 80)
    if (TYPES.includes(input.type)) data.type = input.type
    if (typeof input.required === 'boolean') data.required = input.required
    if (Number.isFinite(input.sortOrder)) data.sortOrder = input.sortOrder
    await strapi.db.query(UID).update({ where: { id: row.id }, data })
    return { data: toDto({ ...row, ...data }) }
  },

  async remove(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const row = await ownRow(ctx)
    if (!row) return
    await strapi.db.query(UID).delete({ where: { id: row.id } })
    return { data: toDto(row) }
  },
}))

async function ownRow(ctx: any): Promise<any | null> {
  const caller = await callerContext(ctx.state.user.id)
  const idParam = String(ctx.params.id)
  const where = /^\d+$/.test(idParam) ? { id: Number(idParam) } : { documentId: idParam }
  const row: any = await strapi.db.query(UID).findOne({ where, populate: ['organization'] })
  if (!row || caller.organizationId == null || String(row.organization?.id) !== String(caller.organizationId)) {
    ctx.notFound('Attribute not found')
    return null
  }
  return row
}
