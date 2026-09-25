/**
 * achievement controller
 */

import { factories } from '@strapi/strapi'
import { achievementsCreatedTotal } from '../../../monitoring/metrics'

interface Achievement {
  id: any
  name: string
  description: string
  credentials?: any[]
  image?: any
  creator?: any
  tags?: any
}

export default factories.createCoreController('api::achievement.achievement', ({ strapi }) => ({
  // Custom controller method to handle creation with empty tags
  async create(ctx) {
    try {
      // Get the data from the request body
      const { data } = ctx.request.body;
      
      // Handle empty tags
      if (data.tags === '' || data.tags === undefined || data.tags === null) {
        data.tags = [];
      }
      
      // Bypass permission checks by using entityService directly
      const entity = await strapi.entityService.create('api::achievement.achievement', {
        data
      });

      const auditLog = strapi.service('api::audit-log-entry.audit-log')
      await auditLog.record({
        action: 'achievement.create',
        entityType: 'achievement',
        entityId: entity.id,
        actorId: ctx.state.user?.id,
        metadata: { name: entity.name },
      })
      achievementsCreatedTotal.inc()

      // Return the created entity
      return { data: entity };
    } catch (error) {
      console.error('Error creating achievement:', error);
      return ctx.badRequest('Failed to create achievement', { error: error.message });
    }
  },
  
  // Custom method for public creation of achievements
  async createAchievement(ctx) {
    try {
      // Get the data from the request body
      const { data } = ctx.request.body;
      
      // Handle empty tags by ensuring it's a valid JSON array
      if (data.tags === '' || data.tags === undefined || data.tags === null) {
        data.tags = [];
      }
      
      // Create the achievement using the entity service directly
      const achievement = await strapi.entityService.create('api::achievement.achievement', {
        data
      });
      
      return { data: achievement };
    } catch (error) {
      console.error('Error in createAchievement:', error);
      return ctx.badRequest('Failed to create achievement', { error: error.toString() });
    }
  },
  
  // Custom method to find achievement with credentials
  async findWithCredentials(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view an achievement\'s credentials')
    }
    try {
      const { id } = ctx.params

      const achievement = await strapi.entityService.findOne('api::achievement.achievement', id, {
        status: 'published',
        populate: {
          credentials: { populate: ['recipient'] },
          image: true,
          creator: { populate: { owner: true, organization: { populate: ['members'] } } },
        } as any,
      }) as any

      if (!achievement) {
        return ctx.notFound('Achievement not found')
      }

      // Was anonymous: anyone could list every recipient of any achievement.
      const creator = achievement.creator
      const isIssuer = creator?.owner?.id === ctx.state.user.id
        || creator?.organization?.members?.some((m: any) => m.id === ctx.state.user.id)
      if (!isIssuer) {
        return ctx.forbidden('Only the issuer can list this achievement\'s credentials')
      }
      delete creator.owner
      delete creator.organization

      return { data: achievement }
    } catch (err) {
      ctx.badRequest('Error fetching achievement', { error: err })
    }
  },
  
  /**
   * Custom method to find achievements by creator id.
   *
   * Was `auth: false` with an unauthenticated, unscoped `populate: '*'` -
   * that wildcard populate pulled in each achievement's private
   * `createdBy`/`updatedBy` admin-user relation (Strapi's own private-field
   * gate is enforced only by sanitizeOutput, which this action never
   * called), leaking the Strapi admin's bcrypt password hash and
   * resetPasswordToken to any unauthenticated caller, on top of returning
   * any organization's achievement data for any guessable/enumerable
   * creatorId. Fixed on three layers: the route now requires auth (see
   * routes/custom.ts), this handler additionally verifies the caller owns
   * the profile they're asking about (the only real caller,
   * composables/useApiClient.ts's getAvailableBadges(), already always
   * passes the caller's own profile id - self-only access matches
   * existing usage exactly, not just non-breaking), populate is now an
   * explicit safe list instead of '*' (defense in depth - even a future
   * caller with a valid reason to relax the ownership check above
   * wouldn't reopen the admin-relation leak), and the response is run
   * through sanitizeOutput like the default core actions already do.
   */
  async findByCreator(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view achievements by creator')
    }

    const { creatorId } = ctx.params
    if (!creatorId) {
      return ctx.badRequest('Missing creatorId parameter')
    }

    try {
      const creatorProfile: any = await strapi.entityService.findOne('api::profile.profile', creatorId, {
        status: 'published',
        populate: ['owner'],
      })

      if (!creatorProfile || creatorProfile.owner?.id !== ctx.state.user.id) {
        return ctx.forbidden('You can only view achievements you created')
      }

      const achievements = await strapi.entityService.findMany('api::achievement.achievement', {
        status: 'published',
        filters: { creator: { id: creatorId } },
        populate: ['image', 'creator'],
      })

      const sanitized = await this.sanitizeOutput(achievements, ctx)
      return this.transformResponse(sanitized)
    } catch (err) {
      ctx.badRequest('Error fetching achievements by creator', { error: err })
    }
  }
})) 