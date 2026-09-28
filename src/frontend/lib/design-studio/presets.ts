/**
 * Ready-made things the Design Studio panels add to the canvas: text
 * styles, text combinations, built-in (recolourable) elements.
 * Coordinates in combinations are relative; the store centres the group.
 */
import type { DesignElement, FrameStyle, ShapeKind, TextElement } from '~/lib/design-core'

type Part = Partial<DesignElement> & { type: DesignElement['type'] }

export function textPart(over: Partial<TextElement>): Part {
  return {
    type: 'text',
    content: 'Your text',
    fontFamily: 'Inter',
    fontWeight: 400,
    fontSize: 20,
    color: '#1f2937',
    align: 'center',
    lineHeight: 1.25,
    w: 360,
    h: 30,
    ...over,
  } as Part
}

export const TEXT_STYLES = {
  heading: () => textPart({ content: 'Add a heading', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 56, w: 700, h: 72, color: '#111827' }),
  subheading: () => textPart({ content: 'Add a subheading', fontFamily: 'Inter', fontWeight: 600, fontSize: 28, w: 520, h: 38 }),
  body: () => textPart({ content: 'Add a little bit of body text', fontSize: 18, w: 440, h: 26, color: '#374151' }),
}

export interface Combination {
  id: string
  labelKey: string
  parts: Part[]
}

const line = (x: number, y: number, w: number, color = '#9ca3af'): Part => ({ type: 'line', x, y, w, h: 2, stroke: color, strokeWidth: 1.5 } as Part)

export const TEXT_COMBINATIONS: Combination[] = [
  {
    id: 'certificate-title',
    labelKey: 'certificateTitle',
    parts: [
      textPart({ content: 'CERTIFICATE', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 64, letterSpacing: 6, x: 0, y: 0, w: 640, h: 80, color: '#111827' }),
      textPart({ content: 'OF ACHIEVEMENT', fontFamily: 'Montserrat', fontWeight: 500, fontSize: 20, letterSpacing: 8, x: 0, y: 84, w: 640, h: 28, color: '#4b5563' }),
    ],
  },
  {
    id: 'completion-intro',
    labelKey: 'completionIntro',
    parts: [
      textPart({ content: 'CERTIFICATE OF COMPLETION', fontFamily: 'Lato', fontWeight: 700, fontSize: 30, letterSpacing: 2, x: 0, y: 0, w: 640, h: 40 }),
      textPart({ content: 'This is to proudly certify that', fontSize: 16, x: 0, y: 56, w: 640, h: 24, color: '#6b7280' }),
      textPart({ content: '{{recipient.name}}', fontFamily: 'Lato', fontSize: 36, autoFit: true, x: 0, y: 90, w: 640, h: 48 }),
    ],
  },
  {
    id: 'signature',
    labelKey: 'signatureBlock',
    parts: [
      textPart({ content: 'Signature', fontFamily: 'Great Vibes', fontSize: 44, x: 0, y: 0, w: 260, h: 56, color: '#111827', bind: 'brand.signer.1.name' } as any),
      line(20, 60, 220),
      textPart({ content: 'Name Surname', fontWeight: 700, fontSize: 18, x: 0, y: 70, w: 260, h: 26, bind: 'brand.signer.1.name' } as any),
      textPart({ content: 'Program Mentor', fontSize: 15, x: 0, y: 98, w: 260, h: 22, color: '#6b7280', bind: 'brand.signer.1.title' } as any),
    ],
  },
  {
    id: 'issue-date',
    labelKey: 'issueDateBlock',
    parts: [
      textPart({ content: '{{credential.issued_on}}', fontWeight: 700, fontSize: 18, x: 0, y: 0, w: 260, h: 26 }),
      line(30, 32, 200),
      textPart({ content: 'Issue Date', fontSize: 15, x: 0, y: 40, w: 260, h: 22, color: '#6b7280' }),
    ],
  },
  {
    id: 'name-title',
    labelKey: 'nameTitleBlock',
    parts: [
      textPart({ content: 'Name Surname', fontWeight: 700, fontSize: 18, x: 0, y: 0, w: 260, h: 26 }),
      line(30, 32, 200),
      textPart({ content: 'Program Mentor', fontSize: 15, x: 0, y: 40, w: 260, h: 22, color: '#6b7280' }),
    ],
  },
  {
    id: 'credential-id',
    labelKey: 'credentialIdBlock',
    parts: [
      textPart({ content: '{{credential.id}}', fontWeight: 600, fontSize: 14, x: 0, y: 0, w: 360, h: 22 }),
      line(80, 28, 200),
      textPart({ content: 'Certificate ID', fontSize: 14, x: 0, y: 36, w: 360, h: 22, color: '#6b7280' }),
    ],
  },
  {
    id: 'verify',
    labelKey: 'verifyBlock',
    parts: [
      textPart({ content: 'Verify this certificate', fontSize: 12, x: 0, y: 124, w: 140, h: 18, color: '#6b7280' }),
      { type: 'qr', target: 'verifyUrl', fg: '#111827', bg: '#ffffff', x: 10, y: 0, w: 120, h: 120 } as Part,
    ],
  },
]

