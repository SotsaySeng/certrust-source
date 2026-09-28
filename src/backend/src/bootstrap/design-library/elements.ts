/**
 * The Design Studio's system Elements library: decorative SVG graphics
 * (laurels, seals, ribbons, ornaments, icons) generated in code, so they are
 * crisp at any size and easy to recolour here. Seeded as design-assets with
 * no organization (see ./seed.ts); starter templates embed a few of them
 * directly as data: URIs.
 */

export type ElementCategory = 'graphics' | 'ribbons' | 'bases' | 'seals' | 'frames' | 'laurels' | 'icons'

export interface SystemElement {
  slug: string
  name: string
  category: ElementCategory
  w: number
  h: number
  svg: string
}

const GOLD = '#c9a13b'
const GOLD_DARK = '#9a7424'
const NAVY = '#1e3a8a'
const RED = '#b91c1c'
const GREEN = '#2f7d4f'
const SILVER = '#9aa5b1'
const INK = '#1f2a44'

const f = (v: number) => Number(v.toFixed(2))
const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`

export function svgDataUri(markup: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`
}

/** Star polygon points centred at (cx, cy). */
function starPoints(cx: number, cy: number, outer: number, inner: number, n = 5, rot = -Math.PI / 2): string {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner : outer
    const a = rot + (i * Math.PI) / n
    pts.push(`${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`)
  }
  return pts.join(' ')
}

/** Scalloped (rosette) outline: n bumps around a circle. */
function scallopPath(cx: number, cy: number, r: number, n: number, depth: number): string {
  let d = ''
  for (let i = 0; i <= n * 8; i++) {
    const a = (i / (n * 8)) * Math.PI * 2
    const rr = r - depth + depth * Math.abs(Math.cos((a * n) / 2))
    d += `${i ? 'L' : 'M'}${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`
  }
  return `${d}Z`
}

// ------------------------------------------------------------------ laurels

/**
 * One laurel branch growing up the left side of a circle (angles in degrees,
 * 90 = bottom, 180 = left). The right branch is its mirror image.
 */
function laurelBranch(cx: number, cy: number, R: number, from: number, to: number, leaves: number, color: string, leaf = 1): string {
  const rad = (d: number) => (d * Math.PI) / 180
  const a0 = rad(from)
  const a1 = rad(to)
  const stem = `<path d="M${f(cx + R * Math.cos(a0))},${f(cy + R * Math.sin(a0))} A${R},${R} 0 0 1 ${f(cx + R * Math.cos(a1))},${f(cy + R * Math.sin(a1))}" fill="none" stroke="${color}" stroke-width="${f(2.2 * leaf)}" stroke-linecap="round"/>`
  let out = ''
  for (let i = 0; i < leaves; i++) {
    const t = (i + 0.5) / leaves
    const a = a0 + (a1 - a0) * t
    const scale = leaf * (0.75 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.15)))
    for (const side of [-1, 1]) {
      const r = R + side * 9 * scale
      const x = cx + r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      // Tangent (direction of growth) rotated so the leaf's long axis follows it, tilted away from the stem.
      const tangent = (Math.atan2(Math.cos(a), -Math.sin(a)) * 180) / Math.PI
      const deg = tangent + 90 + side * 28
      out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(4.6 * scale)}" ry="${f(12 * scale)}" transform="rotate(${f(deg)} ${f(x)} ${f(y)})" fill="${color}"/>`
    }
  }
  // Top leaf at the tip.
  const tx = cx + R * Math.cos(a1)
  const ty = cy + R * Math.sin(a1)
  const tangent = (Math.atan2(Math.cos(a1), -Math.sin(a1)) * 180) / Math.PI
  out += `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="${f(4.2 * leaf)}" ry="${f(12 * leaf)}" transform="rotate(${f(tangent + 90)} ${f(tx)} ${f(ty)})" fill="${color}"/>`
  return stem + out
}

export function laurelWreathSvg(color = GOLD, opts: { from?: number, to?: number, leaves?: number, side?: 'both' | 'left' | 'right' } = {}): string {
  const { from = 100, to = 245, leaves = 9, side = 'both' } = opts
  const left = laurelBranch(100, 100, 78, from, to, leaves, color)
  const right = `<g transform="translate(200 0) scale(-1 1)">${left}</g>`
  const body = side === 'left' ? left : side === 'right' ? right : left + right
  return svg(200, 200, body)
}

