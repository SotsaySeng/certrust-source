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
  pro: { credentialLimit: 1000, designTemplateLimit: 50, achievementLimit: 1000, premiumTemplates: true },
  enterprise: { credentialLimit: null, designTemplateLimit: null, achievementLimit: null, premiumTemplates: true },
  // Design Studio limits while an organization is trialing (only the design
  // dimensions are read from this column - see usage.getDesignLimits).
  trial: { credentialLimit: null, designTemplateLimit: 10, achievementLimit: null, premiumTemplates: false },
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

export async function seedTierSettings(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::tier-settings.tier-settings').findFirst();

    if (existing) {
      await addDesignStudioDefaults(strapi, existing);
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
