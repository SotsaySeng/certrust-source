import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import documentsService, { sniffMimeType, safeFileName, MAX_FILE_BYTES, MAX_FILES_PER_ORG, DocumentError } from '../verification-documents'

const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n')
const PNG = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0])
const JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0])
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')])

describe('sniffMimeType', () => {
  it.each([
    [PDF, 'application/pdf'],
    [PNG, 'image/png'],
    [JPEG, 'image/jpeg'],
    [WEBP, 'image/webp'],
  ])('recognises %#', (buf, type) => {
    expect(sniffMimeType(buf)).toBe(type)
  })

  it.each([
    Buffer.from('<html><script>alert(1)</script>'),
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    Buffer.from('PK\u0003\u0004'), // zip / docx
    Buffer.alloc(0),
  ])('rejects anything else (%#)', (buf) => {
    expect(sniffMimeType(buf)).toBeNull()
  })
})

describe('safeFileName', () => {
  it('uses the extension of the real type, not the claimed one', () => {
    expect(safeFileName('licence.html', 'application/pdf')).toBe('licence.pdf')
  })

  it('strips characters that could break a Content-Disposition header', () => {
    const name = safeFileName('a"b\r\nSet-Cookie: x;.pdf', 'application/pdf')
    expect(name).not.toMatch(/["\r\n;:]/)
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('falls back to "document"', () => {
    expect(safeFileName(undefined, 'image/png')).toBe('document.png')
    expect(safeFileName('///.png', 'image/png')).toBe('document.png')
  })
})

describe('store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'verif-docs-'))
  const file = (name: string, buf: Buffer) => {
    const filepath = join(dir, name)
    writeFileSync(filepath, buf)
    return { filepath, originalFilename: name, size: buf.length }
  }

  function makeService(existing = 0) {
    const create = jest.fn(async ({ data }) => ({ id: 1, fileName: data.fileName, size: data.size }))
    const strapi: any = { db: { query: () => ({ count: jest.fn(async () => existing), create }) } }
    return { service: documentsService({ strapi }), create }
  }

  it('stores a valid file as base64 with its sniffed type', async () => {
    const { service, create } = makeService()
    await service.store('org-1', [file('reg.pdf', PDF)], { id: 7, email: 'a@b.co' })
    const data = create.mock.calls[0][0].data
    expect(data).toMatchObject({ organizationDocumentId: 'org-1', mimeType: 'application/pdf', fileName: 'reg.pdf', uploadedById: 7 })
    expect(Buffer.from(data.data, 'base64').equals(PDF)).toBe(true)
  })

  it('stores nothing if any file in the batch is not an allowed type', async () => {
    const { service, create } = makeService()
    await expect(service.store('org-1', [file('ok.pdf', PDF), file('evil.pdf', Buffer.from('<html>'))], { id: 7 }))
      .rejects.toBeInstanceOf(DocumentError)
    expect(create).not.toHaveBeenCalled()
  })

  it('rejects files over the size limit', async () => {
    const { service } = makeService()
    await expect(service.store('org-1', [{ ...file('big.pdf', PDF), size: MAX_FILE_BYTES + 1 }], { id: 7 }))
      .rejects.toThrow(/larger than/)
  })

  it('caps the number of documents per organisation', async () => {
    const { service } = makeService(MAX_FILES_PER_ORG)
    await expect(service.store('org-1', [file('one.pdf', PDF)], { id: 7 })).rejects.toThrow(/up to/)
  })
})
