// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
import manifest from './fonts.json'

export type FontCategory = 'serif' | 'sans' | 'display' | 'script' | 'lao' | 'fallback'

export interface FontFamilyDef {
  family: string
  category: FontCategory
  /** '400', '700', '400i' ... */
  variants: string[]
}

export const FONT_FAMILIES: FontFamilyDef[] = manifest.families as FontFamilyDef[]

/** Families offered in the editor's font picker (fallback-only ones hidden). */
export const PICKER_FAMILIES = FONT_FAMILIES.filter(f => f.category !== 'fallback')

export const DEFAULT_FONT = 'Inter'

/** Same naming as scripts/design/fetch-fonts.mjs. */
export function fontFileName(family: string, variant: string): string {
  return `${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${variant}.ttf`
}

export function familyDef(family: string): FontFamilyDef | undefined {
  return FONT_FAMILIES.find(f => f.family === family)
}

/**
 * A concrete font file for (family, weight, italic): the closest available
 * weight in the requested style, falling back to the other style, and to the
 * default family if the family is unknown.
 */
export function resolveFont(family: string, weight = 400, italic = false): { family: string, variant: string, file: string, key: string } {
  const def = familyDef(family) ?? familyDef(DEFAULT_FONT)!
  const parse = (v: string) => ({ w: Number.parseInt(v), i: v.endsWith('i'), v })
  const all = def.variants.map(parse)
  const pool = all.filter(x => x.i === italic).length ? all.filter(x => x.i === italic) : all
  const best = pool.reduce((a, b) => Math.abs(b.w - weight) < Math.abs(a.w - weight) ? b : a)
  return { family: def.family, variant: best.v, file: fontFileName(def.family, best.v), key: `${def.family}|${best.v}` }
}

export function weightsFor(family: string): number[] {
  const def = familyDef(family)
  if (!def) {
    return [400]
  }
  return [...new Set(def.variants.map(v => Number.parseInt(v)))].sort((a, b) => a - b)
}

export function hasItalic(family: string): boolean {
  return !!familyDef(family)?.variants.some(v => v.endsWith('i'))
}

export function isLao(cp: number): boolean {
  return cp >= 0x0E80 && cp <= 0x0EFF
}

export function isThai(cp: number): boolean {
  return cp >= 0x0E00 && cp <= 0x0E7F
}

/**
 * Fallback families to try, in order, for a character the primary font
 * cannot draw - e.g. a Lao recipient name on a Playfair Display template.
 * Serif primaries prefer the serif Lao face so the name still matches.
 */
export function fallbackChain(primaryFamily: string, cp: number): string[] {
  const serif = familyDef(primaryFamily)?.category === 'serif'
  if (isLao(cp)) {
    return serif ? ['Noto Serif Lao', 'Noto Sans Lao', 'Phetsarath'] : ['Noto Sans Lao', 'Phetsarath', 'Noto Serif Lao']
  }
  if (isThai(cp)) {
    return ['Noto Sans Thai']
  }
  return ['Noto Sans', 'Noto Sans Lao']
}
