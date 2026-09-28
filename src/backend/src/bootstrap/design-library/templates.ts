/**
 * Starter system templates for the Design Studio gallery. Authored with
 * brand tokens ($brand.primary, $brand.heading, ...) and brand bindings
 * (logo, signatures, signer names), so "Use template" turns each one into
 * the organization's own design in one step. Seeded by ./seed.ts.
 */
import type { Design, DesignElement } from '../../utils/design-core'
import {
  cornerFlourishSvg,
  dividerSvg,
  firstAidSvg,
  graduationCapSvg,
  laurelWreathSvg,
  logoPlaceholderSvg,
  medalTailsSvg,
  rosetteSealSvg,
  signaturePlaceholderSvg,
  svgDataUri,
  trophySvg,
} from './elements'

export interface SystemTemplate {
  slug: string
  name: string
  description: string
  /** design-category slug */
  category: string
  isPremium: boolean
  design: Design
}

type El = Record<string, any>

const A4L = { preset: 'A4', orientation: 'landscape', width: 1123, height: 794 } as const
const A4P = { preset: 'A4', orientation: 'portrait', width: 794, height: 1123 } as const
const BADGE = { preset: 'badge-square', orientation: 'portrait', width: 600, height: 600 } as const

const GOLD = '#c9a13b'
const MUTED = '#64748b'
const BODY = '#334155'
const DARK = '#0f172a'

const LOGO = svgDataUri(logoPlaceholderSvg())
const SIGNATURE = svgDataUri(signaturePlaceholderSvg())
const SIGNATURE_LIGHT = svgDataUri(signaturePlaceholderSvg('#f1f5f9'))

// ----------------------------------------------------------------- helpers

const text = (content: string, x: number, y: number, w: number, h: number, o: El = {}): El => ({
  type: 'text', content, x, y, w, h, fontFamily: '$brand.body', fontWeight: 400, fontSize: 18, color: BODY, align: 'center', lineHeight: (o.fontSize ?? 18) >= 36 ? 1.1 : 1.3, ...o,
})
const shape = (kind: string, x: number, y: number, w: number, h: number, o: El = {}): El => ({ type: 'shape', shape: kind, x, y, w, h, fill: '$brand.primary', ...o })
const line = (x: number, y: number, w: number, o: El = {}): El => ({ type: 'line', x, y, w, h: 4, stroke: '#cbd5e1', strokeWidth: 1.5, ...o })
const frame = (style: string, x: number, y: number, w: number, h: number, o: El = {}): El => ({ type: 'frame', style, x, y, w, h, color: '$brand.primary', color2: '$brand.secondary', thickness: 36, ...o })
const image = (src: string, x: number, y: number, w: number, h: number, o: El = {}): El => ({ type: 'image', src, x, y, w, h, fit: 'contain', ...o })
const qr = (x: number, y: number, size: number, o: El = {}): El => ({ type: 'qr', target: 'verifyUrl', x, y, w: size, h: size, fg: DARK, bg: '#ffffff', name: 'Verification QR', ...o })
const logo = (x: number, y: number, w: number, h: number): El => image(LOGO, x, y, w, h, { bind: 'brand.logo', name: 'Logo' })

/** Name + optional block title. */
const recipientName = (x: number, y: number, w: number, h: number, o: El = {}): El =>
  text('{{recipient.name}}', x, y, w, h, { name: 'Recipient name', fontFamily: 'Great Vibes', fontSize: 72, color: '#1f2937', autoFit: true, minFontSize: 28, vAlign: 'middle', lineHeight: 1.1, ...o })

/** Signature image, line, signer name and title, centred on cx. */
function signature(n: 1 | 2 | 3, cx: number, y: number, o: { light?: boolean, lineColor?: string } = {}): El[] {
  const ink = o.light ? '#f8fafc' : '#111827'
  const sub = o.light ? '#cbd5e1' : MUTED
  return [
    image(o.light ? SIGNATURE_LIGHT : SIGNATURE, cx - 100, y, 200, 66, { bind: `brand.signature.${n}`, name: `Signature ${n}` }),
    line(cx - 120, y + 70, 240, { stroke: o.lineColor ?? (o.light ? '#94a3b8' : '#94a3b8') }),
    text('Name Surname', cx - 140, y + 80, 280, 26, { fontWeight: 700, fontSize: 17, color: ink, bind: `brand.signer.${n}.name`, name: `Signer ${n} name` }),
    text('Title', cx - 140, y + 106, 280, 22, { fontSize: 14, color: sub, bind: `brand.signer.${n}.title`, name: `Signer ${n} title` }),
  ]
}

/** Value over a rule with a small label: issue date, certificate ID... */
function labelled(value: string, label: string, cx: number, y: number, o: { light?: boolean, w?: number } = {}): El[] {
  const w = o.w ?? 260
  return [
    text(value, cx - w / 2, y, w, 26, { fontWeight: 700, fontSize: 17, color: o.light ? '#f8fafc' : '#111827', autoFit: true, minFontSize: 10 }),
    line(cx - 100, y + 32, 200, { stroke: '#94a3b8' }),
    text(label, cx - w / 2, y + 42, w, 22, { fontSize: 14, color: o.light ? '#cbd5e1' : MUTED }),
  ]
}

