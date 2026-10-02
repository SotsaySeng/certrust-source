/**
 * Browser side of the Design Studio renderer: the same design-core code the
 * API uses, fed with the same font files (public/design-fonts) and HarfBuzz
 * build, so what the editor draws is what gets issued.
 */
import type { BrandKit, Design, PlaceholderData, RenderResult, TextEngine } from '~/lib/design-core'
import QRCode from 'qrcode'
import { createTextEngine, renderSvg, resolveFont } from '~/lib/design-core'
import { designAssetUrl } from './designAssetUrl'

let enginePromise: Promise<TextEngine> | null = null

export function getDesignTextEngine(): Promise<TextEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const hb = await import('harfbuzzjs')
      return createTextEngine(hb as any, async (file) => {
        const res = await fetch(`/design-fonts/${encodeURIComponent(file)}`)
        if (!res.ok) {
          throw new Error(`Font ${file} failed to load (${res.status})`)
        }
        return new Uint8Array(await res.arrayBuffer())
      })
    })()
    enginePromise.catch(() => {
      enginePromise = null
    })
  }
  return enginePromise
}

const qrCache = new Map<string, { size: number, isDark: (r: number, c: number) => boolean }>()
export function designQrMatrix(text: string) {
  let m = qrCache.get(text)
  if (!m) {
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
    const { size, data } = qr.modules
    m = { size, isDark: (r: number, c: number) => !!data[r * size + c] }
    qrCache.set(text, m)
  }
  return m
}

/**
 * Register a design font with the page (FontFace API) so HTML controls -
 * the in-place text editor, font picker previews - use the real face.
 */
const cssFonts = new Map<string, Promise<void>>()
export function ensureCssFont(family: string, weight = 400, italic = false): Promise<void> {
  if (!import.meta.client || typeof FontFace === 'undefined') {
    return Promise.resolve()
  }
  const r = resolveFont(family, weight, italic)
  let p = cssFonts.get(r.key)
  if (!p) {
    const face = new FontFace(r.family, `url(/design-fonts/${encodeURIComponent(r.file)})`, {
      weight: String(Number.parseInt(r.variant)),
      style: r.variant.endsWith('i') ? 'italic' : 'normal',
    })
    p = face.load().then((f) => {
      document.fonts.add(f)
    }).catch(() => {})
    cssFonts.set(r.key, p)
  }
  return p
}

export interface EditorRenderOptions {
  data?: PlaceholderData
  brand?: BrandKit | null
  idPrefix?: string
  skipIds?: Set<string>
  annotate?: boolean
  showMissing?: boolean
  width?: number
  height?: number
}

export async function renderDesignInBrowser(design: Design, opts: EditorRenderOptions = {}): Promise<RenderResult> {
  const engine = await getDesignTextEngine()
  return renderSvg(design, {
    engine,
    qr: designQrMatrix,
    resolveImage: async src => designAssetUrl(src) || null,
    ...opts,
  })
}
