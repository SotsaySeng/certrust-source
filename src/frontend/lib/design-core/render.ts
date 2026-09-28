// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
/**
 * Design -> SVG. The single renderer behind the editor canvas, gallery
 * thumbnails, issued certificate PNG/PDF, badge images and share images.
 */
import type { LaidOutLine, TextEngine, TextLayout } from './text'
import type { BrandKit, Design, DesignElement, FrameElement, ImageElement, LineElement, PlaceholderData, QrElement, ShapeElement, TextElement } from './types'
import { resolveColor, resolveFontFamily } from './brand'
import { framePaths, shapePath } from './geometry'
import { fillPlaceholders, showPlaceholderTokens } from './placeholders'

export interface QrMatrix {
  size: number
  isDark: (row: number, col: number) => boolean
}

export interface RenderContext {
  engine: TextEngine
  /** Placeholder values. Omitted: placeholders render as `[recipient.name]`. */
  data?: PlaceholderData
  brand?: BrandKit | null
  /**
   * Map an image src to what the SVG should reference. The server inlines
   * every image as a data: URI (librsvg never fetches remote hrefs); the
   * editor can pass URLs straight through. Return null to skip the image.
   */
  resolveImage?: (src: string) => Promise<string | null>
  qr?: (text: string) => QrMatrix
  /** Prefix for ids (glyph defs, clip paths) when several SVGs share a page. */
  idPrefix?: string
  /** Elements not to draw (the one being edited in place in the editor). */
  skipIds?: Set<string>
  /** Tag each element group with data-el-id (editor hit testing). */
  annotate?: boolean
  /** Draw a dashed placeholder where an image is missing (editor only). */
  showMissing?: boolean
  /** Output size in px (defaults to the page size; viewBox always = page). */
  width?: number
  height?: number
}

export interface RenderIssue {
  elementId: string
  kind: 'text-overflow' | 'image-missing' | 'off-page'
}

export interface RenderResult {
  svg: string
  issues: RenderIssue[]
  /** Final laid-out font size per text element (after auto-fit). */
  fontSizes: Record<string, number>
  /** Laid-out block height per text element (editor: grow boxes to fit). */
  textHeights: Record<string, number>
}

const n = (v: number) => (Math.round(v * 100) / 100).toString()

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', '\'': '&apos;' }[c]!))
}

const SAMPLE_VERIFY_URL = 'https://certrust.app/verify'

class SvgBuilder {
  defs: string[] = []
  glyphIds = new Map<string, string>()
  clipCount = 0
  constructor(public prefix: string) {}
  glyph(engine: TextEngine, font: LaidOutLine['runs'][number]['font'], gid: number): string {
    const k = `${font.index}_${gid}`
    let id = this.glyphIds.get(k)
    if (!id) {
      id = `${this.prefix}g${k}`
      this.glyphIds.set(k, id)
      const d = engine.glyphPath(font, gid)
      this.defs.push(`<path id="${id}" d="${d}"/>`)
    }
    return id
  }

  clip(shape: string): string {
    const id = `${this.prefix}c${this.clipCount++}`
    this.defs.push(`<clipPath id="${id}">${shape}</clipPath>`)
    return id
  }
}

function textStyle(el: TextElement, brand?: BrandKit | null) {
  return {
    fontFamily: resolveFontFamily(el.fontFamily, brand),
    fontWeight: el.fontWeight || 400,
    italic: !!el.italic,
    fontSize: el.fontSize,
    lineHeight: el.lineHeight ?? 1.2,
    letterSpacing: el.letterSpacing ?? 0,
  }
}

export function textFor(el: TextElement, data?: PlaceholderData): string {
  const raw = data ? fillPlaceholders(el.content, data) : showPlaceholderTokens(el.content)
  return el.uppercase ? raw.toLocaleUpperCase() : raw
}

/** Lay out a text element exactly as the renderer will (used by the editor too). */
export async function layoutTextElement(el: TextElement, ctx: Pick<RenderContext, 'engine' | 'data' | 'brand'>): Promise<TextLayout> {
  return ctx.engine.layout(textFor(el, ctx.data), textStyle(el, ctx.brand), { w: el.w, h: el.h }, {
    autoFit: el.autoFit,
    minFontSize: el.minFontSize,
    wrap: !el.curve,
  })
}

