/**
 * design-template controller
 *
 * Design Studio templates. Two kinds of rows:
 *   - organization set: an organization's own designs (scoped to members);
 *   - organization null: platform "system" templates, readable by every
 *     signed-in user, written only by Platform Admins (in the in-app
 *     editor) or through Strapi's /admin panel.
 *
 * Tier rules (see organization/services/usage.ts getDesignLimits): saved
 * design count is enforced by the beforeCreate lifecycle; Premium system
 * templates can only be used by organizations whose Tier Settings column
 * (the trial column while trialing) has premiumTemplates. For everyone
 * else a premium template is listed with `locked: true` and without its
 * layoutConfig, so it can be previewed (previewImage) but not copied.
 *
 * Organization scoping is done here rather than with the
 * global::is-in-organization route policy: that policy resolves to a
 * *profile* id, and design-template.organization points straight at the
 * organization (see git history of this file for the full reasoning).
 *
 * Pre-flight lookups are wrapped in try/catch; delegated super.* calls are
 * not - they (and the tier-limit lifecycle) raise clean 4xx
 * ApplicationErrors that a catch here would flatten into a 500.
 */

import { factories } from '@strapi/strapi'
import type { Design } from '../../../utils/design-core'
import { applyBrandKit, blankDesign, isEmptyDesign, sampleData, validateDesign } from '../../../utils/design-core'
import { renderDesignPdf, renderDesignPng } from '../../../utils/design-render'
import { callerContext, orgBrandKit, parseDesignInput, refreshDesignPreview } from '../../../utils/design-studio'

const UID = 'api::design-template.design-template'

/** Fields only Platform Admins may set (system-template curation). */
const ADMIN_ONLY_FIELDS = ['isPremium', 'isHidden', 'slug', 'sortOrder', 'isDefault']

/**
 * Read access: an organization's own templates, plus every system
 * template (organization null). A caller without an organization only
 * sees system templates.
 */
function canRead(ctx: { organizationId: number | null, isPlatformAdmin: boolean }, targetOrganizationId: number | string | null): boolean {
  if (targetOrganizationId == null) return true
  if (ctx.isPlatformAdmin && ctx.organizationId == null) return false
  return ctx.organizationId != null && String(ctx.organizationId) === String(targetOrganizationId)
}

/**
 * Write access: the caller's own organization's rows; system rows only for
 * Platform Admins.
 */
function canWrite(ctx: { organizationId: number | null, isPlatformAdmin: boolean }, targetOrganizationId: number | string | null): boolean {
  if (targetOrganizationId == null) return ctx.isPlatformAdmin
  return ctx.organizationId != null && String(ctx.organizationId) === String(targetOrganizationId)
}

/** Mark premium system templates the caller may not use, and hide their design. */
function applyPremiumLock<T extends Record<string, any>>(item: T, entitled: boolean): T {
  if (!item) return item
  const isSystem = item.organization == null || item.organization?.id == null
  const locked = !!item.isPremium && isSystem && !entitled
  const out: any = { ...item, locked }
  if (locked) out.layoutConfig = null
  return out
}

async function premiumEntitled(caller: Awaited<ReturnType<typeof callerContext>>): Promise<boolean> {
  if (caller.isPlatformAdmin) return true
  if (!caller.organization) return false
  const limits = await strapi.service('api::organization.usage').getDesignLimits(caller.organization)
  return !!limits.premiumTemplates
}

