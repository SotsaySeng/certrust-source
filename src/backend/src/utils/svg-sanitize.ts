/**
 * Allowlist sanitiser for user-uploaded SVG (logos, signatures, seals).
 *
 * Uploaded files are served from the API origin's /uploads, so an SVG with
 * <script>, on* handlers or javascript: links would be stored XSS there.
 * Everything not on the lists below is dropped: scripts, event handlers,
 * foreignObject, external references (only #fragment and data:image hrefs
 * survive), and CSS imports/URLs inside <style>.
 */
import sanitizeHtml from 'sanitize-html'

const TAGS = [
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern',
  'use', 'symbol', 'title', 'desc', 'text', 'tspan', 'textPath', 'style', 'filter',
  'feGaussianBlur', 'feOffset', 'feBlend', 'feColorMatrix', 'feFlood', 'feComposite', 'feMerge', 'feMergeNode', 'feDropShadow',
  'image', 'marker',
]

const ATTRS = [
  'id', 'class', 'style', 'xmlns', 'xmlns:xlink', 'version', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'd', 'points', 'transform', 'fill', 'fill-opacity', 'fill-rule', 'clip-rule',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-opacity', 'opacity', 'clip-path', 'mask', 'filter', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits',
  'gradientTransform', 'spreadMethod', 'patternUnits', 'patternContentUnits', 'patternTransform', 'clipPathUnits',
  'maskUnits', 'maskContentUnits', 'preserveAspectRatio', 'href', 'xlink:href', 'font-family', 'font-size', 'font-weight',
  'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing', 'dx', 'dy', 'startOffset', 'display', 'visibility',
  'stdDeviation', 'in', 'in2', 'result', 'mode', 'values', 'type', 'operator', 'flood-color', 'flood-opacity',
  'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'color', 'enable-background', 'xml:space', 'data-name',
]

const SAFE_HREF = /^(#[\w.:-]+|data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=\s]+)$/

export function sanitizeSvg(input: string): string {
  const clean = sanitizeHtml(input, {
    allowedTags: TAGS,
    allowedAttributes: { '*': ATTRS },
    // data: only - and SAFE_HREF below narrows that to data:image rasters.
    allowedSchemes: ['data'],
    allowProtocolRelative: false,
    // <style> is needed for real-world exported logos (Illustrator emits
    // class-based styles); its contents are scrubbed below.
    allowVulnerableTags: true,
    parser: { xmlMode: true, lowerCaseTags: false, lowerCaseAttributeNames: false } as any,
    exclusiveFilter: frame => (frame.tag === 'image' || frame.tag === 'use') && !SAFE_HREF.test(String(frame.attribs.href || frame.attribs['xlink:href'] || '')),
    transformTags: {
      '*': (tagName, attribs) => {
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(attribs)) {
          const val = String(v)
          if ((k === 'href' || k === 'xlink:href') && !SAFE_HREF.test(val)) continue
          if (/url\(\s*['"]?\s*(?!#)/i.test(val) || /javascript:|expression\(/i.test(val)) continue
          out[k] = val
        }
        return { tagName, attribs: out }
      },
    },
  })
  return clean
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<style([^>]*)>([\s\S]*?)<\/style>/g, (_, attrs, css: string) => `<style${attrs}>${scrubCss(css)}</style>`)
    .trim()
}

/** Remove @import, non-fragment url(...), expression() and javascript: from CSS. */
function scrubCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi, 'none')
    .replace(/expression\s*\(/gi, '(')
    .replace(/javascript:/gi, '')
    .replace(/<\/?[a-z]/gi, '')
}
