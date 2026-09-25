import type { Core } from '@strapi/strapi';
import { seedDevelopmentData } from './bootstrap/seed-data';
import { setupPermissions } from './bootstrap/permissions-setup';
import { warnIfDefaultAdminCredentials } from './bootstrap/default-credentials-warning';
import { seedOrgTypes } from './bootstrap/org-type-seed';
import { seedTierSettings } from './bootstrap/tier-settings-seed';
import { seedBillingSettings } from './bootstrap/billing-settings-seed';
import { seedGlobalSettings } from './bootstrap/global-settings-seed';
import { seedHomepage } from './bootstrap/homepage-seed';
import { seedSolutionPage } from './bootstrap/solution-page-seed';
import { setupEmailConfirmation } from './bootstrap/email-confirmation-setup';
import { setupEmailSender } from './bootstrap/email-sender-setup';
import { setupEmailBranding } from './bootstrap/email-branding';
import { startDevMailCatcher } from './bootstrap/dev-mail-catcher';
import { assertPersistentStorage } from './bootstrap/persistence-guard';
import { registerMonitoringRoutes } from './monitoring/routes';

/**
 * Main entry point for the Strapi application
 */

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // First thing, before anything can write: a production instance must
    // keep its data and uploads off the container's wipeable disk.
    assertPersistentStorage();

    // Must happen here, not in bootstrap(): Strapi finalizes routing
    // (server.initRouting()) partway through its own bootstrap(), before
    // this app's bootstrap({ strapi }) hook runs - see monitoring/routes.ts.
    registerMonitoringRoutes(strapi);
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Local dev SMTP sink, opt-in via DEV_MAIL_CATCHER - must be up before
    // anything can send mail, and never runs in production. See
    // bootstrap/dev-mail-catcher.ts for why local dev needs one at all.
    await startDevMailCatcher(strapi);

    // First-boot seeding for org-scoped lookup/settings data - must run
    // before anything that could create org-scoped data itself
    // (self-service registration provisioning needs org-types to exist;
    // the tier-limit lifecycle hooks need tier-settings to exist).
    await seedOrgTypes(strapi);
    await seedTierSettings(strapi);
    await seedBillingSettings(strapi);

    // First-boot content for the admin-editable homepage/footer CMS -
    // independent of the org/tier seeding above, order doesn't matter
    // relative to it.
    await seedGlobalSettings(strapi);
    await seedHomepage(strapi);
    await seedSolutionPage(strapi);

    // Real email verification - flips the users-permissions plugin's
    // DB-backed store (not config/plugins.ts, which is dead for this key
    // - see bootstrap/email-confirmation-setup.ts's header comment).
    await setupEmailConfirmation(strapi);
    // ...and send those confirmation/reset emails from SMTP_FROM rather than
    // the plugin's seeded no-reply@strapi.io (see bootstrap/email-sender-setup.ts).
    await setupEmailSender(strapi);
    // ...and put the Certrust logo at the top of every email sent.
    setupEmailBranding(strapi);

    // Seed development data (only creates data if it doesn't exist)
    await seedDevelopmentData(strapi);

    // Setup all permissions (public, authenticated roles)
    await setupPermissions(strapi);

    // Warn on every boot if the default admin credentials are still active,
    // regardless of environment (see bootstrap/default-credentials-warning.ts)
    await warnIfDefaultAdminCredentials(strapi);

    // Schedule daily credential expiration scan.
    // Run once at startup (30s delay to let Strapi fully settle) and then every 24h.
    const runExpirationCheck = async () => {
      try {
        const scanner = strapi.service('api::credential.expiration-scanner');
        await scanner.runDailyCheck();
      } catch (err: any) {
        strapi.log.error('[bootstrap] Expiration scanner error:', { error: err.message });
      }
    };

    setTimeout(runExpirationCheck, 30_000);
    setInterval(runExpirationCheck, 24 * 60 * 60 * 1000);

    // Schedule daily check for pending scheduled issuances.
    // Runs on startup (30s delay) then every 24h — processes any issuances due today.
    const runScheduledIssuanceCheck = async () => {
      try {
        const scanner = strapi.service('api::scheduled-issuance.scheduled-issuance-scanner');
        await scanner.runDailyCheck();
      } catch (err: any) {
        strapi.log.error('[bootstrap] Scheduled issuance scanner error:', { error: err.message });
      }
    };

    setTimeout(runScheduledIssuanceCheck, 35_000);
    setInterval(runScheduledIssuanceCheck, 24 * 60 * 60 * 1000);

    // Delete issuer-verification documents 90 days after their request was
    // decided (Privacy Policy s.9 - see api/trust/services/verification-documents.ts).
    const runVerificationDocumentPurge = async () => {
      try {
        await strapi.service('api::trust.verification-documents').purgeExpired();
      } catch (err: any) {
        strapi.log.error('[bootstrap] Verification document purge error:', { error: err.message });
      }
    };

    setTimeout(runVerificationDocumentPurge, 45_000);
    setInterval(runVerificationDocumentPurge, 24 * 60 * 60 * 1000);

    // Billing scanner: trial/renewal reminders, trial expiry, past-due
    // grace. Every 6h rather than daily so a trial that ends mid-day drops
    // to Free within hours; notices are deduped, so extra runs are free.
    const runBillingCheck = async () => {
      try {
        await strapi.service('api::billing.billing-scanner').runDailyCheck();
      } catch (err: any) {
        strapi.log.error('[bootstrap] Billing scanner error:', { error: err.message });
      }
    };

    // BILLING_SCANNER_ENABLED=false keeps it off until Stripe is actually
    // live: otherwise it emails trial reminders to every org (test orgs
    // included) and drops orgs to Free when their launch trial ends, all
    // without anyone being able to pay.
    if (process.env.BILLING_SCANNER_ENABLED?.toLowerCase() === 'false') {
      strapi.log.info('[bootstrap] Billing scanner disabled via BILLING_SCANNER_ENABLED=false.');
    } else {
      setTimeout(runBillingCheck, 40_000);
      setInterval(runBillingCheck, 6 * 60 * 60 * 1000);
    }
  },
};
