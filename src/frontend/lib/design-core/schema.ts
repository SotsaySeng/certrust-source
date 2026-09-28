// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
/**
 * Server-side validation of a design document (zod). Anything stored in
 * layoutConfig or snapshotted onto a credential passes through this first.
 */
import { z } from 'zod'

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const color = z.string().max(32).refine(v => HEX.test(v) || v === 'transparent' || /^\$brand\.(?:primary|secondary|accent)$/.test(v), 'Invalid colour')

/**
 * Image sources a design may reference. The server fetches these to inline
 * them into renders, so arbitrary URLs would be an SSRF hole: only data:
 * images, and paths/URLs the server itself maps to its own upload storage
 * (checked again, with the real origins, at fetch time).
 */
export const imageSrc = z.string().max(3_000_000).refine(
  v => v === '' || /^data:image\/(?:png|jpeg|svg\+xml|webp);base64,/.test(v) || /^\/uploads\//.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v),
  'Unsupported image source',
)

const num = z.number().finite()
const base = {
  id: z.string().min(1).max(64),
  name: z.string().max(120).optional(),
  x: num.min(-10000).max(20000),
  y: num.min(-10000).max(20000),
  w: num.min(0).max(20000),
  h: num.min(0).max(20000),
  rotation: num.min(-360).max(360).optional(),
  opacity: num.min(0).max(1).optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  bind: z.enum([
    'brand.logo',
    'brand.signature.1',
    'brand.signature.2',
    'brand.signature.3',
    'brand.signer.1.name',
    'brand.signer.2.name',
    'brand.signer.3.name',
    'brand.signer.1.title',
    'brand.signer.2.title',
    'brand.signer.3.title',
  ]).optional(),
}

const text = z.object({
  ...base,
  type: z.literal('text'),
  content: z.string().max(4000),
  fontFamily: z.string().min(1).max(80),
  fontWeight: z.number().int().min(100).max(900),
  italic: z.boolean().optional(),
  fontSize: num.min(1).max(1000),
  color,
  align: z.enum(['left', 'center', 'right']),
  vAlign: z.enum(['top', 'middle', 'bottom']).optional(),
  lineHeight: num.min(0.5).max(5).optional(),
  letterSpacing: num.min(-50).max(200).optional(),
  uppercase: z.boolean().optional(),
  autoFit: z.boolean().optional(),
  minFontSize: num.min(1).max(1000).optional(),
  curve: num.min(-5000).max(5000).optional(),
})

const image = z.object({
  ...base,
  type: z.literal('image'),
  src: imageSrc,
  assetId: z.union([z.string().max(64), z.number()]).optional(),
  fit: z.enum(['contain', 'cover', 'fill']),
  clip: z.enum(['none', 'circle', 'rounded']).optional(),
})

const shape = z.object({
  ...base,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'triangle', 'star', 'hexagon', 'shield', 'sunburst', 'ribbon', 'banner', 'diamond']),
  fill: color,
  fill2: color.optional(),
  stroke: color.optional(),
  strokeWidth: num.min(0).max(500).optional(),
  radius: num.min(0).max(10000).optional(),
  points: z.number().int().min(3).max(96).optional(),
})

const line = z.object({
  ...base,
  type: z.literal('line'),
  stroke: color,
  strokeWidth: num.min(0.1).max(500),
  dash: z.enum(['solid', 'dashed', 'dotted']).optional(),
})

const qr = z.object({
  ...base,
  type: z.literal('qr'),
  target: z.literal('verifyUrl'),
  fg: color,
  bg: color,
})

const frame = z.object({
  ...base,
  type: z.literal('frame'),
  style: z.enum(['classic', 'double', 'guilloche', 'corners', 'deco', 'wave', 'dots']),
  color,
  color2: color.optional(),
  thickness: num.min(0.5).max(500),
})

export const designSchema = z.object({
  version: z.literal(1),
  kind: z.enum(['certificate', 'badge']),
  page: z.object({
    preset: z.enum(['A4', 'Letter', 'badge-square', 'custom']),
    orientation: z.enum(['landscape', 'portrait']),
    width: num.min(50).max(5000),
    height: num.min(50).max(5000),
  }),
  background: z.object({
    color,
    image: z.object({ src: imageSrc, fit: z.enum(['contain', 'cover', 'fill']), opacity: num.min(0).max(1).optional() }).nullable().optional(),
  }),
  elements: z.array(z.discriminatedUnion('type', [text, image, shape, line, qr, frame])).max(400),
})

export type ValidatedDesign = z.infer<typeof designSchema>

/** Parse unknown JSON into a design, or return a readable error. */
export function validateDesign(input: unknown): { ok: boolean, design?: ValidatedDesign, error?: string } {
  const r = designSchema.safeParse(input)
  if (r.success) {
    return { ok: true, design: r.data }
  }
  const first = r.error.issues[0]
  return { ok: false, error: `${first.path.join('.') || 'design'}: ${first.message}` }
}

/** A design with no content yet (older templates stored `{}`). */
export function isEmptyDesign(input: unknown): boolean {
  return !input || typeof input !== 'object' || !Array.isArray((input as any).elements)
}
