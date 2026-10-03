/**
 * Certificate service for generating visual certificates
 */

import sharp from 'sharp'
import { PDFDocument } from 'pdf-lib'
import type { Design } from '../../../utils/design-core'
import { validateDesign } from '../../../utils/design-core'
import { renderDesignPdf, renderDesignPng, renderDesignSvg } from '../../../utils/design-render'
import { credentialPlaceholderData, orgCustomAttributes } from '../../../utils/issue-design'
import { generateCertificateSvg } from '../../../utils/certificate-template'
import { issuerDisplayName } from '../../../utils/issuer-display-name'

/** A credential's frozen design (if it was issued with one), validated. */
function snapshotOf(value: unknown): Design | null {
  if (!value || typeof value !== 'object') return null
  const r = validateDesign(value)
  return r.ok ? (r.design as Design) : null
}

// Link-preview image size recommended by Facebook (1.91:1); WhatsApp,
// LinkedIn and X use the same og:image.
const SHARE_WIDTH = 1200
const SHARE_HEIGHT = 630
// The template's canvas is 800x650 but the certificate itself is the top
// 800x600; the last 50px are empty.
const CERT_WIDTH = 800
const CERT_HEIGHT = 600

/**
 * librsvg (inside sharp) never fetches remote <image href>, so a badge
 * image has to be inlined as a data URI or the preview renders without it.
 * Returns null on any failure: the template then draws its trophy fallback.
 */
async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || !type.startsWith('image/')) return null
    const body = Buffer.from(await res.arrayBuffer())
    if (body.length > 2 * 1024 * 1024) return null
    return `data:${type};base64,${body.toString('base64')}`
  } catch {
    return null
  }
}

