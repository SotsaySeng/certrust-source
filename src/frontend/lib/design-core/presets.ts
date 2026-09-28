// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
import type { Design, DesignKind, Orientation, Page, PagePreset } from './types'

/** Page sizes in px at 96 DPI (portrait width x height). */
export const PAGE_SIZES: Record<Exclude<PagePreset, 'custom'>, { width: number, height: number, label: string }> = {
  'A4': { width: 794, height: 1123, label: 'A4' },
  'Letter': { width: 816, height: 1056, label: 'US Letter' },
  'badge-square': { width: 600, height: 600, label: 'Badge' },
}

/** Physical print size for PDF output, in PDF points (1/72 in). */
export const PRINT_SIZES_PT: Record<'A4' | 'Letter', { width: number, height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
}

export function pageFor(preset: PagePreset, orientation: Orientation, custom?: { width: number, height: number }): Page {
  if (preset === 'custom') {
    const w = custom?.width ?? 800
    const h = custom?.height ?? 600
    return { preset, orientation: w >= h ? 'landscape' : 'portrait', width: w, height: h }
  }
  const size = PAGE_SIZES[preset]
  if (preset === 'badge-square') {
    return { preset, orientation: 'portrait', width: size.width, height: size.height }
  }
  const [width, height] = orientation === 'landscape' ? [size.height, size.width] : [size.width, size.height]
  return { preset, orientation, width, height }
}

let idCounter = 0
/** Short unique element id. Not cryptographic - only needs to be unique inside one design. */
export function newElementId(): string {
  idCounter = (idCounter + 1) % 1e6
  return `el_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function blankDesign(kind: DesignKind, orientation: Orientation = 'landscape', preset?: PagePreset): Design {
  const page = kind === 'badge'
    ? pageFor('badge-square', 'portrait')
    : pageFor(preset && preset !== 'badge-square' ? preset : 'A4', orientation)
  return { version: 1, kind, page, background: { color: '#ffffff', image: null }, elements: [] }
}

/**
 * Re-fit a design to a new page (paper size or orientation switch): elements
 * are scaled uniformly and centred so the layout survives the change.
 */
export function resizeDesign(design: Design, page: Page): Design {
  const sx = page.width / design.page.width
  const sy = page.height / design.page.height
  const s = Math.min(sx, sy)
  const ox = (page.width - design.page.width * s) / 2
  const oy = (page.height - design.page.height * s) / 2
  return {
    ...design,
    page,
    elements: design.elements.map((el) => {
      const scaled: any = { ...el, x: el.x * s + ox, y: el.y * s + oy, w: el.w * s, h: el.h * s }
      if (el.type === 'text') {
        scaled.fontSize = Math.round(el.fontSize * s * 10) / 10
        if (el.minFontSize) {
          scaled.minFontSize = Math.round(el.minFontSize * s * 10) / 10
        }
        if (el.letterSpacing) {
          scaled.letterSpacing = el.letterSpacing * s
        }
        if (el.curve) {
          scaled.curve = el.curve * s
        }
      }
      if ('strokeWidth' in el && el.strokeWidth) {
        scaled.strokeWidth = el.strokeWidth * s
      }
      if (el.type === 'frame') {
        scaled.thickness = el.thickness * s
      }
      return scaled
    }),
  }
}
