/**
 * credential controller
 */

import { factories } from '@strapi/strapi'
import crypto from 'crypto'
import { credentialsRevokedTotal } from '../../../monitoring/metrics'
import { channelAlerts } from '../services/channel-alerts/index'
import { toPublicCredential, isCredentialPrivate } from '../../../utils/public-credential'
import { optionalUser } from '../../../utils/optional-user'

// Define types to help with type assertions
interface Achievement {
  id: any
  name: string
  description: string
  image?: any
  creator?: {
    id: any
  }
}

interface Profile {
  id: any
  name: string
}

interface Credential {
  id: any
  credentialId: string
  name: string
  description: string
  issuanceDate: Date
  expirationDate?: Date
  revoked: boolean
  revocationReason?: string
  achievement?: Achievement
  issuer?: Profile
  recipient?: Profile
  evidence?: any[]
  proof?: any[]
}

/** Look a credential up by its public credentialId (or documentId). */
async function findPublicCredential(strapi: any, id: string) {
  if (!id) return null
  const populate = [
    'achievement', 'achievement.image', 'achievement.criteria',
    'issuer', 'issuer.image', 'issuer.organization', 'recipient', 'evidence',
  ]
  const [byCredentialId] = await strapi.entityService.findMany('api::credential.credential', {
    filters: { credentialId: id },
    status: 'published',
    populate,
    limit: 1,
  }) as any[]
  if (byCredentialId) return byCredentialId
  const [byDocumentId] = await strapi.entityService.findMany('api::credential.credential', {
    filters: { documentId: id },
    status: 'published',
    populate,
    limit: 1,
  }) as any[]
  return byDocumentId ?? null
}

/**
 * True when the user is the issuer (owns the issuing profile or belongs
 * to its organisation) or the recipient (owns the recipient profile or
 * signed up with its email). Deliberately stricter than
 * multi-tenancy.userOwnsProfile, which treats unowned profiles - every
 * auto-created recipient profile - as open to any logged-in user.
 */
async function canManageCredential(strapi: any, user: any, credential: any): Promise<boolean> {
  if (!user) return false
  const load = (id: number) => id
    ? strapi.entityService.findOne('api::profile.profile', id, {
        populate: { owner: true, organization: { populate: ['members'] } },
      }) as Promise<any>
    : Promise.resolve(null)
  const [issuer, recipient] = await Promise.all([load(credential.issuer?.id), load(credential.recipient?.id)])
  if (issuer?.owner?.id === user.id) return true
  if (issuer?.organization?.members?.some((m: any) => m.id === user.id)) return true
  if (recipient?.owner?.id === user.id) return true
  if (recipient?.email && user.email && recipient.email.toLowerCase() === String(user.email).toLowerCase()) return true
  return false
}