export default ({ strapi }) => ({
  /**
   * Everything a Design Studio render needs: the credential with its
   * snapshots and relations, and its placeholder values. `certificate` /
   * `badge` are null for credentials issued before the Design Studio (or
   * without a design) - callers fall back to the classic template.
   */
  async loadDesignContext(credentialId: number | string) {
    const credential: any = await strapi.entityService.findOne('api::credential.credential', credentialId, {
      populate: ['achievement', 'issuer', 'issuer.organization', 'recipient'],
    } as any)
    if (!credential) throw new Error('Credential not found')
    const certificate = snapshotOf(credential.certificateDesignSnapshot)
    const badge = snapshotOf(credential.badgeDesignSnapshot)
    // Placeholder data is only needed for a Design Studio render; legacy
    // credentials skip the custom-attribute lookup.
    const data = certificate || badge
      ? credentialPlaceholderData(credential, await orgCustomAttributes(credential.issuer?.organization?.id ?? null))
      : {}
    return { credential, data, certificate, badge }
  },

  /**
   * Generate a certificate for a credential
   * @param {number|string} credentialId - The ID of the credential
   * @param {object} [options.inlineImages] - embed the badge image as a data
   *   URI (needed when rasterising the SVG server-side)
   * @returns {string} The SVG certificate
   */
  async generateCertificate(
    credentialId: number | string,
    options: { inlineImages?: boolean } = {}
  ): Promise<string> {
    try {
      const ctx = await this.loadDesignContext(credentialId)
      if (ctx.certificate) {
        return (await renderDesignSvg(ctx.certificate, { data: ctx.data })).svg
      }

      // Get the credential with all necessary relationships
      const credential = await strapi.entityService.findOne(
        'api::credential.credential',
        credentialId,
        {
          populate: [
            'achievement',
            'achievement.image',
            'issuer',
            'issuer.image',
            'issuer.organization',
            'recipient'
          ]
        }
      )

      if (!credential) {
        throw new Error('Credential not found')
      }

      // Get required data
      const recipientName = credential.recipient?.name || 'Recipient'
      const achievementName = credential.achievement?.name || credential.name || 'Achievement'
      // Organisation name, not the admin's username (see issuer-display-name.ts)
      const issuerName = issuerDisplayName(credential.issuer as any, 'Issuer')
      const issueDate = credential.issuanceDate
      
      // Determine badge image URL
      const baseUrl = strapi.config.get('server.url', 'http://localhost:1337')
      let badgeImageUrl = null

      if (credential.achievement?.image?.url) {
        badgeImageUrl = credential.achievement.image.url.startsWith('http')
          ? credential.achievement.image.url
          : `${baseUrl}${credential.achievement.image.url}`
        if (options.inlineImages) {
          badgeImageUrl = await fetchAsDataUri(badgeImageUrl)
        }
      }

      // The certificate's QR code links here - same self-hosting-aware
      // frontend.url config credential.ts already uses for notification
      // emails, not a hardcoded production URL.
      const frontendUrl = strapi.config.get('frontend.url', 'http://localhost:3000')
      const verifyUrl = `${frontendUrl}/credentials/${encodeURIComponent(credential.credentialId)}`

      // Generate the certificate SVG
      return await generateCertificateSvg({
        recipientName,
        achievementName,
        issuerName,
        issueDate,
        credentialId: credential.credentialId,
        badgeImageUrl,
        verifyUrl
      })
    } catch (error) {
      console.error('Error generating certificate:', error)
      throw error
    }
  },

  /**
   * Link-preview image (og:image) for Facebook, WhatsApp and other apps that
   * unfurl a shared credential link: the certificate centred on a
   * 1200x630 canvas, as JPEG (WhatsApp drops preview images over ~300 KB).
   * @param {number|string} credentialId - The ID of the credential
   * @returns {Buffer} JPEG bytes
   */
  async generateShareImage(credentialId: number | string): Promise<Buffer> {
    const ctx = await this.loadDesignContext(credentialId)
    let certificate: Buffer
    let certWidth: number
    let certHeight: number
    if (ctx.certificate) {
      // Fit the design (any size/orientation) inside the preview's margins.
      const maxW = SHARE_WIDTH - 60
      const maxH = SHARE_HEIGHT - 60
      const s = Math.min(maxW / ctx.certificate.page.width, maxH / ctx.certificate.page.height)
      certWidth = Math.round(ctx.certificate.page.width * s)
      certHeight = Math.round(ctx.certificate.page.height * s)
      certificate = await sharp(await renderDesignPng(ctx.certificate, { data: ctx.data, width: certWidth * 2 }))
        .resize(certWidth, certHeight)
        .png()
        .toBuffer()
    }
    else {
      const svg = await this.generateCertificate(credentialId, { inlineImages: true })
      // Rasterise at 2x, crop to the certificate, then scale down so text
      // stays crisp after resampling.
      const scale = 2
      certHeight = SHARE_HEIGHT - 60
      certWidth = Math.round(certHeight * CERT_WIDTH / CERT_HEIGHT)
      certificate = await sharp(Buffer.from(svg), { density: 72 * scale })
        .extract({ left: 0, top: 0, width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale })
        .resize(certWidth, certHeight)
        .png()
        .toBuffer()
    }

    return sharp({
      create: { width: SHARE_WIDTH, height: SHARE_HEIGHT, channels: 3, background: '#eef1ef' },
    })
      .composite([{
        input: certificate,
        left: Math.round((SHARE_WIDTH - certWidth) / 2),
        top: Math.round((SHARE_HEIGHT - certHeight) / 2),
      }])
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer()
  },

  /**
   * The certificate as a PNG, for downloading and printing: the top
   * 800x600 of the template (the canvas has 50px of empty space below)
   * rendered at 2x, with the badge image inlined so it is not missing the
   * way it would be when a browser rasterises the SVG itself.
   * @param {number|string} credentialId - The ID of the credential
   * @returns {Buffer} PNG bytes (1600x1200)
   */
  async generateCertificatePng(credentialId: number | string): Promise<Buffer> {
    const ctx = await this.loadDesignContext(credentialId)
    if (ctx.certificate) {
      // ~200 DPI for A4/Letter: sharp enough to print from the PNG too.
      return renderDesignPng(ctx.certificate, { data: ctx.data, width: Math.round(ctx.certificate.page.width * 2) })
    }
    const svg = await this.generateCertificate(credentialId, { inlineImages: true })
    const scale = 2
    return sharp(Buffer.from(svg), { density: 72 * scale })
      .extract({ left: 0, top: 0, width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale })
      .png()
      .toBuffer()
  },

  /**
   * Print PDF: Design Studio certificates get an exact A4/US Letter page at
   * 300 DPI; classic certificates are placed on an A4 landscape page.
   */
  async generateCertificatePdf(credentialId: number | string): Promise<Buffer> {
    const ctx = await this.loadDesignContext(credentialId)
    if (ctx.certificate) return renderDesignPdf(ctx.certificate, { data: ctx.data })
    const png = await this.generateCertificatePng(credentialId)
    const pdf = await PDFDocument.create()
    pdf.setProducer('Certrust')
    const [pw, ph] = [841.89, 595.28]
    const page = pdf.addPage([pw, ph])
    const img = await pdf.embedPng(png)
    const s = Math.min((pw - 48) / img.width, (ph - 48) / img.height)
    page.drawImage(img, { x: (pw - img.width * s) / 2, y: (ph - img.height * s) / 2, width: img.width * s, height: img.height * s })
    return Buffer.from(await pdf.save())
  },

  /**
   * The credential's badge as a PNG (Design Studio badge design), or null
   * when it was issued without one.
   */
  async generateBadgePng(credentialId: number | string, width = 600): Promise<Buffer | null> {
    const ctx = await this.loadDesignContext(credentialId)
    if (!ctx.badge) return null
    return renderDesignPng(ctx.badge, { data: ctx.data, width, transparent: true })
  },

  async generateBadgeSvg(credentialId: number | string): Promise<string | null> {
    const ctx = await this.loadDesignContext(credentialId)
    if (!ctx.badge) return null
    return (await renderDesignSvg(ctx.badge, { data: ctx.data })).svg
  },

  /**
   * Generate a data URI for the certificate SVG
   * @param {number|string} credentialId - The ID of the credential
   * @returns {string} The data URI
   */
  async generateCertificateDataUri(credentialId: number | string): Promise<string> {
    try {
      const svg = await this.generateCertificate(credentialId)
      // Convert to a data URI
      const svgBase64 = Buffer.from(svg).toString('base64')
      return `data:image/svg+xml;base64,${svgBase64}`
    } catch (error) {
      console.error('Error generating certificate data URI:', error)
      throw error
    }
  }
}) 