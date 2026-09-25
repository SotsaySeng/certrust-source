/**
 * Keeps the sender of the users-permissions emails (signup confirmation,
 * password reset) in step with SMTP_FROM / SMTP_REPLY_TO.
 *
 * Those two emails don't use the email plugin's defaultFrom: the plugin
 * sends them with the `from` and `response_email` stored per template in
 * its DB-backed plugin store ('email' key). It seeds that store once with
 * its own defaults - "Administration Panel" <no-reply@strapi.io> - and never
 * re-reads config (the same seed-once behaviour documented in
 * email-confirmation-setup.ts). A provider that only sends from onboarded
 * domains (Cloudflare Email Service) rejects that address outright, and
 * Gmail silently rewrites it.
 *
 * Runs on every boot, but only when SMTP_FROM is set, and only rewrites the
 * sender fields - subject and body templates (editable in the admin panel)
 * are left untouched.
 */

const DEFAULT_SENDER_NAME = 'Certrust';

/** Parses `Name <addr@host>` or a bare `addr@host`. */
export function parseMailbox(value: string | undefined): { name: string; email: string } | null {
  const raw = (value || '').trim();
  if (!raw) return null;

  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = match[2].trim();
    return email ? { name: match[1].trim() || DEFAULT_SENDER_NAME, email } : null;
  }

  return raw.includes('@') ? { name: DEFAULT_SENDER_NAME, email: raw } : null;
}

export async function setupEmailSender(strapi: any): Promise<void> {
  const from = parseMailbox(process.env.SMTP_FROM);
  if (!from) {
    strapi.log.info('[EmailSender] SMTP_FROM not set, leaving users-permissions email senders unchanged.');
    return;
  }
  const replyTo = parseMailbox(process.env.SMTP_REPLY_TO)?.email || from.email;

  try {
    const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
    const templates = await pluginStore.get({ key: 'email' });
    if (!templates || typeof templates !== 'object') {
      strapi.log.warn('[EmailSender] users-permissions email store not initialised yet, skipping.');
      return;
    }

    let changed = false;
    for (const template of Object.values<any>(templates)) {
      const options = template?.options;
      if (!options) continue;
      if (options.from?.name !== from.name || options.from?.email !== from.email || options.response_email !== replyTo) {
        options.from = { name: from.name, email: from.email };
        options.response_email = replyTo;
        changed = true;
      }
    }

    if (!changed) {
      strapi.log.info('[EmailSender] Confirmation/reset email sender already matches SMTP_FROM.');
      return;
    }

    await pluginStore.set({ key: 'email', value: templates });
    strapi.log.info(`[EmailSender] Confirmation/reset emails now sent as "${from.name}" <${from.email}>, replies to ${replyTo}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[EmailSender] Error syncing email sender: ${message}`);
  }
}

export default setupEmailSender;