// -------------------------------------------------------------------- seals

export function rosetteSealSvg(main = GOLD, rim = GOLD_DARK, center = '#ffffff'): string {
  return svg(200, 200, [
    `<path d="${scallopPath(100, 100, 96, 24, 7)}" fill="${main}"/>`,
    `<circle cx="100" cy="100" r="76" fill="none" stroke="${rim}" stroke-width="3"/>`,
    `<circle cx="100" cy="100" r="68" fill="${rim}"/>`,
    `<circle cx="100" cy="100" r="62" fill="none" stroke="${center}" stroke-width="1.5" stroke-dasharray="3 4"/>`,
    `<polygon points="${starPoints(100, 100, 34, 14)}" fill="${center}"/>`,
  ].join(''))
}

export function starburstSealSvg(main = RED, inner = '#ffffff'): string {
  return svg(200, 200, [
    `<polygon points="${starPoints(100, 100, 98, 84, 30)}" fill="${main}"/>`,
    `<circle cx="100" cy="100" r="70" fill="none" stroke="${inner}" stroke-width="3"/>`,
    `<circle cx="100" cy="100" r="62" fill="none" stroke="${inner}" stroke-width="1"/>`,
    `<polygon points="${starPoints(70, 100, 11, 4.5)}" fill="${inner}"/>`,
    `<polygon points="${starPoints(100, 100, 16, 6.5)}" fill="${inner}"/>`,
    `<polygon points="${starPoints(130, 100, 11, 4.5)}" fill="${inner}"/>`,
  ].join(''))
}

export function stampSealSvg(color = NAVY): string {
  let ticks = ''
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2
    ticks += `<line x1="${f(100 + 80 * Math.cos(a))}" y1="${f(100 + 80 * Math.sin(a))}" x2="${f(100 + 86 * Math.cos(a))}" y2="${f(100 + 86 * Math.sin(a))}" stroke="${color}" stroke-width="2"/>`
  }
  return svg(200, 200, [
    `<circle cx="100" cy="100" r="94" fill="none" stroke="${color}" stroke-width="5"/>`,
    ticks,
    `<circle cx="100" cy="100" r="72" fill="none" stroke="${color}" stroke-width="2"/>`,
    `<circle cx="100" cy="100" r="50" fill="${color}"/>`,
    `<polygon points="${starPoints(100, 100, 30, 12)}" fill="#ffffff"/>`,
  ].join(''))
}

export function waxSealSvg(color = '#8b1e2d'): string {
  const blob = scallopPath(100, 100, 92, 9, 10)
  return svg(200, 200, [
    `<path d="${blob}" fill="${color}"/>`,
    `<circle cx="100" cy="100" r="62" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="4"/>`,
    `<circle cx="100" cy="100" r="54" fill="#000000" fill-opacity=".12"/>`,
    `<polygon points="${starPoints(100, 100, 28, 11)}" fill="#ffffff" fill-opacity=".55"/>`,
  ].join(''))
}

// ------------------------------------------------------------------ ribbons

export function medalTailsSvg(left = RED, right = NAVY): string {
  return svg(160, 200, [
    `<polygon points="20,0 78,0 70,200 45,172 14,196" fill="${left}"/>`,
    `<polygon points="82,0 140,0 146,196 115,172 90,200" fill="${right}"/>`,
    `<polygon points="20,0 78,0 77,16 21,16" fill="#000" fill-opacity=".15"/>`,
    `<polygon points="82,0 140,0 139,16 83,16" fill="#000" fill-opacity=".15"/>`,
  ].join(''))
}

export function bookmarkRibbonSvg(color = RED): string {
  return svg(80, 200, `<polygon points="0,0 80,0 80,200 40,165 0,200" fill="${color}"/><rect x="0" y="0" width="80" height="10" fill="#000" fill-opacity=".15"/>`)
}

