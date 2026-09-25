/**
 * Saves a certificate/badge image as a file people can open anywhere:
 * a PNG image, or a one-page PDF ready to print.
 *
 * The certificate endpoint returns SVG, and saving those bytes under a
 * ".png" name gave a file Preview/Photos refuse to open. SVGs are drawn onto
 * a canvas at 2x and saved as a real PNG; PNG/JPEG/WebP images are saved
 * as they are, with the matching extension. The PDF is written by hand
 * (a single page with the image embedded as JPEG) - no PDF library needed
 * for that.
 */

const SVG_SCALE = 2

function safeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120) || 'credential'
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function fetchImage(url: string): Promise<{ blob: Blob, type: string }> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status})`)
  }
  const blob = await response.blob()
  const type = (response.headers.get('content-type') || blob.type || '').split(';')[0].trim().toLowerCase()
  return { blob, type }
}

const isSvg = (type: string) => type === 'image/svg+xml' || type.endsWith('+xml')

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Could not render the certificate image'))
    img.src = src
  })
  return img
}

/** Draws the image onto a white canvas: SVGs at 2x, photos at their own size. */
async function toCanvas(blob: Blob, type: string): Promise<HTMLCanvasElement> {
  let width: number
  let height: number
  let src: string
  if (isSvg(type)) {
    const text = await blob.text()
    src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
    // Prefer the SVG's own width/height; fall back to its viewBox.
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
    const viewBox = (doc.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
    width = (Number.parseFloat(doc.getAttribute('width') || '') || viewBox[2] || 800) * SVG_SCALE
    height = (Number.parseFloat(doc.getAttribute('height') || '') || viewBox[3] || 600) * SVG_SCALE
  }
  else {
    src = URL.createObjectURL(blob)
    width = 0
    height = 0
  }

  try {
    const img = await loadImage(src)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width || img.naturalWidth)
    canvas.height = Math.round(height || img.naturalHeight)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas is not available')
    }
    // White behind any transparent areas, so the file looks like the page.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  }
  finally {
    URL.revokeObjectURL(src)
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), type, quality)
  })
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Downloads `url` as `<baseName>.png` (or .jpg/.webp for photos). */
export async function downloadImageFile(url: string, baseName: string): Promise<void> {
  const { blob, type } = await fetchImage(url)
  const name = safeFileName(baseName)
  if (isSvg(type)) {
    saveBlob(await canvasBlob(await toCanvas(blob, type), 'image/png'), `${name}.png`)
    return
  }
  saveBlob(blob, `${name}.${EXTENSIONS[type] || 'png'}`)
}

// --- PDF -------------------------------------------------------------------

// A4 in PDF points (1/72 inch), and the white margin around the image.
const A4_LONG = 841.89
const A4_SHORT = 595.28
const PDF_MARGIN = 28

/** PDF text string: plain ASCII in (), anything else as UTF-16BE hex. */
function pdfString(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return `(${value.replace(/[\\()]/g, m => `\\${m}`)})`
  }
  let hex = 'FEFF'
  for (let i = 0; i < value.length; i++) {
    hex += value.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase()
  }
  return `<${hex}>`
}

/**
 * One A4 page (landscape for wide images) with the JPEG centred and scaled
 * to fit inside the margins.
 */
function buildPdf(jpeg: Uint8Array, imageWidth: number, imageHeight: number, title: string): Blob {
  const landscape = imageWidth >= imageHeight
  const pageWidth = landscape ? A4_LONG : A4_SHORT
  const pageHeight = landscape ? A4_SHORT : A4_LONG
  const scale = Math.min((pageWidth - 2 * PDF_MARGIN) / imageWidth, (pageHeight - 2 * PDF_MARGIN) / imageHeight)
  const drawWidth = imageWidth * scale
  const drawHeight = imageHeight * scale
  const x = (pageWidth - drawWidth) / 2
  const y = (pageHeight - drawHeight) / 2
  const n = (v: number) => v.toFixed(2)

  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let length = 0
  const push = (chunk: string | Uint8Array) => {
    const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk
    parts.push(bytes)
    length += bytes.length
  }
  const object = (id: number, body: string) => {
    offsets[id] = length
    push(`${id} 0 obj\n${body}\nendobj\n`)
  }

  const content = `q ${n(drawWidth)} 0 0 ${n(drawHeight)} ${n(x)} ${n(y)} cm /Im0 Do Q`

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  object(1, '<< /Type /Catalog /Pages 2 0 R >>')
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(pageWidth)} ${n(pageHeight)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)
  offsets[4] = length
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  push(jpeg)
  push('\nendstream\nendobj\n')
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
  object(6, `<< /Title ${pdfString(title)} /Producer (Certrust) >>`)

  const xrefOffset = length
  let xref = `xref\n0 7\n0000000000 65535 f \n`
  for (let id = 1; id <= 6; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  }
  push(`${xref}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)

  return new Blob(parts, { type: 'application/pdf' })
}

/** Downloads `url` as `<baseName>.pdf`: one A4 page, ready to print. */
export async function downloadPdfFile(url: string, baseName: string): Promise<void> {
  const { blob, type } = await fetchImage(url)
  const canvas = await toCanvas(blob, type)
  const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.95)).arrayBuffer())
  const name = safeFileName(baseName)
  saveBlob(buildPdf(jpeg, canvas.width, canvas.height, baseName), `${name}.pdf`)
}
