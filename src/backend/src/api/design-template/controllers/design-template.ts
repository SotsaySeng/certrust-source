/**
 * design-template controller
 */

import { factories } from '@strapi/strapi'

/**
 * organization: null on the TARGET template (a global/platform template)
 * is the legacy/unrestricted read carve-out - same convention as
 * src/policies/is-in-organization.ts and api::profile.multi-tenancy
 * elsewhere in this codebase. A caller with no organization of their own
 * is NOT a carve-out the other way around, though - they only get that
 * same access to organization: null templates (matching find()'s own
 * scoping below), never to another organization's templates just because
 * they themselves aren't scoped to one.
 *
 * Used by findOne only - see canWriteOrganization below for the write
 * actions, which do NOT share this null-carve-out.
 */
async function canAccessOrganization(userId: number, targetOrganizationId: string | number | null): Promise<boolean> {
  if (targetOrganizationId == null) return true;

  const multiTenancy = strapi.service('api::profile.multi-tenancy');
  const callerOrganizationId = await multiTenancy.getUserOrganizationId(userId);

  if (callerOrganizationId == null) return false;

  return String(callerOrganizationId) === String(targetOrganizationId);
}

/**
 * Write-side counterpart to canAccessOrganization (above). Reads of an
 * organization: null (global/platform) template stay allowed for any
 * authenticated caller - see canAccessOrganization's own comment - but
 * writes do not: global templates are curated only through Strapi's own
 * /admin panel (its Content Manager talks to its own document-manager
 * service, strapi.documents(uid) directly - it never calls this
 * controller), so no content-API caller, regardless of their own
 * organization, may update or delete an organization: null row through
 * update()/delete() below. A caller may still only write to their OWN
 * organization's row, exactly as canAccessOrganization already enforces
 * for the non-null case.
 */
async function canWriteOrganization(userId: number, targetOrganizationId: string | number | null): Promise<boolean> {
  if (targetOrganizationId == null) return false;

  const multiTenancy = strapi.service('api::profile.multi-tenancy');
  const callerOrganizationId = await multiTenancy.getUserOrganizationId(userId);

  if (callerOrganizationId == null) return false;

  return String(callerOrganizationId) === String(targetOrganizationId);
}

