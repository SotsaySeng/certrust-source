/**
 * is-in-organization policy
 *
 * Registered as `global::is-in-organization` - files under src/policies/
 * follow the same src/<kind>/<name>.ts -> global::<name> auto-registration
 * as middlewares (see src/middlewares/api-version-alias.ts); policies work
 * the same way, just loaded from strapi.dirs.dist.policies instead.
 * Handler signature verified against
 * node_modules/@strapi/types/dist/core/policy.d.ts:
 * `(ctx, config, { strapi }) => boolean | undefined`.
 *
 * Enforces organization-scoped tenancy on write actions (create/update/
 * delete) for content types whose real "owner" is a profile, reached
 * either directly (achievement.creator, endorsement.endorser,
 * credential.issuer) or transitively through one extra hop
 * (evidence.credential -> credential.issuer). credential itself has no
 * direct `organization` column by design - tenancy is always resolved
 * transitively through profile, matching the tier-limit lifecycle hook at
 * api::credential.credential/lifecycles.ts.
 *
 * A profile with organization: null is a legacy/unrestricted resource -
 * exactly like the pre-existing `owner: null` carve-out in
 * api::profile.multi-tenancy - and is always allowed through, never denied.
 */

type RelationRef =
  | string
  | number
  | { id?: string | number }
  | { connect?: Array<string | number | { id: string | number }> }
  | { set?: Array<string | number | { id: string | number }> }
  | Array<string | number | { id: string | number }>
  | null
  | undefined;

/**
 * Normalize the shapes a Strapi relation input can arrive in for a create
 * (bare id, `{ id }`, `{ connect: [{ id }] }`, `{ set: [...] }`, or an
 * array of any of the above - first element wins) down to a single scalar
 * id, or null if nothing usable was found.
 */
const normalizeRelationId = (raw: RelationRef): string | number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? normalizeRelationId(raw[0]) : null;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, any>;
    if (Array.isArray(obj.connect) && obj.connect.length > 0) {
      return normalizeRelationId(obj.connect[0]);
    }
    if (Array.isArray(obj.set) && obj.set.length > 0) {
      return normalizeRelationId(obj.set[0]);
    }
    if (obj.id !== undefined && obj.id !== null) {
      return normalizeRelationId(obj.id);
    }
  }
  return null;
};

interface ThroughConfig {
  /** UID of the intermediate content type, e.g. 'api::credential.credential'. */
  uid: string;
  /** Relation field on the intermediate record that points at the profile. */
  field: string;
}

export interface IsInOrganizationConfig {
  /**
   * 'body'     - the profile (or, with `through`, an intermediate record)
   *              is referenced directly in the request body, at
   *              ctx.request.body.data[field]. Used for create actions.
   * 'existing' - the profile (or intermediate record) is reached by
   *              loading the record this route already identifies via
   *              ctx.params.id (content type `uid`), then reading `field`
   *              off it. Used for update/delete actions.
   */
  via: 'body' | 'existing';
  /** This route's own content-type UID. Required when via is 'existing'. */
  uid?: string;
  /** Field holding the profile id, or (with `through`) the intermediate record's id. */
  field: string;
  /** Optional second hop - e.g. evidence.credential -> credential.issuer. */
  through?: ThroughConfig;
}

type Resolution =
  | { status: 'no-claim' }
  | { status: 'unresolvable' }
  | { status: 'resolved'; profileId: string | number };

/**
 * Resolve "the profile this request acts on" per the route's `via` config.
 *
 * Returns 'no-claim' (not 'unresolvable') when the request simply doesn't
 * reference a profile-bearing field at all (e.g. achievement created with
 * no creator, evidence created with no credential) - there's nothing to
 * scope, so the caller allows the request through, consistent with this
 * policy's "restrict only on a positive cross-org conflict" posture.
 *
 * Returns 'unresolvable' when a field *was* given but points at a record
 * that doesn't exist - the caller denies this case, matching
 * api::profile.multi-tenancy's userOwnsProfile (`if (!profile) return
 * false`) precedent for a dangling reference.
 */
