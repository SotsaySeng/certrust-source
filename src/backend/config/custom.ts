// App-specific settings read via strapi.config.get('custom.<key>').
// The site's own URL is not repeated here - it lives in config/frontend.ts
// (strapi.config.get('frontend.url')).
export default ({ env }) => ({
  // Shown in credential emails as the address to contact for help. Defaults
  // to the Reply-To address, so participant replies and support requests
  // land in the same inbox.
  supportEmail: env('SUPPORT_EMAIL', env('SMTP_REPLY_TO', '')),
  // Data Protection Officer / trust & safety inbox: receives abuse and
  // takedown reports and issuer-verification requests, and is the contact
  // the Privacy Policy and DPA publish. Falls back to supportEmail.
  privacyEmail: env('PRIVACY_EMAIL', env('SUPPORT_EMAIL', env('SMTP_REPLY_TO', ''))),
  // See api/credential/services/notification-providers/index.ts
  notificationProvider: env('NOTIFICATION_PROVIDER', 'strapi-email'),
  // Daily "your credential expires soon" emails (expiration-scanner.ts)
  expirationNotificationsEnabled: env.bool('EXPIRATION_NOTIFICATIONS_ENABLED', true),
});
