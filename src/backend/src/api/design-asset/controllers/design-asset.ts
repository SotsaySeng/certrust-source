/**
 * design-asset controller - the Design Studio's Uploads panel (an
 * organization's logos, signatures, seals) and Elements library (system
 * assets, organization null, curated by Platform Admins).
 *
 * Uploads: SVG, PNG or JPG up to 2 MB. SVGs are sanitised (utils/svg-
 * sanitize.ts) before storage because /uploads is served from the API
 * origin; every file must also decode with sharp, which rejects
 * mislabelled or corrupt images.
 */
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { factories } from '@strapi/strapi'
import { callerContext, uploadBuffer } from '../../../utils/design-studio'
import { sanitizeSvg } from '../../../utils/svg-sanitize'

const UID = 'api::design-asset.design-asset'
const MAX_BYTES = 2 * 1024 * 1024
const ELEMENT_CATEGORIES = ['shapes', 'graphics', 'ribbons', 'bases', 'seals', 'frames', 'laurels', 'icons']

function detectType(buf: Buffer, name: string, mimetype: string): 'svg' | 'png' | 'jpeg' | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'png'
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpeg'
  const head = buf.subarray(0, 2048).toString('utf8')
  if ((/\.svg$/i.test(name) || mimetype === 'image/svg+xml') && /<svg[\s>]/i.test(head)) return 'svg'
  return null
}