async function resolveProfileId(ctx: any, config: IsInOrganizationConfig, strapi: any): Promise<Resolution> {
  let directId: string | number | null;

  if (config.via === 'body') {
    directId = normalizeRelationId(ctx.request?.body?.data?.[config.field]);
  } else {
    // via: 'existing' - ctx.params.id here is a *documentId* string, not
    // the legacy numeric id. All four content types this policy is wired
    // into (achievement, evidence, endorsement, credential) have
    // draftAndPublish enabled, and Strapi 5's default core update/delete
    // actions route through the Document Service, which only resolves
    // routes by documentId - a numeric id in this position 404s before
    // this policy is even involved (verified directly: GET
    // /api/achievements/<numeric id> -> 404 NotFoundError, GET
    // /api/achievements/<documentId> -> 200). strapi.entityService (the
    // legacy v4-style compatibility API) only understands numeric ids and
    // silently returns null for a documentId string, which would make
    // every update/delete on these routes deny as 'unresolvable'
    // regardless of the actual caller - so this specifically has to use
    // strapi.documents(uid).findOne({ documentId }), the Document Service
    // API that documentId is native to. status: 'published' is required
    // here too - findOne() without it defaults to the *draft* row, which
    // (verified directly) can have stale/incomplete relation data: a
    // partial update (e.g. `{ data: { description: '...' } }`, not
    // re-specifying `creator`) updates the published row correctly but
    // leaves the draft row's `creator` null, which would otherwise make
    // this resolve to 'no-claim' and fall through to an open allow.
    // status: 'published' matches this codebase's own convention for
    // reading these content types - e.g. credential.ts controller's
    // issue()/verify()/export() and achievement.ts controller's
    // findWithCredentials()/findByCreator() all explicitly filter
    // status: 'published'.
    const recordId = ctx.params?.id;
    if (!recordId || !config.uid) return { status: 'no-claim' };
    const record: any = await strapi.documents(config.uid as any).findOne({
      documentId: recordId,
      status: 'published',
      populate: [config.field],
    } as any);
    if (!record) return { status: 'unresolvable' };
    directId = normalizeRelationId(record[config.field]);
  }

  if (directId == null) return { status: 'no-claim' };
  if (!config.through) return { status: 'resolved', profileId: directId };

  // status: 'published' - see the long comment above on why this is
  // required for every entityService.findOne/findMany call in this file:
  // it silently re-resolves by documentId under the hood and defaults to
  // the draft row otherwise (verified directly against this repo's
  // installed @strapi/core - services/entity-service/index.js's findOne
  // does a raw `where: { id }` lookup *only* to discover the row's
  // documentId, then throws that row away and re-fetches via
  // strapi.documents(uid).findOne({ documentId, ...opts }), which
  // defaults to draft when opts.status is unset).
  const intermediate: any = await strapi.entityService.findOne(config.through.uid as any, directId, {
    status: 'published',
    populate: [config.through.field],
  } as any);
  if (!intermediate) return { status: 'unresolvable' };

  const profileId = normalizeRelationId(intermediate[config.through.field]);
  if (profileId == null) return { status: 'no-claim' };
  return { status: 'resolved', profileId };
}

/**
 * Check whether `user` owns or belongs to the organization of the profile
 * identified by `profileId`. Shared by both the "current value" and
 * "proposed new value" checks in isInOrganization below - see that
 * function's own comment for why an update needs both.
 */
async function checkProfileAccess(user: any, profileId: string | number, strapi: any): Promise<boolean> {
  // status: 'published' - see resolveProfileId's through-lookup comment.
  const profile: any = await strapi.entityService.findOne('api::profile.profile', profileId as any, {
    status: 'published',
    populate: { owner: true, organization: { populate: ['members'] } },
  } as any);

  if (!profile) return false;

  // Direct ownership always wins.
  if (profile.owner?.id === user.id) return true;

  // organization: null is the legacy/unrestricted carve-out - same
  // convention as owner: null elsewhere in this codebase. Always allow,
  // never deny.
  if (!profile.organization) return true;

  return (profile.organization.members ?? []).some((m: any) => m.id === user.id);
}

// NOTE: plain ctx.forbidden(...) (the shorthand most Strapi docs show)
// does NOT work from inside a policy handler - @strapi/utils'
// createPolicyContext rebuilds the ctx object with
// Object.assign({is, type}, ctx), which copies ctx's own-enumerable
// properties but drops the app.context prototype chain that the
// forbidden/badRequest/etc. response shorthands are delegated onto
// (they're added to the shared Koa app.context/app.response prototypes
// via the `delegates` package, not as own properties of any individual
// request's ctx). Calling ctx.forbidden(...) here throws "not a
// function". ctx.response is copied by reference though (it's a real
// own property of ctx), and *its* prototype chain is intact, so
// ctx.response.forbidden(...) works below. Confirmed by direct inspection
// of this repo's installed @strapi/core (services/server/koa.js) and
// @strapi/utils (policy.js) - not just framework docs.
const isInOrganization = async (ctx: any, config: IsInOrganizationConfig, { strapi }: { strapi: any }): Promise<boolean> => {
  const user = ctx.state.user;
  if (!user) {
    ctx.response.forbidden('You must be logged in.');
    return false;
  }

  const resolution = await resolveProfileId(ctx, config, strapi);

  if (resolution.status === 'unresolvable') {
    ctx.response.forbidden('The referenced record could not be found.');
    return false;
  }

  if (resolution.status === 'resolved' && !(await checkProfileAccess(user, resolution.profileId, strapi))) {
    ctx.response.forbidden("You do not have access to this organization's resources.");
    return false;
  }

  // via: 'existing' only checks the record's CURRENTLY PERSISTED relation
  // value above - a caller who owns that current value would otherwise
  // pass regardless of what they're actually submitting. Strapi's default
  // update action (used by every route this policy is wired into) writes
  // any relation field present in the body with no further check, so a
  // caller could reassign e.g. credential.issuer or achievement.creator
  // onto a different organization's profile in the very same request that
  // passed the check above. Re-resolve and re-check the NEW value too,
  // whenever the request body is actually touching this field.
  if (config.via === 'existing' && config.field in (ctx.request?.body?.data ?? {})) {
    const proposed = await resolveProfileId(ctx, { ...config, via: 'body' }, strapi);

    if (proposed.status === 'unresolvable') {
      ctx.response.forbidden('The referenced record could not be found.');
      return false;
    }

    if (proposed.status === 'resolved' && !(await checkProfileAccess(user, proposed.profileId, strapi))) {
      ctx.response.forbidden("You do not have access to this organization's resources.");
      return false;
    }
  }

  return true;
};

export default isInOrganization;