export function foldedBannerSvg(color = NAVY, fold = '#0f1e4a'): string {
  return svg(500, 120, [
    `<polygon points="0,40 70,40 70,110 0,110 22,75" fill="${fold}"/>`,
    `<polygon points="500,40 430,40 430,110 500,110 478,75" fill="${fold}"/>`,
    `<polygon points="50,90 70,110 70,90" fill="#000" fill-opacity=".35"/>`,
    `<polygon points="450,90 430,110 430,90" fill="#000" fill-opacity=".35"/>`,
    `<rect x="50" y="10" width="400" height="80" fill="${color}"/>`,
  ].join(''))
}

export function cornerRibbonSvg(color = GOLD): string {
  return svg(200, 200, `<polygon points="0,0 70,0 200,130 200,200" fill="${color}"/><polygon points="0,0 30,0 200,170 200,200" fill="#000" fill-opacity=".12"/>`)
}

// -------------------------------------------------------------------- bases

export function medalSvg(rim = GOLD, face = '#f6e7b4', mark = GOLD_DARK): string {
  return svg(200, 200, [
    `<circle cx="100" cy="100" r="96" fill="${rim}"/>`,
    `<circle cx="100" cy="100" r="80" fill="${face}"/>`,
    `<circle cx="100" cy="100" r="80" fill="none" stroke="${mark}" stroke-width="2"/>`,
    `<polygon points="${starPoints(100, 100, 44, 18)}" fill="${mark}"/>`,
  ].join(''))
}

export function plaqueSvg(color = NAVY, trim = GOLD): string {
  return svg(300, 200, [
    `<rect x="4" y="4" width="292" height="192" rx="18" fill="${color}"/>`,
    `<rect x="16" y="16" width="268" height="168" rx="10" fill="none" stroke="${trim}" stroke-width="3"/>`,
    `<circle cx="30" cy="30" r="4" fill="${trim}"/><circle cx="270" cy="30" r="4" fill="${trim}"/><circle cx="30" cy="170" r="4" fill="${trim}"/><circle cx="270" cy="170" r="4" fill="${trim}"/>`,
  ].join(''))
}

// ------------------------------------------------------------------- frames

/** Ornamental corner flourish (top-left; rotate the element for the others). */
export function cornerFlourishSvg(color = GOLD): string {
  const s = `fill="none" stroke="${color}" stroke-linecap="round"`
  return svg(160, 160, [
    `<path d="M8,152 L8,40 Q8,8 40,8 L152,8" ${s} stroke-width="4"/>`,
    `<path d="M22,152 L22,52 Q22,22 52,22 L152,22" ${s} stroke-width="1.5"/>`,
    `<path d="M36,70 C36,44 52,36 70,36 C88,36 92,56 76,60 C64,63 60,50 68,48" ${s} stroke-width="2.5"/>`,
    `<circle cx="36" cy="36" r="6" fill="${color}"/>`,
    `<path d="M60,90 C48,90 40,98 40,110" ${s} stroke-width="2"/><path d="M90,60 C90,48 98,40 110,40" ${s} stroke-width="2"/>`,
  ].join(''))
}

export function cornerGeometricSvg(color = NAVY, accent = GOLD): string {
  return svg(160, 160, [
    `<polygon points="0,0 120,0 0,120" fill="${color}"/>`,
    `<polygon points="0,0 70,0 0,70" fill="${accent}"/>`,
    `<line x1="0" y1="150" x2="150" y2="0" stroke="${accent}" stroke-width="3"/>`,
  ].join(''))
}

export function dividerSvg(color = GOLD, style: 'diamond' | 'dots' | 'flourish' = 'diamond'): string {
  if (style === 'dots') {
    return svg(400, 30, `<line x1="0" y1="15" x2="165" y2="15" stroke="${color}" stroke-width="2"/><circle cx="185" cy="15" r="4" fill="${color}"/><circle cx="200" cy="15" r="6" fill="${color}"/><circle cx="215" cy="15" r="4" fill="${color}"/><line x1="235" y1="15" x2="400" y2="15" stroke="${color}" stroke-width="2"/>`)
  }
  if (style === 'flourish') {
    const s = `fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"`
    return svg(400, 40, `<path d="M10,20 C80,20 120,6 170,20 C185,24 190,32 200,20 C210,8 215,16 230,20 C280,34 320,20 390,20" ${s}/><circle cx="200" cy="20" r="4" fill="${color}"/>`)
  }
  return svg(400, 30, `<line x1="0" y1="15" x2="180" y2="15" stroke="${color}" stroke-width="2"/><polygon points="200,3 212,15 200,27 188,15" fill="${color}"/><line x1="220" y1="15" x2="400" y2="15" stroke="${color}" stroke-width="2"/>`)
}