/** Curved text on a circle centred at (cx, cy). top: over the top; else along the bottom. */
function arcText(content: string, cx: number, cy: number, R: number, top: boolean, o: El = {}): El {
  const fontSize = o.fontSize ?? 26
  const h = Math.round(fontSize * 1.5)
  const ascent = fontSize * 0.95
  const descent = fontSize * 0.25
  const y = top ? cy - R - ascent : cy + R + descent - h
  return text(content, cx - R, Math.round(y), R * 2, h, { fontFamily: 'Montserrat', fontWeight: 700, fontSize, letterSpacing: 3, uppercase: true, color: '#ffffff', curve: top ? R : -R, ...o })
}

function design(kind: 'certificate' | 'badge', page: typeof A4L | typeof A4P | typeof BADGE, background: string, parts: Array<El | El[]>): Design {
  const elements = parts.flat().map((el, i) => ({ id: `e${i + 1}`, ...el })) as DesignElement[]
  return { version: 1, kind, page: { ...page }, background: { color: background }, elements }
}

const cert = (page: typeof A4L | typeof A4P, bg: string, parts: Array<El | El[]>) => design('certificate', page, bg, parts)
const badge = (parts: Array<El | El[]>) => design('badge', BADGE, 'transparent', parts)

const goldCorner = svgDataUri(cornerFlourishSvg(GOLD))
const goldDivider = svgDataUri(dividerSvg(GOLD))
const goldFlourish = svgDataUri(dividerSvg(GOLD, 'flourish'))
const goldLaurel = svgDataUri(laurelWreathSvg(GOLD))
const goldRosette = svgDataUri(rosetteSealSvg())

// ------------------------------------------------------------ certificates

