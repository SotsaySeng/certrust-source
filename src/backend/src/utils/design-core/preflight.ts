// GENERATED from src/shared/design-core by scripts/design/sync-design-core.mjs - do not edit here.
/**
 * Pre-flight checks shown before saving a design or assigning it to an
 * achievement. Each finding points at an element so the editor can jump to
 * it. Severity 'error' blocks assignment; 'warning' is advisory.
 */
import type { RenderIssue } from './render'
import type { Design } from './types'
import { placeholdersInDesign } from './placeholders'

export interface PreflightFinding {
  code: 'no-recipient-name' | 'no-qr' | 'text-overflow' | 'off-page' | 'image-missing' | 'low-res-image' | 'empty-design' | 'missing-custom-attribute'
  severity: 'error' | 'warning'
  elementId?: string
  /** Extra value for the message (attribute key etc.). */
  detail?: string
}

export function preflight(design: Design, opts: {
  /** Issues from a render with long sample data (see sampleData / SAMPLE_RECIPIENTS). */
  renderIssues?: RenderIssue[]
  /** Natural pixel sizes of image elements, when known. */
  imageSizes?: Record<string, { width: number, height: number }>
  /** Custom attribute keys that exist for the organization. */
  customAttributeKeys?: string[]
} = {}): PreflightFinding[] {
  const out: PreflightFinding[] = []
  const visible = design.elements.filter(e => !e.hidden)
  if (!visible.length) {
    out.push({ code: 'empty-design', severity: 'error' })
    return out
  }
  const keys = placeholdersInDesign({ ...design, elements: visible })
  if (!keys.has('recipient.name')) {
    out.push({ code: 'no-recipient-name', severity: design.kind === 'certificate' ? 'error' : 'warning' })
  }
  if (design.kind === 'certificate' && !visible.some(e => e.type === 'qr')) {
    out.push({ code: 'no-qr', severity: 'warning' })
  }

  const seen = new Set<string>()
  for (const issue of opts.renderIssues ?? []) {
    const k = `${issue.kind}:${issue.elementId}`
    if (seen.has(k)) {
      continue
    }
    seen.add(k)
    if (issue.kind === 'text-overflow') {
      out.push({ code: 'text-overflow', severity: 'warning', elementId: issue.elementId })
    }
    else if (issue.kind === 'off-page') {
      out.push({ code: 'off-page', severity: 'warning', elementId: issue.elementId })
    }
    else if (issue.kind === 'image-missing') {
      out.push({ code: 'image-missing', severity: 'warning', elementId: issue.elementId })
    }
  }

  // Print at 300 DPI from 96-DPI layout units: an image needs ~3x its box.
  for (const el of visible) {
    if (el.type !== 'image') {
      continue
    }
    const size = opts.imageSizes?.[el.id]
    if (size && (size.width < el.w * 1.5 || size.height < el.h * 1.5)) {
      out.push({ code: 'low-res-image', severity: 'warning', elementId: el.id })
    }
  }

  if (opts.customAttributeKeys) {
    const known = new Set(opts.customAttributeKeys.map(k => `custom.${k}`))
    for (const k of keys) {
      if (k.startsWith('custom.') && !known.has(k)) {
        out.push({ code: 'missing-custom-attribute', severity: 'error', detail: k.slice(7) })
      }
    }
  }
  return out
}
