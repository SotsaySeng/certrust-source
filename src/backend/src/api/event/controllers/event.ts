/**
 * event controller
 */

import { factories } from '@strapi/strapi'

/**
 * Multi-tenancy read/write scoping, mirroring
 * design-template/controllers/design-template.ts's canAccessOrganization/
 * canWriteOrganization exactly (see that file's own header comment for why
 * this is duplicated locally rather than a shared policy -
 * is-in-organization.ts only resolves fields that point at a profile, and
 * event.organization, like design-template.organization, points at the
 * Organization directly). Unlike design-template, event has no
 * organization: null "global/platform" concept - every event belongs to
 * exactly one organization, so there is no read-side null carve-out here.
 */
async function canAccessOrganization(userId: number, targetOrganizationId: string | number | null): Promise<boolean> {
  const multiTenancy = strapi.service('api::profile.multi-tenancy');
  const callerOrganizationId = await multiTenancy.getUserOrganizationId(userId);

  if (callerOrganizationId == null || targetOrganizationId == null) return false;

  return String(callerOrganizationId) === String(targetOrganizationId);
}

export default factories.createCoreController('api::event.event', ({ strapi }) => ({
  /**
   * Multi-tenancy: scope results to the caller's organization. A caller
   * with no organization sees nothing (unlike design-template's legacy
   * null-carve-out - there is no pre-existing "unscoped" event data to
   * stay backwards-compatible with here, this content-type is new).
   */
  async find(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to list events');
    }

    let organizationId: string | number | null;
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);
    } catch (err) {
      strapi.log.error(`[event.find] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching events');
    }

    if (!organizationId) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    }

    ctx.query = {
      ...ctx.query,
      filters: {
        ...((ctx.query as any)?.filters || {}),
        organization: organizationId,
      },
    } as any;

    return super.find(ctx);
  },

  /**
   * Direct-by-id lookup, scoped the same way as find() above - a bare
   * createCoreController leaves findOne with no organization check at all.
   */
  async findOne(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view events');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::event.event').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Event not found');
      }

      allowed = await canAccessOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[event.findOne] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching event');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    return super.findOne(ctx);
  },

  /**
   * organization is always resolved server-side from the caller's own
   * profile, never trusted from the client - same reasoning as
   * design-template.create(). creator is left client-supplied (matching
   * design-template's own precedent for that field) since the frontend
   * always sends the caller's own authStore.profile.id.
   */
  async create(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to create events');
    }

    let organizationId: string | number | null;
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);
    } catch (err) {
      strapi.log.error(`[event.create] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error creating event');
    }

    if (organizationId == null) {
      return ctx.forbidden('You must belong to an organization to create events.');
    }

    ctx.request.body = {
      ...(ctx.request.body as any),
      data: {
        ...((ctx.request.body as any)?.data || {}),
        organization: organizationId,
      },
    } as any;

    return super.create(ctx);
  },

  async update(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to update events');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::event.event').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Event not found');
      }

      allowed = await canAccessOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[event.update] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error updating event');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    // organization is immutable via this route once set, same as
    // design-template.update() - [id].vue's save handler never sends it.
    if ((ctx.request.body as any)?.data && 'organization' in (ctx.request.body as any).data) {
      delete (ctx.request.body as any).data.organization;
    }

    return super.update(ctx);
  },

  async delete(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to delete events');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::event.event').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Event not found');
      }

      allowed = await canAccessOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[event.delete] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error deleting event');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    return super.delete(ctx);
  },
}))