export default factories.createCoreController('api::design-template.design-template', ({ strapi }) => ({
  /**
   * Multi-tenancy: scope results to the caller's organization. A caller
   * with no organization of their own (no profile, or a profile with
   * organization: null) only sees the global/platform templates
   * (organization: null) - the same legacy carve-out canAccessOrganization
   * applies for direct-by-id lookups - never every other organization's
   * templates.
   */
  async find(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to list design templates');
    }

    let organizationId: string | number | null;
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);
    } catch (err) {
      strapi.log.error(`[design-template.find] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching design templates');
    }

    if (!organizationId) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...((ctx.query as any)?.filters || {}),
          // { $null: true }, not a literal null - see the $or branch
          // below for why a literal null doesn't survive the query
          // setter's stringify/parse round-trip.
          organization: { $null: true },
        },
      } as any;
      return super.find(ctx);
    }

    ctx.query = {
      ...ctx.query,
      filters: {
        ...((ctx.query as any)?.filters || {}),
        // Overwrites any caller-supplied filters.$or, same posture as
        // this already had for filters.organization - fine today since
        // getDesignTemplates() (the only caller) never sends its own $or.
        //
        // { organization: null } (a literal null value) looks equivalent
        // but is NOT: assigning to ctx.query invokes Koa's query setter,
        // which re-stringifies the object back into ctx.request.querystring
        // - and null has no URL representation, so it round-trips through
        // that re-parse as organization='' (empty string), which then
        // matches nothing. { $null: true } is a plain boolean, so it
        // survives the stringify/parse round-trip intact. Verified
        // directly against a live request log: the literal-null version
        // hit the server as `filters[$or][1][organization]=` (empty).
        $or: [
          { organization: organizationId },
          { organization: { $null: true } },
        ],
      },
    } as any;

    // Not wrapped in the try/catch above: super.find(ctx) handles and
    // formats its own errors; wrapping it here would flatten Strapi's
    // own clean error responses into a generic 500 (see create()'s
    // comment below for the same reasoning, verified the hard way).
    return super.find(ctx);
  },

  /**
   * Multi-tenancy read-scoping for direct-by-id lookups.
   *
   * find() (above) already scopes the list endpoint by organization, but
   * a bare `createCoreController` leaves findOne on the default core
   * implementation, which has no organization check at all - GET
   * /api/design-templates/:documentId returned any organization's
   * template (name, description, layoutConfig, previewImage, creator,
   * organization) to any authenticated user who knew or guessed a
   * documentId. Mirrors update()/delete()'s exact lookup-then-check shape
   * below, reusing canAccessOrganization (see its own comment above for
   * why that's the right check to reuse for a read).
   */
  async findOne(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to view design templates');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::design-template.design-template').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Design template not found');
      }

      allowed = await canAccessOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[design-template.findOne] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error fetching design template');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    return super.findOne(ctx);
  },

  /**
   * Multi-tenancy write-scoping for create/update/delete.
   *
   * NOTE ON DEVIATION FROM PLAN: the original design called for wiring
   * the shared `global::is-in-organization` route policy here (matching
   * achievement.ts's wiring style - see routes/design-template.ts).
   * Verified directly against src/policies/is-in-organization.ts's
   * actual implementation (out of this rollout's file scope to modify)
   * that it cannot do this: every path through that policy ends by
   * resolving the configured field down to a *profile* id and looking it
   * up via entityService.findOne('api::profile.profile', id, ...) -
   * there is no config mode for a field that points directly at an
   * Organization. achievement.creator / credential.issuer /
   * endorsement.endorser / evidence's through-credential all point at a
   * profile one hop up from the organization; design-template.organization
   * points at the Organization itself, zero hops. Wiring
   * `{ field: 'organization' }` onto that policy as originally planned
   * would feed an *organization* id into a profile lookup - at best a
   * blanket false-deny (403 on every write, since no profile shares that
   * id), at worst a real authorization bug if a profile happens to share
   * a numeric id with an unrelated organization. Implementing the
   * equivalent check here instead - canAccessOrganization for findOne's
   * null-carve-out read case, canWriteOrganization for update/delete
   * (which, unlike canAccessOrganization, denies writes to an
   * organization: null row outright, since global/platform templates are
   * /admin-only - see canWriteOrganization's own comment), and create()
   * resolving organization server-side from the caller's own profile
   * rather than checking a client-supplied value at all - using the same
   * organization: null legacy carve-out convention as the rest of this
   * codebase for reads. Flagged as a follow-up: is-in-organization.ts
   * could grow a `resolvesTo: 'organization'` config mode to skip the
   * profile hop and make this a policy again.
   *
   * Each action below only wraps *its own* pre-flight lookup/authorization
   * step in try/catch - never the delegated super.create/update/delete(ctx)
   * call itself. Verified directly (the hard way, via a live 500 during
   * this rollout's own self-validation): super.*(ctx) - and the
   * beforeCreate tier-limit lifecycle hook it triggers - already
   * propagates its own errors (a clean ApplicationError -> 4xx) all the
   * way to Strapi's global errors middleware with no help needed: a
   * try/catch wrapped around it here would catch that ApplicationError
   * too and flatten it into a generic ctx.internalServerError(...) (500),
   * destroying the tier-limit hook's own clear 4xx message. Same
   * no-try/catch-needed reasoning documented in
   * credential/content-types/credential/lifecycles.ts's header comment.
   */
  async create(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to create design templates');
    }

    let organizationId: string | number | null;
    try {
      const multiTenancy = strapi.service('api::profile.multi-tenancy');
      organizationId = await multiTenancy.getUserOrganizationId(ctx.state.user.id);
    } catch (err) {
      strapi.log.error(`[design-template.create] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error creating design template');
    }

    // Global templates (organization: null) are curated only through
    // Strapi's /admin panel - a content-API caller always needs a real
    // organization to create into.
    if (organizationId == null) {
      return ctx.forbidden('You must belong to an organization to create design templates.');
    }

    // Always resolve organization server-side from the caller's own
    // profile - never trust a client-supplied value. This is what stops
    // a business user from creating (or, via duplicateDesignTemplate(),
    // copying) a template with organization: null or another org's id.
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
      return ctx.unauthorized('You must be logged in to update design templates');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::design-template.design-template').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Design template not found');
      }

      allowed = await canWriteOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[design-template.update] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error updating design template');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    // organization is immutable via this route once set - an organization
    // may not move its own template into or out of the global/platform
    // pool via the regular API. [id].vue's save handler never sends this
    // field today, so stripping it is a no-op for every real caller.
    if ((ctx.request.body as any)?.data && 'organization' in (ctx.request.body as any).data) {
      delete (ctx.request.body as any).data.organization;
    }

    return super.update(ctx);
  },

  async delete(ctx) {
    if (!ctx.state.user) {
      return ctx.unauthorized('You must be logged in to delete design templates');
    }

    let allowed: boolean;
    try {
      const existing: any = await strapi.documents('api::design-template.design-template').findOne({
        documentId: ctx.params.id,
        status: 'published',
        populate: ['organization'],
      } as any);

      if (!existing) {
        return ctx.notFound('Design template not found');
      }

      allowed = await canWriteOrganization(ctx.state.user.id, existing.organization?.id ?? null);
    } catch (err) {
      strapi.log.error(`[design-template.delete] Multi-tenancy error: ${(err as Error).message}`);
      return ctx.internalServerError('Error deleting design template');
    }

    if (!allowed) {
      return ctx.forbidden("You do not have access to this organization's resources.");
    }

    return super.delete(ctx);
  },
}))