function toDto(row: any) {
  return {
    id: row.id,
    documentId: row.documentId,
    name: row.name,
    kind: row.kind,
    elementCategory: row.elementCategory ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    url: row.file?.url ?? null,
    mime: row.file?.mime ?? null,
    system: row.organization == null,
    sortOrder: row.sortOrder ?? 0,
  }
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  /**
   * GET /design-assets?kind=upload|element - uploads: the caller's
   * organization's files, newest first; element: the system library.
   */
  async list(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    const kind = ctx.query.kind === 'element' ? 'element' : 'upload'
    const where: any = kind === 'element'
      ? { kind: 'element', organization: { id: { $null: true } } }
      : { kind: 'upload', organization: { id: caller.organizationId ?? -1 } }
    const rows = await strapi.db.query(UID).findMany({
      where,
      populate: ['file', 'organization'],
      orderBy: kind === 'element' ? [{ elementCategory: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] : [{ id: 'desc' }],
      limit: 500,
    })
    return { data: rows.map(toDto) }
  },

  /**
   * POST /design-assets/upload (multipart: file, name?; Platform Admins
   * may add system=true, elementCategory for the Elements library).
   */
  async upload(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const caller = await callerContext(ctx.state.user.id)
    const body: any = ctx.request.body || {}
    const system = (body.system === 'true' || body.system === true) && caller.isPlatformAdmin
    if (!system && caller.organizationId == null) return ctx.forbidden('You must belong to an organization to upload images.')

    const raw: any = (ctx.request as any).files?.file ?? (ctx.request as any).files?.files
    const file = Array.isArray(raw) ? raw[0] : raw
    if (!file) return ctx.badRequest('Choose a file to upload.')
    if ((file.size ?? 0) > MAX_BYTES) return ctx.badRequest('That file is larger than 2 MB. Please upload a smaller image.', { code: 'FILE_TOO_LARGE' })

    const original = String(file.originalFilename || file.name || 'image')
    let buf: Buffer = await readFile(file.filepath || file.path)
    if (buf.length > MAX_BYTES) return ctx.badRequest('That file is larger than 2 MB. Please upload a smaller image.', { code: 'FILE_TOO_LARGE' })
    const type = detectType(buf, original, String(file.mimetype || file.type || ''))
    if (!type) return ctx.badRequest('Only SVG, PNG and JPG images can be uploaded.', { code: 'UNSUPPORTED_TYPE' })

    if (type === 'svg') {
      const clean = sanitizeSvg(buf.toString('utf8'))
      if (!/<svg[\s>]/.test(clean)) return ctx.badRequest('That SVG could not be read.', { code: 'INVALID_IMAGE' })
      buf = Buffer.from(clean, 'utf8')
    }

    let width: number | undefined
    let height: number | undefined
    try {
      const meta = await sharp(buf).metadata()
      width = meta.width
      height = meta.height
    }
    catch {
      return ctx.badRequest('That image could not be read. Please try a different file.', { code: 'INVALID_IMAGE' })
    }

    const ext = type === 'svg' ? 'svg' : type === 'png' ? 'png' : 'jpg'
    const mime = type === 'svg' ? 'image/svg+xml' : type === 'png' ? 'image/png' : 'image/jpeg'
    const base = original.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 80) || 'image'
    const stored = await uploadBuffer(buf, `${base}.${ext}`, mime)

    const elementCategory = system && ELEMENT_CATEGORIES.includes(body.elementCategory) ? body.elementCategory : null
    const created: any = await strapi.documents(UID).create({
      data: {
        name: String(body.name || base).slice(0, 120),
        file: stored.id,
        kind: system ? 'element' : 'upload',
        elementCategory,
        width,
        height,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
        organization: system ? null : caller.organizationId,
        creator: caller.profileId,
      },
    } as any)
    const row = await strapi.db.query(UID).findOne({ where: { id: created.id }, populate: ['file', 'organization'] })
    return { data: toDto(row) }
  },

  /** PUT /design-assets/:id - rename; Platform Admins may also move a system element (elementCategory, sortOrder). */
  async rename(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const row = await findWritable(ctx)
    if (!row) return
    const input: any = (ctx.request.body as any)?.data || {}
    const data: Record<string, unknown> = {}
    if ('name' in input) {
      const name = String(input.name ?? '').trim().slice(0, 120)
      if (!name) return ctx.badRequest('Name is required.')
      data.name = name
    }
    // System elements (only reachable here for Platform Admins, see findWritable).
    if (row.organization == null) {
      if ('elementCategory' in input) {
        if (!ELEMENT_CATEGORIES.includes(input.elementCategory)) return ctx.badRequest('Unknown element category.')
        data.elementCategory = input.elementCategory
      }
      if (Number.isFinite(Number(input.sortOrder)) && input.sortOrder !== null && input.sortOrder !== '') data.sortOrder = Math.trunc(Number(input.sortOrder))
    }
    if (!Object.keys(data).length) return ctx.badRequest('Nothing to update.')
    await strapi.db.query(UID).update({ where: { id: row.id }, data })
    const fresh = await strapi.db.query(UID).findOne({ where: { id: row.id }, populate: ['file', 'organization'] })
    return { data: toDto(fresh) }
  },

  /**
   * DELETE /design-assets/:id - removes the library entry and its file.
   * Designs that already use the image keep working only until re-render,
   * so the editor asks for confirmation first.
   */
  async remove(ctx) {
    if (!ctx.state.user) return ctx.unauthorized('You must be logged in.')
    const row = await findWritable(ctx)
    if (!row) return
    await strapi.db.query(UID).delete({ where: { id: row.id } })
    if (row.file) await strapi.plugin('upload').service('upload').remove(row.file).catch(() => {})
    return { data: { id: row.id } }
  },
}))

/** Load :id (documentId or numeric id) if the caller may modify it; otherwise respond and return null. */
async function findWritable(ctx: any): Promise<any | null> {
  const caller = await callerContext(ctx.state.user.id)
  const idParam = String(ctx.params.id)
  const where = /^\d+$/.test(idParam) ? { id: Number(idParam) } : { documentId: idParam }
  const row: any = await strapi.db.query(UID).findOne({ where, populate: ['file', 'organization'] })
  if (!row) {
    ctx.notFound('Image not found')
    return null
  }
  const ok = row.organization == null
    ? caller.isPlatformAdmin
    : caller.organizationId != null && String(row.organization.id) === String(caller.organizationId)
  if (!ok) {
    ctx.forbidden('You do not have access to this image.')
    return null
  }
  return row
}
