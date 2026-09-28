import type { Design, TextElement, TextEngine } from '../design-core'
// @vitest-environment node
/**
 * design-core: placeholders, brand kit, text layout (HarfBuzz, real fonts),
 * rendering, schema validation and pre-flight. Runs in plain Node so
 * harfbuzzjs loads its WASM from disk.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as hb from 'harfbuzzjs'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyBrandKit,
  blankDesign,
  createTextEngine,
  DEFAULT_BRAND,
  fillPlaceholders,
  layoutTextElement,
  placeholdersInDesign,
  preflight,
  renderSvg,
  resizeDesign,
  resolveFont,
  sampleData,
  showPlaceholderTokens,
  validateDesign,
} from '../design-core'

const fontsDir = path.resolve(__dirname, '../../public/design-fonts')
let engine: TextEngine

beforeAll(() => {
  engine = createTextEngine(hb as any, async file => new Uint8Array(fs.readFileSync(path.join(fontsDir, file))))
})

function text(over: Partial<TextElement> = {}): TextElement {
  return {
    id: 't',
    type: 'text',
    content: 'Hello',
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 20,
    color: '#000000',
    align: 'left',
    x: 0,
    y: 0,
    w: 400,
    h: 100,
    ...over,
  }
}

describe('placeholders', () => {
  it('fills values and blanks unknown keys', () => {
    expect(fillPlaceholders('Hi {{recipient.name}}, {{ custom.location }}!{{nope}}', { 'recipient.name': 'Ana', 'custom.location': 'Vientiane' }))
      .toBe('Hi Ana, Vientiane!')
  })
  it('shows tokens in template view', () => {
    expect(showPlaceholderTokens('{{recipient.name}} - {{credential.issued_on}}')).toBe('[recipient.name] - [credential.issued_on]')
  })
  it('lists placeholders used in a design', () => {
    const d = blankDesign('certificate')
    d.elements.push(text({ content: '{{recipient.name}} {{custom.trainingdate}}' }))
    expect([...placeholdersInDesign(d)]).toEqual(['recipient.name', 'custom.trainingdate'])
  })
})

describe('fonts', () => {
  it('resolves the closest available weight and style', () => {
    expect(resolveFont('Cinzel', 600).variant).toBe('700')
    expect(resolveFont('Great Vibes', 700, true).variant).toBe('400')
    expect(resolveFont('Unknown Family', 400).family).toBe('Inter')
    expect(resolveFont('Playfair Display', 700, true).file).toBe('playfair-display-700i.ttf')
  })
  it('every manifest font file exists in public/design-fonts', async () => {
    const { FONT_FAMILIES, fontFileName } = await import('../design-core')
    for (const f of FONT_FAMILIES) {
      for (const v of f.variants) {
        expect(fs.existsSync(path.join(fontsDir, fontFileName(f.family, v))), `${f.family} ${v}`).toBe(true)
      }
    }
  })
})

describe('text layout', () => {
  it('wraps at word boundaries within the box width', async () => {
    const el = text({ content: 'The quick brown fox jumps over the lazy dog again and again', w: 200 })
    const l = await layoutTextElement(el, { engine })
    expect(l.lines.length).toBeGreaterThan(1)
    for (const line of l.lines) {
      expect(line.width).toBeLessThanOrEqual(200.5)
    }
    expect(l.brokeWord).toBe(false)
  })

  it('breaks Lao text (no spaces) between words, not mid-syllable', async () => {
    const el = text({ content: 'ໃບຢັ້ງຢືນການເຂົ້າຮ່ວມການຝຶກອົບຮົມ', fontFamily: 'Noto Sans Lao', w: 150 })
    const l = await layoutTextElement(el, { engine })
    expect(l.lines.length).toBeGreaterThan(1)
    expect(l.brokeWord).toBe(false)
  })

  it('falls back to a Lao font for Lao characters in a Latin font', async () => {
    const el = text({ content: 'Name: ສົມສະໄໝ', fontFamily: 'Playfair Display' })
    const l = await layoutTextElement(el, { engine })
    const families = l.lines[0].runs.map(r => r.font.family)
    expect(families).toContain('Playfair Display')
    expect(families).toContain('Noto Serif Lao')
    // No .notdef (gid 0) glyphs anywhere.
    for (const r of l.lines[0].runs) {
      for (const g of r.glyphs) {
        expect(g.gid).not.toBe(0)
      }
    }
  })

  it('auto-fit shrinks a long name to fit one line', async () => {
    const el = text({ content: '{{recipient.name}}', fontFamily: 'Great Vibes', fontSize: 72, w: 500, h: 100, autoFit: true })
    const long = sampleData({ recipientName: 'Maximilian Alexander Featherstonehaugh-Worthington' })
    const l = await layoutTextElement(el, { engine, data: long })
    expect(l.fontSize).toBeLessThan(72)
    expect(l.overflows).toBe(false)
    const short = await layoutTextElement(el, { engine, data: sampleData({ recipientName: 'Ana' }) })
    expect(short.fontSize).toBe(72)
  })

  it('reports overflow without auto-fit', async () => {
    const el = text({ content: 'A very long heading that cannot fit', fontSize: 60, w: 200, h: 60 })
    const l = await layoutTextElement(el, { engine })
    expect(l.overflows).toBe(true)
  })

  it('letter spacing widens the line', async () => {
    const a = await engine.measure('SPACED', { fontFamily: 'Inter', fontWeight: 400, fontSize: 20 })
    const b = await engine.measure('SPACED', { fontFamily: 'Inter', fontWeight: 400, fontSize: 20, letterSpacing: 5 })
    expect(b - a).toBeCloseTo(25, 0)
  })
})

describe('brand kit', () => {
  it('replaces colour/font tokens and fills bindings', () => {
    const d: Design = {
      ...blankDesign('certificate'),
      background: { color: '$brand.secondary' },
      elements: [
        text({ id: 'h', color: '$brand.primary', fontFamily: '$brand.heading' }),
        { id: 'logo', type: 'image', src: '', fit: 'contain', bind: 'brand.logo', x: 0, y: 0, w: 10, h: 10 },
        text({ id: 's', content: 'Name Surname', bind: 'brand.signer.1.name' }),
        text({ id: 's2', content: 'Keep me', bind: 'brand.signer.2.name' }),
      ],
    }
    const out = applyBrandKit(d, { primary: '#112233', logo: '/uploads/logo.png', headingFont: 'Cinzel', signers: [{ name: 'Dr. Ana Lee' }] })
    const [h, logo, s, s2] = out.elements as any[]
    expect(h.color).toBe('#112233')
    expect(h.fontFamily).toBe('Cinzel')
    expect(out.background.color).toBe(DEFAULT_BRAND.secondary)
    expect(logo.src).toBe('/uploads/logo.png')
    expect(s.content).toBe('Dr. Ana Lee')
    expect(s2.content).toBe('Keep me')
    expect(JSON.stringify(out)).not.toContain('$brand')
  })
})

describe('render', () => {
  it('produces SVG with glyph paths, no <text>, and escapes image hrefs', async () => {
    const d = blankDesign('certificate')
    d.elements.push(text({ content: 'Hello {{recipient.name}}' }))
    d.elements.push({ id: 'i', type: 'image', src: 'https://x.test/a.png?a=1&b="2"', fit: 'contain', x: 0, y: 0, w: 10, h: 10 })
    const { svg } = await renderSvg(d, { engine, data: sampleData() })
    expect(svg).toMatch(/^<svg /)
    expect(svg).not.toContain('<text')
    expect(svg).toContain('<use href="#g')
    expect(svg).toContain('a=1&amp;b=&quot;2&quot;')
  })

  it('skips hidden elements and reports text overflow', async () => {
    const d = blankDesign('certificate')
    d.elements.push(text({ id: 'hid', hidden: true, content: 'SECRET' }))
    d.elements.push(text({ id: 'big', content: 'Far too much text for this box', fontSize: 80, w: 100, h: 40 }))
    const { issues } = await renderSvg(d, { engine, annotate: true })
    expect(issues.some(i => i.elementId === 'hid')).toBe(false)
    expect(issues).toContainEqual({ elementId: 'big', kind: 'text-overflow' })
  })

  it('draws a QR code with the injected matrix', async () => {
    const d = blankDesign('certificate')
    d.elements.push({ id: 'q', type: 'qr', target: 'verifyUrl', fg: '#000000', bg: '#ffffff', x: 0, y: 0, w: 100, h: 100 })
    const { svg } = await renderSvg(d, { engine, qr: () => ({ size: 2, isDark: (r, c) => r === c }) })
    expect(svg).toContain('M0 0h50v50h-50z')
  })
})

describe('schema', () => {
  it('accepts a valid design and rejects bad image sources and colours', () => {
    const d = blankDesign('badge')
    d.elements.push(text({ color: '$brand.accent' }))
    expect(validateDesign(d).ok).toBe(true)
    const bad = structuredClone(d)
    bad.elements.push({ id: 'i', type: 'image', src: 'javascript:alert(1)', fit: 'contain', x: 0, y: 0, w: 1, h: 1 })
    expect(validateDesign(bad).ok).toBe(false)
    const bad2 = structuredClone(d)
    ;(bad2.elements[0] as any).color = 'red;}</style>'
    expect(validateDesign(bad2).ok).toBe(false)
    expect(validateDesign({}).ok).toBe(false)
  })
})

describe('preflight and resize', () => {
  it('flags a certificate with no recipient name or QR', () => {
    const d = blankDesign('certificate')
    d.elements.push(text({ content: 'Certificate' }))
    const codes = preflight(d).map(f => f.code)
    expect(codes).toContain('no-recipient-name')
    expect(codes).toContain('no-qr')
    expect(preflight(blankDesign('certificate')).map(f => f.code)).toEqual(['empty-design'])
  })

  it('flags custom attributes the organization has not defined', () => {
    const d = blankDesign('certificate')
    d.elements.push(text({ content: '{{recipient.name}} at {{custom.location}}' }))
    expect(preflight(d, { customAttributeKeys: [] }).some(f => f.code === 'missing-custom-attribute' && f.detail === 'location')).toBe(true)
    expect(preflight(d, { customAttributeKeys: ['location'] }).some(f => f.code === 'missing-custom-attribute')).toBe(false)
  })

  it('switching orientation keeps elements on the page', () => {
    const d = blankDesign('certificate', 'landscape')
    d.elements.push(text({ x: 1000, y: 700, w: 100, h: 50 }))
    const p = resizeDesign(d, { ...d.page, orientation: 'portrait', width: d.page.height, height: d.page.width })
    const el = p.elements[0]
    expect(el.x + el.w).toBeLessThanOrEqual(p.page.width + 0.01)
    expect(el.y + el.h).toBeLessThanOrEqual(p.page.height + 0.01)
  })
})

describe('shared copies', () => {
  it('backend and frontend copies match src/shared/design-core', () => {
    const script = path.resolve(__dirname, '../../../../scripts/design/sync-design-core.mjs')
    if (!fs.existsSync(script)) {
      return
    }
    expect(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })).not.toThrow()
  })
})
