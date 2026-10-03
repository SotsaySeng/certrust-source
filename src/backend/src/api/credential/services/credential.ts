/**
 * Credential service
 *
 * Wrapped in factories.createCoreService (like every sibling service in
 * this codebase - achievement, evidence, endorsement, organization,
 * profile all use it) instead of a bare `({ strapi }) => ({...})` object
 * literal. Without it, strapi.service('api::credential.credential') has
 * only the custom methods below - no default create/update/delete/
 * findOne/find/count - so the default core controller actions (used by
 * raw POST/PUT/DELETE /credentials, since credential.ts's controller
 * only overrides issue/verify/revoke/renew/find/batchIssue/etc., not
 * create/update/delete/findOne) crash with "strapi.service(...).create
 * is not a function" (@strapi/core/dist/core-api/controller/
 * collection-type.js). Confirmed directly: this broke every raw
 * POST /credentials, including the ones needed to validate this
 * rollout's tier-limit lifecycle hook via that path. This wrapper only
 * adds the missing default CRUD methods - none of the custom methods
 * below change.
 */

import type { IssueDesigns } from '../../../utils/issue-design'
import type { IssueEvent } from '../../../utils/issue-event'
import { attachEvidence } from '../../../utils/credential-evidence'
import { resolveIssueDesigns } from '../../../utils/issue-design'
import { randomUUID } from 'node:crypto'
import { factories } from '@strapi/strapi'
import { getNotificationProvider } from './notification-providers'
import { channelAlerts } from './channel-alerts/index'
import { credentialsIssuedTotal } from '../../../monitoring/metrics'
import { issuerDisplayName } from '../../../utils/issuer-display-name'

