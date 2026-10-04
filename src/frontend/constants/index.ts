/**
 * URL of the Certrust website.
 *
 * Defaults to the production URL for convenience but can be overridden
 * via the NUXT_PUBLIC_WEBSITE_URL env var for self-hosted deployments.
 * This powers canonical links, OG images, shareable URLs, and QR codes
 * on certificates.
 *
 * @see docs/known-issues-and-dev-notes.md item 33
 */
export const WEBSITE_URL = import.meta.env?.NUXT_PUBLIC_WEBSITE_URL
  ?? process.env.NUXT_PUBLIC_WEBSITE_URL
  ?? 'http://localhost:3000'

export const HEADER_NAV_LINKS = [
  { name: 'Home', href: '/', i18nKey: 'home' },
  { name: 'About', href: '/about', i18nKey: 'about' },
  { name: 'Dashboard', href: '/dashboard', i18nKey: 'dashboard', requiresAuth: true },
  { name: 'Issue Badges', href: '/issue', i18nKey: 'issue', requiresAuth: true, requiresIssuer: true },
  { name: 'Design Templates', href: '/design-templates', i18nKey: 'designTemplates', requiresAuth: true, requiresIssuer: true },
  { name: 'Events', href: '/events', i18nKey: 'events', requiresAuth: true, requiresIssuer: true },
  { name: 'Solution', href: '/solution', i18nKey: 'solution' },
  { name: 'Verify', href: '/verify', i18nKey: 'verify' },
]
// Issuer pages, grouped under the header's "Manage" menu (Header.vue).
// i18nKey is a full locale key.
export const MANAGE_MENU_LINKS = [
  { href: '/dashboard', i18nKey: 'nav.dashboard', icon: 'i-heroicons-home' },
  { href: '/issue', i18nKey: 'nav.issue', icon: 'i-heroicons-paper-airplane' },
  { href: '/achievements/create', i18nKey: 'achievements.createTitle', icon: 'i-heroicons-plus-circle' },
  { href: '/design-templates', i18nKey: 'nav.designTemplates', icon: 'i-heroicons-paint-brush' },
  { href: '/events', i18nKey: 'nav.events', icon: 'i-heroicons-calendar-days' },
  { href: '/api-keys', i18nKey: 'nav.apiKeys', icon: 'i-heroicons-key' },
]
// Public integration manuals, grouped under the header's "Developers" menu
// (Header.vue). No sign-in needed for any of them.
export const DEVELOPERS_MENU_LINKS = [
  { href: '/integrations', i18nKey: 'nav.dev.overview', icon: 'i-heroicons-puzzle-piece' },
  { href: '/integrations/google-sheets', i18nKey: 'nav.dev.googleSheets', icon: 'i-heroicons-table-cells' },
  { href: '/integrations/google-forms', i18nKey: 'nav.dev.googleForms', icon: 'i-heroicons-clipboard-document-list' },
  { href: '/integrations/student-records', i18nKey: 'nav.dev.studentRecords', icon: 'i-heroicons-academic-cap' },
  { href: '/integrations/guide', i18nKey: 'nav.dev.apiGuide', icon: 'i-heroicons-code-bracket' },
]
export const HELLO_SH_MAIL = 'mailto:hello@schroedinger-hat.org'
