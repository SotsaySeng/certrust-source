/**
 * Server side of the Design Studio renderer: wires design-core to
 * harfbuzzjs, the bundled fonts (assets/design-fonts), qrcode and sharp.
 *
 * Output formats:
 *   renderDesignSvg - SVG string with every image inlined (data: URIs)
 *   renderDesignPng - PNG at a chosen pixel width
 *   renderDesignPdf - one exact A4/Letter page (or page-sized for others)
 *                     holding a 300-DPI render
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import QRCode from 'qrcode'
import { PDFDocument } from 'pdf-lib'
import type { BrandKit, Design, PlaceholderData, RenderIssue, TextEngine } from './design-core'
import { createTextEngine, PRINT_SIZES_PT, renderSvg } from './design-core'

// harfbuzzjs is ESM-only with top-level await, so it cannot be require()d
// from this CommonJS build, and TypeScript would rewrite a plain import()
// into require(). A Function-constructed import() survives compilation.
// eslint-disable-next-line no-new-func
const nativeImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>

function fontsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'assets/design-fonts'),
    path.resolve(__dirname, '../../assets/design-fonts'),
    path.resolve(__dirname, '../../../assets/design-fonts'),
  ]
  const found = candidates.find(d => fs.existsSync(d))
  if (!found) throw new Error('Design fonts not found (assets/design-fonts) - run scripts/design/fetch-fonts.mjs')
  return found
}

let enginePromise: Promise<TextEngine> | null = null

export function getTextEngine(): Promise<TextEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const hb = await nativeImport('harfbuzzjs')
      const dir = fontsDir()
      return createTextEngine(hb, async (file) => {
        // file comes from the fonts manifest, never from user input, but
        // keep it inside the fonts directory regardless.
        const p = path.join(dir, path.basename(file))
        return new Uint8Array(await fs.promises.readFile(p))
      })
    })()
    enginePromise.catch(() => { enginePromise = null })
  }
  return enginePromise
}

export function qrMatrix(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const { size, data } = qr.modules
  return { size, isDark: (r: number, c: number) => !!data[r * size + c] }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = /^image\/(png|jpeg|svg\+xml|webp|gif)$/

function uploadsRoot(): string {
  return path.join(process.cwd(), 'public', 'uploads')
}

/** Origins the server may fetch design images from: its own and the upload CDN. */
function allowedImageOrigins(): Set<string> {
  const origins = new Set<string>()
  for (const u of [strapi.config.get('server.url'), process.env.S3_PUBLIC_URL, process.env.PUBLIC_URL]) {
    if (!u) continue
    try {
      origins.add(new URL(String(u)).origin)
    } catch { /* ignore malformed config */ }
  }
  return origins
}

/**
 * SSRF-safe image resolver: data: images pass through; /uploads/... is read
 * from local disk (no HTTP round trip); https URLs are fetched only from the
 * server's own origin or the configured upload CDN. Anything else is dropped.
 */
export async function resolveDesignImage(src: string): Promise<string | null> {
  if (!src) return null
  if (src.startsWith('data:image/')) return src.length <= MAX_IMAGE_BYTES * 1.4 ? src : null
  try {
    if (src.startsWith('/uploads/')) {
      const root = uploadsRoot()
      const file = path.resolve(root, decodeURIComponent(src.slice('/uploads/'.length).split('?')[0]))
      if (!file.startsWith(root + path.sep)) return null
      if (fs.existsSync(file)) {
        const body = await fs.promises.readFile(file)
        if (body.length > MAX_IMAGE_BYTES) return null
        return `data:${mimeFor(file)};base64,${body.toString('base64')}`
      }
      // Not on local disk (e.g. S3 provider): fall through to our own origin.
      src = `${strapi.config.get('server.url', 'http://localhost:1337')}${src}`
    }
    const url = new URL(src)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (!allowedImageOrigins().has(url.origin)) return null
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' })
    const type = (res.headers.get('content-type') || '').split(';')[0].trim()
    if (!res.ok || !IMAGE_TYPES.test(type)) return null
    const body = Buffer.from(await res.arrayBuffer())
    if (body.length > MAX_IMAGE_BYTES) return null
    return `data:${type};base64,${body.toString('base64')}`
  } catch {
    return null
  }
}

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase()
  return ext === '.svg' ? 'image/svg+xml' : ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
}

export interface ServerRenderOptions {
  data?: PlaceholderData
  brand?: BrandKit | null
}

export async function renderDesignSvg(design: Design, opts: ServerRenderOptions = {}): Promise<{ svg: string, issues: RenderIssue[] }> {
  const engine = await getTextEngine()
  const cache = new Map<string, Promise<string | null>>()
  const { svg, issues } = await renderSvg(design, {
    engine,
    data: opts.data,
    brand: opts.brand,
    qr: qrMatrix,
    resolveImage: (src) => {
      let p = cache.get(src)
      if (!p) {
        p = resolveDesignImage(src)
        cache.set(src, p)
      }
      return p
    },
  })
  return { svg, issues }
}

/** PNG of the whole page, `width` px wide (height follows the page ratio). */
export async function renderDesignPng(design: Design, opts: ServerRenderOptions & { width?: number, transparent?: boolean } = {}): Promise<Buffer> {
  const { svg } = await renderDesignSvg(design, opts)
  const width = Math.round(opts.width ?? design.page.width * 2)
  // density scales the SVG's own px size: 72 DPI = 1 SVG px per output px.
  const density = Math.max(1, Math.min(2400, (72 * width) / design.page.width))
  const img = sharp(Buffer.from(svg), { density, limitInputPixels: false }).resize({ width, withoutEnlargement: false })
  // Badges keep their transparent corners; certificates are flat pages.
  return (opts.transparent ? img : img.flatten({ background: '#ffffff' })).png({ compressionLevel: 8 }).toBuffer()
}

/**
 * Print PDF: an exact A4/Letter page (badges and custom sizes get a page of
 * their own size) with a 300-DPI render placed edge to edge. The render is
 * raster on purpose - it is pixel-identical to the PNG and the editor, with
 * Lao shaping and every font exactly as designed.
 */
export async function renderDesignPdf(design: Design, opts: ServerRenderOptions = {}): Promise<Buffer> {
  const { preset, orientation, width, height } = design.page
  let pageW: number
  let pageH: number
  if (preset === 'A4' || preset === 'Letter') {
    const s = PRINT_SIZES_PT[preset]
    ;[pageW, pageH] = orientation === 'landscape' ? [s.height, s.width] : [s.width, s.height]
  }
  else {
    pageW = (width * 72) / 96
    pageH = (height * 72) / 96
  }
  const pxWidth = Math.round((pageW / 72) * 300)
  const { svg } = await renderDesignSvg(design, opts)
  const density = Math.max(1, Math.min(2400, (72 * pxWidth) / width))
  const jpeg = await sharp(Buffer.from(svg), { density, limitInputPixels: false })
    .resize({ width: pxWidth, height: Math.round((pageH / 72) * 300), fit: 'fill' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer()
  const pdf = await PDFDocument.create()
  pdf.setProducer('Certrust')
  pdf.setCreator('Certrust Design Studio')
  const page = pdf.addPage([pageW, pageH])
  const img = await pdf.embedJpg(jpeg)
  page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH })
  return Buffer.from(await pdf.save())
}
