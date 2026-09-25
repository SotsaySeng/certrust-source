/**
 * Real email verification - bootstrap-time fix.
 *
 * config/plugins.ts's users-permissions.config.advanced.email_confirmation
 * is dead configuration - verified directly against
 * @strapi/plugin-users-permissions' installed source
 * (dist/server/bootstrap/index.js's initAdvancedOptions): the plugin
 * seeds a DB-backed plugin store ('advanced' key) with its own fully
 * hardcoded defaults exactly once, the very first time that store key has
 * no value at all, and never reads config/plugins.ts for it again
 * afterward (verified live against this repo's local dev DB: the seeded
 * store row has email_reset_password: null despite config/plugins.ts
 * defining a full custom template for it - that config block has simply
 * never been consulted here). auth.js's actual runtime checks
 * (register/callback) read exclusively from that store value, so the
 * only way to really turn email confirmation on is an explicit
 * pluginStore.set(...) write - matching this codebase's own established
 * one-time-idempotent-setup pattern (see permissions-setup.ts), not a
 * config/plugins.ts edit that would silently do nothing.
 *
 * Idempotent: reads the current store value and only writes back if
 * email_confirmation, email_confirmation_redirection and
 * email_reset_password aren't already exactly what this app wants, preserving every other existing key
 * (unique_email, allow_register, default_role,
 * etc.) untouched.
 */

const FRONTEND_URL_CONFIG_KEY = 'frontend.url';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

export async function setupEmailConfirmation(strapi: any): Promise<void> {
  strapi.log.info('[EmailConfirmation] Checking email confirmation settings...');

  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const advanced = (await pluginStore.get({ key: 'advanced' })) || {};

    const frontendUrl = strapi.config.get(FRONTEND_URL_CONFIG_KEY, DEFAULT_FRONTEND_URL);
    const desiredRedirect = `${frontendUrl}/login?confirmed=true`;
    // Base URL of the reset link in the forgot-password email (the plugin
    // appends ?code=<token>; pages/reset-password.vue reads it). The plugin
    // seeds this as null, which made every reset email link to
    // "null?code=..." - including the "Set Your Password" path that newly
    // issued credential recipients are sent down.
    const desiredResetUrl = `${frontendUrl}/reset-password`;

    const alreadyCorrect =
      advanced.email_confirmation === true &&
      advanced.email_confirmation_redirection === desiredRedirect &&
      advanced.email_reset_password === desiredResetUrl;

    if (alreadyCorrect) {
      strapi.log.info('[EmailConfirmation] Already enabled with the correct redirect, skipping.');
      return;
    }

    await pluginStore.set({
      key: 'advanced',
      value: {
        ...advanced,
        email_confirmation: true,
        email_confirmation_redirection: desiredRedirect,
        email_reset_password: desiredResetUrl,
      },
    });

    strapi.log.info(
      `[EmailConfirmation] Enabled email confirmation; confirmed users redirect to ${desiredRedirect}, password resets link to ${desiredResetUrl}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[EmailConfirmation] Error setting up email confirmation: ${message}`);
  }
}

export default setupEmailConfirmation;
