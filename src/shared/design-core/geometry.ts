/**
 * Parametric shapes and frames, drawn inside a w x h box (local coords).
 * Everything here is recolourable, which is what lets a template follow an
 * organization's brand colours instead of baking colours into images.
 */
import type { FrameStyle, ShapeKind } from './types'

const f = (n: number) => (Math.round(n * 100) / 100).toString()

function polygon(points: Array<[number, number]>): string {
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`
}

/** Regular star / sunburst points fitted to the box (ellipse radii). */
function radial(w: number, h: number, n: number, inner: number, rotate = -Math.PI / 2): string {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n * 2; i++) {
    const a = rotate + (i * Math.PI) / n
    const r = i % 2 === 0 ? 1 : inner
    pts.push([w / 2 + Math.cos(a) * (w / 2) * r, h / 2 + Math.sin(a) * (h / 2) * r])
  }
  return polygon(pts)
}

export interface ShapeParts {
  /** Main path(s), drawn with fill/stroke. */
  main: string
  /** Secondary parts drawn behind the main shape with fill2 (ribbon tails). */
  back?: string
}

export function shapePath(shape: ShapeKind, w: number, h: number, opts: { radius?: number, points?: number } = {}): ShapeParts {
  switch (shape) {
    case 'rect': {
      const r = Math.max(0, Math.min(opts.radius ?? 0, w / 2, h / 2))
      if (!r) {
        return { main: `M0 0H${f(w)}V${f(h)}H0Z` }
      }
      return { main: `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z` }
    }
    case 'ellipse':
      return { main: `M0 ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 1 0 ${f(w)} ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 1 0 0 ${f(h / 2)}Z` }
    case 'triangle':
      return { main: polygon([[w / 2, 0], [w, h], [0, h]]) }
    case 'diamond':
      return { main: polygon([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]) }
    case 'star':
      return { main: radial(w, h, Math.max(3, opts.points ?? 5), 0.45) }
    case 'sunburst':
      return { main: radial(w, h, Math.max(8, opts.points ?? 24), 0.88) }
    case 'hexagon':
      return { main: polygon([[w / 2, 0], [w, h * 0.25], [w, h * 0.75], [w / 2, h], [0, h * 0.75], [0, h * 0.25]]) }
    case 'shield':
      return { main: `M${f(w * 0.5)} 0C${f(w * 0.68)} ${f(h * 0.08)} ${f(w * 0.86)} ${f(h * 0.1)} ${f(w)} ${f(h * 0.1)}V${f(h * 0.5)}C${f(w)} ${f(h * 0.76)} ${f(w * 0.74)} ${f(h * 0.9)} ${f(w * 0.5)} ${f(h)}C${f(w * 0.26)} ${f(h * 0.9)} 0 ${f(h * 0.76)} 0 ${f(h * 0.5)}V${f(h * 0.1)}C${f(w * 0.14)} ${f(h * 0.1)} ${f(w * 0.32)} ${f(h * 0.08)} ${f(w * 0.5)} 0Z` }
    case 'ribbon': {
      // Band bowing upward, with notched tails behind both ends.
      const main = `M${f(w * 0.12)} ${f(h * 0.3)}Q${f(w * 0.5)} ${f(-h * 0.05)} ${f(w * 0.88)} ${f(h * 0.3)}V${f(h * 0.72)}Q${f(w * 0.5)} ${f(h * 0.37)} ${f(w * 0.12)} ${f(h * 0.72)}Z`
      const back = polygon([[w * 0.16, h * 0.44], [0, h * 0.5], [w * 0.06, h * 0.7], [0, h * 0.9], [w * 0.16, h * 0.84]])
        + polygon([[w * 0.84, h * 0.44], [w, h * 0.5], [w * 0.94, h * 0.7], [w, h * 0.9], [w * 0.84, h * 0.84]])
      return { main, back }
    }
    case 'banner': {
      const main = `M${f(w * 0.1)} ${f(h * 0.1)}H${f(w * 0.9)}V${f(h * 0.7)}H${f(w * 0.1)}Z`
      const back = polygon([[w * 0.14, h * 0.3], [0, h * 0.3], [w * 0.06, h * 0.6], [0, h * 0.9], [w * 0.14, h * 0.9]])
        + polygon([[w * 0.86, h * 0.3], [w, h * 0.3], [w * 0.94, h * 0.6], [w, h * 0.9], [w * 0.86, h * 0.9]])
      return { main, back }
    }
  }
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`
}

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  if (!rr) {
    return rectPath(x, y, w, h)
  }
  return `M${f(x + rr)} ${f(y)}H${f(x + w - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w)} ${f(y + rr)}V${f(y + h - rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + w - rr)} ${f(y + h)}H${f(x + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x)} ${f(y + h - rr)}V${f(y + rr)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + rr)} ${f(y)}Z`
}

