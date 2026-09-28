/**
 * Re-apply a changed brand kit to a design whose brand values were already
 * baked in: colours and fonts that equal the OLD kit's values are swapped
 * for the new ones, and bound elements (logo, signatures, signer names)
 * are refilled. Anything the user picked by hand is left alone.
 */
import type { BrandKit, Design } from '~/lib/design-core'
import { applyBrandKit, DEFAULT_BRAND } from '~/lib/design-core'

const COLOR_PROPS = ['color', 'color2', 'fill', 'fill2', 'stroke', 'fg', 'bg'] as const

export function rebrandDesign(design: Design, oldKit: BrandKit | null, newKit: BrandKit): Design {
  const pairs: Array<[string, string]> = []
  for (const k of ['primary', 'secondary', 'accent'] as const) {
    const from = (oldKit?.[k] || DEFAULT_BRAND[k]).toLowerCase()
    const to = newKit[k]
    if (to && from !== to.toLowerCase()) {
      pairs.push([from, to])
    }
  }
  const fonts: Array<[string, string]> = []
  for (const k of ['headingFont', 'bodyFont'] as const) {
    const from = oldKit?.[k] || DEFAULT_BRAND[k]
    const to = newKit[k]
    if (to && from !== to) {
      fonts.push([from, to])
    }
  }
  const swap = (v: unknown) => {
    if (typeof v !== 'string') {
      return v
    }
    const hit = pairs.find(([from]) => from === v.toLowerCase())
    return hit ? hit[1] : v
  }
  const out: Design = JSON.parse(JSON.stringify(design))
  out.background.color = swap(out.background.color) as string
  for (const el of out.elements as any[]) {
    for (const p of COLOR_PROPS) {
      if (p in el) {
        el[p] = swap(el[p])
      }
    }
    if (el.type === 'text') {
      const f = fonts.find(([from]) => from === el.fontFamily)
      if (f) {
        el.fontFamily = f[1]
      }
    }
  }
  // Refill logo/signature/signer bindings from the new kit.
  return applyBrandKit(out, newKit)
}
