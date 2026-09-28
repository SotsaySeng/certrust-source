// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
import type { BrandKit, Design, DesignElement } from './types'

/**
 * Brand tokens. Templates are authored with `$brand.primary` etc. instead of
 * fixed colours and `$brand.heading` / `$brand.body` instead of fixed fonts,
 * so applying a template to an organization makes it look like theirs.
 * Unresolved tokens (a system template shown in the gallery) use DEFAULT_BRAND.
 */
export const DEFAULT_BRAND: Required<Pick<BrandKit, 'primary' | 'secondary' | 'accent' | 'headingFont' | 'bodyFont'>> = {
  primary: '#1e3a8a',
  secondary: '#b08d3c',
  accent: '#0f766e',
  headingFont: 'Playfair Display',
  bodyFont: 'Inter',
}

const COLOR_TOKENS = { '$brand.primary': 'primary', '$brand.secondary': 'secondary', '$brand.accent': 'accent' } as const
const FONT_TOKENS = { '$brand.heading': 'headingFont', '$brand.body': 'bodyFont' } as const

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isBrandToken(v: unknown): v is string {
  return typeof v === 'string' && v.startsWith('$brand.')
}

export function resolveColor(value: string | undefined | null, brand?: BrandKit | null, fallback = '#000000'): string {
  if (!value) {
    return fallback
  }
  if (value === 'transparent' || value === 'none') {
    return 'none'
  }
  if (value in COLOR_TOKENS) {
    const k = COLOR_TOKENS[value as keyof typeof COLOR_TOKENS]
    const v = brand?.[k]
    return v && HEX_RE.test(v) ? v : DEFAULT_BRAND[k]
  }
  return HEX_RE.test(value) ? value : fallback
}

export function resolveFontFamily(value: string, brand?: BrandKit | null): string {
  if (value in FONT_TOKENS) {
    const k = FONT_TOKENS[value as keyof typeof FONT_TOKENS]
    return brand?.[k] || DEFAULT_BRAND[k]
  }
  return value
}

function bindValue(bind: string, kit: BrandKit): string | null | undefined {
  if (bind === 'brand.logo') {
    return kit.logo
  }
  const m = bind.match(/^brand\.(signature|signer)\.(\d)(?:\.(name|title))?$/)
  if (!m) {
    return undefined
  }
  const signer = kit.signers?.[Number(m[2]) - 1]
  if (!signer) {
    return undefined
  }
  if (m[1] === 'signature') {
    return signer.signature
  }
  return m[3] === 'name' ? signer.name : signer.title
}

/**
 * Bake an organization's brand kit into a design: colour and font tokens
 * become concrete values, bound logo/signature images and signer texts are
 * filled. Elements bound to something the kit doesn't have keep their
 * template content. The result has no tokens left, so later brand-kit edits
 * never silently change a saved design.
 */
export function applyBrandKit(design: Design, kit: BrandKit | null | undefined): Design {
  const k = kit ?? {}
  const color = (c: string | undefined) => (c && isBrandToken(c) ? resolveColor(c, k) : c)
  const elements = design.elements.map((el): DesignElement => {
    const out: any = { ...el }
    for (const prop of ['color', 'fill', 'fill2', 'stroke', 'color2', 'fg', 'bg'] as const) {
      if (prop in out) {
        out[prop] = color(out[prop])
      }
    }
    if (el.type === 'text') {
      out.fontFamily = resolveFontFamily(el.fontFamily, k)
    }
    if (el.bind) {
      const v = bindValue(el.bind, k)
      if (v) {
        if (el.type === 'image') {
          out.src = v
        }
        else if (el.type === 'text') {
          out.content = v
        }
      }
    }
    return out
  })
  return {
    ...design,
    background: { ...design.background, color: color(design.background.color) ?? '#ffffff' },
    elements,
  }
}
