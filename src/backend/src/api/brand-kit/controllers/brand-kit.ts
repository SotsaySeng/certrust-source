/**
 * brand-kit controller - logo, colours, fonts and signers an organization
 * saves once; applied to a template when it is used (design-core
 * applyBrandKit). Editing the kit never changes designs already saved.
 */
import sharp from 'sharp'
import { factories } from '@strapi/strapi'
import { familyDef, imageSrc } from '../../../utils/design-core'
import { resolveDesignImage } from '../../../utils/design-render'
import { callerContext } from '../../../utils/design-studio'

const UID = 'api::brand-kit.brand-kit'
const HEX = /^#[0-9a-f]{6}$/i

function toDto(r: any) {
  return {
    logo: r?.logo ?? null,
    primary: r?.primary ?? null,
    secondary: r?.secondary ?? null,
    accent: r?.accent ?? null,
    headingFont: r?.headingFont ?? null,
    bodyFont: r?.bodyFont ?? null,
    signers: Array.isArray(r?.signers) ? r.signers : [],
    exists: !!r,
  }
}

const img = (v: unknown) => (typeof v === 'string' && v && imageSrc.safeParse(v).success && v.length < 2048 ? v : null)
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)

export default factories.createCoreController(UID, ({ strapi }) => ({
  async mine(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return { data: toDto(null) }
    const row = await strapi.db.query(UID).findOne({ where: { organization: { id: caller.organizationId } } })
    return { data: toDto(row) }
  },

  async save(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    if (caller.organizationId == null) return ctx.forbidden('You must belong to an organization.')
    const input: any = (ctx.request.body as any)?.data || {}
    const data: any = {
      logo: img(input.logo),
      primary: HEX.test(input.primary) ? input.primary : null,
      secondary: HEX.test(input.secondary) ? input.secondary : null,
      accent: HEX.test(input.accent) ? input.accent : null,
      headingFont: typeof input.headingFont === 'string' && familyDef(input.headingFont) ? input.headingFont : null,
      bodyFont: typeof input.bodyFont === 'string' && familyDef(input.bodyFont) ? input.bodyFont : null,
      signers: (Array.isArray(input.signers) ? input.signers : []).slice(0, 3).map((s: any) => ({
        name: str(s?.name, 80),
        title: str(s?.title, 120),
        signature: img(s?.signature),
      })),
    }
    const existing = await strapi.db.query(UID).findOne({ where: { organization: { id: caller.organizationId } } })
    if (existing) await strapi.db.query(UID).update({ where: { id: existing.id }, data })
    else await strapi.documents(UID).create({ data: { ...data, organization: caller.organizationId } } as any)
    const row = await strapi.db.query(UID).findOne({ where: { organization: { id: caller.organizationId } } })
    return { data: toDto(row) }
  },

  /**
   * POST /brand-kit/suggest-colors {src} - up to 5 distinct colours from a
   * logo the organization uploaded, most dominant first, for the wizard's
   * "use my logo's colours" step.
   */
  async suggestColors(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const src = img((ctx.request.body as any)?.src)
    if (!src) return ctx.badRequest('Upload a logo first.')
    const dataUri = await resolveDesignImage(src)
    if (!dataUri) return ctx.badRequest('That logo could not be read.')
    const buf = Buffer.from(dataUri.slice(dataUri.indexOf(',') + 1), 'base64')
    const { data, info } = await sharp(buf, { density: 72 }).resize(64, 64, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const buckets = new Map<string, { n: number, r: number, g: number, b: number }>()
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]]
      if (a < 128) continue
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      // Skip near-white, near-black and greys: brand colours are chromatic.
      if (max > 240 && min > 225) continue
      if (max < 25) continue
      if (max - min < 18) continue
      const key = `${r >> 5},${g >> 5},${b >> 5}`
      const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
      e.n++
      e.r += r
      e.g += g
      e.b += b
      buckets.set(key, e)
    }
    const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0')
    const colors = [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .map(e => `#${hex(e.r / e.n)}${hex(e.g / e.n)}${hex(e.b / e.n)}`)
      .filter((c, i, all) => all.findIndex(o => distance(o, c) < 60) === i)
      .slice(0, 5)
    return { data: { colors } }
  },
}))

function distance(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map(i => Number.parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
}