/** Strip client-supplied fields the caller may not set; derive kind/orientation/type from the design. */
function prepareData(data: any, design: Design | null, isPlatformAdmin: boolean): any {
  const out = { ...(data || {}) }
  delete out.organization
  delete out.creator
  delete out.previewImage
  delete out.system
  if (!isPlatformAdmin) for (const f of ADMIN_ONLY_FIELDS) delete out[f]
  if (design) {
    out.layoutConfig = design
    out.kind = design.kind
    out.type = design.kind
    out.orientation = design.page.orientation
    out.schemaVersion = design.version
  }
  return out
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  async find(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to list design templates')
    }

    let caller: Awaited<ReturnType<typeof callerContext>>
    let entitled: boolean
    try {
      caller = await callerContext(ctx.state.user.id)
      entitled = await premiumEntitled(caller)
    }
    catch (err) {
      strapi.log.error(`[design-template.find] Multi-tenancy error: ${(err as Error).message}`)
      return ctx.internalServerError('Error fetching design templates')
    }

    // { $null: true }, never a literal null: assigning ctx.query runs Koa's
    // setter, which re-stringifies the object, and null does not survive
    // that round trip (it arrives as organization='' and matches nothing).
    // System templates hidden by a Platform Admin stay out of the gallery
    // (null counts as visible: rows from before the field existed).
    const system = { $and: [{ organization: { $null: true } }, { $or: [{ isHidden: false }, { isHidden: { $null: true } }] }] }
    const scope = caller.organizationId
      ? { $or: [{ organization: caller.organizationId }, system] }
      : system
    ctx.query = {
      ...ctx.query,
      filters: { $and: [(ctx.query as any)?.filters || {}, scope] },
    } as any

    const result: any = await super.find(ctx)
    if (Array.isArray(result?.data)) result.data = result.data.map((item: any) => applyPremiumLock(item, entitled))
    return result
  },

  async findOne(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view design templates')
    }

    let caller: Awaited<ReturnType<typeof callerContext>>
    let entitled: boolean
    let ownerOrgId: number | null
    try {
      const existing: any = await strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        populate: ['organization'],
      } as any)
      if (!existing) return ctx.notFound('Design template not found')
      ownerOrgId = existing.organization?.id ?? null
      caller = await callerContext(ctx.state.user.id)
      if (!canRead(caller, ownerOrgId)) {
        return ctx.forbidden('You do not have access to this organization\'s resources.')
      }
      entitled = await premiumEntitled(caller)
    }
    catch (err) {
      strapi.log.error(`[design-template.findOne] Multi-tenancy error: ${(err as Error).message}`)
      return ctx.internalServerError('Error fetching design template')
    }

    const result: any = await super.findOne(ctx)
    if (result?.data) {
      result.data = applyPremiumLock({ ...result.data, organization: result.data.organization ?? (ownerOrgId == null ? null : { id: ownerOrgId }) }, entitled)
      result.data.canEdit = canWrite(caller, ownerOrgId)
      result.data.system = ownerOrgId == null
    }
    return result
  },

  /**
   * Create. organization is always resolved server-side from the caller's
   * profile (never trusted from the client). Platform Admins may create a
   * system template instead by sending `data.system: true`.
   */
  async create(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to create design templates')
    }
    const body: any = ctx.request.body || {}
    const input = body.data || {}

    let caller: Awaited<ReturnType<typeof callerContext>>
    try {
      caller = await callerContext(ctx.state.user.id)
    }
    catch (err) {
      strapi.log.error(`[design-template.create] Multi-tenancy error: ${(err as Error).message}`)
      return ctx.internalServerError('Error creating design template')
    }

    const system = input.system === true && caller.isPlatformAdmin
    if (!system && caller.organizationId == null) {
      return ctx.forbidden('You must belong to an organization to create design templates.')
    }

    const design = parseDesignInput(input.layoutConfig)
    ctx.request.body = {
      ...body,
      data: {
        ...prepareData(input, design, caller.isPlatformAdmin),
        organization: system ? null : caller.organizationId,
        creator: caller.profileId,
      },
    } as any

    const result: any = await super.create(ctx)
    if (result?.data?.documentId && design) await refreshDesignPreview(result.data.documentId)
    return result
  },

  async update(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to update design templates')
    }

    let caller: Awaited<ReturnType<typeof callerContext>>
    try {
      const existing: any = await strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        populate: ['organization'],
      } as any)
      if (!existing) return ctx.notFound('Design template not found')
      caller = await callerContext(ctx.state.user.id)
      if (!canWrite(caller, existing.organization?.id ?? null)) {
        return ctx.forbidden('You do not have access to this organization\'s resources.')
      }
    }
    catch (err) {
      strapi.log.error(`[design-template.update] Multi-tenancy error: ${(err as Error).message}`)
      return ctx.internalServerError('Error updating design template')
    }

    const body: any = ctx.request.body || {}
    const input = body.data || {}
    const design = 'layoutConfig' in input ? parseDesignInput(input.layoutConfig) : null
    const data = prepareData(input, design, caller.isPlatformAdmin)
    if ('layoutConfig' in input && !design) data.layoutConfig = {}
    ctx.request.body = { ...body, data } as any

    const result: any = await super.update(ctx)
    if (design) await refreshDesignPreview(ctx.params.id)
    return result
  },

  async delete(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to delete design templates')
    }

    try {
      const existing: any = await strapi.documents(UID).findOne({
        documentId: ctx.params.id,
        populate: ['organization'],
      } as any)
      if (!existing) return ctx.notFound('Design template not found')
      const caller = await callerContext(ctx.state.user.id)
      if (!canWrite(caller, existing.organization?.id ?? null)) {
        return ctx.forbidden('You do not have access to this organization\'s resources.')
      }
    }
    catch (err) {
      strapi.log.error(`[design-template.delete] Multi-tenancy error: ${(err as Error).message}`)
      return ctx.internalServerError('Error deleting design template')
    }

    return super.delete(ctx)
  },

  /**
   * POST /design-templates/:id/use - "Use this template": copy a template
   * (system or the organization's own) into a new organization design,
   * with the organization's brand kit applied. The premium gate and the
   * saved-design limit are both enforced here, server side.
   */
  async use(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) {
      return ctx.forbidden('You must belong to an organization to use templates.')
    }
    const source: any = await strapi.documents(UID).findOne({
      documentId: ctx.params.id,
      populate: ['organization', 'category'],
    } as any)
    if (!source || !canRead(caller, source.organization?.id ?? null)) {
      return ctx.notFound('Design template not found')
    }
    if (source.isPremium && source.organization == null && !(await premiumEntitled(caller))) {
      return ctx.forbidden('This is a Premium template. Upgrade your plan to use it.', { code: 'PREMIUM_REQUIRED' })
    }

    const parsed = isEmptyDesign(source.layoutConfig) ? null : validateDesign(source.layoutConfig)
    const base: Design = parsed?.ok ? (parsed.design as Design) : blankDesign(source.kind === 'badge' ? 'badge' : 'certificate', source.orientation === 'portrait' ? 'portrait' : 'landscape')
    const design = applyBrandKit(base, await orgBrandKit(caller.organizationId))
    const name = String((ctx.request.body as any)?.name || '').trim().slice(0, 120) || source.name

    const created: any = await strapi.documents(UID).create({
      data: {
        name,
        description: source.description ?? null,
        layoutConfig: design,
        kind: design.kind,
        type: design.kind,
        orientation: design.page.orientation,
        schemaVersion: 1,
        category: source.category?.id ?? null,
        organization: caller.organizationId,
        creator: caller.profileId,
      },
    } as any)
    await refreshDesignPreview(created.documentId)
    const fresh = await strapi.documents(UID).findOne({ documentId: created.documentId, populate: ['previewImage', 'category'] } as any)
    return { data: fresh }
  },

  /**
   * POST /design-templates/render-preview - render a design (as sent from
   * the editor, not necessarily saved) with sample data. `format` png
   * (default) or pdf. Used by the editor's Preview and the admin library.
   */
  async renderPreview(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    if (!allowRender(ctx.state.user.id)) return ctx.tooManyRequests('Too many preview requests, please wait a moment.')
    const body: any = ctx.request.body || {}
    const design = parseDesignInput(body.layoutConfig)
    if (!design) return ctx.badRequest('Nothing to render yet - add something to the design first.')
    const caller = await callerContext(ctx.state.user.id)
    const data = sampleData({
      recipientName: typeof body.recipientName === 'string' ? body.recipientName.slice(0, 200) : undefined,
      organization: caller.organization?.name,
      custom: typeof body.custom === 'object' && body.custom ? Object.fromEntries(Object.entries(body.custom).slice(0, 50).map(([k, v]) => [k, String(v).slice(0, 500)])) : undefined,
    })
    const brand = await orgBrandKit(caller.organizationId)
    if (body.format === 'pdf') {
      ctx.set('Content-Type', 'application/pdf')
      ctx.body = await renderDesignPdf(design, { data, brand })
      return
    }
    const width = Math.min(3000, Math.max(200, Number(body.width) || design.page.width * 2))
    ctx.set('Content-Type', 'image/png')
    ctx.set('Cache-Control', 'no-store')
    ctx.body = await renderDesignPng(design, { data, brand, width })
  },

  /**
   * GET /design-templates/limits - saved-design usage and Premium access
   * for the caller's organization (Tier Settings, trial-aware).
   */
  async limits(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    const usage = strapi.service('api::organization.usage')
    if (!caller.organization) {
      return { data: { used: 0, limit: 0, premiumTemplates: caller.isPlatformAdmin, source: null, trialing: false, isPlatformAdmin: caller.isPlatformAdmin, tier: null } }
    }
    const [limits, used] = await Promise.all([
      usage.getDesignLimits(caller.organization),
      usage.countOrganizationDesignTemplates(caller.organizationId),
    ])
    return {
      data: {
        used,
        limit: limits.designTemplateLimit,
        premiumTemplates: limits.premiumTemplates || caller.isPlatformAdmin,
        source: limits.source,
        trialing: caller.organization.subscriptionStatus === 'trialing',
        trialEndsAt: caller.organization.trialEndsAt ?? null,
        tier: caller.organization.tier,
        isPlatformAdmin: caller.isPlatformAdmin,
      },
    }
  },

  // ---------------------------------------------------------------------
  // Admin > Design library (routes guarded by global::is-platform-admin).
  // Curation fields are plain in-place writes with the query engine.

  /** GET /design-templates/admin/library - every system template, hidden ones included. */
  async adminLibrary(ctx) {
    const rows: any[] = await strapi.db.query(UID).findMany({
      where: { organization: { id: { $null: true } } },
      populate: ['previewImage', 'category'],
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const docs = new Map<string, any>(rows.map(r => [r.documentId, r]))
    const ids = [...docs.keys()]
    const achievements: any[] = ids.length
      ? await strapi.db.query('api::achievement.achievement').findMany({
        where: { $or: [{ certificateDesignId: { $in: ids } }, { badgeDesignId: { $in: ids } }] },
        select: ['certificateDesignId', 'badgeDesignId'],
      })
      : []
    const usedBy = new Map<string, number>()
    for (const a of achievements) {
      for (const id of new Set([a.certificateDesignId, a.badgeDesignId])) {
        if (id && docs.has(id)) usedBy.set(id, (usedBy.get(id) || 0) + 1)
      }
    }
    const data = [...docs.values()].map(r => ({
      documentId: r.documentId,
      name: r.name,
      description: r.description,
      slug: r.slug,
      kind: r.kind,
      orientation: r.orientation,
      isPremium: !!r.isPremium,
      isHidden: !!r.isHidden,
      sortOrder: r.sortOrder ?? 0,
      category: r.category ? { documentId: r.category.documentId, name: r.category.name } : null,
      previewImage: r.previewImage ? { url: r.previewImage.url } : null,
      usedByAchievements: usedBy.get(r.documentId) || 0,
      updatedAt: r.updatedAt,
    }))
    return { data }
  },

  /** PUT /design-templates/admin/:id - name, description, category, premium, hidden. */
  async adminUpdate(ctx) {
    const rows: any[] = await strapi.db.query(UID).findMany({ where: { documentId: ctx.params.id, organization: { id: { $null: true } } }, select: ['id'] })
    if (!rows.length) return ctx.notFound('System template not found')
    const input: any = (ctx.request.body as any)?.data || {}
    const data: Record<string, unknown> = {}
    if (typeof input.name === 'string') {
      const name = input.name.trim().slice(0, 120)
      if (!name) return ctx.badRequest('Name is required.')
      data.name = name
    }
    if (typeof input.description === 'string') data.description = input.description.trim().slice(0, 1000)
    if (typeof input.isPremium === 'boolean') data.isPremium = input.isPremium
    if (typeof input.isHidden === 'boolean') data.isHidden = input.isHidden
    if ('category' in input) {
      if (input.category) {
        const cat: any = await strapi.db.query('api::design-category.design-category').findOne({ where: { documentId: String(input.category) }, select: ['id'] })
        if (!cat) return ctx.badRequest('Unknown category.')
        data.category = cat.id
      }
      else {
        data.category = null
      }
    }
    for (const r of rows) await strapi.db.query(UID).update({ where: { id: r.id }, data })
    return { data: { documentId: ctx.params.id, ...data } }
  },

  /** PUT /design-templates/admin/order - { data: { ids: documentId[] } } sets gallery order. */
  async adminReorder(ctx) {
    const ids: unknown = (ctx.request.body as any)?.data?.ids
    if (!Array.isArray(ids) || ids.length > 1000 || !ids.every(x => typeof x === 'string')) {
      return ctx.badRequest('ids must be a list of template ids.')
    }
    const rows: any[] = await strapi.db.query(UID).findMany({
      where: { documentId: { $in: ids }, organization: { id: { $null: true } } },
      select: ['id', 'documentId'],
    })
    const order = new Map((ids as string[]).map((id, i) => [id, i]))
    for (const r of rows) await strapi.db.query(UID).update({ where: { id: r.id }, data: { sortOrder: order.get(r.documentId) } })
    return { data: { updated: new Set(rows.map(r => r.documentId)).size } }
  },
}))

// A small per-user throttle for the render endpoint (rendering is CPU work).
const renderLog = new Map<number, number[]>()
function allowRender(userId: number): boolean {
  const now = Date.now()
  const recent = (renderLog.get(userId) || []).filter(t => now - t < 60_000)
  if (recent.length >= 30) return false
  recent.push(now)
  renderLog.set(userId, recent)
  if (renderLog.size > 5000) renderLog.clear()
  return true
}
