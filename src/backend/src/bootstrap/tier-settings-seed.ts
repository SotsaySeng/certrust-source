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
  free: { credentialLimit: 50, designTemplateLimit: 50, achievementLimit: 50 },
  pro: { credentialLimit: 1000, designTemplateLimit: 1000, achievementLimit: 1000 },
  enterprise: { credentialLimit: null, designTemplateLimit: null, achievementLimit: null },
};

export async function seedTierSettings(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::tier-settings.tier-settings').findFirst();

    if (existing) {
      strapi.log.info('[Seed] Tier settings already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default tier settings (free: 50, pro: 1000, enterprise: unlimited)...');

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