function glyphUses(b: SvgBuilder, engine: TextEngine, line: LaidOutLine, x: number, y: number, fontSize: number): string {
  let out = ''
  for (const run of line.runs) {
    const s = fontSize / run.font.upem
    const uses = run.glyphs.map((g) => {
      const id = b.glyph(engine, run.font, g.gid)
      return `<use href="#${id}" x="${n(g.x / s)}" y="${n(-g.y / s)}"/>`
    }).join('')
    out += `<g transform="translate(${n(x)} ${n(y)}) scale(${s.toFixed(6)} ${(-s).toFixed(6)})">${uses}</g>`
  }
  return out
}

async function renderText(b: SvgBuilder, el: TextElement, ctx: RenderContext, issues: RenderIssue[], sizes: Record<string, number>, heights: Record<string, number>): Promise<string> {
  const layout = await layoutTextElement(el, ctx)
  sizes[el.id] = layout.fontSize
  heights[el.id] = layout.height
  if (layout.overflows && textFor(el, ctx.data).trim()) {
    issues.push({ elementId: el.id, kind: 'text-overflow' })
  }
  const fill = resolveColor(el.color, ctx.brand)
  const { ascent, descent, lineHeightPx } = layout
  const halfLeading = (lineHeightPx - (ascent + descent)) / 2

  if (el.curve && layout.lines[0]) {
    return renderCurvedText(b, el, layout, ctx, fill)
  }

  const vAlign = el.vAlign ?? 'top'
  let top = 0
  if (vAlign === 'middle') {
    top = (el.h - layout.height) / 2
  }
  else if (vAlign === 'bottom') {
    top = el.h - layout.height
  }

  let out = ''
  layout.lines.forEach((line, i) => {
    const baseline = top + i * lineHeightPx + halfLeading + ascent
    const x = el.align === 'center' ? (el.w - line.width) / 2 : el.align === 'right' ? el.w - line.width : 0
    out += glyphUses(b, ctx.engine, line, x, baseline, layout.fontSize)
  })
  return `<g fill="${fill}">${out}</g>`
}

/**
 * Text along an arc (badges). The baseline midpoint sits at the box's
 * horizontal centre; positive curve = text over the top of a circle whose
 * centre is below, negative = along the bottom, reading left to right.
 */
function renderCurvedText(b: SvgBuilder, el: TextElement, layout: TextLayout, ctx: RenderContext, fill: string): string {
  const line = layout.lines[0]
  const R = Math.abs(el.curve!)
  const top = el.curve! > 0
  const { ascent, descent } = layout
  // Keep the glyphs inside the box: top arc baseline near the top edge,
  // bottom arc baseline near the bottom edge.
  const by = top ? ascent : el.h - descent
  const cx = el.w / 2
  const cy = top ? by + R : by - R
  let out = ''
  for (const run of line.runs) {
    const s = layout.fontSize / run.font.upem
    for (const g of run.glyphs) {
      const mid = g.x + g.advance / 2 - line.width / 2
      const phi = mid / R
      const px = cx + R * Math.sin(phi)
      const py = top ? cy - R * Math.cos(phi) : cy + R * Math.cos(phi)
      const deg = ((top ? phi : -phi) * 180) / Math.PI
      const id = b.glyph(ctx.engine, run.font, g.gid)
      out += `<use href="#${id}" transform="translate(${n(px)} ${n(py + g.y)}) rotate(${n(deg)}) translate(${n(-g.advance / 2)} 0) scale(${s.toFixed(6)} ${(-s).toFixed(6)})"/>`
    }
  }
  return `<g fill="${fill}">${out}</g>`
}

