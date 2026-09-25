/**
 * Certificate service for generating visual certificates
 */

import sharp from 'sharp'
import { generateCertificateSvg } from '../../../utils/certificate-template'
import { issuerDisplayName } from '../../../utils/issuer-display-name'

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
      // Get the credential with all necessary relationships
      const credential = await strapi.entityService.findOne(
        'api::credential.credential',
        credentialId,
        {
          status: 'published',
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
    const svg = await this.generateCertificate(credentialId, { inlineImages: true })

    // Rasterise at 2x, crop to the certificate, then scale down so text
    // stays crisp after resampling.
    const scale = 2
    const certHeight = SHARE_HEIGHT - 60
    const certWidth = Math.round(certHeight * CERT_WIDTH / CERT_HEIGHT)
    const certificate = await sharp(Buffer.from(svg), { density: 72 * scale })
      .extract({ left: 0, top: 0, width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale })
      .resize(certWidth, certHeight)
      .png()
      .toBuffer()

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
    const svg = await this.generateCertificate(credentialId, { inlineImages: true })
    const scale = 2
    return sharp(Buffer.from(svg), { density: 72 * scale })
      .extract({ left: 0, top: 0, width: CERT_WIDTH * scale, height: CERT_HEIGHT * scale })
      .png()
      .toBuffer()
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