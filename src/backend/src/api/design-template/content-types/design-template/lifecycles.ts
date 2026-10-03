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

    // A create carrying an existing documentId is not a new design (Strapi
    // re-created rows on every save while draft & publish was on). Kept so
    // an organization at its limit can never be blocked from saving a
    // design it already has.
    if (data.documentId) {
      const existing = await strapi.db.query('api::design-template.design-template').count({
        where: { documentId: data.documentId },
      } as any);
      if (existing > 0) return;
    }

    const organizationId = normalizeOrganizationId(data.organization);
    if (organizationId == null) {
      // No organization given at all (e.g. a system/global template) -
      // nothing to scope a tier limit against. Legacy/unrestricted
      // carve-out, same convention as a null-organization profile
      // elsewhere in this codebase.
      return;
    }

    const organization: any = await strapi.entityService.findOne('api::organization.organization', organizationId as any);

    // Fails open if the organization id doesn't resolve to a real
    // organization - not this hook's job to enforce
    // referential integrity, only tier limits.
    if (!organization) {
      return;
    }

    // Trial-aware: a trialing organization is held to Tier Settings' "trial"
    // column for saved designs, whatever tier the trial runs on (see
    // organization/services/usage.ts getDesignLimits).
    const usage = strapi.service('api::organization.usage');
    const limits = await usage.getDesignLimits(organization);
    const limit = limits.designTemplateLimit;

    // null = unlimited (enterprise, or an unrecognized tier/dimension -
    // fail open rather than block creation over a config problem).
    if (limit == null) {
      return;
    }

    const currentCount = await usage.countOrganizationDesignTemplates(organizationId);
    if (currentCount >= limit) {
      const plan = limits.source === 'trial' ? 'trial' : `"${organization.tier}" plan`;
      throw new errors.ApplicationError(
        `Your ${plan} includes ${limit} saved designs and you have used them all. Upgrade your plan to save more designs.`,
        { code: 'DESIGN_LIMIT_REACHED', limit, source: limits.source }
      );
    }
  },
};
