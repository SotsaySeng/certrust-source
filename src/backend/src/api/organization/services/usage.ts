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
   * How many credentials this organization may issue, and since when they
   * count. Nothing here includes credential packs: those are a separate
   * top-up balance (packCreditsLeft / usePackCredit), spent only once this
   * allowance is used up.
   *
   * - trialing, with a trial credentialLimit set: that many, ever
   * - free: the free limit, ever
   * - paid, monthly subscription: monthlyCredentialLimit (or credentialLimit
   *   when blank) for the current billing month
   * - paid, yearly subscription or a hand-granted plan: credentialLimit for
   *   the current billing year (a hand-granted plan has no billing period,
   *   so the last 12 months)
   *
   * limit null = unlimited (also when no tier-settings record or column
   * exists: fail open, same as before).
   */
  async getCredentialAllowance(
    organization: { tier?: string | null, subscriptionStatus?: string | null, billingInterval?: string | null, currentPeriodEnd?: string | Date | null },
    now: Date = new Date(),
  ): Promise<{ limit: number | null, since: Date | null, period: 'lifetime' | 'month' | 'year' }> {
    const settings: any = await this.getTierSettings();
    const trialLimit = settings?.trial?.credentialLimit;
    if (organization.subscriptionStatus === 'trialing' && trialLimit != null) {
      return { limit: trialLimit, since: null, period: 'lifetime' };
    }
    const tier = organization.tier || 'free';
    const column = settings?.[tier];
    if (!column) return { limit: null, since: null, period: 'lifetime' };
    if (tier === 'free') return { limit: column.credentialLimit ?? null, since: null, period: 'lifetime' };

    const end = organization.currentPeriodEnd ? new Date(organization.currentPeriodEnd) : null;
    const since = new Date(end ?? now);
    // ponytail: period start = period end minus one month/year; Stripe's own
    // period start isn't stored. Can be off by a day or two at month ends.
    if (organization.billingInterval === 'month' && end && organization.subscriptionStatus !== 'none') {
      since.setUTCMonth(since.getUTCMonth() - 1);
      return { limit: column.monthlyCredentialLimit ?? column.credentialLimit ?? null, since, period: 'month' };
    }
    since.setUTCFullYear(since.getUTCFullYear() - 1);
    return { limit: column.credentialLimit ?? null, since, period: 'year' };
  },

  /** Credentials bought in packs and not yet spent. */
  packCreditsLeft(organization: { purchasedCredentials?: number | null, packCreditsUsed?: number | null }): number {
    return Math.max(0, (organization.purchasedCredentials || 0) - (organization.packCreditsUsed || 0));
  },

  /**
   * Spend one pack credit, atomically (one SQL update), so parallel
   * issuance can't spend the same credit twice. false = none left.
   * ponytail: spent before the credential row is written; if that write
   * then fails, the credit is gone. Hand it back in the admin if it matters.
   */
  async usePackCredit(organizationId: string | number): Promise<boolean> {
    const knex = strapi.db.connection;
    const changed = await knex('organizations')
      .where({ id: organizationId })
      .whereRaw('coalesce(pack_credits_used, 0) < coalesce(purchased_credentials, 0)')
      .update({ pack_credits_used: knex.raw('coalesce(pack_credits_used, 0) + 1') });
    return changed > 0;
  },

  /**
   * Organizations that bought packs before packCreditsUsed existed: under
   * the old rule a pack simply raised the lifetime limit, so whatever was
   * issued above the tier limit came out of the packs. Runs at boot, only
   * touches rows where packCreditsUsed is still empty.
   */
  async backfillPackCreditsUsed(): Promise<void> {
    const orgs: any[] = await strapi.db.query('api::organization.organization').findMany({
      where: { purchasedCredentials: { $gt: 0 }, packCreditsUsed: { $null: true } },
    } as any);
    for (const org of orgs) {
      const tierLimit = (await this.getTierLimit(org.tier || 'free', 'credential')) ?? 0;
      const issued = await this.countOrganizationCredentials(org.id);
      const used = Math.min(org.purchasedCredentials, Math.max(0, issued - tierLimit));
      await strapi.db.query('api::organization.organization').update({ where: { id: org.id }, data: { packCreditsUsed: used } } as any);
      strapi.log.info(`[usage] org ${org.id}: ${used} of ${org.purchasedCredentials} pack credits already spent`);
    }
  },

  /**
   * Live count of credentials issued by any profile belonging to this
   * organization, optionally only those created since a date - the entire
   * replacement for a stored current_month_usage counter. credential has
   * no direct `organization` column by design, so this is scoped
   * transitively through issuer, same as src/policies/is-in-organization.ts.
   */
  async countOrganizationCredentials(organizationId: string | number, since: Date | null = null): Promise<number> {
    return strapi.db.query('api::credential.credential').count({
      where: {
        issuer: { organization: organizationId },
        ...(since ? { createdAt: { $gte: since } } : {}),
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
