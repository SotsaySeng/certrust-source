/**
 * First-boot seeding for the tier-settings singleType.
 *
 * Replaces config/tiers.ts's hardcoded defaults (50 / 1000 / unlimited)
 * with an equivalent seeded record, so nothing silently changes behavior
 * the moment usage.ts starts reading limits from this singleType instead
 * of strapi.config.get(...). Idempotent: only seeds if
 * api::tier-settings.tier-settings has no record yet.
 */

const DEFAULT_TIER_SETTINGS = {
  free: { credentialLimit: 50, designTemplateLimit: 3, achievementLimit: 50, premiumTemplates: false },
  // Paid plans: credentialLimit per billing year, monthlyCredentialLimit per
  // billing month on a monthly subscription (see usage.getCredentialAllowance).
  pro: { credentialLimit: 1000, monthlyCredentialLimit: 100, designTemplateLimit: 50, achievementLimit: 1000, premiumTemplates: true },
  enterprise: { credentialLimit: null, monthlyCredentialLimit: 1000, designTemplateLimit: null, achievementLimit: null, premiumTemplates: true },
  // Limits while an organization is trialing: the design dimensions (see
  // usage.getDesignLimits) and credentials, ever (blank = follow the tier).
  trial: { credentialLimit: 50, designTemplateLimit: 10, achievementLimit: null, premiumTemplates: false },
};

/**
 * Records seeded before the Design Studio have no trial column and no
 * premiumTemplates flags. Add those - and only those - so every limit an
 * admin already set stays exactly as it was.
 */
async function addDesignStudioDefaults(strapi: any, existing: any): Promise<void> {
  const full: any = await strapi.documents('api::tier-settings.tier-settings').findFirst({
    populate: ['free', 'pro', 'enterprise', 'trial'],
  } as any);
  if (!full) return;
  const patch: any = {};
  for (const tier of ['free', 'pro', 'enterprise'] as const) {
    const col = full[tier];
    if (col && typeof col.premiumTemplates !== 'boolean') {
      const { id, ...rest } = col;
      patch[tier] = { ...rest, premiumTemplates: DEFAULT_TIER_SETTINGS[tier].premiumTemplates };
    }
  }
  if (!full.trial) patch.trial = DEFAULT_TIER_SETTINGS.trial;
  if (!Object.keys(patch).length) return;
  await strapi.documents('api::tier-settings.tier-settings').update({
    documentId: existing.documentId,
    data: patch,
  } as any);
  strapi.log.info(`[Seed] Tier settings: added Design Studio defaults (${Object.keys(patch).join(', ')}).`);
}

/**
 * Records seeded before per-period credential limits: credential limits
 * were lifetime, so one paid month bought a whole paid allowance for good,
 * and a trial ran on the full paid allowance. Sets the monthly limits and
 * the trial cap once: it only runs while Pro and Enterprise both have no
 * monthly limit, which is never true again after the first run.
 */
async function addMonthlyCredentialDefaults(strapi: any, existing: any): Promise<void> {
  const full: any = await strapi.documents('api::tier-settings.tier-settings').findFirst({
    populate: ['free', 'pro', 'enterprise', 'trial'],
  } as any);
  if (!full?.pro || !full?.enterprise) return;
  if (full.pro.monthlyCredentialLimit != null || full.enterprise.monthlyCredentialLimit != null) return;
  const strip = ({ id, ...rest }: any) => rest;
  const patch: any = {
    pro: { ...strip(full.pro), monthlyCredentialLimit: DEFAULT_TIER_SETTINGS.pro.monthlyCredentialLimit },
    enterprise: { ...strip(full.enterprise), monthlyCredentialLimit: DEFAULT_TIER_SETTINGS.enterprise.monthlyCredentialLimit },
  };
  if (full.trial && full.trial.credentialLimit == null) {
    patch.trial = { ...strip(full.trial), credentialLimit: DEFAULT_TIER_SETTINGS.trial.credentialLimit };
  }
  await strapi.documents('api::tier-settings.tier-settings').update({
    documentId: existing.documentId,
    data: patch,
  } as any);
  strapi.log.info(`[Seed] Tier settings: added monthly credential limits (${Object.keys(patch).join(', ')}).`);
}

export async function seedTierSettings(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::tier-settings.tier-settings').findFirst();

    if (existing) {
      await addDesignStudioDefaults(strapi, existing);
      await addMonthlyCredentialDefaults(strapi, existing);
      return;
    }

    strapi.log.info('[Seed] Seeding default tier settings...');

    await strapi.documents('api::tier-settings.tier-settings').create({
      data: DEFAULT_TIER_SETTINGS,
    } as any);

    strapi.log.info('[Seed] Tier settings seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding tier settings: ${message}`);
  }
}

export default seedTierSettings;
