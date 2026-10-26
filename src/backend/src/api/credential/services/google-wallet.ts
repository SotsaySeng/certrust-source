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
import { isCredentialPrivate } from '../../../utils/public-credential'
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
    const apiUrl = String(strapi.config.get('server.url', 'http://localhost:1337')).replace(/\/+$/, '')
    const id = encodeURIComponent(credential.credentialId)
    const pageUrl = `${frontendUrl}/credentials/${id}`
    // Google fetches images anonymously; private credentials' images are not public.
    const isPublic = !isCredentialPrivate(credential)
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
      header: text(credential.recipient?.name || name),
      logo: {
        sourceUri: {
          uri: isPublic && credential.badgeDesignSnapshot
            ? `${apiUrl}/api/credentials/${id}/badge?size=660`
            : `${frontendUrl}/android-chrome-512x512.png`,
        },
        contentDescription: text(name),
      },
      ...(isPublic && {
        heroImage: {
          sourceUri: { uri: `${apiUrl}/api/credentials/${id}/share-image` },
          contentDescription: text(name),
        },
      }),
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
