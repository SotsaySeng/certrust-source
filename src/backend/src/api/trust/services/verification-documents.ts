/**
 * Evidence for issuer verification: business registration, accreditation,
 * a letter on letterhead, and so on.
 *
 * These files are private, so they do NOT go through the upload plugin -
 * in production that writes to the public R2 bucket (S3_PUBLIC_URL), where
 * anyone with the link can read an object. They are stored base64 in the
 * database instead (small, rare, and covered by the encrypted database
 * backups), and only platform admins can read them back.
 *
 * Retention (Privacy Policy s.9): kept while the request is open, then
 * deleted 90 days after a platform admin decides it, and straight away
 * when the organisation closes.
 */
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

const UID = 'api::trust.verification-document'

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_FILES_PER_ORG = 10
export const RETENTION_DAYS_AFTER_DECISION = 90

// Metadata only - never select `data` into a list.
const META = ['id', 'fileName', 'mimeType', 'size', 'uploadedByEmail', 'createdAt', 'purgeAfter']

/** The real type, from the file's first bytes - never the browser's claim. */
export function sniffMimeType(buf: Buffer): string | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png'
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

/** A display name that is safe in a Content-Disposition header, with the extension matching the real type. */
export function safeFileName(original: unknown, mimeType: string): string {
  const base = (typeof original === 'string' ? original : '')
    .replace(/\.[^.]*$/, '')
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .trim()
    .slice(0, 120) || 'document'
  return `${base}.${EXTENSIONS[mimeType]}`
}

export class DocumentError extends Error {}

export default ({ strapi }: { strapi: any }) => ({
  async list(organizationDocumentId: string) {
    return strapi.db.query(UID).findMany({
      where: { organizationDocumentId },
      select: META,
      orderBy: { createdAt: 'asc' },
    })
  },

  async count(organizationDocumentId: string): Promise<number> {
    return strapi.db.query(UID).count({ where: { organizationDocumentId } })
  },

  /** Stores formidable/koa-body files after checking size and real type. */
  async store(organizationDocumentId: string, files: any[], user: { id: number, email?: string }) {
    const existing = await this.count(organizationDocumentId)
    if (existing + files.length > MAX_FILES_PER_ORG) {
      throw new DocumentError(`You can upload up to ${MAX_FILES_PER_ORG} documents. Remove one first.`)
    }

    // Check every file before storing any, so a bad one doesn't leave half an upload behind.
    const checked = []
    for (const file of files) {
      const name = file.originalFilename || file.name
      if (!file.size || file.size > MAX_FILE_BYTES) {
        throw new DocumentError(`${name || 'A file'} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`)
      }
      const buf = await readFile(file.filepath || file.path)
      if (buf.length > MAX_FILE_BYTES) throw new DocumentError(`${name || 'A file'} is too large.`)
      const mimeType = sniffMimeType(buf)
      if (!mimeType) throw new DocumentError(`${name || 'A file'} is not a PDF, PNG, JPEG or WebP file.`)
      checked.push({ buf, mimeType, fileName: safeFileName(name, mimeType) })
    }

    const stored = []
    for (const { buf, mimeType, fileName } of checked) {
      const row = await strapi.db.query(UID).create({
        data: {
          organizationDocumentId,
          fileName,
          mimeType,
          size: buf.length,
          sha256: createHash('sha256').update(buf).digest('hex'),
          data: buf.toString('base64'),
          uploadedById: user.id,
          uploadedByEmail: user.email || null,
        },
        select: META,
      })
      stored.push(row)
    }
    return stored
  },

  /** A document of this organisation, metadata only; null if it is someone else's. */
  async findOwn(organizationDocumentId: string, id: number) {
    return strapi.db.query(UID).findOne({ where: { id, organizationDocumentId }, select: META })
  },

  /** For platform admins: the file itself. */
  async read(id: number) {
    const row = await strapi.db.query(UID).findOne({ where: { id } })
    if (!row) return null
    return { ...row, buffer: Buffer.from(row.data || '', 'base64'), data: undefined }
  },

  async remove(id: number) {
    await strapi.db.query(UID).delete({ where: { id } })
  },

  /** A new request covers every document on file again, so none of them expire mid-review. */
  async keep(organizationDocumentId: string) {
    await strapi.db.query(UID).updateMany({ where: { organizationDocumentId }, data: { purgeAfter: null } })
  },

  /** After a decision, start the retention clock. */
  async scheduleDeletion(organizationDocumentId: string, from = new Date()) {
    const purgeAfter = new Date(from.getTime() + RETENTION_DAYS_AFTER_DECISION * 24 * 60 * 60 * 1000)
    await strapi.db.query(UID).updateMany({ where: { organizationDocumentId }, data: { purgeAfter } })
  },

  async removeAllFor(organizationDocumentId: string) {
    await strapi.db.query(UID).deleteMany({ where: { organizationDocumentId } })
  },

  /** Daily: delete documents whose retention period has run out. */
  async purgeExpired(now = new Date()): Promise<number> {
    const { count } = await strapi.db.query(UID).deleteMany({ where: { purgeAfter: { $lt: now } } })
    if (count) strapi.log.info(`[trust] Deleted ${count} expired verification document(s).`)
    return count
  },
})
