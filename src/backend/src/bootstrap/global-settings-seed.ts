/**
 * First-boot seeding for the global-settings singleType: site-wide chrome
 * (header/footer logo, footer tagline/description/social/contact, footer
 * copyright line, and the footer's Quick Links / Resources / Legal link
 * lists). Seeded with the content that was previously hardcoded directly
 * in Header.vue/Footer.vue, so nothing visually changes on first boot -
 * from here, an admin can edit any of it from the Content Manager.
 * Idempotent: only seeds if api::global-settings.global-settings has no
 * record yet.
 */

import { uploadSeedImage } from './seed-image-upload';

export async function seedGlobalSettings(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::global-settings.global-settings').findFirst();

    if (existing) {
      strapi.log.info('[Seed] Global settings already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default global settings...');

    const logoId = await uploadSeedImage(strapi, 'logo.svg');

    await strapi.documents('api::global-settings.global-settings').create({
      data: {
        logo: logoId ?? undefined,
        description: 'Create, manage and issue digital certificates with ease.',
        socialGithubUrl: 'https://github.com/schroedinger-hat/certo',
        socialDiscordUrl: 'https://discord.gg/schroedinger-hat',
        socialTwitterUrl: 'https://twitter.com/schroedinger_hat',
        contactEmail: 'info@schroedinger-hat.org',
        contactWebsiteLabel: 'www.schroedinger-hat.org',
        contactWebsiteUrl: 'https://www.schroedinger-hat.org',
        copyrightText: 'Certrust © {year}. All rights reserved.',
        quickLinks: [
          { label: 'Home', url: '/' },
          { label: 'Dashboard', url: '/dashboard' },
          { label: 'Verify Credentials', url: '/verify' },
          { label: 'Issue Credentials', url: '/issue' },
          { label: 'LinkedIn Guide', url: '/linkedin' },
        ],
        resourceLinks: [
          { label: 'Documentation', url: 'https://github.com/schroedinger-hat/certo' },
          { label: 'Contributing', url: 'https://github.com/schroedinger-hat/certo/blob/main/CONTRIBUTING.md' },
          { label: 'Report an Issue', url: 'https://github.com/schroedinger-hat/certo/issues' },
          { label: 'About', url: '/about' },
        ],
        legalLinks: [
          { label: 'Privacy Policy', url: '/privacy-policy' },
          { label: 'Terms and Conditions', url: '/terms-and-conditions' },
          { label: 'LinkedIn Guide', url: '/linkedin' },
        ],
      } as any,
    });

    strapi.log.info('[Seed] Global settings seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding global settings: ${message}`);
  }
}

export default seedGlobalSettings;