/** The element added for an attribute chip. */
export function attributePart(key: string): Part {
  const isName = key === 'recipient.name'
  return textPart({
    content: `{{${key}}}`,
    fontFamily: isName ? 'Playfair Display' : 'Inter',
    fontWeight: isName ? 700 : 500,
    fontSize: isName ? 44 : 18,
    autoFit: isName || undefined,
    w: isName ? 600 : 320,
    h: isName ? 60 : 26,
  })
}

export interface ElementPreset {
  id: string
  labelKey: string
  part: () => Part
}

const shape = (s: ShapeKind, over: Partial<DesignElement> = {}): Part => ({ type: 'shape', shape: s, fill: '$brand.primary', w: 160, h: 160, ...over } as Part)
const frame = (style: FrameStyle, over: Partial<DesignElement> = {}): Part => ({ type: 'frame', style, color: '$brand.primary', color2: '$brand.secondary', thickness: 36, x: 24, y: 24, ...over } as Part)

export const ELEMENT_GROUPS: Array<{ id: string, labelKey: string, items: ElementPreset[] }> = [
  {
    id: 'lines',
    labelKey: 'lines',
    items: [
      { id: 'line', labelKey: 'line', part: () => line(0, 0, 300, '#111827') },
      { id: 'line-gold', labelKey: 'lineAccent', part: () => ({ type: 'line', w: 300, h: 4, stroke: '$brand.secondary', strokeWidth: 3 } as Part) },
      { id: 'line-dashed', labelKey: 'lineDashed', part: () => ({ type: 'line', w: 300, h: 2, stroke: '#6b7280', strokeWidth: 2, dash: 'dashed' } as Part) },
      { id: 'line-dotted', labelKey: 'lineDotted', part: () => ({ type: 'line', w: 300, h: 4, stroke: '#6b7280', strokeWidth: 4, dash: 'dotted' } as Part) },
    ],
  },
  {
    id: 'shapes',
    labelKey: 'shapes',
    items: [
      { id: 'rect', labelKey: 'rectangle', part: () => shape('rect', { w: 220, h: 140 }) },
      { id: 'rounded', labelKey: 'roundedRectangle', part: () => shape('rect', { w: 220, h: 140, radius: 20 }) },
      { id: 'ellipse', labelKey: 'circle', part: () => shape('ellipse') },
      { id: 'triangle', labelKey: 'triangle', part: () => shape('triangle') },
      { id: 'diamond', labelKey: 'diamond', part: () => shape('diamond') },
      { id: 'hexagon', labelKey: 'hexagon', part: () => shape('hexagon', { w: 150, h: 170 }) },
    ],
  },
  {
    id: 'graphics',
    labelKey: 'graphics',
    items: [
      { id: 'star', labelKey: 'star', part: () => shape('star', { fill: '#f5b820', w: 90, h: 90 }) },
      { id: 'seal', labelKey: 'seal', part: () => shape('sunburst', { fill: '$brand.secondary', points: 32, w: 170, h: 170 }) },
      { id: 'burst', labelKey: 'burst', part: () => shape('star', { fill: '$brand.accent', points: 12, w: 150, h: 150 }) },
    ],
  },
  {
    id: 'ribbons',
    labelKey: 'ribbons',
    items: [
      { id: 'ribbon', labelKey: 'ribbon', part: () => shape('ribbon', { w: 420, h: 110 }) },
      { id: 'ribbon-dark', labelKey: 'ribbonDark', part: () => shape('ribbon', { fill: '#0f172a', w: 420, h: 110 }) },
      { id: 'banner', labelKey: 'banner', part: () => shape('banner', { fill: '$brand.secondary', w: 420, h: 100 }) },
    ],
  },
  {
    id: 'bases',
    labelKey: 'bases',
    items: [
      { id: 'shield', labelKey: 'shield', part: () => shape('shield', { fill: '#fffbeb', stroke: '#e0a82e', strokeWidth: 10, w: 220, h: 260 }) },
      { id: 'shield-dark', labelKey: 'shieldDark', part: () => shape('shield', { fill: '#eef2ff', stroke: '$brand.primary', strokeWidth: 10, w: 220, h: 260 }) },
      { id: 'hex-base', labelKey: 'hexagonBase', part: () => shape('hexagon', { fill: '#fffbeb', stroke: '#e0a82e', strokeWidth: 10, w: 220, h: 250 }) },
      { id: 'circle-base', labelKey: 'circleBase', part: () => shape('ellipse', { fill: '$brand.primary', stroke: '#ffffff', strokeWidth: 8, w: 260, h: 260 }) },
    ],
  },
  {
    id: 'frames',
    labelKey: 'frames',
    items: (['guilloche', 'classic', 'double', 'corners', 'deco', 'wave', 'dots'] as FrameStyle[]).map(style => ({
      id: `frame-${style}`,
      labelKey: `frame_${style}`,
      part: () => frame(style),
    })),
  },
]

/** Friendly chip labels for placeholders (i18n key under designStudio.attributes). */
export const PLACEHOLDER_GROUPS = [
  { id: 'recipient', keys: ['recipient.name'] },
  { id: 'credential', keys: ['credential.id', 'credential.issued_on', 'credential.expires_on'] },
  { id: 'issuer', keys: ['issuer.name', 'issuer.organization', 'issuer.support_email'] },
  { id: 'achievement', keys: ['achievement.name', 'achievement.description'] },
]
