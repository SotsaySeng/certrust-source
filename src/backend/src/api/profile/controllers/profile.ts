/**
 * profile controller
 */

import { factories } from '@strapi/strapi'
import { errors } from '@strapi/utils'
import { issuerDisplayName } from '../../../utils/issuer-display-name'
const { ApplicationError } = errors

// Define interface for profile
interface ProfileWithCredentials {
  id: any
  name: string
  email?: string
  issuedCredentials?: any[]
  receivedCredentials?: any[]
}

// Define interface for profile with public keys
interface ProfileWithPublicKeys {
  id: any
  name: string
  email?: string
  url?: string
  did?: string
  publicKey?: Array<{
    id: string
    type: string
    publicKeyJwk?: any
  }>
}

/**
 * Owner of the profile (see multi-tenancy.userOwnsProfile), or a member of
 * the organisation the profile issues for.
 */
async function canReadProfileCredentials(user: any, profileId: string | number): Promise<boolean> {
  if (!user) return false
  const multiTenancy = strapi.service('api::profile.multi-tenancy')
  if (await multiTenancy.userOwnsProfile(user.id, profileId as any)) return true
  const profile: any = await strapi.entityService.findOne('api::profile.profile', profileId as any, {
    populate: { organization: { populate: ['members'] } } as any,
  })
  return !!profile?.organization?.members?.some((m: any) => m.id === user.id)
}