export default factories.createCoreController('api::credential.credential', ({ strapi }) => ({
  /**
   * Custom method to issue a new Open Badge credential
   */
  async issue(ctx) {
    try {
      strapi.log.debug('[credential.issue] Request received:', ctx.request.body)

      const { data } = ctx.request.body
      if (!data) {
        return ctx.badRequest('Missing required data')
      }

      const { achievementId, recipientId, evidence = [] } = data
      
      if (!achievementId) {
        return ctx.badRequest('Achievement ID is required')
      }

      // Find the achievement and ensure it's published
      const achievements = await strapi.entityService.findMany('api::achievement.achievement', {
        status: 'published',
        filters: {
          id: achievementId,
        },
        populate: { creator: { populate: ['organization'] }, image: true },
      });

      if (!achievements || achievements.length === 0) {
        return ctx.notFound('Published achievement not found');
      }
      const achievement = achievements[0];

      if (!achievement) {
        return ctx.notFound('Achievement not found')
      }
      if ((achievement as any).creator?.organization?.suspendedAt) {
        return ctx.forbidden('Your organisation is suspended pending review and cannot issue credentials')
      }

      // Add recipient data if provided in the request
      const recipientData = data.recipient || {}
      const recipient = {
        id: recipientId || 0,
        ...recipientData
      }

      // Support expirationDate at top-level or in recipient
      const expirationDate = data.expirationDate || recipient.expirationDate || undefined

      strapi.log.debug('[credential.issue] Processing with data:', { 
        achievementId, 
        recipientId: recipient.id,
        recipientName: recipient.name
      })

      // Create the credential
      const credential = await strapi.service('api::credential.credential').issue(
        achievement,
        recipient,
        evidence,
        expirationDate,
        ctx.state.user?.id
      )

      return credential
    } catch (error) {
      // strapi.log.error only prints its first argument - see the note in
      // bootstrap/seed-data.ts for why the error is interpolated in-message.
      strapi.log.error(`[credential.issue] Error: ${error.message}`)
      return ctx.badRequest(error.message || 'Failed to issue credential')
    }
  },

  /**
   * Verify a credential
   * @param {Object} ctx - The context object
   */
  async verify(ctx) {
    try {
      const { id } = ctx.params

      if (!id) {
        return ctx.badRequest('Credential ID is required')
      }

      try {
        // Anonymous route; a signed-in issuer or recipient still gets the
        // full view of a private credential, and the controls for it.
        const credential = await findPublicCredential(strapi, id)
        if (!credential) {
          return ctx.notFound('Credential not found')
        }
        const user = await optionalUser(strapi, ctx)
        const canManage = !!user && await canManageCredential(strapi, user, credential)
        const verificationService = strapi.service('api::credential.verification')
        const result = await verificationService.verifyCredential(credential.credentialId, { fullView: canManage })
        return { ...result, viewer: { canManage } }
      } catch (error) {
        // The old fallback here re-queried and returned the unsanitised row
        // (recipient email/telephone included). Not found is the answer.
        return ctx.notFound('Credential not found')
      }
    } catch (error) {
      console.error('Error verifying credential:', error)
      return ctx.badRequest(error.message || 'Failed to verify credential')
    }
  },
  
  /**
   * Revoke a credential
   */
  async revoke(ctx) {
    try {
      const { id } = ctx.params
      const { reason } = ctx.request.body

      if (!id) {
        return ctx.badRequest('Credential ID is required')
      }

      // status: 'published' - entityService.findOne resolves the given id
      // to its documentId and re-fetches via the Document Service, which
      // defaults to the draft row when status is unset; a credential
      // that's ever been through a partial PUT update not re-specifying
      // `issuer` would otherwise look issuer-less here and break the
      // ownership check below (see the equivalent, more detailed comment
      // in src/policies/is-in-organization.ts).
      const existing: any = await strapi.entityService.findOne('api::credential.credential', id, {
        status: 'published',
        populate: ['statusList', 'issuer'],
      })

      if (!existing) {
        return ctx.notFound('Credential not found')
      }

      // Only the issuer profile owner (or any authenticated user if issuer has no owner — legacy)
      if (ctx.state.user) {
        const multiTenancy = strapi.service('api::profile.multi-tenancy')
        const canAccess = await multiTenancy.userOwnsProfile(ctx.state.user.id, existing.issuer?.id)
        if (!canAccess) {
          return ctx.forbidden('Only the issuer can revoke this credential')
        }
      } else {
        return ctx.unauthorized('You must be logged in to revoke credentials')
      }

      // Update the credential to revoked status
      const updatedCredential = await strapi.entityService.update('api::credential.credential', id, {
        data: {
          revoked: true,
          revocationReason: reason || 'No reason provided'
        },
      })

      // Also flip the bit in the issuer's status list, if this credential
      // has one (older credentials issued before status lists existed
      // won't - revoked: true above is still authoritative for those).
      if (existing?.statusList && existing.statusListIndex != null) {
        const revocationListService = strapi.service('api::revocation-list.revocation-list')
        await revocationListService.revokeCredentialInStatusList(existing.statusList.id, existing.statusListIndex)
      }

      const webhookDispatcher = strapi.service('api::webhook-subscription.dispatch')
      await webhookDispatcher.dispatch('credential.revoked', {
        credentialId: updatedCredential.credentialId,
        reason: reason || 'No reason provided',
      })

      const auditLog = strapi.service('api::audit-log-entry.audit-log')
      await auditLog.record({
        action: 'credential.revoke',
        entityType: 'credential',
        entityId: id,
        actorId: ctx.state.user?.id,
        metadata: { reason: reason || 'No reason provided' },
      })
      credentialsRevokedTotal.inc()

      // Fan out admin channel alerts — best-effort
      channelAlerts.sendCredentialRevoked({
        credentialId: (updatedCredential as any).credentialId ?? String(id),
        recipientEmail: (existing as any)?.recipient?.email ?? '',
        reason: reason || 'No reason provided',
        revokedBy: ctx.state.user?.email,
      }).catch(() => {})

      return { success: true, credential: updatedCredential }
    } catch (error) {
      console.error('Error revoking credential:', error)
      return ctx.badRequest(error.message || 'Failed to revoke credential')
    }
  },

  /**
   * Renew a credential by re-issuing it with a new expiration date.
   * The original credential is left untouched (not auto-revoked).
   * Only the issuer profile owner can renew.
   */
  async renew(ctx) {
    try {
      const { id } = ctx.params
      const { newExpirationDate } = ctx.request.body

      if (!id) {
        return ctx.badRequest('Credential ID is required')
      }
      if (!newExpirationDate) {
        return ctx.badRequest('newExpirationDate is required')
      }
      const parsedDate = new Date(newExpirationDate)
      if (isNaN(parsedDate.getTime()) || parsedDate <= new Date()) {
        return ctx.badRequest('newExpirationDate must be a valid future date')
      }

      const existing: any = await strapi.entityService.findOne('api::credential.credential', id, {
        populate: ['achievement', 'issuer', 'recipient'],
      })
      if (!existing) {
        return ctx.notFound('Credential not found')
      }

      // Only the issuer profile owner (or any authenticated user if issuer has no owner — legacy)
      if (ctx.state.user) {
        const multiTenancy = strapi.service('api::profile.multi-tenancy')
        const canAccess = await multiTenancy.userOwnsProfile(ctx.state.user.id, existing.issuer?.id)
        if (!canAccess) {
          return ctx.forbidden('Only the issuer can renew this credential')
        }
      } else {
        return ctx.unauthorized('You must be logged in to renew credentials')
      }

      const credentialService = strapi.service('api::credential.credential')
      const newCredential = await credentialService.issue(
        existing.achievement,
        existing.recipient,
        [],
        parsedDate.toISOString(),
        ctx.state.user?.id
      )

      const auditLog = strapi.service('api::audit-log-entry.audit-log')
      await auditLog.record({
        action: 'credential.renew',
        entityType: 'credential',
        entityId: String(id),
        actorId: ctx.state.user?.id,
        metadata: { newCredentialId: newCredential?.credentialId, newExpirationDate },
      })

      return { success: true, credential: newCredential }
    } catch (error: any) {
      strapi.log.error('[credential.renew] Error:', { error: error.message })
      return ctx.badRequest(error.message || 'Failed to renew credential')
    }
  },

  /**
   * Manually trigger the expiration notification scan.
   * Admin-only endpoint — useful for K8s CronJobs or system cron.
   */
  async expirationCheck(ctx) {
    try {
      const scanner = strapi.service('api::credential.expiration-scanner')
      const result = await scanner.runDailyCheck()
      return { success: true, ...result }
    } catch (error: any) {
      strapi.log.error('[credential.expirationCheck] Error:', { error: error.message })
      return ctx.internalServerError('Expiration check failed')
    }
  },

  /**
   * Export a credential as an Open Badge Verifiable Credential
   */
  async exportOpenBadge(ctx) {
    try {
      const { id } = ctx.params
      
      // Use the open-badge service to serialize the credential
      const openBadgeService = strapi.service('api::credential.open-badge')
      const openBadgeVC = await openBadgeService.serializeCredential(id)
      
      return openBadgeVC
    } catch (err) {
      console.error('Error exporting Open Badge:', err)
      return ctx.internalServerError('Error exporting Open Badge')
    }
  },

  /**
   * Import an Open Badge Verifiable Credential
   */
  async importOpenBadge(ctx) {
    try {
      const { credential } = ctx.request.body
      
      if (!credential) {
        return ctx.badRequest('Credential data is required')
      }

      // Use the open-badge service to import the credential
      const openBadgeService = strapi.service('api::credential.open-badge')
      const importedCredential = await openBadgeService.importCredential(credential)
      
      return { 
        success: true, 
        credential: importedCredential
      }
    } catch (err) {
      console.error('Error importing Open Badge:', err)
      return ctx.badRequest('Error importing Open Badge: ' + err.message)
    }
  },

  /**
   * Validate a credential submitted in the request body
   * This is for validating external credentials not in our database
   */
  async validate(ctx) {
    try {
      const { credential } = ctx.request.body

      if (!credential) {
        return ctx.badRequest('Credential data is required')
      }

      // Use the OpenBadge service to validate the credential
      const result = await strapi.service('api::credential.open-badge').validateExternalCredential(credential)

      return result
    } catch (error) {
      console.error('Error validating credential:', error)
      return ctx.badRequest(error.message || 'Failed to validate credential')
    }
  },

  /**
   * Export a credential
   * @param {Object} ctx - The context object
   */
  async export(ctx) {
    try {
      const { id } = ctx.params

      if (!id) {
        return ctx.badRequest('Credential ID is required')
      }

      const credential: any = await strapi.entityService.findOne('api::credential.credential', id, {
        status: 'published',
        populate: ['achievement', 'issuer', 'recipient', 'evidence'],
      })

      if (!credential) {
        return ctx.notFound('Credential not found')
      }

      // The export carries the recipient's email, so only the issuer or the
      // recipient may download it.
      if (!(await canManageCredential(strapi, ctx.state.user, credential))) {
        return ctx.forbidden('Only the issuer or the recipient can export this credential')
      }

      // Use the OpenBadge service to serialize the credential
      const openBadgeCredential = await strapi.service('api::credential.open-badge').serializeCredential(id)

      // Ensure proof is a single object, not an array (defensive, should be handled in service)
      if (Array.isArray(openBadgeCredential.proof)) {
        openBadgeCredential.proof = openBadgeCredential.proof[0]
      }

      return {
        data: openBadgeCredential,
        meta: {
          format: 'OpenBadges3.0',
        }
      }
    } catch (error) {
      console.error('Error exporting credential:', error)
      return ctx.badRequest(error.message || 'Failed to export credential')
    }
  },

  /**
   * Import a credential
   * @param {Object} ctx - The context object
   */
  async import(ctx) {
    try {
      const { certificateData } = ctx.request.body

      if (!certificateData) {
        return ctx.badRequest('Certificate data is required')
      }

      // Use the OpenBadge service to import the credential
      const credential = await strapi.service('api::credential.open-badge').importCredential(certificateData)

      return {
        data: credential,
        meta: {
          message: 'Credential imported successfully',
        }
      }
    } catch (error) {
      console.error('Error importing credential:', error)
      return ctx.badRequest(error.message || 'Failed to import credential')
    }
  },

  /**
   * Get a certificate for a credential
   * @param {Object} ctx - The context object
   */
  async getCertificate(ctx) {
    try {
      const { id } = ctx.params
      
      if (!id) {
        return ctx.badRequest('Credential ID is required')
      }
      
      const credential = await findPublicCredential(strapi, id)
      if (!credential || (isCredentialPrivate(credential) && !(await canManageCredential(strapi, await optionalUser(strapi, ctx), credential)))) {
        return ctx.notFound('Credential not found')
      }

      const certificateService = strapi.service('api::credential.certificate')

      // ?format=png: the downloadable/printable version (PNG and PDF
      // downloads on the website are built from it).
      if (ctx.query?.format === 'png') {
        ctx.type = 'image/png'
        ctx.set('Cache-Control', 'private, no-store')
        ctx.body = await certificateService.generateCertificatePng(credential.id)
        return
      }

      const svg = await certificateService.generateCertificate(credential.id)
      
      // Set the content type and return the SVG
      ctx.set('Content-Type', 'image/svg+xml')
      return svg
    } catch (error) {
      console.error('Error generating certificate:', error)
      return ctx.badRequest(error.message || 'Failed to generate certificate')
    }
  },

  /**
   * GET /credentials/:id/share-image - the og:image of the credential page,
   * fetched anonymously by Facebook, WhatsApp etc. when a link is shared.
   * Public, unrevoked credentials only: the image carries the recipient's
   * name, and a crawler never has the holder's session anyway.
   */
  async getShareImage(ctx) {
    try {
      const credential = await findPublicCredential(strapi, ctx.params.id)
      if (!credential || credential.revoked || isCredentialPrivate(credential)) {
        return ctx.notFound('Credential not found')
      }

      const image = await strapi.service('api::credential.certificate').generateShareImage(credential.id)
      ctx.type = 'image/jpeg'
      // Short: a credential made private or revoked should drop out of
      // caches we control soon (Facebook keeps its own copy regardless).
      ctx.set('Cache-Control', 'public, max-age=3600')
      ctx.body = image
    } catch (error) {
      console.error('Error generating share image:', error)
      return ctx.internalServerError('Failed to generate share image')
    }
  },

  /**
   * Direct certificate endpoint for /verify/:id
   * Returns the certificate image for a credential
   */
  async getDirectCertificate(ctx) {
    try {
      const { id } = ctx.params;
      
      if (!id) {
        return ctx.badRequest('Credential ID is required');
      }
      
      
      // Find credential by ID (could be UUID or database ID)
      let credential;
      
      // First try to find by credentialId (UUID)
      credential = await strapi.db.query('api::credential.credential').findOne({
        where: { credentialId: id },
        populate: ['achievement', 'issuer', 'recipient'],
      });
      
      // No numeric-id fallback: sequential ids made every certificate
      // (with the recipient's name on it) enumerable.
      if (credential && isCredentialPrivate(credential)
        && !(await canManageCredential(strapi, await optionalUser(strapi, ctx), credential))) {
        credential = null;
      }

      if (!credential) {
        return ctx.notFound('Credential not found');
      }
      
      // Generate the certificate
      const certificateService = strapi.service('api::credential.certificate');
      const { image, contentType } = await certificateService.generateCertificate(credential);
      
      // Set content type and send the image
      ctx.type = contentType;
      return image;
    } catch (error) {
      console.error('Error generating certificate:', error);
      return ctx.badRequest(error.message || 'Failed to generate certificate');
    }
  },

  /**
   * Public GET /credentials/:id. The core findOne honoured ?populate= on an
   * auth:false route, so recipient/issuer profiles (email, telephone) were
   * one query parameter away. Returns the whitelisted public view only.
   */
  async findOne(ctx) {
    const credential = await findPublicCredential(strapi, ctx.params.id)
    if (!credential) {
      return ctx.notFound('Credential not found')
    }
    const user = await optionalUser(strapi, ctx)
    const fullView = !!user && await canManageCredential(strapi, user, credential)
    return { data: toPublicCredential(credential, { fullView }) }
  },

  /**
   * PUT /credentials/:id/visibility { visibility: 'public' | 'private' }.
   * The recipient or the issuing organisation may change it (the DPA makes
   * honouring the recipient's choice a standing instruction of the issuer).
   */
  async setVisibility(ctx) {
    const visibility = (ctx.request.body as any)?.data?.visibility ?? (ctx.request.body as any)?.visibility
    if (visibility !== 'public' && visibility !== 'private') {
      return ctx.badRequest('visibility must be "public" or "private"')
    }
    const credential = await findPublicCredential(strapi, ctx.params.id)
    if (!credential) {
      return ctx.notFound('Credential not found')
    }
    if (!(await canManageCredential(strapi, ctx.state.user, credential))) {
      return ctx.forbidden('Only the recipient or the issuer can change this credential\'s visibility')
    }

    // In-place write to every row of the document. documents().update()
    // on a draftAndPublish type republishes by cloning the row under a new
    // id, orphaning the recipient/evidence relations (see billing.updateOrg).
    await strapi.db.query('api::credential.credential').updateMany({
      where: { documentId: credential.documentId },
      data: { visibility },
    })

    await strapi.service('api::audit-log-entry.audit-log').record({
      action: 'credential.visibility',
      entityType: 'credential',
      entityId: String(credential.id),
      actorId: ctx.state.user.id,
      metadata: { visibility, previous: isCredentialPrivate(credential) ? 'private' : 'public' },
    })

    return { data: { credentialId: credential.credentialId, visibility } }
  },

  /**
   * Override the default find method to filter results based on user ownership
   * Multi-tenancy: only return credentials the user can access (owns issuer or recipient profile)
   */
  async find(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to list credentials');
    }
    
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const credentials = await multiTenancy.getUserCredentials(ctx.state.user.id);
      
      return { data: credentials };
    } catch (err) {
      strapi.log.error('[credential.find] Multi-tenancy error:', { error: (err as Error).message });
      return ctx.internalServerError('Error fetching credentials');
    }
  },

  /**
   * Batch issue credentials to multiple recipients
   */
  async batchIssue(ctx) {
    try {
      const { data } = ctx.request.body
      if (!data || !Array.isArray(data.recipients) || data.recipients.length === 0) {
        return ctx.badRequest('Missing or invalid recipients array')
      }

      const { achievementId, recipients, evidence = [] } = data

      if (!achievementId) {
        return ctx.badRequest('Achievement ID is required')
      }

      // Find the achievement
      const achievement = await strapi.entityService.findOne('api::achievement.achievement', achievementId, {
        status: 'published',
        populate: { creator: { populate: ['organization'] } } as any
      }) as Achievement

      if (!achievement) {
        return ctx.notFound('Achievement not found')
      }
      if (!achievement.creator) {
        return ctx.badRequest('Achievement creator not found')
      }
      if ((achievement as any).creator?.organization?.suspendedAt) {
        return ctx.forbidden('Your organisation is suspended pending review and cannot issue credentials')
      }

      const issuePromises = recipients.map(async (recipientData) => {
        try {
          const recipient = { ...recipientData }
          const expirationDate = recipientData.expirationDate || undefined
          // An expiry that is not in the future issues an already-expired
          // credential (easy to do by typing today's date into the expiry box).
          if (expirationDate) {
            const expires = new Date(expirationDate)
            if (Number.isNaN(expires.getTime())) {
              return { success: false, recipient: recipientData.email, error: `Invalid expiration date "${expirationDate}"` }
            }
            if (expires.getTime() <= Date.now()) {
              return { success: false, recipient: recipientData.email, error: 'Expiration date must be in the future (leave it empty for no expiry)' }
            }
          }
          const credential = await strapi.service('api::credential.credential').issue(
            achievement,
            recipient,
            evidence,
            expirationDate,
            ctx.state.user?.id
          )
          return { success: true, recipient: recipientData.email, data: credential }
        } catch (error) {
          strapi.log.error(`[credential.batchIssue] Error issuing to ${recipientData.email}: ${error.message}`)
          return { success: false, recipient: recipientData.email, error: error.message }
        }
      })

      const results = await Promise.all(issuePromises)

      return { results }
    } catch (error) {
      strapi.log.error(`[credential.batchIssue] General error: ${error.message}`)
      return ctx.badRequest(error.message || 'Failed to batch issue credentials')
    }
  }
}))