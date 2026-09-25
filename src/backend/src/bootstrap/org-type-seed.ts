/**
 * First-boot seeding for organization types.
 *
 * Runs in *all* environments - unlike seed-data.ts's sample credentials/
 * achievements (dev-only, gated on NODE_ENV !== 'production'), an empty
 * org-type list would permanently block self-service registration's
 * organization-type dropdown on any fresh install, including production.
 * Idempotent: only seeds if api::org-type.org-type has zero rows.
 */

const DEFAULT_ORG_TYPES = ['Private', 'Public', 'Nonprofit / NGO', 'Educational', 'Government', 'Other'];

export async function seedOrgTypes(strapi: any): Promise<void> {
  try {
    const existingCount = await strapi.db.query('api::org-type.org-type').count();

    if (existingCount > 0) {
      strapi.log.info('[Seed] Organization types already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default organization types...');

    for (const name of DEFAULT_ORG_TYPES) {
      await strapi.entityService.create('api::org-type.org-type', {
        data: { name },
      });
    }

    strapi.log.info(`[Seed] Seeded ${DEFAULT_ORG_TYPES.length} organization types: ${DEFAULT_ORG_TYPES.join(', ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding organization types: ${message}`);
  }
}

export default seedOrgTypes;
