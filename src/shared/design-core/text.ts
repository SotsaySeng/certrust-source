/**
 * Text shaping and layout with HarfBuzz (harfbuzzjs, WASM).
 *
 * Text is drawn as glyph outlines (<path>), never as SVG <text>. That is
 * what makes a design render identically in the editor (browser), on a
 * developer's Mac and in the Linux API container: no system fonts, no
 * fontconfig, no Pango backend differences - the same font file, the same
 * shaper, the same outlines. HarfBuzz also shapes Lao (stacked vowel and
 * tone marks) correctly, which SVG-text-through-librsvg could not guarantee.
 *
 * The harfbuzzjs module and font bytes are injected (see createTextEngine),
 * so this file has no platform imports and runs in both Nuxt and Strapi.
 */
import { fallbackChain, resolveFont } from './fonts'

/** The subset of harfbuzzjs used here (v1 API). */
export interface HarfBuzzModule {
  Blob: new (data: ArrayBuffer | Uint8Array) => any
  Face: new (blob: any, index?: number) => any
  Font: new (face: any) => any
  Buffer: new () => any
  shape: (font: any, buffer: any, features?: any) => void
}

export type FontBytesLoader = (file: string) => Promise<ArrayBuffer | Uint8Array>

export interface LoadedFont {
  key: string
  family: string
  /** Stable small index, used for glyph <path> ids. */
  index: number
  upem: number
  ascender: number
  descender: number
  hbFont: any
  has: (cp: number) => boolean
}

export interface PlacedGlyph {
  gid: number
  /** Pen x in px from the line start, glyph offset included. */
  x: number
  /** Offset in px, y-down. */
  y: number
  /** Advance in px (0 for marks). */
  advance: number
}

export interface GlyphRun {
  font: LoadedFont
  glyphs: PlacedGlyph[]
}

export interface LaidOutLine {
  runs: GlyphRun[]
  width: number
}

export interface TextLayout {
  lines: LaidOutLine[]
  fontSize: number
  lineHeightPx: number
  ascent: number
  descent: number
  /** Total block height (lines x line height). */
  height: number
  /** A single word was wider than the box and had to be broken mid-word. */
  brokeWord: boolean
  /** The block (after any auto-fit) still does not fit the box. */
  overflows: boolean
}

export interface TextStyle {
  fontFamily: string
  fontWeight: number
  italic?: boolean
  fontSize: number
  lineHeight?: number
  letterSpacing?: number
}

const MARK_RE = /[\p{M}\u200C\u200D]/u

interface Segmenter { segment: (s: string) => Iterable<{ segment: string }> }
/** Intl.Segmenter (ES2022; the backend compiles against ES2020 lib types). */
function segmenter(granularity: 'word' | 'grapheme'): Segmenter {
  const Ctor = (Intl as any).Segmenter as new (locale: string | undefined, opts: { granularity: string }) => Segmenter
  return new Ctor(undefined, { granularity })
}

export class TextEngine {
  private fonts = new Map<string, LoadedFont>()
  private loading = new Map<string, Promise<LoadedFont>>()
  private pathCache = new Map<string, string>()
  private measureCache = new Map<string, number>()
  private nextIndex = 0

  constructor(private hb: HarfBuzzModule, private loadBytes: FontBytesLoader) {}