const CERTIFICATES: SystemTemplate[] = [
  {
    slug: 'classic-guilloche',
    name: 'Classic Guilloché',
    description: 'Timeless certificate of achievement with a banknote-style guilloché border and a seal.',
    category: 'education',
    isPremium: false,
    design: cert(A4L, '#fffdf7', [
      frame('guilloche', 20, 20, 1083, 754, { thickness: 44 }),
      logo(511, 76, 100, 100),
      text('CERTIFICATE', 100, 188, 923, 70, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 56, letterSpacing: 8, color: '$brand.primary' }),
      text('OF ACHIEVEMENT', 100, 260, 923, 32, { fontFamily: 'Cinzel', fontSize: 22, letterSpacing: 10, color: '$brand.secondary' }),
      text('This certificate is proudly presented to', 100, 316, 923, 28, { fontFamily: 'Lora', italic: true, color: '#475569' }),
      recipientName(161, 346, 801, 100, { fontSize: 80 }),
      line(311, 448, 500, { stroke: '$brand.secondary' }),
      text('for successfully completing {{achievement.name}} on {{credential.issued_on}}.', 211, 468, 700, 60, { fontFamily: 'Lora', lineHeight: 1.5 }),
      signature(1, 290, 552),
      signature(2, 833, 552),
      shape('sunburst', 501, 560, 120, 120, { fill: '$brand.secondary', points: 30, name: 'Seal' }),
      shape('ellipse', 521, 580, 80, 80, { fill: '$brand.primary', stroke: '#ffffff', strokeWidth: 3 }),
      shape('star', 541, 598, 40, 40, { fill: '#ffffff' }),
      qr(972, 80, 70),
      text('Certificate ID: {{credential.id}}', 261, 700, 600, 18, { fontSize: 11, color: MUTED }),
    ]),
  },
  {
    slug: 'modern-minimal',
    name: 'Modern Minimal',
    description: 'Clean, left-aligned certificate with a bold brand-colour bar.',
    category: 'corporate',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      shape('rect', 0, 0, 28, 794, { name: 'Brand bar' }),
      shape('rect', 28, 0, 6, 794, { fill: '$brand.secondary' }),
      logo(92, 64, 110, 90),
      text('CERTIFICATE', 90, 206, 880, 76, { name: 'Title', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 64, letterSpacing: 4, color: DARK, align: 'left' }),
      text('OF COMPLETION', 94, 284, 700, 30, { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 20, letterSpacing: 10, color: '$brand.primary', align: 'left' }),
      line(94, 334, 80, { stroke: '$brand.secondary', strokeWidth: 4, h: 6 }),
      text('Presented to', 94, 368, 400, 26, { fontSize: 16, color: MUTED, align: 'left' }),
      recipientName(90, 396, 900, 84, { fontFamily: 'Poppins', fontWeight: 600, fontSize: 56, color: DARK, align: 'left' }),
      text('For successfully completing {{achievement.name}}.', 94, 488, 760, 60, { color: '#475569', align: 'left', lineHeight: 1.5 }),
      labelled('{{credential.issued_on}}', 'Date', 224, 624),
      signature(1, 540, 596),
      qr(930, 590, 110),
      text('Scan to verify', 910, 704, 150, 18, { fontSize: 12, color: MUTED }),
    ]),
  },
  {
    slug: 'formal-navy-gold',
    name: 'Formal Navy & Gold',
    description: 'Prestigious dark certificate with gold double border, flourishes and seal.',
    category: 'awards-and-excellence',
    isPremium: true,
    design: cert(A4L, '$brand.primary', [
      frame('double', 24, 24, 1075, 746, { thickness: 30, color: GOLD, color2: GOLD }),
      image(goldCorner, 62, 62, 110, 110, { name: 'Corner' }),
      image(goldCorner, 951, 62, 110, 110, { rotation: 90, name: 'Corner' }),
      logo(521, 70, 80, 80),
      text('CERTIFICATE OF EXCELLENCE', 100, 160, 923, 60, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 44, letterSpacing: 4, color: GOLD }),
      image(goldDivider, 361, 224, 400, 30),
      text('is hereby awarded to', 100, 266, 923, 32, { fontFamily: 'Cormorant Garamond', italic: true, fontSize: 24, color: '#e2e8f0' }),
      recipientName(161, 300, 801, 110, { fontFamily: 'Pinyon Script', fontSize: 84, color: GOLD }),
      text('in recognition of outstanding achievement in {{achievement.name}}', 211, 426, 700, 70, { fontFamily: 'Cormorant Garamond', fontSize: 22, color: '#e2e8f0', lineHeight: 1.4 }),
      image(goldRosette, 501, 536, 120, 120, { name: 'Seal' }),
      signature(1, 300, 560, { light: true, lineColor: GOLD }),
      signature(2, 823, 560, { light: true, lineColor: GOLD }),
      qr(975, 646, 72, { fg: DARK }),
      text('{{credential.issued_on}}', 461, 668, 200, 20, { fontSize: 13, color: '#cbd5e1' }),
    ]),
  },
  {
    slug: 'training-completion',
    name: 'Training Completion',
    description: 'Certificate of completion for training programmes, with date and QR verification.',
    category: 'training-and-courses',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      frame('corners', 30, 30, 1063, 734, { thickness: 60 }),
      logo(521, 66, 80, 80),
      text('CERTIFICATE OF COMPLETION', 100, 166, 923, 56, { name: 'Title', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 40, letterSpacing: 3, color: DARK }),
      text('This is to certify that', 100, 238, 923, 28, { color: MUTED }),
      recipientName(161, 270, 801, 88, { fontFamily: '$brand.heading', fontWeight: 700, fontSize: 60, color: '$brand.primary' }),
      line(336, 364, 450),
      text('has successfully completed the training programme', 100, 384, 923, 28, { color: MUTED }),
      text('{{achievement.name}}', 161, 418, 801, 42, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 28, color: DARK, autoFit: true, minFontSize: 14 }),
      labelled('{{credential.issued_on}}', 'Date of completion', 240, 580),
      signature(1, 561, 552),
      qr(835, 548, 100),
      text('Scan to verify', 810, 654, 150, 18, { fontSize: 12, color: MUTED }),
      text('Certificate ID: {{credential.id}}', 261, 700, 600, 18, { fontSize: 11, color: MUTED }),
    ]),
  },
  {
    slug: 'participation',
    name: 'Participation',
    description: 'Friendly certificate of participation for events, camps and competitions.',
    category: 'events-and-participation',
    isPremium: false,
    design: cert(A4L, '#f8fafc', [
      frame('wave', 20, 20, 1083, 754, { thickness: 28, color: '$brand.accent', color2: '$brand.primary' }),
      logo(80, 70, 100, 90),
      text('CERTIFICATE OF PARTICIPATION', 100, 110, 923, 80, { name: 'Title', fontFamily: 'Bebas Neue', fontSize: 72, letterSpacing: 4, color: DARK }),
      shape('ribbon', 311, 200, 500, 80, { fill: '$brand.accent' }),
      text('PROUDLY PRESENTED TO', 361, 222, 400, 30, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 18, letterSpacing: 4, color: '#ffffff', vAlign: 'middle' }),
      recipientName(161, 300, 801, 100, { fontFamily: 'Dancing Script', fontWeight: 700, color: '$brand.primary' }),
      text('for participating in {{achievement.name}} held on {{credential.issued_on}}.', 211, 414, 700, 60, { lineHeight: 1.5 }),
      signature(1, 300, 540),
      signature(2, 823, 540),
      qr(511, 548, 100),
      text('Scan to verify', 486, 654, 150, 18, { fontSize: 12, color: MUTED }),
    ]),
  },
  {
    slug: 'appreciation',
    name: 'Appreciation',
    description: 'Warm portrait certificate of appreciation with an art-deco border.',
    category: 'appreciation',
    isPremium: false,
    design: cert(A4P, '#fffaf3', [
      frame('deco', 28, 28, 738, 1067, { thickness: 40, color: '$brand.secondary', color2: '$brand.primary' }),
      logo(347, 106, 100, 100),
      text('Certificate', 97, 232, 600, 84, { name: 'Title', fontFamily: '$brand.heading', fontWeight: 700, fontSize: 68, color: '$brand.primary' }),
      text('OF APPRECIATION', 97, 318, 600, 30, { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 20, letterSpacing: 10, color: '$brand.secondary' }),
      image(goldFlourish, 197, 366, 400, 40),
      text('This certificate is gratefully presented to', 97, 436, 600, 28, { fontFamily: 'Lora', italic: true, color: '#475569' }),
      recipientName(97, 474, 600, 104, { fontFamily: 'Alex Brush', fontSize: 76 }),
      text('in sincere appreciation of your dedication and valuable contribution to {{achievement.name}}.', 117, 604, 560, 100, { fontFamily: 'Lora', lineHeight: 1.6 }),
      image(goldRosette, 337, 726, 120, 120, { name: 'Seal' }),
      signature(1, 220, 880),
      signature(2, 574, 880),
      qr(362, 898, 70),
      text('Issued {{credential.issued_on}}', 247, 1022, 300, 18, { fontSize: 12, color: MUTED }),
    ]),
  },
  {
    slug: 'award-of-excellence',
    name: 'Award of Excellence',
    description: 'Striking award with a brand-colour side panel, laurel wreath and trophy.',
    category: 'awards-and-excellence',
    isPremium: true,
    design: cert(A4L, '#ffffff', [
      shape('rect', 0, 0, 330, 794, { name: 'Side panel' }),
      logo(115, 60, 100, 100),
      image(goldLaurel, 45, 222, 240, 240, { name: 'Laurel' }),
      image(svgDataUri(trophySvg(GOLD)), 115, 290, 100, 100, { name: 'Trophy' }),
      text('EXCELLENCE', 15, 488, 300, 36, { fontFamily: 'Cinzel', fontWeight: 700, fontSize: 26, letterSpacing: 6, color: '#ffffff' }),
      text('{{credential.issued_on}}', 15, 528, 300, 22, { fontSize: 14, color: '#e2e8f0' }),
      qr(125, 636, 80, { fg: DARK }),
      shape('rect', 356, 22, 745, 750, { fill: 'transparent', stroke: '$brand.secondary', strokeWidth: 2, name: 'Border' }),
      text('AWARD', 390, 110, 673, 84, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 68, letterSpacing: 10, color: DARK }),
      text('OF EXCELLENCE', 390, 196, 673, 32, { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 22, letterSpacing: 10, color: '$brand.secondary' }),
      line(626, 246, 200, { stroke: '$brand.secondary', strokeWidth: 3 }),
      text('Presented to', 390, 284, 673, 26, { fontSize: 16, color: MUTED }),
      recipientName(410, 314, 633, 104, { fontSize: 76, color: '$brand.primary' }),
      text('For exceptional performance and outstanding achievement in {{achievement.name}}.', 450, 436, 553, 80, { fontFamily: 'Lora', lineHeight: 1.6 }),
      signature(1, 560, 570),
      signature(2, 900, 570),
    ]),
  },
  {
    slug: 'honor-roll',
    name: 'Honor Roll',
    description: 'Portrait academic honour certificate with laurel-framed logo.',
    category: 'education',
    isPremium: false,
    design: cert(A4P, '#ffffff', [
      frame('classic', 30, 30, 734, 1063, { thickness: 26 }),
      image(goldLaurel, 287, 84, 220, 220, { name: 'Laurel' }),
      logo(347, 144, 100, 100),
      text('HONOR ROLL', 97, 318, 600, 72, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 56, letterSpacing: 6, color: '$brand.primary' }),
      text('CERTIFICATE OF ACADEMIC ACHIEVEMENT', 97, 394, 600, 24, { fontFamily: 'Montserrat', fontWeight: 500, fontSize: 15, letterSpacing: 4, color: '$brand.secondary' }),
      text('This honour is awarded to', 97, 468, 600, 28, { fontFamily: 'Lora', italic: true, color: '#475569' }),
      recipientName(97, 502, 600, 88, { fontFamily: 'Playfair Display', fontWeight: 700, italic: true, fontSize: 56, color: '#111827' }),
      line(197, 596, 400, { stroke: '$brand.secondary' }),
      text('for outstanding academic performance and dedication to excellence in {{achievement.name}}.', 137, 618, 520, 90, { fontFamily: 'Lora', lineHeight: 1.6 }),
      labelled('{{credential.issued_on}}', 'Date', 230, 800),
      signature(1, 564, 772),
      qr(357, 924, 80),
      text('ID {{credential.id}}', 197, 1020, 400, 18, { fontSize: 10, color: MUTED }),
    ]),
  },
  {
    slug: 'workshop',
    name: 'Workshop',
    description: 'Certificate for workshops and short courses with a bold header band.',
    category: 'training-and-courses',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      shape('rect', 0, 0, 1123, 170, { name: 'Header band' }),
      shape('rect', 0, 170, 1123, 8, { fill: '$brand.secondary' }),
      logo(60, 36, 100, 100),
      text('WORKSHOP CERTIFICATE', 190, 46, 870, 58, { name: 'Title', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 42, letterSpacing: 4, color: '#ffffff', align: 'left' }),
      text('{{issuer.organization}}', 192, 106, 870, 28, { fontSize: 18, color: '#e2e8f0', align: 'left' }),
      text('This certifies that', 100, 236, 923, 28, { color: MUTED }),
      recipientName(161, 268, 801, 84, { fontFamily: 'Poppins', fontWeight: 600, fontSize: 56, color: '$brand.primary' }),
      text('attended and completed the workshop', 100, 364, 923, 28, { color: MUTED }),
      text('{{achievement.name}}', 161, 398, 801, 46, { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 30, color: DARK, autoFit: true, minFontSize: 14 }),
      text('{{achievement.description}}', 211, 452, 700, 54, { fontSize: 15, color: MUTED, lineHeight: 1.4, autoFit: true, minFontSize: 10 }),
      labelled('{{credential.issued_on}}', 'Date', 220, 592),
      signature(1, 561, 566),
      qr(850, 560, 100),
      text('Scan to verify', 825, 666, 150, 18, { fontSize: 12, color: MUTED }),
      shape('rect', 0, 754, 1123, 40, { name: 'Footer band' }),
      text('Certificate ID: {{credential.id}}', 261, 765, 600, 18, { fontSize: 12, color: '#ffffff' }),
    ]),
  },
  {
    slug: 'course-completion',
    name: 'Course Completion',
    description: 'Elegant course completion certificate with a dotted border and graduation cap.',
    category: 'education',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      frame('dots', 24, 24, 1075, 746, { thickness: 20 }),
      logo(74, 62, 100, 90),
      image(svgDataUri(graduationCapSvg('#1f2a44')), 506, 70, 110, 88, { name: 'Graduation cap' }),
      text('CERTIFICATE', 100, 170, 923, 76, { name: 'Title', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 60, letterSpacing: 6, color: DARK }),
      text('OF COURSE COMPLETION', 100, 248, 923, 28, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 18, letterSpacing: 8, color: '$brand.primary' }),
      text('awarded to', 100, 300, 923, 28, { fontFamily: 'Lora', italic: true, color: '#475569' }),
      recipientName(161, 328, 801, 104, { fontFamily: 'Allura', fontSize: 84, color: DARK }),
      line(311, 438, 500, { stroke: '$brand.primary' }),
      text('for successfully completing the course {{achievement.name}}', 211, 460, 700, 60, { lineHeight: 1.5 }),
      signature(1, 250, 560),
      signature(2, 873, 560),
      qr(516, 574, 90),
      text('{{credential.issued_on}}', 461, 674, 200, 20, { fontSize: 13, color: MUTED }),
      text('ID {{credential.id}}', 361, 700, 400, 18, { fontSize: 10, color: MUTED }),
    ]),
  },
  {
    slug: 'corporate-recognition',
    name: 'Corporate Recognition',
    description: 'Confident corporate recognition award with a brand seal.',
    category: 'corporate',
    isPremium: true,
    design: cert(A4L, '#ffffff', [
      shape('rect', 0, 0, 1123, 14, { name: 'Top stripe' }),
      shape('rect', 0, 780, 1123, 14, { name: 'Bottom stripe' }),
      shape('rect', 64, 96, 8, 128, { fill: '$brand.secondary', name: 'Accent bar' }),
      text('RECOGNITION', 90, 88, 800, 92, { name: 'Title', fontFamily: 'Oswald', fontWeight: 600, fontSize: 76, letterSpacing: 6, color: DARK, align: 'left' }),
      text('OF EXCELLENCE', 92, 180, 700, 40, { fontFamily: 'Oswald', fontSize: 28, letterSpacing: 12, color: '$brand.primary', align: 'left' }),
      logo(913, 70, 150, 100),
      shape('sunburst', 823, 290, 230, 230, { fill: '$brand.secondary', points: 36, name: 'Seal' }),
      shape('ellipse', 853, 320, 170, 170, { stroke: '#ffffff', strokeWidth: 4 }),
      shape('star', 898, 358, 80, 80, { fill: '#ffffff' }),
      text('Presented to', 92, 292, 500, 26, { fontSize: 16, color: MUTED, align: 'left' }),
      recipientName(90, 320, 700, 80, { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 52, color: DARK, align: 'left' }),
      line(92, 408, 300, { stroke: '$brand.secondary', strokeWidth: 3 }),
      text('In recognition of exceptional contribution, leadership and commitment: {{achievement.name}}.', 92, 430, 640, 84, { align: 'left', lineHeight: 1.6 }),
      signature(1, 220, 590),
      signature(2, 520, 590),
      qr(900, 590, 100),
      text('{{credential.issued_on}} · ID {{credential.id}}', 563, 740, 500, 18, { fontSize: 11, color: MUTED, align: 'right' }),
    ]),
  },
  {
    slug: 'diploma',
    name: 'Diploma',
    description: 'Traditional portrait diploma with guilloché border and gold seal.',
    category: 'education',
    isPremium: true,
    design: cert(A4P, '#fbf8ef', [
      frame('guilloche', 26, 26, 742, 1071, { thickness: 50 }),
      logo(347, 108, 100, 100),
      text('{{issuer.organization}}', 97, 224, 600, 40, { fontFamily: 'Cinzel', fontWeight: 700, fontSize: 26, letterSpacing: 3, color: '$brand.primary', autoFit: true, minFontSize: 14 }),
      text('DIPLOMA', 97, 286, 600, 92, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 72, letterSpacing: 12, color: '#1f2937' }),
      image(goldDivider, 197, 388, 400, 30),
      text('This is to certify that', 97, 436, 600, 32, { fontFamily: 'Cormorant Garamond', italic: true, fontSize: 22, color: '#475569' }),
      recipientName(117, 472, 560, 104, { fontFamily: 'Pinyon Script', fontSize: 72, color: '#1f2937' }),
      text('has fulfilled all the requirements and is hereby awarded', 97, 588, 600, 30, { fontFamily: 'Cormorant Garamond', fontSize: 20, color: '#475569' }),
      text('{{achievement.name}}', 97, 624, 600, 48, { fontFamily: 'Cinzel', fontWeight: 700, fontSize: 30, color: '$brand.primary', autoFit: true, minFontSize: 14 }),
      text('with all the rights, honours and privileges thereto.', 97, 678, 600, 30, { fontFamily: 'Cormorant Garamond', italic: true, fontSize: 20, color: '#475569' }),
      image(goldRosette, 337, 748, 120, 120, { name: 'Seal' }),
      signature(1, 215, 890),
      signature(2, 579, 890),
      qr(362, 902, 70),
      text('{{credential.issued_on}}', 297, 978, 200, 18, { fontSize: 12, color: MUTED }),
    ]),
  },
  {
    slug: 'health-and-safety',
    name: 'Health & Safety Training',
    description: 'Training certificate with completion date, expiry date and certificate ID.',
    category: 'health-and-safety',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      frame('classic', 24, 24, 1075, 746, { thickness: 16, color: '$brand.accent', color2: '$brand.accent' }),
      image(svgDataUri(firstAidSvg('#2f7d4f')), 70, 64, 90, 90, { name: 'First aid icon' }),
      text('CERTIFICATE OF TRAINING', 180, 70, 700, 52, { name: 'Title', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 40, letterSpacing: 2, color: DARK, align: 'left' }),
      text('HEALTH & SAFETY', 182, 124, 600, 28, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 18, letterSpacing: 8, color: '$brand.accent', align: 'left' }),
      logo(953, 60, 100, 90),
      line(70, 180, 983, { stroke: '#e2e8f0', strokeWidth: 2 }),
      text('This is to certify that', 100, 226, 923, 28, { color: MUTED }),
      recipientName(161, 258, 801, 84, { fontFamily: 'Poppins', fontWeight: 600, fontSize: 54, color: DARK }),
      text('has successfully completed {{achievement.name}} and demonstrated the required knowledge and skills.', 211, 356, 700, 80, { lineHeight: 1.6 }),
      labelled('{{credential.issued_on}}', 'Date completed', 250, 470),
      labelled('{{credential.expires_on}}', 'Valid until', 561, 470),
      labelled('{{credential.id}}', 'Certificate ID', 872, 470, { w: 300 }),
      signature(1, 330, 590),
      qr(760, 588, 100),
      text('Scan to verify', 735, 694, 150, 18, { fontSize: 12, color: MUTED }),
    ]),
  },
  {
    slug: 'event-attendance',
    name: 'Event Attendance',
    description: 'Bold dark certificate of attendance for conferences and events.',
    category: 'events-and-participation',
    isPremium: false,
    design: cert(A4L, '#0b1120', [
      shape('ellipse', 800, 50, 280, 280, { fill: '$brand.accent', opacity: 0.3, name: 'Circle' }),
      shape('ellipse', 900, 420, 180, 180, { fill: '$brand.secondary', opacity: 0.35, name: 'Circle' }),
      shape('ellipse', 800, 350, 100, 100, { fill: '$brand.primary', opacity: 0.8, name: 'Circle' }),
      text('CERTIFICATE', 80, 76, 800, 130, { name: 'Title', fontFamily: 'Bebas Neue', fontSize: 116, letterSpacing: 6, color: '#ffffff', align: 'left' }),
      text('OF ATTENDANCE', 84, 202, 700, 54, { fontFamily: 'Bebas Neue', fontSize: 46, letterSpacing: 10, color: '$brand.secondary', align: 'left' }),
      text('This certifies that', 84, 298, 500, 28, { color: '#cbd5e1', align: 'left' }),
      recipientName(80, 328, 700, 80, { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 54, color: '#ffffff', align: 'left' }),
      text('attended {{achievement.name}} on {{credential.issued_on}}.', 84, 420, 640, 70, { fontSize: 20, color: '#e2e8f0', align: 'left', lineHeight: 1.5 }),
      logo(84, 600, 120, 100),
      signature(1, 420, 580, { light: true }),
      qr(950, 640, 100, { fg: '#0b1120' }),
    ]),
  },
  {
    slug: 'lao-bilingual',
    name: 'Lao Bilingual',
    description: 'Lao and English certificate (ໃບຢັ້ງຢືນ) with a double border.',
    category: 'corporate',
    isPremium: false,
    design: cert(A4L, '#ffffff', [
      frame('double', 24, 24, 1075, 746, { thickness: 24 }),
      logo(511, 58, 100, 100),
      text('ໃບຢັ້ງຢືນ', 100, 166, 923, 84, { name: 'Title (Lao)', fontFamily: 'Noto Serif Lao', fontWeight: 700, fontSize: 54, color: '$brand.primary' }),
      text('CERTIFICATE', 100, 250, 923, 36, { name: 'Title', fontFamily: 'Cinzel', fontWeight: 700, fontSize: 26, letterSpacing: 10, color: '$brand.secondary' }),
      text('ມອບໃຫ້ · Presented to', 100, 300, 923, 32, { fontFamily: 'Noto Sans Lao', fontSize: 18, color: '#475569' }),
      recipientName(161, 336, 801, 90, { fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 54, color: '#111827' }),
      line(311, 432, 500, { stroke: '$brand.secondary' }),
      text('{{achievement.name}}', 161, 450, 801, 36, { fontFamily: 'Noto Sans Lao', fontWeight: 700, fontSize: 22, color: DARK, autoFit: true, minFontSize: 12 }),
      text('{{credential.issued_on}}', 361, 492, 400, 26, { fontSize: 16, color: MUTED }),
      signature(1, 280, 556),
      signature(2, 843, 556),
      qr(516, 574, 90),
    ]),
  },
]

