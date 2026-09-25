/**
 * First-boot seeding for the billing-settings singleType, plus the
 * one-off launch migration that puts pre-billing organizations on a
 * trial (see api::billing.billing's migrateExistingOrgs). Both are
 * idempotent: the seed only runs when no record exists, and the
 * migration only touches orgs whose subscriptionStatus is still null.
 */

import { DEFAULT_BILLING_SETTINGS } from '../api/billing/services/billing';

export async function seedBillingSettings(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::billing-settings.billing-settings').findFirst();
    if (!existing) {
      strapi.log.info('[Seed] Seeding default billing settings (14-day Pro trial, no card)...');
      await strapi.documents('api::billing-settings.billing-settings').create({ data: DEFAULT_BILLING_SETTINGS } as any);
    }

    const { trials, kept } = await strapi.service('api::billing.billing').migrateExistingOrgs();
    if (trials || kept) {
      strapi.log.info(`[Seed] Billing launch migration: ${trials} organizations started a trial, ${kept} kept their current plan.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding billing settings: ${message}`);
  }
}

export default seedBillingSettings;
