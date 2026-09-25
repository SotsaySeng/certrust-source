/**
 * Organization usage service
 *
 * Tier-limit enforcement is based on live COUNT queries against
 * credentials/design-templates/achievements (each scoped to an
 * organization, transitively through profile where there's no direct
 * `organization` column), not stored/incremented counters. Per-tier
 * limits themselves live in the api::tier-settings.tier-settings
 * singleType (Content Manager > Tier Settings - admin-editable, takes
 * effect immediately, no redeploy) - see
 * src/api/tier-settings/content-types/tier-settings/schema.json and its
 * settings.usage-limits component. This replaced an earlier
 * config/tiers.ts + strapi.config.get(...) approach (deleted once this
 * was verified live serving the same default values - see
 * .claude/plans/typed-forging-sphinx.md's Phase B section).
 *
 * This service supplies the lookups that the credential/design-template/
 * achievement beforeCreate lifecycle hooks (and organization.usage())
 * need.
 */

export type UsageDimension = 'credential' | 'designTemplate' | 'achievement';

const DIMENSION_LIMIT_FIELD: Record<UsageDimension, string> = {
  credential: 'credentialLimit',
  designTemplate: 'designTemplateLimit',
  achievement: 'achievementLimit',
};

export default () => ({
  /**
   * The limit for a tier + dimension, or null for unlimited (enterprise
   * by default, an unrecognized tier, a dimension left blank, or a
   * missing tier-settings record entirely - callers should fail open on
   * null, same convention as before).
   *
   * Reads the api::tier-settings.tier-settings singleType live on every
   * call (it's exactly one record, no id needed - hence findFirst()) so
   * an admin edit via Content Manager takes effect immediately with no
   * restart, which is the entire point of moving this off
   * config/tiers.ts. populate is required - Strapi doesn't populate
   * component fields by default.
   */
  async getTierLimit(tier: string, dimension: UsageDimension = 'credential'): Promise<number | null> {
    const tierSettings: any = await strapi.documents('api::tier-settings.tier-settings').findFirst({
      populate: ['free', 'pro', 'enterprise'],
    } as any);

    const tierComponent = tierSettings?.[tier];
    if (!tierComponent) return null;

    const field = DIMENSION_LIMIT_FIELD[dimension];
    return tierComponent[field] ?? null;
  },

  /**
   * Live count of credentials issued by any profile belonging to this
   * organization - the entire replacement for a stored
   * current_month_usage counter. credential has no direct `organization`
   * column by design, so this is scoped transitively through issuer, same
   * as src/policies/is-in-organization.ts.
   *
   * publishedAt: { $notNull: true } is required, not optional tidiness:
   * a draftAndPublish content type's create - confirmed directly, not
   * assumed - produces *two* physical rows per credential (a draft,
   * publishedAt: null, and a separately-published copy, sharing one
   * documentId), each with its own fully-attached `issuer` relation. This
   * is strapi.db.query(), the low-level query engine below the Document
   * Service - it has no notion of "status" and counts every matching row,
   * so without this filter every credential is counted twice (its draft
   * row and its published row both match `issuer.organization`),
   * reaching any tier limit at half the real count. Verified directly:
   * TIER_LIMIT_FREE=2, first credential created fine, second - the true
   * 2nd of 2 - was rejected as if it were the 3rd, before this filter was
   * added.
   */
  async countOrganizationCredentials(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::credential.credential').count({
      where: {
        issuer: { organization: organizationId },
        publishedAt: { $notNull: true },
      },
    } as any);
  },

  /**
   * Live count of design templates belonging to this organization.
   * Unlike credential/achievement, design-template has a *direct*
   * `organization` column (one hop, no profile indirection) - see
   * src/api/design-template/content-types/design-template/schema.json.
   *
   * publishedAt: { $notNull: true } - same double-row hazard as
   * countOrganizationCredentials above: design-template is
   * draftAndPublish: true, so every record produces a draft row
   * (publishedAt: null) plus, once published, a second published row
   * sharing one documentId. Without this filter every design template
   * would be counted twice.
   */
  async countOrganizationDesignTemplates(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::design-template.design-template').count({
      where: {
        organization: organizationId,
        publishedAt: { $notNull: true },
      },
    } as any);
  },

  /**
   * Live count of achievements created by any profile belonging to this
   * organization. achievement has no direct `organization` column (same
   * as credential, by design) - scoped transitively through
   * creator -> profile -> organization, two hops.
   *
   * publishedAt: { $notNull: true } - same double-row hazard as the two
   * count methods above; achievement is draftAndPublish: true too.
   */
  async countOrganizationAchievements(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::achievement.achievement').count({
      where: {
        creator: { organization: organizationId },
        publishedAt: { $notNull: true },
      },
    } as any);
  },
});
