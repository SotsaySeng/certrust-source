import { createHash } from 'node:crypto'
import { issuerDisplayName } from './issuer-display-name'

/**
 * What anonymous callers (verification pages, employers, crawlers) may see
 * about a credential. The public endpoints used to return the entityService
 * row as-is, which carried the recipient profile's email and telephone to
 * anyone holding a credential URL. Everything public now goes through this
 * whitelist instead - add a field here only if it is safe to publish.
 *
 * Shape stays compatible with what the frontend already reads from
 * `rawCredential` (id, achievement.image.url/formats, recipient.name, ...).
 */

export function isCredentialPrivate(credential: any): boolean {
  return credential?.visibility === 'private' || credential?.issuedToMinor === true
}

export function issuerOrganizationStatus(issuer: any): { active: boolean; suspended: boolean; verificationStatus: string } {
  const org = issuer?.organization
  return {
    active: !org?.closedAt,
    suspended: !!org?.suspendedAt,
    verificationStatus: org?.verificationStatus || 'unverified',
  }
}

function publicImage(image: any) {
  if (!image?.url) return null
  const formats = image.formats
    ? Object.fromEntries(
        Object.entries(image.formats).map(([k, f]: [string, any]) => [k, { url: f?.url }])
      )
    : undefined
  return { url: image.url, alternativeText: image.alternativeText ?? null, formats }
}

/**
 * `fullView` is for the credential's own issuer or recipient: they see the
 * details of a private credential (still never contact details).
 */
export function toPublicCredential(credential: any, { fullView = false }: { fullView?: boolean } = {}) {
  if (!credential) return null
  const isPrivate = isCredentialPrivate(credential) && !fullView
  const issuer = credential.issuer
  const status = issuerOrganizationStatus(issuer)
  const achievement = credential.achievement

  return {
    id: credential.id,
    documentId: credential.documentId,
    credentialId: credential.credentialId,
    name: isPrivate ? null : credential.name,
    issuanceDate: credential.issuanceDate,
    expirationDate: credential.expirationDate ?? null,
    revoked: !!credential.revoked,
    revocationReason: credential.revoked ? credential.revocationReason ?? null : null,
    visibility: isCredentialPrivate(credential) ? 'private' : 'public',
    issuedToMinor: !!credential.issuedToMinor,
    // Private credentials only disclose that a valid credential exists and
    // who issued it; the achievement details and recipient stay hidden.
    description: isPrivate ? null : credential.description ?? null,
    achievement: achievement && !isPrivate
      ? {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description ?? null,
          image: publicImage(achievement.image),
          criteria: achievement.criteria ? { narrative: achievement.criteria.narrative } : null,
          alignment: achievement.alignment ?? [],
          skills: achievement.skills ?? [],
        }
      : null,
    issuer: issuer
      ? {
          id: issuer.id,
          name: issuerDisplayName(issuer),
          url: issuer.url || null,
          image: publicImage(issuer.image),
          ...status,
        }
      : null,
    recipient: !isPrivate && credential.recipient?.name ? { name: credential.recipient.name } : null,
    evidence: isPrivate
      ? []
      : (credential.evidence ?? []).map((ev: any) => ({
          name: ev.name,
          description: ev.description,
          narrative: ev.narrative,
          genre: ev.genre,
          audience: ev.audience,
        })),
  }
}

/**
 * OB 3.0 IdentityObject for a recipient email, hashed so the public document
 * does not disclose the address but someone who already knows it can confirm
 * the match. The salt is derived from the credential id so the output is
 * stable between requests.
 */
export function hashedEmailIdentifier(email: string, credentialId: string) {
  const salt = createHash('sha256').update(String(credentialId)).digest('hex').slice(0, 16)
  const identityHash = 'sha256$' + createHash('sha256').update(email.trim().toLowerCase() + salt).digest('hex')
  return { type: 'IdentityObject', identityHash, identityType: 'emailAddress', hashed: true, salt }
}

/**
 * The Open Badges document shown for a private credential to anyone but its
 * issuer or recipient: enough to confirm that a valid credential exists,
 * and who issued it, without describing the recipient or the achievement.
 */
export function privateOpenBadgeStub(credential: any, baseUrl: string) {
  return {
    id: credential.credentialId,
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    name: 'Private credential',
    issuer: {
      id: `${baseUrl}/api/profiles/${credential.issuer?.id}/issuer`,
      type: ['Profile'],
      name: issuerDisplayName(credential.issuer),
    },
    issuanceDate: credential.issuanceDate,
    validFrom: credential.issuanceDate,
    ...(credential.expirationDate ? { expirationDate: credential.expirationDate } : {}),
    credentialSubject: { type: ['AchievementSubject'] },
  }
}