async function renderImage(b: SvgBuilder, el: ImageElement, ctx: RenderContext, issues: RenderIssue[]): Promise<string> {
  const href = el.src ? (ctx.resolveImage ? await ctx.resolveImage(el.src) : el.src) : null
  if (!href) {
    issues.push({ elementId: el.id, kind: 'image-missing' })
    if (!ctx.showMissing) {
      return ''
    }
    return `<rect width="${n(el.w)}" height="${n(el.h)}" fill="#f1f5f9" stroke="#94a3b8" stroke-dasharray="6 4"/>`
  }
  const par = el.fit === 'cover' ? 'xMidYMid slice' : el.fit === 'fill' ? 'none' : 'xMidYMid meet'
  let clip = ''
  if (el.clip === 'circle') {
    clip = b.clip(`<ellipse cx="${n(el.w / 2)}" cy="${n(el.h / 2)}" rx="${n(el.w / 2)}" ry="${n(el.h / 2)}"/>`)
  }
  else if (el.clip === 'rounded') {
    clip = b.clip(`<rect width="${n(el.w)}" height="${n(el.h)}" rx="${n(Math.min(el.w, el.h) * 0.12)}"/>`)
  }
  else if (el.fit === 'cover') {
    clip = b.clip(`<rect width="${n(el.w)}" height="${n(el.h)}"/>`)
  }
  const img = `<image href="${escapeXml(href)}" width="${n(el.w)}" height="${n(el.h)}" preserveAspectRatio="${par}"/>`
  return clip ? `<g clip-path="url(#${clip})">${img}</g>` : img
}

function renderShape(el: ShapeElement, ctx: RenderContext): string {
  const parts = shapePath(el.shape, el.w, el.h, { radius: el.radius, points: el.points })
  const fill = resolveColor(el.fill, ctx.brand, 'none')
  const stroke = el.stroke ? resolveColor(el.stroke, ctx.brand, 'none') : 'none'
  const sw = el.strokeWidth ?? 0
  const strokeAttrs = stroke !== 'none' && sw > 0 ? ` stroke="${stroke}" stroke-width="${n(sw)}" stroke-linejoin="round"` : ''
  let out = ''
  if (parts.back) {
    const fill2 = el.fill2 ? resolveColor(el.fill2, ctx.brand, fill) : fill
    out += `<path d="${parts.back}" fill="${fill2}"${strokeAttrs}/>`
    if (!el.fill2 && fill !== 'none') {
      out += `<path d="${parts.back}" fill="#000" fill-opacity="0.25"/>`
    }
  }
  out += `<path d="${parts.main}" fill="${fill}"${strokeAttrs}/>`
  return out
}

function renderLine(el: LineElement, ctx: RenderContext): string {
  const stroke = resolveColor(el.stroke, ctx.brand)
  const sw = el.strokeWidth || 1
  const dash = el.dash === 'dashed' ? ` stroke-dasharray="${n(sw * 4)} ${n(sw * 3)}"` : el.dash === 'dotted' ? ` stroke-dasharray="0 ${n(sw * 2)}" stroke-linecap="round"` : ''
  return `<line x1="0" y1="${n(el.h / 2)}" x2="${n(el.w)}" y2="${n(el.h / 2)}" stroke="${stroke}" stroke-width="${n(sw)}"${dash}/>`
}

function renderQr(el: QrElement, ctx: RenderContext): string {
  const size = Math.min(el.w, el.h)
  const ox = (el.w - size) / 2
  const oy = (el.h - size) / 2
  const fg = resolveColor(el.fg, ctx.brand, '#000000')
  const bg = resolveColor(el.bg, ctx.brand, '#ffffff')
  const url = ctx.data?.['credential.verify_url'] || SAMPLE_VERIFY_URL
  const bgRect = bg !== 'none' ? `<rect x="${n(ox)}" y="${n(oy)}" width="${n(size)}" height="${n(size)}" fill="${bg}"/>` : ''
  if (!ctx.qr) {
    return `${bgRect}<rect x="${n(ox)}" y="${n(oy)}" width="${n(size)}" height="${n(size)}" fill="none" stroke="${fg}"/>`
  }
  const m = ctx.qr(url)
  const cell = size / m.size
  let d = ''
  for (let r = 0; r < m.size; r++) {
    let c = 0
    while (c < m.size) {
      if (!m.isDark(r, c)) {
        c++
        continue
      }
      const start = c
      while (c < m.size && m.isDark(r, c)) {
        c++
      }
      d += `M${n(ox + start * cell)} ${n(oy + r * cell)}h${n((c - start) * cell)}v${n(cell)}h${n(-(c - start) * cell)}z`
    }
  }
  return `${bgRect}<path d="${d}" fill="${fg}" shape-rendering="crispEdges"/>`
}