  /** Load (once) the font file serving family/weight/italic. */
  async font(family: string, weight = 400, italic = false): Promise<LoadedFont> {
    const r = resolveFont(family, weight, italic)
    const existing = this.fonts.get(r.key)
    if (existing) {
      return existing
    }
    let p = this.loading.get(r.key)
    if (!p) {
      p = (async () => {
        const bytes = await this.loadBytes(r.file)
        const hb = this.hb
        const face = new hb.Face(new hb.Blob(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)))
        const hbFont = new hb.Font(face)
        const upem = face.upem as number
        hbFont.setScale(upem, upem)
        const ext = hbFont.hExtents()
        const coverage = new Map<number, boolean>()
        const loaded: LoadedFont = {
          key: r.key,
          family: r.family,
          index: this.nextIndex++,
          upem,
          ascender: ext.ascender,
          descender: Math.abs(ext.descender),
          hbFont,
          has: (cp: number) => {
            let v = coverage.get(cp)
            if (v === undefined) {
              const g = hbFont.nominalGlyph(cp)
              v = g !== undefined && g !== 0
              coverage.set(cp, v)
            }
            return v
          },
        }
        this.fonts.set(r.key, loaded)
        return loaded
      })()
      this.loading.set(r.key, p)
      p.catch(() => this.loading.delete(r.key))
    }
    return p
  }

  /** SVG path data for a glyph, in font units (y up). Cached. */
  glyphPath(font: LoadedFont, gid: number): string {
    const k = `${font.index}:${gid}`
    let d = this.pathCache.get(k)
    if (d === undefined) {
      d = font.hbFont.glyphToPath(gid) as string
      this.pathCache.set(k, d)
    }
    return d
  }

  /**
   * Split text into runs by the font that can draw each character: the
   * primary font where it covers the character, otherwise the first font in
   * the fallback chain that does. Combining marks stay with their base.
   */
  async itemize(text: string, style: TextStyle): Promise<Array<{ font: LoadedFont, text: string }>> {
    const primary = await this.font(style.fontFamily, style.fontWeight, style.italic)
    const runs: Array<{ font: LoadedFont, text: string }> = []
    let current: { font: LoadedFont, text: string } | null = null
    for (const ch of text) {
      const cp = ch.codePointAt(0)!
      let f: LoadedFont = primary
      if (current && (MARK_RE.test(ch) || ch === ' ')) {
        f = current.font.has(cp) || ch === ' ' ? current.font : primary
      }
      else if (!primary.has(cp) && cp > 0x20) {
        for (const fam of fallbackChain(style.fontFamily, cp)) {
          const cand = await this.font(fam, style.fontWeight, style.italic)
          if (cand.has(cp)) {
            f = cand
            break
          }
        }
      }
      if (current && current.font === f) {
        current.text += ch
      }
      else {
        current = { font: f, text: ch }
        runs.push(current)
      }
    }
    return runs
  }

  /** Shape one run. Positions in px, relative to the run start. */
  shapeRun(font: LoadedFont, text: string, fontSize: number, letterSpacing = 0): { glyphs: PlacedGlyph[], width: number } {
    const hb = this.hb
    const buf = new hb.Buffer()
    buf.addText(text)
    buf.guessSegmentProperties()
    hb.shape(font.hbFont, buf)
    const infos = buf.getGlyphInfos()
    const positions = buf.getGlyphPositions()
    buf.destroy?.()
    const s = fontSize / font.upem
    const glyphs: PlacedGlyph[] = []
    let pen = 0
    for (let i = 0; i < infos.length; i++) {
      const p = positions[i]
      const adv = p.xAdvance * s
      glyphs.push({ gid: infos[i].codepoint, x: pen + p.xOffset * s, y: -p.yOffset * s, advance: adv })
      pen += adv
      // Letter spacing between clusters, not after marks (zero advance).
      if (letterSpacing && adv > 0) {
        pen += letterSpacing
      }
    }
    if (letterSpacing && glyphs.length) {
      pen -= letterSpacing
    }
    return { glyphs, width: pen }
  }

  async shapeLine(text: string, style: TextStyle): Promise<LaidOutLine> {
    const runs = await this.itemize(text, style)
    const out: GlyphRun[] = []
    let x = 0
    for (const r of runs) {
      const { glyphs, width } = this.shapeRun(r.font, r.text, style.fontSize, style.letterSpacing)
      for (const g of glyphs) {
        g.x += x
      }
      x += width + (style.letterSpacing && width ? style.letterSpacing : 0)
      out.push({ font: r.font, glyphs })
    }
    if (style.letterSpacing && runs.length) {
      x -= style.letterSpacing
    }
    return { runs: out, width: Math.max(0, x) }
  }

  async measure(text: string, style: TextStyle): Promise<number> {
    const k = `${style.fontFamily}|${style.fontWeight}|${style.italic ? 1 : 0}|${style.fontSize}|${style.letterSpacing ?? 0}|${text}`
    let w = this.measureCache.get(k)
    if (w === undefined) {
      w = (await this.shapeLine(text, style)).width
      if (this.measureCache.size > 20000) {
        this.measureCache.clear()
      }
      this.measureCache.set(k, w)
    }
    return w
  }

  /** Ascent/descent (px) of the primary font at the given size. */
  async metrics(style: TextStyle): Promise<{ ascent: number, descent: number }> {
    const f = await this.font(style.fontFamily, style.fontWeight, style.italic)
    const s = style.fontSize / f.upem
    return { ascent: f.ascender * s, descent: f.descender * s }
  }

  /**
   * Greedy line wrapping at word boundaries (Intl.Segmenter, which knows
   * Lao and Thai have no spaces between words), with explicit newlines kept.
   * A word wider than the box is broken between graphemes.
   */
  async wrap(text: string, style: TextStyle, maxWidth: number): Promise<{ lines: string[], brokeWord: boolean }> {
    const lines: string[] = []
    let brokeWord = false
    const wordSeg = segmenter('word')
    const graphemeSeg = segmenter('grapheme')
    for (const para of text.split('\n')) {
      if (!para) {
        lines.push('')
        continue
      }
      const fits = async (s: string) => await this.measure(s.trimEnd(), style) <= maxWidth + 0.01
      let line = ''
      for (const { segment } of wordSeg.segment(para)) {
        const candidate = line + segment
        if (!line.trim() || await fits(candidate)) {
          line = candidate
        }
        else {
          lines.push(line.trimEnd())
          line = segment.trimStart()
        }
        // `line` is now a single segment wider than the box: break it by grapheme.
        if (line.trim() && !(await fits(line))) {
          brokeWord = true
          let part = ''
          for (const { segment: g } of graphemeSeg.segment(line)) {
            if (part && await this.measure(part + g, style) > maxWidth + 0.01) {
              lines.push(part)
              part = g
            }
            else {
              part += g
            }
          }
          line = part
        }
      }
      lines.push(line.trimEnd())
    }
    return { lines, brokeWord }
  }

  /** Lay out a block at a fixed font size. */
  async layoutAt(text: string, style: TextStyle, box: { w: number, h: number }, wrap = true): Promise<TextLayout> {
    const { ascent, descent } = await this.metrics(style)
    const lineHeightPx = style.fontSize * (style.lineHeight ?? 1.2)
    const { lines, brokeWord } = wrap
      ? await this.wrap(text, style, box.w)
      : { lines: text.split('\n'), brokeWord: false }
    const laid: LaidOutLine[] = []
    for (const l of lines) {
      laid.push(await this.shapeLine(l, style))
    }
    const height = laid.length * lineHeightPx
    const widest = laid.reduce((m, l) => Math.max(m, l.width), 0)
    return {
      lines: laid,
      fontSize: style.fontSize,
      lineHeightPx,
      ascent,
      descent,
      height,
      brokeWord,
      overflows: brokeWord || height > box.h + 0.5 || widest > box.w + 0.5,
    }
  }

  /**
   * Lay out a text box. With autoFit, the font shrinks (binary search, down
   * to minFontSize) until no word has to be broken and the block fits the
   * box height - so "Maximilian Alexander Featherstonehaugh-Worthington"
   * lands on the certificate at a smaller size instead of spilling out.
   */
  async layout(text: string, style: TextStyle, box: { w: number, h: number }, opts: { autoFit?: boolean, minFontSize?: number, wrap?: boolean } = {}): Promise<TextLayout> {
    const wrap = opts.wrap !== false
    const full = await this.layoutAt(text, style, box, wrap)
    if (!opts.autoFit || !full.overflows) {
      return full
    }
    const min = Math.max(4, Math.min(style.fontSize, opts.minFontSize ?? style.fontSize * 0.4))
    let lo = min
    let hi = style.fontSize
    let best = await this.layoutAt(text, { ...style, fontSize: lo }, box, wrap)
    if (best.overflows) {
      return best
    }
    for (let i = 0; i < 8 && hi - lo > 0.25; i++) {
      const mid = (lo + hi) / 2
      const l = await this.layoutAt(text, { ...style, fontSize: mid }, box, wrap)
      if (l.overflows) {
        hi = mid
      }
      else {
        lo = mid
        best = l
      }
    }
    return best
  }
}

export function createTextEngine(hb: HarfBuzzModule, loadBytes: FontBytesLoader): TextEngine {
  return new TextEngine(hb, loadBytes)
}