export default factories.createCoreService('api::credential.credential', ({ strapi }) => ({
  /**
   * Issue a new credential
   * @param {Object} achievement - The achievement to issue
   * @param {Object} recipient - The recipient profile
   * @param {Array} evidence - Optional evidence items
   * @param {string} expirationDate - Optional expiration date for the credential
   * @param {number} [actorId] - The users-permissions user id of the caller, for the audit log
   */
  /**
   * @param opts.designs certificate/badge designs to snapshot onto the
   *   credential (see utils/issue-design.ts). Omitted: the achievement's
   *   default designs are used - so scheduled issuance gets them too; a
   *   default that can't be used falls back to the classic certificate
   *   rather than failing the issuance.
   * @param opts.customFields cleaned custom attribute values.
   * @param opts.event the event it was issued for (its details are copied).
   */
  async issue(achievement, recipient, evidence = [], expirationDate = undefined, actorId = undefined, opts: { designs?: IssueDesigns, customFields?: Record<string, string>, event?: IssueEvent | null } = {}) {
    try {
      // Covers every path that issues (API, CSV, scheduled issuance).
      let organization: any = null
      if (achievement.creator?.id) {
        const creator: any = await strapi.db.query('api::profile.profile').findOne({
          where: { id: achievement.creator.id },
          populate: ['organization'],
        })
        if (creator?.organization?.suspendedAt) {
          throw new Error('This organisation is suspended pending review and cannot issue credentials')
        }
        organization = creator?.organization ?? null
      }

      let designs = opts.designs
      if (!designs) {
        try {
          designs = await resolveIssueDesigns(achievement, organization)
        }
        catch (err) {
          strapi.log.warn(`[credential.issue] Default design not used for achievement ${achievement.id}: ${(err as Error).message}`)
          designs = { certificate: null, badge: null, templateId: null }
        }
      }

      const recipientEntity = await this.findOrCreateRecipientProfile(recipient)


      // Generate a unique credential ID
      const credentialId = `urn:uuid:${this.generateUUID()}`

      // Credentials for minors are private by default (Terms s.6). CSV
      // uploads send strings, so accept yes/true/1 as well as booleans.
      const issuedToMinor = [true, 'true', 'yes', 'y', '1', 1].includes(
        typeof recipient?.issuedToMinor === 'string' ? recipient.issuedToMinor.trim().toLowerCase() : recipient?.issuedToMinor
      )

      // Prepare the credential payload for signing (excluding proof)
      const credentialPayload = {
        credentialId,
        name: achievement.name,
        description: achievement.description,
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        achievement: achievement.id,
        issuer: achievement.creator?.id,
        recipient: recipientEntity.id,
        issuanceDate: new Date(),
        revoked: false,
        // Not used by Strapi any more, but part of the signed payload's
        // format since launch, so it stays.
        publishedAt: new Date(),
        ...(expirationDate ? { expirationDate: new Date(expirationDate) } : {})
      }
      // Generate cryptographic proof (JWS)
      const proof = await this.generateProof(credentialPayload.issuer, credentialPayload)

      // Reserve a slot for this credential in the issuer's revocation
      // status list (StatusList2021), creating the list on first use.
      const revocationListService = strapi.service('api::revocation-list.revocation-list')
      const statusList = await revocationListService.getOrCreateActiveListForIssuer(credentialPayload.issuer)
      const statusListIndex = await revocationListService.assignNextIndex(statusList)

      // Create the credential.
      const credential = await strapi.documents('api::credential.credential').create({
        data: {
          credentialId,
          name: achievement.name,
          description: achievement.description,
          type: ['VerifiableCredential', 'OpenBadgeCredential'],
          achievement: achievement.id,
          issuer: achievement.creator?.id,
          recipient: recipientEntity.id,
          issuanceDate: new Date(),
          revoked: false,
          // Not in the signed payload: visibility is the recipient's to change.
          issuedToMinor,
          visibility: issuedToMinor || recipient?.visibility === 'private' ? 'private' : 'public',
          proof: [proof],
          statusList: { connect: [{ documentId: statusList.documentId }] },
          statusListIndex,
          ...(expirationDate ? { expirationDate: new Date(expirationDate) } : {}),
          // Design Studio: frozen copies of the designs + per-recipient values.
          certificateDesignSnapshot: designs.certificate,
          badgeDesignSnapshot: designs.badge,
          designTemplateId: designs.templateId,
          customFields: opts.customFields && Object.keys(opts.customFields).length ? opts.customFields : null,
          ...(opts.event ? { event: opts.event.id, eventSnapshot: opts.event.snapshot } : {}),
        },
      })

      // Add evidence if provided.
      if (evidence && evidence.length > 0) {
        for (const item of evidence) {
          if (item.name || item.description) {
            await strapi.documents('api::evidence.evidence').create({
              data: {
                name: item.name || 'Evidence',
                description: item.description || '',
                credential: credential.id,
              },
            })
          }
        }
      }

      // Return the full credential with populated relations
      const populatedCredential = await strapi.entityService.findOne(
        'api::credential.credential',
        credential.id,
        {
          populate: [
            'achievement',
            'issuer',
            'recipient',
            'proof'
          ],
        }
      )
      await attachEvidence(strapi, [populatedCredential as any])

      // Convert to Open Badge format
      const openBadgeService = strapi.service('api::credential.open-badge')
      const serializedCredential = await openBadgeService.serializeCredential(credential.id, { publicView: true })

      // Send notification email to recipient
      let emailSent = false
      let emailError = null

      try {
        if (recipientEntity.email) {
          const frontendUrl = strapi.config.get('frontend.url', 'http://localhost:3000')

          const notificationProvider = getNotificationProvider(strapi)
          await notificationProvider.sendCredentialIssued({
            to: recipientEntity.email,
            achievement,
            credential,
            frontendUrl,
            user: null,
            issuerName: issuerDisplayName(
              await strapi.db.query('api::profile.profile').findOne({
                where: { id: credentialPayload.issuer },
                populate: ['organization'],
              })
            ),
            supportEmail: strapi.config.get('custom.supportEmail', ''),
          })

          emailSent = true
        }
      } catch (e) {
        console.error('Failed to send notification email:', e)
        emailError = e.message
      }

      // Notify any registered webhook subscriptions. Best-effort: dispatch()
      // never throws (each delivery is individually caught/logged), so this
      // can't fail the issuance itself.
      const webhookDispatcher = strapi.service('api::webhook-subscription.dispatch')
      await webhookDispatcher.dispatch('credential.issued', {
        credentialId: credential.credentialId,
        achievementId: achievement.id,
        issuerId: credentialPayload.issuer,
        recipientId: recipientEntity.id,
      })

      // Record who issued this - see known-issues-and-dev-notes.md item 5
      // (this controller path disables the normal permission check).
      const auditLog = strapi.service('api::audit-log-entry.audit-log')
      await auditLog.record({
        action: 'credential.issue',
        entityType: 'credential',
        entityId: credential.id,
        actorId,
        metadata: { achievementId: achievement.id, recipientId: recipientEntity.id },
      })
      credentialsIssuedTotal.inc()

      // Fan out admin channel alerts (Slack/Teams/Discord) — best-effort, never throws
      const frontendUrl = strapi.config.get('frontend.url', 'http://localhost:3000')
      channelAlerts.sendCredentialIssued({
        credentialId: credential.credentialId,
        credentialUrl: `${frontendUrl}/credentials/${encodeURIComponent(credential.credentialId)}`,
        achievementName: (achievement as any).achievementType ?? (achievement as any).name ?? 'Unknown',
        recipientEmail: (recipientEntity as any).email ?? '',
      }).catch(() => { /* already logged inside channelAlerts */ })
      return {
        credential: populatedCredential,
        openBadge: serializedCredential,
        notification: {
          sent: emailSent,
          error: emailError
        }
      }
    } catch (error) {
      console.error('Error issuing credential:', error)
      throw error
    }
  },

  /**
   * Find or create the recipient profile for an incoming credential -
   * either an existing profile by id, an existing one by email, or a new
   * bare Recipient profile if neither exists yet. Shared by issue() and by
   * the profile data-portability service's import path.
   * @param {Object} recipient - `{ id }` or `{ email, name }`
   */
  async findOrCreateRecipientProfile(recipient) {
    let recipientEntity = null

    if (recipient.id && recipient.id !== 0) {
      recipientEntity = await strapi.entityService.findOne('api::profile.profile', recipient.id)
    } else if (recipient.email) {
      const existingRecipients = await strapi.entityService.findMany(
        'api::profile.profile',
        {
          filters: { email: recipient.email },
        }
      )

      if (existingRecipients && existingRecipients.length > 0) {
        recipientEntity = existingRecipients[0]
      } else {
        recipientEntity = await strapi.documents('api::profile.profile').create({
          data: {
            name: recipient.name,
            email: recipient.email,
            profileType: 'Recipient',
          },
        })
      }
    }

    if (!recipientEntity) {
      throw new Error('Unable to find or create recipient profile')
    }

    return recipientEntity
  },

  /**
   * Generate a random password
   * @returns {string} A random password
   */
  generateRandomPassword() {
    const length = 12
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
    let password = ''
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length)
      password += charset[randomIndex]
    }
    
    return password
  },

  /**
   * Get or create a default system issuer profile
   */
  async getDefaultIssuerId() {
    try {
      // Try to find a system issuer
      const existingIssuers = await strapi.entityService.findMany('api::profile.profile', {
        filters: { name: 'System Issuer' },
      })
      
      if (existingIssuers && existingIssuers.length > 0) {
        return existingIssuers[0].id
      }
      
      // Create a default system issuer.
      const systemIssuer = await strapi.documents('api::profile.profile').create({
        data: {
          name: 'System Issuer',
          profileType: 'Issuer',
        },
      })

      return systemIssuer.id
    } catch (error) {
      console.error('Error getting default issuer:', error)
      return null
    }
  },

  /**
   * Generate cryptographic proof for a credential, signed with the
   * issuer's own keypair (generated on first use - see
   * api::profile.issuer-keys). Throws rather than falling back to a fake
   * proof: an unsigned "signed" credential is worse than a failed issuance.
   * @param {string} issuerId - The ID of the issuer profile
   * @param {Object} credentialPayload - The credential payload
   */
  async generateProof(issuerId, credentialPayload) {
    const baseUrl = strapi.config.get('server.url', 'http://localhost:1337')
    const payload = { ...credentialPayload }
    delete payload.proof

    const issuerKeys = strapi.service('api::profile.issuer-keys')
    const { privateKey } = await issuerKeys.getOrCreateKeyPair(issuerId)

    const { SignJWT } = await import('jose')
    const jws = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(privateKey)

    return {
      type: "Ed25519Signature2020",
      created: new Date().toISOString(),
      verificationMethod: `${baseUrl}/api/profiles/${issuerId}/keys`,
      proofPurpose: "assertionMethod",
      jws
    }
  },

  /**
   * Generate a UUID v4
   * @returns {string} A UUID v4 string
   */
  generateUUID() {
    // Credential ids double as the public verification URL, so they must be
    // unguessable - Math.random() is not a CSPRNG.
    return randomUUID()
  },
}))