function renderFrame(el: FrameElement, ctx: RenderContext): string {
  const c1 = resolveColor(el.color, ctx.brand)
  const c2 = el.color2 ? resolveColor(el.color2, ctx.brand) : c1
  return framePaths(el.style, el.w, el.h, el.thickness).map((p) => {
    const color = p.color === 2 ? c2 : c1
    return p.mode === 'fill'
      ? `<path d="${p.d}" fill="${color}"/>`
      : `<path d="${p.d}" fill="none" stroke="${color}" stroke-width="${n(p.sw ?? 1)}" stroke-linejoin="round" stroke-linecap="round"/>`
  }).join('')
}

async function renderElement(b: SvgBuilder, el: DesignElement, ctx: RenderContext, issues: RenderIssue[], sizes: Record<string, number>, heights: Record<string, number>): Promise<string> {
  switch (el.type) {
    case 'text': return renderText(b, el, ctx, issues, sizes, heights)
    case 'image': return renderImage(b, el, ctx, issues)
    case 'shape': return renderShape(el, ctx)
    case 'line': return renderLine(el, ctx)
    case 'qr': return renderQr(el, ctx)
    case 'frame': return renderFrame(el, ctx)
    default: return ''
  }
}

export async function renderSvg(design: Design, ctx: RenderContext): Promise<RenderResult> {
  const { width: W, height: H } = design.page
  const b = new SvgBuilder(ctx.idPrefix ?? '')
  const issues: RenderIssue[] = []
  const sizes: Record<string, number> = {}
  const heights: Record<string, number> = {}
  let body = ''

  const bg = resolveColor(design.background?.color, ctx.brand, '#ffffff')
  if (bg !== 'none') {
    body += `<rect width="${W}" height="${H}" fill="${bg}"/>`
  }
  const bgImage = design.background?.image
  if (bgImage?.src) {
    const href = ctx.resolveImage ? await ctx.resolveImage(bgImage.src) : bgImage.src
    if (href) {
      const par = bgImage.fit === 'cover' ? 'xMidYMid slice' : bgImage.fit === 'fill' ? 'none' : 'xMidYMid meet'
      const op = bgImage.opacity != null && bgImage.opacity < 1 ? ` opacity="${bgImage.opacity}"` : ''
      body += `<image href="${escapeXml(href)}" width="${W}" height="${H}" preserveAspectRatio="${par}"${op}/>`
    }
  }

  for (const el of design.elements) {
    if (el.hidden || ctx.skipIds?.has(el.id)) {
      continue
    }
    if (el.x > W || el.y > H || el.x + el.w < 0 || el.y + el.h < 0) {
      issues.push({ elementId: el.id, kind: 'off-page' })
    }
    const inner = await renderElement(b, el, ctx, issues, sizes, heights)
    const rot = el.rotation ? ` rotate(${n(el.rotation)} ${n(el.w / 2)} ${n(el.h / 2)})` : ''
    const op = el.opacity != null && el.opacity < 1 ? ` opacity="${n(el.opacity)}"` : ''
    const tag = ctx.annotate ? ` data-el-id="${escapeXml(el.id)}"` : ''
    // Editor hit area: the whole box (clicks between glyphs, on thin lines).
    const hw = Math.max(el.w, 10)
    const hh = Math.max(el.h, 10)
    const hit = ctx.annotate ? `<rect x="${n((el.w - hw) / 2)}" y="${n((el.h - hh) / 2)}" width="${n(hw)}" height="${n(hh)}" fill="transparent"/>` : ''
    body += `<g${tag} transform="translate(${n(el.x)} ${n(el.y)})${rot}"${op}>${hit}${inner}</g>`
  }

  const w = ctx.width ?? W
  const h = ctx.height ?? H
  const defs = b.defs.length ? `<defs>${b.defs.join('')}</defs>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(w)}" height="${n(h)}" viewBox="0 0 ${W} ${H}">${defs}${body}</svg>`
  return { svg, issues, fontSizes: sizes, textHeights: heights }
}