// -------------------------------------------------------------------- icons

export function graduationCapSvg(color = INK): string {
  return svg(200, 160, [
    `<polygon points="100,10 196,52 100,94 4,52" fill="${color}"/>`,
    `<path d="M44,70 L44,112 C44,130 156,130 156,112 L156,70 L100,95 Z" fill="${color}"/>`,
    `<line x1="170" y1="58" x2="170" y2="118" stroke="${GOLD}" stroke-width="4"/>`,
    `<circle cx="170" cy="124" r="8" fill="${GOLD}"/>`,
  ].join(''))
}

export function trophySvg(color = GOLD): string {
  return svg(200, 200, [
    `<path d="M52,20 L148,20 L148,70 C148,110 124,128 100,128 C76,128 52,110 52,70 Z" fill="${color}"/>`,
    `<path d="M52,34 L24,34 C20,74 36,92 60,96" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`,
    `<path d="M148,34 L176,34 C180,74 164,92 140,96" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>`,
    `<rect x="88" y="126" width="24" height="34" fill="${color}"/>`,
    `<rect x="60" y="158" width="80" height="14" rx="3" fill="${color}"/>`,
    `<rect x="48" y="172" width="104" height="18" rx="4" fill="${GOLD_DARK}"/>`,
    `<polygon points="${starPoints(100, 66, 22, 9)}" fill="#ffffff" fill-opacity=".85"/>`,
  ].join(''))
}

export function openBookSvg(color = NAVY): string {
  return svg(200, 150, [
    `<path d="M100,30 C74,12 38,10 8,18 L8,130 C38,122 74,124 100,142 Z" fill="${color}"/>`,
    `<path d="M100,30 C126,12 162,10 192,18 L192,130 C162,122 126,124 100,142 Z" fill="${color}" fill-opacity=".82"/>`,
    `<path d="M24,44 C50,38 72,42 88,50 M24,66 C50,60 72,64 88,72 M24,88 C50,82 72,86 88,94" stroke="#ffffff" stroke-opacity=".6" stroke-width="3" fill="none"/>`,
  ].join(''))
}

export function starRatingSvg(color = GOLD): string {
  return svg(300, 100, [60, 150, 240].map((cx, i) => `<polygon points="${starPoints(cx, 52, i === 1 ? 46 : 36, i === 1 ? 19 : 15)}" fill="${color}"/>`).join(''))
}

export function checkBadgeSvg(color = GREEN): string {
  return svg(200, 200, `<path d="${scallopPath(100, 100, 94, 12, 8)}" fill="${color}"/><path d="M58,102 L88,132 L144,72" fill="none" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>`)
}

export function lightbulbSvg(color = '#f5b820'): string {
  return svg(160, 200, [
    `<path d="M80,10 C40,10 16,40 16,74 C16,100 32,114 44,128 C52,138 54,146 54,156 L106,156 C106,146 108,138 116,128 C128,114 144,100 144,74 C144,40 120,10 80,10 Z" fill="${color}"/>`,
    `<rect x="54" y="162" width="52" height="10" rx="3" fill="${INK}"/><rect x="58" y="176" width="44" height="10" rx="3" fill="${INK}"/>`,
    `<path d="M44,78 C44,54 58,38 78,34" fill="none" stroke="#ffffff" stroke-opacity=".75" stroke-width="9" stroke-linecap="round"/>`,
  ].join(''))
}

export function heartSvg(color = '#e0457b'): string {
  return svg(200, 180, `<path d="M100,170 C40,120 6,90 6,52 C6,24 28,6 54,6 C74,6 90,16 100,34 C110,16 126,6 146,6 C172,6 194,24 194,52 C194,90 160,120 100,170 Z" fill="${color}"/>`)
}

export function firstAidSvg(color = GREEN): string {
  return svg(200, 200, `<circle cx="100" cy="100" r="94" fill="${color}"/><path d="M78,38 H122 V78 H162 V122 H122 V162 H78 V122 H38 V78 H78 Z" fill="#ffffff"/>`)
}

