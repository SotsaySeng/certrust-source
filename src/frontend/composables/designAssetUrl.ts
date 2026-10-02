// Kept apart from useDesignEngine: importing that module on the server loads
// the qrcode/pngjs stream code, which crashes on Cloudflare Workers.

/** Absolute URL for an image src stored in a design (/uploads/... is on the API origin). */
export function designAssetUrl(src: string | null | undefined): string {
  if (!src) {
    return ''
  }
  if (src.startsWith('/uploads/')) {
    const base = String(useRuntimeConfig().public.apiUrl || '').replace(/\/$/, '')
    return `${base}${src}`
  }
  return src
}
