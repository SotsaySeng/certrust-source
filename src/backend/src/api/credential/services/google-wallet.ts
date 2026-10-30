/**
 * "Add to Google Wallet" for a credential.
 *
 * Google's no-API flow: the pass (a Generic object, plus its class) goes
 * inside a JWT signed with the service account's key, and the holder opens
 * https://pay.google.com/gp/v/save/<jwt>. Google creates the class and the
 * object on first save, so nothing here calls Google.
 *
 * Off until GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL and
 * GOOGLE_WALLET_PRIVATE_KEY are set (see docs/open-badges.md#wallets).
 *
 * ponytail: the saved pass is a snapshot - revoking a credential does not grey
 * it out in the wallet (its QR still opens the live page, which says revoked).
 * Upgrade path: on revoke, PATCH the object to state EXPIRED through the
 * Google Wallet REST API with the same service account.
 */

import { SignJWT, importPKCS8 } from 'jose'
import { issuerDisplayName } from '../../../utils/issuer-display-name'

const CLASS_SUFFIX = 'certrust_credential'

function config() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID?.trim()
  const email = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL?.trim()
  // The service-account JSON stores the key with literal "\n"s; env files keep them.
  const privateKey = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n').trim()
  return issuerId && email && privateKey ? { issuerId, email, privateKey } : null
}

const text = (value: string) => ({ defaultValue: { language: 'en', value } })
const day = (iso: string) => String(iso).slice(0, 10)

export default ({ strapi }) => ({
  isConfigured(): boolean {
    return !!config()
  },

  /** Pass object for a credential row (achievement/issuer/recipient populated). */
  buildObject(credential: any, issuerId: string) {
    const frontendUrl = String(strapi.config.get('frontend.url', 'http://localhost:3000')).replace(/\/+$/, '')
    const id = encodeURIComponent(credential.credentialId)
    const pageUrl = `${frontendUrl}/credentials/${id}`
    const name = credential.name || credential.achievement?.name || 'Credential'

    const textModulesData = [{ id: 'issued', header: 'Issued', body: day(credential.issuanceDate) }]
    if (credential.expirationDate) {
      textModulesData.push({ id: 'expires', header: 'Expires', body: day(credential.expirationDate) })
    }

    return {
      // Object ids allow only letters, digits, '.', '_' and '-'.
      id: `${issuerId}.${String(credential.credentialId).replace(/[^\w.-]/g, '_')}`,
      classId: `${issuerId}.${CLASS_SUFFIX}`,
      state: 'ACTIVE',
      cardTitle: text(issuerDisplayName(credential.issuer)),
      subheader: text(name),
      header: text(credential.recipientName || credential.recipient?.name || name),
      // A static file only: Google rejects the whole pass ("Image cannot be
      // loaded") when an image is slow, and the rendered certificate/badge
      // images take ~3 s. ponytail: no certificate picture on the pass; add
      // one back as a pre-rendered file (e.g. on R2) if it is wanted.
      logo: {
        sourceUri: { uri: `${frontendUrl}/android-chrome-512x512.png` },
        contentDescription: text(name),
      },
      hexBackgroundColor: '#1B2420',
      barcode: { type: 'QR_CODE', value: pageUrl },
      textModulesData,
      linksModuleData: { uris: [{ id: 'verify', uri: pageUrl, description: 'Verify this credential' }] },
      ...(credential.expirationDate && {
        validTimeInterval: { end: { date: new Date(credential.expirationDate).toISOString() } },
      }),
    }
  },

  /** The "Save to Google Wallet" link, or null when the feature is not configured. */
  async saveUrl(credential: any): Promise<string | null> {
    const cfg = config()
    if (!cfg) return null
    const frontendUrl = String(strapi.config.get('frontend.url', 'http://localhost:3000')).replace(/\/+$/, '')
    const key = await importPKCS8(cfg.privateKey, 'RS256')
    const jwt = await new SignJWT({
      origins: [frontendUrl],
      typ: 'savetowallet',
      payload: {
        genericClasses: [{ id: `${cfg.issuerId}.${CLASS_SUFFIX}` }],
        genericObjects: [this.buildObject(credential, cfg.issuerId)],
      },
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(cfg.email)
      .setAudience('google')
      .setIssuedAt()
      .sign(key)
    return `https://pay.google.com/gp/v/save/${jwt}`
  },
})
