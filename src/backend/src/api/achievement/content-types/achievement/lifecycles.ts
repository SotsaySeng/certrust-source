/**
 * Lifecycle hooks for the Achievement model
 *
 * beforeCreate does two unrelated things, in order:
 *  1. Tag-array sanitization (original logic, unchanged).
 *  2. Tier-limit enforcement for achievement creation ("credential
 *     templates" in this product's own language) - mirrors
 *     api::credential.credential/lifecycles.ts exactly (see that file's
 *     header comment for the full verified-against-source reasoning on
 *     why a beforeCreate hook with no try/catch is the right, and only,
 *     place to enforce this).
 *
 * achievement has no direct `organization` column (by design - see
 * api::profile.multi-tenancy and src/policies/is-in-organization.ts for
 * the same convention elsewhere) - tenancy is resolved transitively
 * through creator -> profile -> organization, two hops, the same shape
 * as credential's issuer hop.
 *
 * Both of achievement's creation paths - the default core `create`
 * action (routes/achievement.ts) and the custom POST /achievements/create
 * action (routes/achievement-create.ts -> controllers/achievement.ts's
 * createAchievement, which also calls strapi.entityService.create
 * directly) - funnel through the same strapi.db.query(...).create() at
 * the entity-manager layer, so this one hook covers both.
 */

import { errors } from '@strapi/utils';

/**
 * An achievement's creator relation may arrive as a plain id, `{ id }`,
 * or `{ connect: [{ id }] }` depending on which creation path produced
 * this event's data - normalize defensively, same shape as credential
 * lifecycle's normalizeIssuerId.
 */
function normalizeCreatorId(raw: any): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? normalizeCreatorId(raw[0]) : null;
  }
  if (typeof raw === 'object') {
    if (Array.isArray(raw.connect) && raw.connect.length > 0) {
      return normalizeCreatorId(raw.connect[0]);
    }
    if (Array.isArray(raw.set) && raw.set.length > 0) {
      return normalizeCreatorId(raw.set[0]);
    }
    if (raw.id !== undefined && raw.id !== null) {
      return normalizeCreatorId(raw.id);
    }
  }
  return null;
}

export default {
  async beforeCreate(event) {
    const { data } = event.params;

    // Ensure tags is always a valid JSON array when empty or undefined
    if (!data.tags || data.tags === '') {
      data.tags = [];
    }

    // Tier-limit enforcement (credential-template / achievement creation
    // cap) - see header comment.
    const creatorId = normalizeCreatorId(data.creator);
    if (creatorId == null) {
      // No creator given at all - nothing to scope a tier limit against.
      // Not this hook's job to enforce that creator is present; let the
      // create proceed.
      return;
    }

    // status: 'published' - entityService.findOne resolves the given id
    // to its documentId and re-fetches via the Document Service, which
    // defaults to the *draft* row when status is unset - a creator
    // profile whose draft happens to lack its organization relation
    // would otherwise silently look like a legacy/unrestricted creator
    // and skip tier enforcement entirely. Same reasoning as credential
    // lifecycle's beforeCreate.
    const creator: any = await strapi.entityService.findOne('api::profile.profile', creatorId as any, {
      status: 'published',
      populate: ['organization'],
    } as any);

    // Legacy carve-out (creator profile with no organization) - same
    // null-organization convention as src/policies/is-in-organization.ts
    // and api::profile.multi-tenancy. Also fails open if the creator id
    // doesn't resolve to a real profile - not this hook's job to enforce
    // referential integrity, only tier limits.
    if (!creator || !creator.organization) {
      return;
    }

    const organizationId = creator.organization.id;
    const tier = creator.organization.tier;

    const usage = strapi.service('api::organization.usage');
    const limit = await usage.getTierLimit(tier, 'achievement');

    // null = unlimited (enterprise, or an unrecognized tier/dimension -
    // fail open rather than block creation over a config problem).
    if (limit == null) {
      return;
    }

    const currentCount = await usage.countOrganizationAchievements(organizationId);
    if (currentCount >= limit) {
      throw new errors.ApplicationError(
        `This organization has reached its "${tier}" tier limit of ${limit} achievements. Upgrade the organization's tier to create more.`
      );
    }
  },

  beforeUpdate(event) {
    const { data } = event.params;
    
    // Ensure tags is always a valid JSON array when empty or undefined
    if (data.tags !== undefined && (data.tags === '' || data.tags === null)) {
      data.tags = [];
    }
  }
} 