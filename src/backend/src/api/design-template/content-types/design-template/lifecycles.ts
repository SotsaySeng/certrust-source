/**
 * Lifecycle hooks for the Design Template model
 *
 * beforeCreate enforces each organization's tier-based design-template
 * limit - mirrors api::credential.credential/lifecycles.ts exactly (see
 * that file's header comment for the full verified-against-source
 * reasoning on beforeCreate/no-try-catch/error-propagation - all of it
 * applies unchanged here).
 *
 * design-template has a *direct* `organization` relation (unlike
 * credential/achievement, which are scoped transitively through a
 * profile) - one hop, no creator/profile lookup needed. Only one
 * creation path exists for design-template today (the default core
 * `create` action - routes/design-template.ts has no custom create
 * route the way achievement does), so this single hook is the only
 * enforcement point needed.
 */

import { errors } from '@strapi/utils';

/**
 * A design-template's organization relation may arrive as a plain id,
 * `{ id }`, or `{ connect: [{ id }] }` - normalize defensively, same
 * shape as credential lifecycle's normalizeIssuerId.
 */
function normalizeOrganizationId(raw: any): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? normalizeOrganizationId(raw[0]) : null;
  }
  if (typeof raw === 'object') {
    if (Array.isArray(raw.connect) && raw.connect.length > 0) {
      return normalizeOrganizationId(raw.connect[0]);
    }
    if (Array.isArray(raw.set) && raw.set.length > 0) {
      return normalizeOrganizationId(raw.set[0]);
    }
    if (raw.id !== undefined && raw.id !== null) {
      return normalizeOrganizationId(raw.id);
    }
  }
  return null;
}

export default {
  async beforeCreate(event) {
    const { data } = event.params;

    const organizationId = normalizeOrganizationId(data.organization);
    if (organizationId == null) {
      // No organization given at all (e.g. a system/global template) -
      // nothing to scope a tier limit against. Legacy/unrestricted
      // carve-out, same convention as a null-organization profile
      // elsewhere in this codebase.
      return;
    }

    // status: 'published' - entityService.findOne resolves the given id
    // to its documentId and re-fetches via the Document Service, which
    // defaults to the *draft* row (which can have a stale `tier`, e.g.
    // after a partial update that didn't re-specify it) when status is
    // unset. Same reasoning as credential lifecycle's beforeCreate.
    const organization: any = await strapi.entityService.findOne('api::organization.organization', organizationId as any, {
      status: 'published',
    } as any);

    // Fails open if the organization id doesn't resolve to a real,
    // published organization - not this hook's job to enforce
    // referential integrity, only tier limits.
    if (!organization) {
      return;
    }

    const tier = organization.tier;

    const usage = strapi.service('api::organization.usage');
    const limit = await usage.getTierLimit(tier, 'designTemplate');

    // null = unlimited (enterprise, or an unrecognized tier/dimension -
    // fail open rather than block creation over a config problem).
    if (limit == null) {
      return;
    }

    const currentCount = await usage.countOrganizationDesignTemplates(organizationId);
    if (currentCount >= limit) {
      throw new errors.ApplicationError(
        `This organization has reached its "${tier}" tier limit of ${limit} design templates. Upgrade the organization's tier to create more.`
      );
    }
  },
};