// ------------------------------------------------------------------ badges

const BADGES: SystemTemplate[] = [
  {
    slug: 'badge-classic-seal',
    name: 'Classic Seal Badge',
    description: 'Round seal badge with curved organisation name and issue date.',
    category: 'awards-and-excellence',
    isPremium: false,
    design: badge([
      shape('sunburst', 20, 20, 560, 560, { fill: '$brand.secondary', points: 30, name: 'Seal' }),
      shape('ellipse', 70, 70, 460, 460, { stroke: '#ffffff', strokeWidth: 6, name: 'Disc' }),
      shape('ellipse', 95, 95, 410, 410, { fill: 'transparent', stroke: '$brand.secondary', strokeWidth: 3 }),
      arcText('{{issuer.organization}}', 300, 300, 165, true, { fontSize: 26, autoFit: true, minFontSize: 14 }),
      shape('star', 245, 150, 110, 110, { fill: '$brand.secondary' }),
      text('{{achievement.name}}', 120, 272, 360, 116, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 34, color: '#ffffff', autoFit: true, minFontSize: 14, vAlign: 'middle', lineHeight: 1.1 }),
      arcText('{{credential.issued_on}}', 300, 300, 186, false, { fontSize: 20, fontWeight: 600 }),
    ]),
  },
  {
    slug: 'badge-shield',
    name: 'Shield Badge',
    description: 'Heraldic shield with a banner across the front.',
    category: 'awards-and-excellence',
    isPremium: false,
    design: badge([
      shape('shield', 120, 30, 360, 440, { fill: '#ffffff', stroke: '$brand.primary', strokeWidth: 14, name: 'Shield' }),
      shape('shield', 150, 62, 300, 370, { name: 'Shield face' }),
      shape('star', 245, 118, 110, 110, { fill: '$brand.secondary' }),
      text('{{issuer.organization}}', 175, 250, 250, 60, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 18, letterSpacing: 2, uppercase: true, color: '#ffffff', autoFit: true, minFontSize: 10, vAlign: 'middle' }),
      shape('ribbon', 50, 372, 500, 110, { fill: '$brand.secondary', name: 'Banner' }),
      text('{{achievement.name}}', 130, 402, 340, 38, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 26, color: '#ffffff', autoFit: true, minFontSize: 10, vAlign: 'middle', lineHeight: 1 }),
      text('{{credential.issued_on}}', 200, 510, 200, 28, { fontWeight: 600, fontSize: 16, color: '$brand.primary' }),
    ]),
  },
  {
    slug: 'badge-hexagon',
    name: 'Hexagon Badge',
    description: 'Modern hexagon badge for courses and certifications.',
    category: 'education',
    isPremium: false,
    design: badge([
      shape('hexagon', 90, 62, 420, 476, { stroke: '$brand.secondary', strokeWidth: 16, name: 'Hexagon' }),
      image(svgDataUri(graduationCapSvg('#ffffff')), 225, 140, 150, 120, { name: 'Graduation cap' }),
      text('{{achievement.name}}', 140, 286, 320, 110, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 32, color: '#ffffff', autoFit: true, minFontSize: 14, vAlign: 'middle', lineHeight: 1.1 }),
      text('CERTIFIED', 200, 408, 200, 28, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 16, letterSpacing: 6, color: '$brand.secondary' }),
    ]),
  },
  {
    slug: 'badge-ribbon-medal',
    name: 'Ribbon Medal',
    description: 'Gold-rimmed medal with ribbon tails.',
    category: 'awards-and-excellence',
    isPremium: true,
    design: badge([
      image(svgDataUri(medalTailsSvg()), 200, 330, 200, 250, { name: 'Ribbon tails' }),
      shape('sunburst', 110, 30, 380, 380, { fill: '$brand.secondary', points: 32, name: 'Medal rim' }),
      shape('ellipse', 140, 60, 320, 320, { stroke: '#ffffff', strokeWidth: 5, name: 'Medal face' }),
      shape('ellipse', 160, 80, 280, 280, { fill: 'transparent', stroke: '$brand.secondary', strokeWidth: 3 }),
      shape('star', 268, 104, 64, 64, { fill: '$brand.secondary' }),
      text('{{achievement.name}}', 180, 176, 240, 100, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 30, color: '#ffffff', autoFit: true, minFontSize: 11, vAlign: 'middle', lineHeight: 1.05 }),
      text('{{credential.issued_on}}', 200, 290, 200, 24, { fontSize: 15, color: '#e2e8f0' }),
    ]),
  },
  {
    slug: 'badge-star',
    name: 'Star Badge',
    description: 'Cheerful five-point star badge.',
    category: 'awards-and-excellence',
    isPremium: false,
    design: badge([
      shape('star', 50, 40, 500, 500, { fill: '$brand.secondary', name: 'Star' }),
      shape('ellipse', 185, 200, 230, 230, { stroke: '#ffffff', strokeWidth: 6, name: 'Disc' }),
      text('{{achievement.name}}', 205, 262, 190, 106, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 26, color: '#ffffff', autoFit: true, minFontSize: 11, vAlign: 'middle', lineHeight: 1.05 }),
    ]),
  },
  {
    slug: 'badge-laurel',
    name: 'Laurel Badge',
    description: 'Distinguished badge framed by a golden laurel wreath.',
    category: 'awards-and-excellence',
    isPremium: true,
    design: badge([
      shape('ellipse', 150, 150, 300, 300, { name: 'Disc' }),
      shape('ellipse', 166, 166, 268, 268, { fill: 'transparent', stroke: '$brand.secondary', strokeWidth: 3 }),
      image(goldLaurel, 40, 40, 520, 520, { name: 'Laurel' }),
      shape('star', 270, 186, 60, 60, { fill: '$brand.secondary' }),
      text('{{achievement.name}}', 190, 252, 220, 100, { name: 'Achievement', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 30, color: '#ffffff', autoFit: true, minFontSize: 12, vAlign: 'middle', lineHeight: 1.1 }),
      text('{{credential.issued_on}}', 200, 360, 200, 24, { fontSize: 15, color: '#e2e8f0' }),
    ]),
  },
  {
    slug: 'badge-rosette',
    name: 'Rosette Badge',
    description: 'Thank-you rosette for appreciation and recognition.',
    category: 'appreciation',
    isPremium: false,
    design: badge([
      shape('sunburst', 20, 20, 560, 560, { points: 40, name: 'Rosette' }),
      shape('sunburst', 70, 70, 460, 460, { fill: '$brand.secondary', points: 36 }),
      shape('ellipse', 130, 130, 340, 340, { fill: '#ffffff', stroke: '$brand.primary', strokeWidth: 8, name: 'Disc' }),
      text('THANK YOU', 150, 196, 300, 32, { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 20, letterSpacing: 6, color: '$brand.primary' }),
      text('{{achievement.name}}', 160, 238, 280, 110, { name: 'Achievement', fontFamily: 'Playfair Display', fontWeight: 700, fontSize: 34, color: '#111827', autoFit: true, minFontSize: 12, vAlign: 'middle', lineHeight: 1.1 }),
      text('{{credential.issued_on}}', 200, 362, 200, 26, { fontSize: 16, color: MUTED }),
    ]),
  },
  {
    slug: 'badge-membership',
    name: 'Membership Badge',
    description: 'Rounded-square membership badge with your logo.',
    category: 'membership',
    isPremium: false,
    design: badge([
      shape('rect', 50, 50, 500, 500, { radius: 64, name: 'Card' }),
      shape('rect', 76, 76, 448, 448, { fill: 'transparent', stroke: '$brand.secondary', strokeWidth: 4, radius: 46 }),
      logo(250, 104, 100, 100),
      text('MEMBER', 100, 236, 400, 72, { name: 'Title', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 58, letterSpacing: 10, color: '#ffffff' }),
      text('{{achievement.name}}', 110, 318, 380, 44, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 600, fontSize: 24, color: '$brand.secondary', autoFit: true, minFontSize: 12 }),
      text('Since {{credential.issued_on}}', 150, 440, 300, 26, { fontSize: 16, color: '#e2e8f0' }),
    ]),
  },
  {
    slug: 'badge-skill-diamond',
    name: 'Skill Diamond',
    description: 'Diamond-shaped badge for skills and micro-credentials.',
    category: 'training-and-courses',
    isPremium: false,
    design: badge([
      shape('diamond', 40, 40, 520, 520, { fill: '$brand.accent', name: 'Diamond' }),
      shape('diamond', 86, 86, 428, 428, { fill: 'transparent', stroke: '#ffffff', strokeWidth: 4 }),
      shape('star', 270, 170, 60, 60, { fill: '#ffffff' }),
      text('{{achievement.name}}', 170, 244, 260, 106, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 30, color: '#ffffff', autoFit: true, minFontSize: 12, vAlign: 'middle', lineHeight: 1.05 }),
      text('SKILL', 200, 362, 200, 28, { fontFamily: 'Montserrat', fontWeight: 600, fontSize: 16, letterSpacing: 8, color: '#ffffff' }),
    ]),
  },
  {
    slug: 'badge-modern-flat',
    name: 'Modern Flat Badge',
    description: 'Minimal flat badge with a curved "Verified credential" ring.',
    category: 'corporate',
    isPremium: false,
    design: badge([
      shape('ellipse', 30, 30, 540, 540, { name: 'Ring' }),
      shape('ellipse', 72, 72, 456, 456, { fill: '#ffffff', name: 'Face' }),
      arcText('{{issuer.organization}}', 300, 300, 238, true, { fontSize: 20, autoFit: true, minFontSize: 11 }),
      arcText('Verified credential', 300, 300, 256, false, { fontSize: 18, fontWeight: 600 }),
      shape('ellipse', 250, 130, 100, 100, { fill: '$brand.accent', name: 'Icon disc' }),
      shape('star', 272, 150, 56, 56, { fill: '#ffffff' }),
      text('{{achievement.name}}', 130, 256, 340, 110, { name: 'Achievement', fontFamily: 'Montserrat', fontWeight: 700, fontSize: 34, color: '$brand.primary', autoFit: true, minFontSize: 12, vAlign: 'middle', lineHeight: 1.1 }),
      text('{{credential.issued_on}}', 200, 384, 200, 26, { fontSize: 16, color: MUTED }),
    ]),
  },
]

export const SYSTEM_TEMPLATES: SystemTemplate[] = [...CERTIFICATES, ...BADGES]