export function globeSvg(color = NAVY): string {
  const s = `fill="none" stroke="${color}" stroke-width="6"`
  return svg(200, 200, [
    `<circle cx="100" cy="100" r="90" ${s}/>`,
    `<ellipse cx="100" cy="100" rx="40" ry="90" ${s}/>`,
    `<line x1="10" y1="100" x2="190" y2="100" stroke="${color}" stroke-width="6"/>`,
    `<path d="M24,55 H176 M24,145 H176" ${s}/>`,
  ].join(''))
}

export function calendarSvg(color = NAVY): string {
  let cells = ''
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) cells += `<rect x="${34 + c * 36}" y="${82 + r * 32}" width="24" height="20" rx="3" fill="${color}" fill-opacity="${r === 1 && c === 2 ? 1 : 0.25}"/>`
  }
  return svg(200, 200, `<rect x="14" y="30" width="172" height="160" rx="14" fill="none" stroke="${color}" stroke-width="8"/><rect x="14" y="30" width="172" height="40" rx="14" fill="${color}"/><rect x="50" y="12" width="12" height="36" rx="6" fill="${color}"/><rect x="138" y="12" width="12" height="36" rx="6" fill="${color}"/>${cells}`)
}

export function signaturePlaceholderSvg(color = INK): string {
  return svg(300, 100, `<path d="M14,70 C30,30 44,20 50,34 C56,50 40,78 52,80 C66,82 76,40 86,42 C96,44 86,76 98,76 C112,76 118,48 130,50 C140,52 132,74 146,72 C164,70 176,40 196,46 C210,50 200,70 214,70 C236,70 250,56 286,52" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`)
}

export function logoPlaceholderSvg(color = '#94a3b8'): string {
  return svg(200, 200, `<circle cx="100" cy="100" r="92" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="14 10"/><path d="M100,44 L146,62 L146,100 C146,128 126,148 100,158 C74,148 54,128 54,100 L54,62 Z" fill="${color}" fill-opacity=".35"/><path d="M80,100 L96,116 L124,84" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`)
}

// ------------------------------------------------------------------ library

