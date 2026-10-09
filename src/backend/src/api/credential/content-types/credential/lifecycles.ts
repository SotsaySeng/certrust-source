/**
 * Lifecycle hooks for the Credential model
 *
 * beforeCreate enforces each organization's tier-based credential limit -
 * see api::tier-settings.tier-settings (admin-editable singleType) for
 * the per-tier ceilings and api::organization.usage for the live-count
 * query this replaces a stored counter with.
 *
 * Verified against node_modules/@strapi/database's entity-manager
 * (dist/entity-manager/index.js): `create(uid, params)` runs
 * `db.lifecycles.run('beforeCreate', uid, { params })` first - before
 * processData/insert/attachRelations - and neither that call nor
 * anything above it in the call chain wraps it in try/catch. So a thrown
 * error here propagates unmodified all the way up through
 * entityService/the Document Service, past the create() controller
 * action, out to the global `strapi::errors` middleware
 * (@strapi/core/dist/middlewares/errors.js), which turns any
 * @strapi/utils ApplicationError into a clean 4xx JSON response. No
 * try/catch needed in this hook itself.
 *
 * This is the one hook that covers both credential-creation paths in
 * this codebase:
 *  - the custom issue()/batchIssue() controller actions
 *    (src/api/credential/controllers/credential.ts), which call the
 *    credential service's issue() (services/credential.ts), which calls
 *    strapi.entityService.create('api::credential.credential', ...) with
 *    `issuer` as a plain numeric id (achievement.creator?.id).
 *  - the never-overridden default core `create` action (raw
 *    POST /credentials, routed in routes/credential-authenticated.ts),
 *    where Strapi's Document Service passes the request body's `data`
 *    through largely unchanged for relation fields - `issuer` may arrive
 *    as a plain id, `{ id }`, or `{ connect: [{ id }] }`.
 *
 * Both paths funnel through strapi.db.query('api::credential.credential')
 * .create(), so both fire this hook with event.params.data.issuer in
 * whichever of those shapes the caller used - normalized defensively
 * below.
 *
 * File shape (bare `export default { beforeCreate(event) {...} }`, no
 * strapi import - `strapi` is the ambient global) follows
 * api::achievement.achievement/lifecycles.ts's original shape. That
 * file's beforeCreate has since gained this same async tier-limit-check
 * pattern (appended after its original tag-sanitization logic, for
 * achievement's own "credential template" limit) - see its own header
 * comment.
 */

import { errors } from '@strapi/utils';

/**
 * A credential's issuer relation may arrive as a plain id, `{ id }`, or
 * `{ connect: [{ id }] }` depending on which creation path produced this
 * event's data (see header comment) - normalize defensively.
 */
function normalizeIssuerId(raw: any): string | number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string' || typeof raw === 'number') return raw;
  if (Array.isArray(raw)) {
    return raw.length > 0 ? normalizeIssuerId(raw[0]) : null;
  }
  if (typeof raw === 'object') {
    if (Array.isArray(raw.connect) && raw.connect.length > 0) {
      return normalizeIssuerId(raw.connect[0]);
    }
    if (Array.isArray(raw.set) && raw.set.length > 0) {
      return normalizeIssuerId(raw.set[0]);
    }
    if (raw.id !== undefined && raw.id !== null) {
      return normalizeIssuerId(raw.id);
    }
  }
  return null;
}

export default {
  async beforeCreate(event) {
    const { data } = event.params;

    // A create carrying an existing documentId is not a new credential
    // (Strapi re-created rows on every save while draft & publish was on).
    // Kept so an organization over its limit (e.g. after a downgrade) can
    // never be blocked from revoking or renewing credentials it already has.
    if (data.documentId) {
      const existing = await strapi.db.query('api::credential.credential').count({
        where: { documentId: data.documentId },
      } as any);
      if (existing > 0) return;
    }

    const issuerId = normalizeIssuerId(data.issuer);
    if (issuerId == null) {
      // No issuer given at all - nothing to scope a tier limit against.
      // Not this hook's job to enforce that issuer is present; let the
      // create proceed.
      return;
    }

    const issuer: any = await strapi.entityService.findOne('api::profile.profile', issuerId as any, {
      populate: ['organization'],
    } as any);

    // Legacy carve-out (issuer profile with no organization) - same
    // null-organization convention as src/policies/is-in-organization.ts
    // and api::profile.multi-tenancy. Also fails open if the issuer id
    // doesn't resolve to a real profile - not this hook's job to enforce
    // referential integrity, only tier limits.
    if (!issuer || !issuer.organization) {
      return;
    }

    const organizationId = issuer.organization.id;

    const usage = strapi.service('api::organization.usage');
    const limit = await usage.getCredentialLimit(issuer.organization);

    // null = unlimited (enterprise, or an unrecognized tier - fail open
    // rather than block issuance over a config problem).
    if (limit == null) {
      return;
    }

    const currentCount = await usage.countOrganizationCredentials(organizationId);
    if (currentCount >= limit) {
      throw new errors.ApplicationError(
        `This organization has reached its limit of ${limit} credentials. Buy more credentials or upgrade the plan on the Billing page to issue more.`
      );
    }
  },
};