/**
 * Point and outward normal at arc length `t` along a rounded rectangle
 * (inset c from the box, corner radius r), travelling clockwise from the
 * top-left corner's end.
 */
function roundedRectAt(w: number, h: number, c: number, r: number, t: number): [number, number, number, number] {
  const lx = w - 2 * c - 2 * r
  const ly = h - 2 * c - 2 * r
  const arc = (Math.PI * r) / 2
  // Point on a corner arc around (cx, cy) at angle a, with its outward normal.
  const arcPoint = (cx: number, cy: number, a: number): [number, number, number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a), Math.sin(a)]
  const sides: Array<{ len: number, at: (u: number) => [number, number, number, number] }> = [
    { len: lx, at: u => [c + r + u, c, 0, -1] },
    { len: arc, at: u => arcPoint(w - c - r, c + r, -Math.PI / 2 + u / r) },
    { len: ly, at: u => [w - c, c + r + u, 1, 0] },
    { len: arc, at: u => arcPoint(w - c - r, h - c - r, u / r) },
    { len: lx, at: u => [w - c - r - u, h - c, 0, 1] },
    { len: arc, at: u => arcPoint(c + r, h - c - r, Math.PI / 2 + u / r) },
    { len: ly, at: u => [c, h - c - r - u, -1, 0] },
    { len: arc, at: u => arcPoint(c + r, c + r, Math.PI + u / r) },
  ]
  for (const side of sides) {
    if (t <= side.len) {
      return side.at(t)
    }
    t -= side.len
  }
  return sides[0].at(0)
}

/**
 * Sinusoidal strands following a rounded rectangle at inset `c` - the
 * interlaced "guilloche" border of banknotes and formal certificates. The
 * wavelength is adjusted so a whole number of waves fits the perimeter and
 * the strand closes without a seam.
 */
function perimeterWave(w: number, h: number, c: number, amp: number, wavelength: number, phase: number): string {
  const r = Math.max(amp * 1.6, 1)
  const perimeter = 2 * (w - 2 * c - 2 * r) + 2 * (h - 2 * c - 2 * r) + 2 * Math.PI * r
  if (perimeter <= 0) {
    return ''
  }
  const waves = Math.max(4, Math.round(perimeter / wavelength))
  const wl = perimeter / waves
  const steps = waves * 16
  let d = ''
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * perimeter
    const [x, y, nx, ny] = roundedRectAt(w, h, c, r, t)
    const off = Math.sin((t / wl) * Math.PI * 2 + phase) * amp
    d += `${i ? 'L' : 'M'}${f(x + nx * off)} ${f(y + ny * off)}`
  }
  return `${d}Z`
}

export interface FramePart {
  d: string
  /** 'stroke' parts are drawn with stroke width sw; 'fill' parts filled. */
  mode: 'stroke' | 'fill'
  sw?: number
  color: 1 | 2
}