export const SYSTEM_ELEMENTS: SystemElement[] = [
  { slug: 'laurel-gold', name: 'Laurel wreath (gold)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(GOLD) },
  { slug: 'laurel-green', name: 'Laurel wreath (green)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(GREEN) },
  { slug: 'laurel-silver', name: 'Laurel wreath (silver)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(SILVER) },
  { slug: 'laurel-navy', name: 'Laurel wreath (navy)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(NAVY) },
  { slug: 'laurel-open', name: 'Open laurel', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(GOLD, { from: 115, to: 215, leaves: 7 }) },
  { slug: 'laurel-left', name: 'Laurel branch (left)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(GOLD, { side: 'left' }) },
  { slug: 'laurel-right', name: 'Laurel branch (right)', category: 'laurels', w: 200, h: 200, svg: laurelWreathSvg(GOLD, { side: 'right' }) },

  { slug: 'seal-rosette-gold', name: 'Rosette seal (gold)', category: 'seals', w: 200, h: 200, svg: rosetteSealSvg() },
  { slug: 'seal-rosette-navy', name: 'Rosette seal (navy)', category: 'seals', w: 200, h: 200, svg: rosetteSealSvg('#3b5bb5', NAVY) },
  { slug: 'seal-rosette-silver', name: 'Rosette seal (silver)', category: 'seals', w: 200, h: 200, svg: rosetteSealSvg('#c3ccd6', '#6b7785') },
  { slug: 'seal-starburst-red', name: 'Starburst seal (red)', category: 'seals', w: 200, h: 200, svg: starburstSealSvg() },
  { slug: 'seal-starburst-gold', name: 'Starburst seal (gold)', category: 'seals', w: 200, h: 200, svg: starburstSealSvg(GOLD) },
  { slug: 'seal-stamp', name: 'Official stamp', category: 'seals', w: 200, h: 200, svg: stampSealSvg() },
  { slug: 'seal-wax', name: 'Wax seal', category: 'seals', w: 200, h: 200, svg: waxSealSvg() },

  { slug: 'ribbon-medal-tails', name: 'Medal ribbon tails', category: 'ribbons', w: 160, h: 200, svg: medalTailsSvg() },
  { slug: 'ribbon-medal-tails-gold', name: 'Medal ribbon tails (gold)', category: 'ribbons', w: 160, h: 200, svg: medalTailsSvg(GOLD, GOLD_DARK) },
  { slug: 'ribbon-bookmark', name: 'Bookmark ribbon', category: 'ribbons', w: 80, h: 200, svg: bookmarkRibbonSvg() },
  { slug: 'ribbon-banner-navy', name: 'Folded banner (navy)', category: 'ribbons', w: 500, h: 120, svg: foldedBannerSvg() },
  { slug: 'ribbon-banner-red', name: 'Folded banner (red)', category: 'ribbons', w: 500, h: 120, svg: foldedBannerSvg(RED, '#7f1414') },
  { slug: 'ribbon-corner', name: 'Corner ribbon', category: 'ribbons', w: 200, h: 200, svg: cornerRibbonSvg() },

  { slug: 'base-medal-gold', name: 'Gold medal', category: 'bases', w: 200, h: 200, svg: medalSvg() },
  { slug: 'base-medal-silver', name: 'Silver medal', category: 'bases', w: 200, h: 200, svg: medalSvg('#aab4bf', '#eef1f4', '#6b7785') },
  { slug: 'base-medal-bronze', name: 'Bronze medal', category: 'bases', w: 200, h: 200, svg: medalSvg('#b0703a', '#f1d5bb', '#7c4a22') },
  { slug: 'base-plaque', name: 'Plaque', category: 'bases', w: 300, h: 200, svg: plaqueSvg() },

  { slug: 'corner-flourish-gold', name: 'Corner flourish (gold)', category: 'frames', w: 160, h: 160, svg: cornerFlourishSvg() },
  { slug: 'corner-flourish-navy', name: 'Corner flourish (navy)', category: 'frames', w: 160, h: 160, svg: cornerFlourishSvg(NAVY) },
  { slug: 'corner-geometric', name: 'Geometric corner', category: 'frames', w: 160, h: 160, svg: cornerGeometricSvg() },
  { slug: 'divider-diamond', name: 'Divider (diamond)', category: 'frames', w: 400, h: 30, svg: dividerSvg() },
  { slug: 'divider-dots', name: 'Divider (dots)', category: 'frames', w: 400, h: 30, svg: dividerSvg(GOLD, 'dots') },
  { slug: 'divider-flourish', name: 'Divider (flourish)', category: 'frames', w: 400, h: 40, svg: dividerSvg(GOLD, 'flourish') },

  { slug: 'icon-graduation', name: 'Graduation cap', category: 'icons', w: 200, h: 160, svg: graduationCapSvg() },
  { slug: 'icon-trophy', name: 'Trophy', category: 'icons', w: 200, h: 200, svg: trophySvg() },
  { slug: 'icon-book', name: 'Open book', category: 'icons', w: 200, h: 150, svg: openBookSvg() },
  { slug: 'icon-stars', name: 'Star rating', category: 'icons', w: 300, h: 100, svg: starRatingSvg() },
  { slug: 'icon-check', name: 'Verified check', category: 'icons', w: 200, h: 200, svg: checkBadgeSvg() },
  { slug: 'icon-lightbulb', name: 'Idea', category: 'icons', w: 160, h: 200, svg: lightbulbSvg() },
  { slug: 'icon-heart', name: 'Heart', category: 'icons', w: 200, h: 180, svg: heartSvg() },
  { slug: 'icon-first-aid', name: 'First aid', category: 'icons', w: 200, h: 200, svg: firstAidSvg() },
  { slug: 'icon-globe', name: 'Globe', category: 'icons', w: 200, h: 200, svg: globeSvg() },
  { slug: 'icon-calendar', name: 'Calendar', category: 'icons', w: 200, h: 200, svg: calendarSvg() },

  { slug: 'graphic-signature', name: 'Signature (sample)', category: 'graphics', w: 300, h: 100, svg: signaturePlaceholderSvg() },
  { slug: 'graphic-logo-placeholder', name: 'Logo placeholder', category: 'graphics', w: 200, h: 200, svg: logoPlaceholderSvg() },
]