export default factories.createCoreController('api::profile.profile', ({ strapi }) => ({
  // Custom controller methods for profile
  
  /**
   * Get the current user's profile
   */
  async me(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in');
      }

      const userEmail = ctx.state.user.email;

      // Find profile by email
      const profiles = await strapi.entityService.findMany('api::profile.profile', {
        filters: { email: userEmail },
        status: 'published',
        populate: ['organization'],
        limit: 1
      });
      
      // Return the first profile that matches
      if (profiles && profiles.length > 0) {
        return { data: profiles[0] };
      }

      return ctx.notFound('Profile not found for the current user');
    } catch (err) {
      console.error('Error fetching current user profile:', err);
      return ctx.badRequest('Error fetching profile', { error: err });
    }
  },

  /**
   * Export everything associated with the current user's own profile:
   * achievements it created, credentials it issued or received, and their
   * evidence. See services/data-portability.ts.
   */
  async exportMyData(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in');
      }

      const profiles = await strapi.entityService.findMany('api::profile.profile', {
        filters: { email: ctx.state.user.email },
        status: 'published',
        limit: 1,
      });

      if (!profiles || profiles.length === 0) {
        return ctx.notFound('Profile not found for the current user');
      }

      const dataPortability = strapi.service('api::profile.data-portability');
      return await dataPortability.exportProfileData(profiles[0]);
    } catch (err) {
      console.error('Error exporting profile data:', err);
      return ctx.badRequest('Error exporting profile data', { error: err });
    }
  },

  /**
   * Restores achievements/credentials the current user's profile previously
   * exported via exportMyData - never someone else's data, never
   * credentials merely *received* by this profile. See
   * services/data-portability.ts.
   */
  async importMyData(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in');
      }

      const profiles = await strapi.entityService.findMany('api::profile.profile', {
        filters: { email: ctx.state.user.email },
        status: 'published',
        limit: 1,
      });

      if (!profiles || profiles.length === 0) {
        return ctx.notFound('Profile not found for the current user');
      }

      const dataPortability = strapi.service('api::profile.data-portability');
      return await dataPortability.importProfileData(profiles[0], ctx.request.body || {});
    } catch (err) {
      console.error('Error importing profile data:', err);
      return ctx.badRequest('Error importing profile data', { error: err });
    }
  },

  /**
   * Per-issuer analytics: real credential/achievement counts for the
   * current user's profile, replacing the hardcoded placeholder values
   * the frontend was previously showing. Served at
   * GET /api/dashboard/stats to match the existing API-client call.
   */
  async dashboardStats(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in');
      }

      const profiles = await strapi.entityService.findMany('api::profile.profile', {
        filters: { email: ctx.state.user.email },
        status: 'published',
        limit: 1,
      });

      if (!profiles || profiles.length === 0) {
        return ctx.notFound('Profile not found for the current user');
      }

      const dashboard = strapi.service('api::profile.dashboard');
      const stats = await dashboard.getStats(ctx.state.user.id, profiles[0].id);
      return { data: stats };
    } catch (err) {
      strapi.log.error('[dashboardStats] Error fetching stats', { error: (err as Error).message });
      return ctx.badRequest('Error fetching dashboard stats', { error: (err as Error).message });
    }
  },

  async findIssuedCredentials(ctx) {
    try {
      const { id } = ctx.params

      // These lists carry recipient/issuer contact details; they used to be
      // served for any profile id to any logged-in user.
      if (!(await canReadProfileCredentials(ctx.state.user, id))) {
        return ctx.forbidden('You do not have access to this profile')
      }
      
      const profile = await strapi.entityService.findOne('api::profile.profile', id, {
        status: 'published',
        populate: {
          issuedCredentials: {
            populate: {
              achievement: {
                populate: ['image']
              },
              recipient: true
            }
          }
        }
      }) as ProfileWithCredentials
      
      if (!profile) {
        return ctx.notFound('Profile not found')
      }
      
      return { data: profile.issuedCredentials || [] }
    } catch (err) {
      ctx.badRequest('Error fetching issued credentials', { error: err })
    }
  },
  
  async findReceivedCredentials(ctx) {
    try {
      const { id } = ctx.params

      // These lists carry recipient/issuer contact details; they used to be
      // served for any profile id to any logged-in user.
      if (!(await canReadProfileCredentials(ctx.state.user, id))) {
        return ctx.forbidden('You do not have access to this profile')
      }
      
      const profile = await strapi.entityService.findOne('api::profile.profile', id, {
        status: 'published',
        populate: {
          receivedCredentials: {
            populate: {
              achievement: {
                populate: ['image']
              },
              issuer: true
            }
          }
        }
      }) as ProfileWithCredentials
      
      if (!profile) {
        return ctx.notFound('Profile not found')
      }
      
      strapi.log.debug(`[profile.findReceivedCredentials] Found ${profile.receivedCredentials?.length || 0} credentials for profile ${id}`)

      return { data: profile.receivedCredentials || [] }
    } catch (err) {
      ctx.badRequest('Error fetching received credentials', { error: err })
    }
  },

  /**
   * Get all public keys for a profile
   */
  async getPublicKeys(ctx) {
    try {
      const { id } = ctx.params

      // Find the profile with its public keys
      const profile = await strapi.entityService.findOne('api::profile.profile', id, {
        status: 'published',
        populate: ['publicKey']
      }) as ProfileWithPublicKeys

      if (!profile) {
        return ctx.notFound('Profile not found')
      }

      // Keys live on the issuer-key record now, not mirrored onto the
      // profile - see api::profile.issuer-keys' header comment for why that
      // mirror had to go. Anything still stored on the profile is kept.
      const publicKeys = await strapi.service('api::profile.issuer-keys').publicKeysForProfile(profile)

      // Format the keys according to Open Badges 3.0 spec
      const keys = publicKeys.map((key: any) => ({
        id: key.id,
        type: key.type || 'Ed25519VerificationKey2020',
        controller: profile.did || `did:web:${ctx.request.header.host}:profiles:${id}`,
        publicKeyJwk: key.publicKeyJwk
      }))

      return keys[0];
    } catch (err) {
      console.error('Error fetching public keys:', err)
      return ctx.internalServerError('Error fetching public keys')
    }
  },

  /**
   * Get public keys in JWKS format
   */
  async getJWKS(ctx) {
    try {
      const { id } = ctx.params

      // Find the profile with its public keys
      const profile = await strapi.entityService.findOne('api::profile.profile', id, {
        status: 'published',
        populate: ['publicKey']
      }) as ProfileWithPublicKeys

      if (!profile) {
        return ctx.notFound('Profile not found')
      }

      const publicKeys = await strapi.service('api::profile.issuer-keys').publicKeysForProfile(profile)

      // Format the keys in JWKS format
      const keys = publicKeys
        .filter((key: any) => key.publicKeyJwk)
        .map((key: any) => ({
          ...key.publicKeyJwk,
          kid: key.id || `${profile.id}-${key.type}`,
          use: 'sig',
          alg: key.type === 'Ed25519VerificationKey2020' ? 'EdDSA' : 'ES256K'
        }))

      return {
        keys
      }
    } catch (err) {
      console.error('Error fetching JWKS:', err)
      return ctx.internalServerError('Error fetching JWKS')
    }
  },

  /**
   * Multi-tenancy: Override find to only return profiles owned by the current user
   * Authenticated users can only see their own profiles
   */
  async find(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in to list profiles');
      }

      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const profiles = await multiTenancy.getUserProfiles(ctx.state.user.id);
      
      return { data: profiles };
    } catch (err) {
      strapi.log.error('[profile.find] Multi-tenancy error:', { error: (err as Error).message });
      return ctx.internalServerError('Error fetching profiles');
    }
  },

  /**
   * Multi-tenancy: Override findOne to enforce ownership
   * Users can only access profiles they own
   */
  async findOne(ctx) {
    try {
      const { id } = ctx.params;

      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in to view profiles');
      }

      const profile = await strapi.entityService.findOne('api::profile.profile', id, {
        populate: ['publicKey']
      });

      if (!profile) {
        return ctx.notFound('Profile not found');
      }

      // Check ownership
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const ownsProfile = await multiTenancy.userOwnsProfile(ctx.state.user.id, id);

      if (!ownsProfile) {
        return ctx.forbidden('You do not have access to this profile');
      }

      return { data: profile };
    } catch (err) {
      strapi.log.error('[profile.findOne] Multi-tenancy error:', { error: (err as Error).message });
      return ctx.internalServerError('Error fetching profile');
    }
  },

  /**
   * Public OB 3.0 issuer Profile (the `issuer.id` URL inside every
   * credential). Anonymous, sequential ids - so it must only ever describe
   * issuers, and only with public fields. It used to return any profile row
   * as-is, recipients included, email and telephone with it.
   */
  async getIssuer(ctx) {
    const { id } = ctx.params
    const profile = await strapi.entityService.findOne('api::profile.profile', id, {
      status: 'published',
      populate: ['publicKey', 'image', 'organization']
    }) as any

    if (!profile || profile.profileType === 'Recipient') {
      return ctx.notFound('Profile not found')
    }

    const baseUrl = strapi.config.get('server.url') || ''
    const publicKey = await strapi.service('api::profile.issuer-keys').publicKeysForProfile(profile)
    return {
      id: `${baseUrl}/api/profiles/${profile.id}/issuer`,
      type: ['Profile'],
      name: issuerDisplayName(profile),
      ...(profile.url ? { url: profile.url } : {}),
      ...(profile.description ? { description: profile.description } : {}),
      ...(profile.image?.url ? { image: { id: profile.image.url, type: 'Image' } } : {}),
      publicKey,
    }
  },

  /**
   * Multi-tenancy: `owner`/`organization` are never client-settable, same
   * boundary as update()'s field allowlist below - only create() had no
   * override at all, so the default core action would persist whatever
   * `owner`/`organization` the client sent, including another
   * organization's id (Strapi's relation-write guard only checks the
   * caller's role has `find` on the target type, not on that specific
   * instance). Always resolve both server-side instead - owner is always
   * the caller's own account; organization is always the caller's own
   * (nullable) organization membership - same "never trust a
   * client-supplied value" posture as design-template.create() uses for
   * its own organization relation.
   */
  async create(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to create a profile');
    }

    let organizationId: string | number | null;
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);
    } catch (err) {
      strapi.log.error('[profile.create] Multi-tenancy error:', { error: (err as Error).message });
      return ctx.internalServerError('Error creating profile');
    }

    ctx.request.body = {
      ...(ctx.request.body as any),
      data: {
        ...((ctx.request.body as any)?.data || {}),
        owner: ctx.state.user.id,
        organization: organizationId,
      },
    } as any;

    return super.create(ctx);
  },

  /**
   * Multi-tenancy: enforce ownership on update, and restrict which fields
   * a self-update may touch.
   *
   * Previously fell through entirely unchecked to the default core
   * action - unlike find/findOne above, update/delete were never
   * overridden, so PUT /api/profiles/:id worked for ANY profile id (the
   * authenticated role already has the update permission, per
   * permissions-setup.ts - nothing was scoping it). Reuses the same
   * multi-tenancy.userOwnsProfile check findOne already established.
   *
   * Deliberately does NOT delegate to super.update(ctx) - verified live
   * that this 404s. userOwnsProfile (like every other profile lookup in
   * this controller: findOne, findIssuedCredentials, getPublicKeys, ...)
   * takes the numeric id, via entityService - but Strapi 5's *default*
   * core update action is Document-Service-backed and expects
   * ctx.params.id to be a documentId instead. Mixing both within one
   * action can't work for any single client-supplied id. findOne (above)
   * already sidesteps this the same way: do the whole thing via
   * entityService directly, matching this profile API's one consistent
   * (numeric-id) convention throughout, rather than introducing the
   * Document Service's documentId convention for this one action only.
   *
   * The field allowlist is a second, independent restriction: even for a
   * profile you DO own, `owner`/`organization`/the *Credentials/
   * createdAchievements relations aren't meant to be self-editable at
   * all, and `email` specifically drives me()'s lookup (line 44 above) -
   * letting it drift out of sync with the Strapi user's own login email
   * would break /api/profiles/me for that account.
   */
  async update(ctx) {
    const { id } = ctx.params;

    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to update a profile');
    }

    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const ownsProfile = await multiTenancy.userOwnsProfile(ctx.state.user.id, id);

      if (!ownsProfile) {
        return ctx.forbidden('You do not have access to this profile');
      }
    } catch (err) {
      strapi.log.error('[profile.update] Multi-tenancy error:', { error: (err as Error).message });
      return ctx.internalServerError('Error updating profile');
    }

    const allowedFields = ['name', 'description', 'url', 'telephone'];
    const incoming = (ctx.request.body as any)?.data || {};
    const safeData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (field in incoming) {
        safeData[field] = incoming[field];
      }
    }

    try {
      const updated = await strapi.entityService.update('api::profile.profile', id, {
        data: safeData,
      });
      return { data: updated };
    } catch (err) {
      strapi.log.error('[profile.update] Error updating profile:', { error: (err as Error).message });
      return ctx.internalServerError('Error updating profile');
    }
  },

  /**
   * Blocks profile deletion outright, for anyone, regardless of
   * ownership - see deleteAccount's own comment for the reasoning
   * (deleting a profile row in isolation would leave dangling
   * achievement/credential relations with no defined cleanup anywhere in
   * this codebase). Real "delete my account" is DELETE /profiles/me
   * (deleteAccount below), not this generic REST action.
   */
  async delete(ctx) {
    return ctx.badRequest('Profiles cannot be deleted directly. Use DELETE /api/profiles/me to delete your own account.');
  },

  /**
   * DELETE /profiles/me: erase the signed-in account (Privacy Policy s.9).
   *
   * Deletes the login, erases contact details from the profiles the user
   * owns, and removes them from their organisations; an organisation left
   * with no members is marked closed. Profile rows and credentials are
   * kept - they are the issuer/recipient of credentials that stay
   * verifiable (Terms s.14) - so nothing dangles. Used to only block the
   * login, which erased nothing.
   */
  async deleteAccount(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to delete your account');
    }
    const userId = ctx.state.user.id;

    try {
      // Membership is either the org's `members` relation or (as
      // self-service provisioning does it) owning a profile linked to it.
      const ownedProfiles: any[] = await strapi.db.query('api::profile.profile').findMany({
        where: { owner: { id: userId } },
        populate: ['organization'],
      });
      const memberOf: any[] = await strapi.db.query('api::organization.organization').findMany({
        where: { members: { id: userId } },
        select: ['documentId'],
      });
      const orgDocumentIds = [...new Set([
        ...ownedProfiles.map((p: any) => p.organization?.documentId).filter(Boolean),
        ...memberOf.map((o: any) => o.documentId),
      ])];
      const orgs: any[] = [];
      for (const documentId of orgDocumentIds) {
        const org: any = await strapi.db.query('api::organization.organization').findOne({
          where: { documentId, publishedAt: { $notNull: true } },
          populate: ['members'],
        });
        if (!org) continue;
        const otherOwners = await strapi.db.query('api::profile.profile').count({
          where: { organization: { documentId }, owner: { id: { $notNull: true, $ne: userId } } },
        });
        const otherMembers = (org.members || []).filter((m: any) => m.id !== userId);
        orgs.push({ ...org, otherMembers, lastOne: otherOwners === 0 && otherMembers.length === 0 });
      }

      // An organisation left with no one who can sign in is closed. A live
      // paid subscription has to be cancelled first, so nobody keeps being
      // billed for an organisation no one can sign in to.
      for (const org of orgs) {
        const paying = ['active', 'trialing', 'past_due'].includes(org.subscriptionStatus) && !!org.stripeSubscriptionId && !org.cancelAtPeriodEnd;
        if (org.lastOne && paying) {
          return ctx.badRequest('Cancel your organisation\'s subscription in Billing before deleting your account.');
        }
      }

      // In-place writes (draft and published rows): see billing.updateOrg
      // for why documents().update() must not be used on organisations.
      const now = new Date();
      for (const org of orgs) {
        if ((org.members || []).some((m: any) => m.id === userId)) {
          const rows: any[] = await strapi.db.query('api::organization.organization').findMany({ where: { documentId: org.documentId }, select: ['id'] });
          for (const row of rows) {
            await strapi.db.query('api::organization.organization').update({
              where: { id: row.id },
              data: { members: org.otherMembers.map((m: any) => m.id) },
            });
          }
        }
        if (org.lastOne) {
          // Credentials the organisation issued keep verifying, labelled
          // "Issuer account inactive" (Terms s.14).
          await strapi.service('api::billing.billing').updateOrg(org.documentId, { closedAt: now });
          // Its verification evidence has no further use (Privacy Policy s.9).
          await strapi.service('api::trust.verification-documents').removeAllFor(org.documentId);
        }
      }

      // Erase the person's contact details from the profiles they own. The
      // profile rows themselves stay: they are the issuer/recipient of
      // credentials that must keep verifying, and are shown only by name
      // (issuing profiles by their organisation's name).
      for (const profile of ownedProfiles) {
        await strapi.db.query('api::profile.profile').update({
          where: { id: profile.id },
          data: { email: null, telephone: null, url: null, description: null, owner: null },
        });
      }

      await strapi.db.query('plugin::users-permissions.user').delete({ where: { id: userId } });

      const auditLog = strapi.service('api::audit-log-entry.audit-log');
      await auditLog.record({
        action: 'account.delete',
        entityType: 'user',
        entityId: userId,
        actorId: null,
        metadata: { organizationsClosed: orgs.filter((o: any) => o.lastOne).length },
      });

      return { data: { success: true } };
    } catch (err) {
      strapi.log.error(`[profile.deleteAccount] Error erasing account: ${(err as Error).message}`);
      return ctx.internalServerError('Error deleting account');
    }
  },
}))