export function framePaths(style: FrameStyle, w: number, h: number, t: number): FramePart[] {
  switch (style) {
    case 'classic':
      return [
        { d: rectPath(t * 0.2, t * 0.2, w - t * 0.4, h - t * 0.4), mode: 'stroke', sw: t * 0.3, color: 1 },
        { d: rectPath(t * 0.8, t * 0.8, w - t * 1.6, h - t * 1.6), mode: 'stroke', sw: Math.max(1, t * 0.08), color: 2 },
      ]
    case 'double':
      return [
        { d: rectPath(t * 0.15, t * 0.15, w - t * 0.3, h - t * 0.3), mode: 'stroke', sw: t * 0.15, color: 1 },
        { d: rectPath(t * 0.75, t * 0.75, w - t * 1.5, h - t * 1.5), mode: 'stroke', sw: t * 0.15, color: 1 },
      ]
    case 'guilloche': {
      const c = t / 2
      const amp = t * 0.34
      const wl = t * 1.1
      // Edge lines follow the strands' rounded corners (radius amp * 1.6).
      const r = Math.max(amp * 1.6, 1)
      const outer = c - t * 0.46
      const inner = c + t * 0.46
      const parts: FramePart[] = [
        { d: roundedRectPath(outer, outer, w - 2 * outer, h - 2 * outer, r + t * 0.46), mode: 'stroke', sw: Math.max(1, t * 0.06), color: 1 },
        { d: roundedRectPath(inner, inner, w - 2 * inner, h - 2 * inner, r - t * 0.46), mode: 'stroke', sw: Math.max(1, t * 0.06), color: 1 },
      ]
      for (let k = 0; k < 6; k++) {
        parts.push({ d: perimeterWave(w, h, c, amp, wl, (k * Math.PI) / 3), mode: 'stroke', sw: Math.max(0.6, t * 0.035), color: k % 2 ? 2 : 1 })
      }
      return parts
    }
    case 'corners': {
      const L = t * 3
      const i = t * 0.5
      const s = Math.max(1, t * 0.18)
      const corner = (cx: number, cy: number, sx: number, sy: number) =>
        `M${f(cx + sx * i)} ${f(cy + sy * (i + L))}V${f(cy + sy * i)}H${f(cx + sx * (i + L))}`
        + `M${f(cx + sx * (i + t * 0.6))} ${f(cy + sy * (i + L * 0.7))}V${f(cy + sy * (i + t * 0.6))}H${f(cx + sx * (i + L * 0.7))}`
      const d = corner(0, 0, 1, 1) + corner(w, 0, -1, 1) + corner(w, h, -1, -1) + corner(0, h, 1, -1)
      const dots = [[0, 0, 1, 1], [w, 0, -1, 1], [w, h, -1, -1], [0, h, 1, -1]]
        .map(([cx, cy, sx, sy]) => {
          const x = cx + sx * (i + t * 1.25)
          const y = cy + sy * (i + t * 1.25)
          const r = t * 0.22
          return `M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)}Z`
        })
        .join('')
      return [
        { d: rectPath(i * 0.4, i * 0.4, w - i * 0.8, h - i * 0.8), mode: 'stroke', sw: Math.max(0.75, t * 0.05), color: 2 },
        { d, mode: 'stroke', sw: s, color: 1 },
        { d: dots, mode: 'fill', color: 1 },
      ]
    }
    case 'deco': {
      const a = t * 0.2
      const b = t * 0.7
      const step = t * 0.9
      const stepped = (o: number) =>
        `M${f(o + step)} ${f(o)}H${f(w - o - step)}V${f(o + step * 0.5)}H${f(w - o - step * 0.5)}V${f(o + step)}H${f(w - o)}`
        + `V${f(h - o - step)}H${f(w - o - step * 0.5)}V${f(h - o - step * 0.5)}H${f(w - o - step)}V${f(h - o)}`
        + `H${f(o + step)}V${f(h - o - step * 0.5)}H${f(o + step * 0.5)}V${f(h - o - step)}H${f(o)}`
        + `V${f(o + step)}H${f(o + step * 0.5)}V${f(o + step * 0.5)}H${f(o + step)}Z`
      return [
        { d: rectPath(a, a, w - a * 2, h - a * 2), mode: 'stroke', sw: Math.max(1, t * 0.08), color: 2 },
        { d: stepped(b), mode: 'stroke', sw: t * 0.22, color: 1 },
      ]
    }
    case 'wave':
      return [
        { d: perimeterWave(w, h, t / 2, t * 0.25, t * 2, 0), mode: 'stroke', sw: Math.max(1, t * 0.12), color: 1 },
        { d: rectPath(t * 1.1, t * 1.1, w - t * 2.2, h - t * 2.2), mode: 'stroke', sw: Math.max(0.75, t * 0.05), color: 2 },
      ]
    case 'dots': {
      const r = t * 0.18
      const gap = t * 0.7
      const c = t / 2
      let d = ''
      const dot = (x: number, y: number) => {
        d += `M${f(x - r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x + r)} ${f(y)}A${f(r)} ${f(r)} 0 1 0 ${f(x - r)} ${f(y)}Z`
      }
      const nx = Math.max(2, Math.round((w - 2 * c) / gap))
      const ny = Math.max(2, Math.round((h - 2 * c) / gap))
      for (let k = 0; k <= nx; k++) {
        dot(c + (k * (w - 2 * c)) / nx, c)
        dot(c + (k * (w - 2 * c)) / nx, h - c)
      }
      for (let k = 1; k < ny; k++) {
        dot(c, c + (k * (h - 2 * c)) / ny)
        dot(w - c, c + (k * (h - 2 * c)) / ny)
      }
      return [
        { d, mode: 'fill', color: 1 },
        { d: rectPath(t * 1.1, t * 1.1, w - t * 2.2, h - t * 2.2), mode: 'stroke', sw: Math.max(0.75, t * 0.05), color: 2 },
      ]
    }
  }
}
