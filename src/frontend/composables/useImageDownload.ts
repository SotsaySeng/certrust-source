/**
 * Saves a certificate/badge image as a file people can open anywhere.
 *
 * The certificate endpoint returns SVG, and saving those bytes under a
 * ".png" name gave a file Preview/Photos refuse to open. SVGs are drawn onto
 * a canvas at 2x and saved as a real PNG; PNG/JPEG/WebP images are saved
 * as they are, with the matching extension.
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

async function svgToPng(svg: Blob): Promise<Blob> {
  const text = await svg.text()
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not render the certificate image'))
      img.src = url
    })

    // Prefer the SVG's own width/height; fall back to its viewBox.
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
    const viewBox = (doc.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
    const width = Number.parseFloat(doc.getAttribute('width') || '') || viewBox[2] || img.naturalWidth || 800
    const height = Number.parseFloat(doc.getAttribute('height') || '') || viewBox[3] || img.naturalHeight || 600

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * SVG_SCALE)
    canvas.height = Math.round(height * SVG_SCALE)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas is not available')
    }
    // White behind any transparent areas, so the PNG looks like the page.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png')
    })
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Downloads `url` as `<baseName>.png` (or .jpg/.webp for photos). */
export async function downloadImageFile(url: string, baseName: string): Promise<void> {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    throw new Error(`Image request failed (${response.status})`)
  }
  const blob = await response.blob()
  const type = (response.headers.get('content-type') || blob.type || '').split(';')[0].trim().toLowerCase()
  const name = safeFileName(baseName)

  if (type === 'image/svg+xml' || type.endsWith('+xml')) {
    saveBlob(await svgToPng(blob), `${name}.png`)
    return
  }
  saveBlob(blob, `${name}.${EXTENSIONS[type] || 'png'}`)
}
