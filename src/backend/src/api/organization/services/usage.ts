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

/**
 * Design Studio limits for one organization, after choosing the right
 * Tier Settings column: 'trial' while the organization is trialing (when
 * that column has been configured), otherwise the organization's tier.
 */
export interface DesignLimits {
  /** Which Tier Settings column the limits came from. */
  source: string;
  /** Max saved designs (org-owned design templates). null = unlimited. */
  designTemplateLimit: number | null;
  /** May use Premium system templates. */
  premiumTemplates: boolean;
}

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
  async getTierSettings(): Promise<any> {
    return strapi.documents('api::tier-settings.tier-settings').findFirst({
      populate: ['free', 'pro', 'enterprise', 'trial'],
    } as any);
  },

  /**
   * Design Studio limits for an organization (needs tier and
   * subscriptionStatus). The trial column deliberately covers only the
   * design dimensions - credential/achievement limits keep following the
   * tier a trial runs on, exactly as before it existed.
   *
   * premiumTemplates falls back to "pro/enterprise yes, free no" when the
   * flag was never set on that column (records seeded before it existed).
   */
  async getDesignLimits(organization: { tier?: string | null, subscriptionStatus?: string | null } | null): Promise<DesignLimits> {
    const tier = organization?.tier || 'free';
    const settings: any = await this.getTierSettings();
    const trialing = organization?.subscriptionStatus === 'trialing' && settings?.trial;
    const source = trialing ? 'trial' : tier;
    const column = settings?.[source];
    if (!column) {
      return { source, designTemplateLimit: null, premiumTemplates: tier !== 'free' };
    }
    return {
      source,
      designTemplateLimit: column.designTemplateLimit ?? null,
      premiumTemplates: typeof column.premiumTemplates === 'boolean' ? column.premiumTemplates : tier !== 'free' && source !== 'trial',
    };
  },

  /**
   * May this organization create and use API keys? Follows the same
   * Tier Settings column as getDesignLimits (trial while trialing). When
   * the flag was never set on that column: every tier except Free.
   */
  async getApiAccess(organization: { tier?: string | null, subscriptionStatus?: string | null } | null): Promise<boolean> {
    const tier = organization?.tier || 'free';
    const settings: any = await this.getTierSettings();
    const trialing = organization?.subscriptionStatus === 'trialing' && settings?.trial;
    const flag = settings?.[trialing ? 'trial' : tier]?.apiAccess;
    return typeof flag === 'boolean' ? flag : tier !== 'free';
  },

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
   * The credential limit for one organization: its tier's limit plus the
   * credentials it bought (purchasedCredentials, written by the billing
   * webhook). null = unlimited, whatever was bought.
   */
  async getCredentialLimit(organization: { tier?: string | null, purchasedCredentials?: number | null }): Promise<number | null> {
    const limit = await this.getTierLimit(organization.tier, 'credential');
    return limit == null ? null : limit + (organization.purchasedCredentials || 0);
  },

  /**
   * Live count of credentials issued by any profile belonging to this
   * organization - the entire replacement for a stored
   * current_month_usage counter. credential has no direct `organization`
   * column by design, so this is scoped transitively through issuer, same
   * as src/policies/is-in-organization.ts.
   */
  async countOrganizationCredentials(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::credential.credential').count({
      where: {
        issuer: { organization: organizationId },
      },
    } as any);
  },

  /**
   * Live count of design templates belonging to this organization.
   * Unlike credential/achievement, design-template has a *direct*
   * `organization` column (one hop, no profile indirection) - see
   * src/api/design-template/content-types/design-template/schema.json.
   */
  async countOrganizationDesignTemplates(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::design-template.design-template').count({
      where: {
        organization: organizationId,
      },
    } as any);
  },

  /**
   * Live count of achievements created by any profile belonging to this
   * organization. achievement has no direct `organization` column (same
   * as credential, by design) - scoped transitively through
   * creator -> profile -> organization, two hops.
   */
  async countOrganizationAchievements(organizationId: string | number): Promise<number> {
    return strapi.db.query('api::achievement.achievement').count({
      where: {
        creator: { organization: organizationId },
      },
    } as any);
  },
});
