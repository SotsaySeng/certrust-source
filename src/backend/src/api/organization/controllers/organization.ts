/**
 * organization controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::organization.organization', ({ strapi }) => ({
  /**
   * Multi-tenancy: an authenticated user may only ever see their own
   * organization - there is no cross-org listing in this app's design
   * (see api::profile.multi-tenancy's null-organization carve-out for
   * the general convention; an organization itself has no "legacy/
   * unowned" analogue, so unlike design-template's find() there is no
   * unscoped fallback here).
   *
   * Necessary once ANY role has `find` permission on this content type
   * (see permissions-setup.ts's comment on why `authenticated`/`issuer`
   * now need it: Strapi's own content-API input validation
   * (@strapi/utils' throwRestrictedRelations) requires the caller's role
   * to have `find` on a relation's target type before it will let them
   * *set* that relation at all - e.g. design-template.organization -
   * regardless of any app-level authorization this codebase adds on top.
   * Granting that permission without this scoping override would let any
   * authenticated user list every organization in the system.
   */
  async find(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to list organizations');
    }

    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);

      if (!organizationId) {
        return { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } };
      }

      ctx.query = {
        ...ctx.query,
        filters: {
          ...((ctx.query as any)?.filters || {}),
          id: organizationId,
        },
      } as any;

      return super.find(ctx);
    } catch (err) {
      strapi.log.error(`[organization.find] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching organizations');
    }
  },

  /**
   * Multi-tenancy: enforce the same "own organization only" scoping on
   * direct-by-id lookups. See find()'s comment above for why this
   * override exists at all.
   */
  async findOne(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view an organization');
    }

    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      const organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);

      if (!organizationId) {
        return ctx.notFound('Organization not found');
      }

      const requested: any = await strapi.documents('api::organization.organization').findOne({
        documentId: ctx.params.id,
        status: 'published',
      } as any);

      if (!requested || String(requested.id) !== String(organizationId)) {
        return ctx.notFound('Organization not found');
      }

      return super.findOne(ctx);
    } catch (err) {
      strapi.log.error(`[organization.findOne] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching organization');
    }
  },

  /**
   * Report the current user's organization tier and usage limits.
   * Resolves ctx.state.user -> profile(s) they own -> organization.
   * Returns { tier: null, limit: null, limits: null } if the user has no
   * profile with an organization (no organization to report on - not an
   * error).
   *
   * `limit` is kept as the existing credential limit (unchanged shape,
   * so nothing downstream breaks); `limits` is new and additive, giving
   * all 3 dimensions the design-template and achievement tier-limit
   * hooks also enforce.
   */
  async usage(ctx) {
    try {
      if (!ctx.state.user) {
        return ctx.unauthorized('You must be logged in.');
      }

      // status: 'published' - entityService (and the Document Service it
      // wraps) defaults to the draft version when status is unset; see
      // the equivalent comment in
      // src/policies/is-in-organization.ts for why that matters for a
      // relation like `organization` here.
      const profiles: any[] = await strapi.entityService.findMany('api::profile.profile', {
        status: 'published',
        filters: { owner: { id: ctx.state.user.id } },
        populate: ['organization'],
      } as any);

      const profileWithOrg = (profiles || []).find((p: any) => p.organization);

      if (!profileWithOrg) {
        return { data: { tier: null, limit: null, limits: null } };
      }

      const { tier } = profileWithOrg.organization;
      const usage = strapi.service('api::organization.usage');
      const [credential, designTemplate, achievement] = await Promise.all([
        usage.getTierLimit(tier, 'credential'),
        usage.getTierLimit(tier, 'designTemplate'),
        usage.getTierLimit(tier, 'achievement'),
      ]);

      return { data: { tier, limit: credential, limits: { credential, designTemplate, achievement } } };
    } catch (err) {
      strapi.log.error('[organization.usage] Error:', { error: (err as Error).message });
      return ctx.badRequest('Error fetching usage', { error: (err as Error).message });
    }
  },
}))
