/**
 * First-boot seeding for the solution-page singleType: the /solution
 * page's pricing plans. Seeded with the content that was previously
 * hardcoded in composables/useHomeContent.ts's `pricing` object +
 * locales/en.json's `home.pricing*` keys, plus illustrative example copy
 * for each tier's optional note/extraFeature (so a fresh install shows a
 * fuller template, not blank fields) - edit or clear these from the admin,
 * they're not commitments. Idempotent: only seeds if
 * api::solution-page.solution-page has no record yet.
 */

export async function seedSolutionPage(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::solution-page.solution-page').findFirst();

    if (existing) {
      strapi.log.info('[Seed] Solution page already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default solution page content...');

    await strapi.documents('api::solution-page.solution-page').create({
      data: {
        header: 'Plans that grow with your program',
        subheader: 'Every plan includes full Open Badges 3.0 issuance, public verification, and CSV batch issuance — the only difference is how many credentials, templates, and achievement types you get.',
        mostPopularLabel: 'Most popular',
        limitLabelCredentials: 'Credentials issued',
        limitLabelDesignTemplates: 'Design templates',
        limitLabelAchievements: 'Achievement types',
        coreFeature1: 'Full Open Badges 3.0 + W3C Verifiable Credentials issuance',
        coreFeature2: 'Public verification page for every credential',
        coreFeature3: 'CSV batch issuance',
        tiers: [
          {
            tierId: 'free',
            name: 'Free',
            tagline: 'For pilots, single events, and small programs',
            price: 'Free',
            credentialsLimit: '50',
            designTemplatesLimit: '50',
            achievementsLimit: '50',
            ctaLabel: 'Get started free',
            ctaHref: '/register',
            highlighted: false,
            note: 'No credit card required to get started.',
          },
          {
            tierId: 'pro',
            name: 'Pro',
            tagline: 'For growing programs across multiple courses or departments',
            price: 'Contact us',
            credentialsLimit: '1,000',
            designTemplatesLimit: '1,000',
            achievementsLimit: '1,000',
            extraFeature: 'Priority email support',
            ctaLabel: 'Get started free',
            ctaHref: '/register',
            highlighted: true,
            note: 'Every organization starts on Free — contact us any time to move to Pro.',
          },
          {
            tierId: 'enterprise',
            name: 'Enterprise',
            tagline: 'For large-scale, multi-department, or government-wide deployments',
            price: 'Custom',
            credentialsLimit: 'Unlimited',
            designTemplatesLimit: 'Unlimited',
            achievementsLimit: 'Unlimited',
            extraFeature: 'Self-hosting available for full data control',
            ctaLabel: 'Contact sales',
            ctaHref: 'mailto:hello@schroedinger-hat.org?subject=Certrust%20Enterprise%20inquiry',
            highlighted: false,
            note: 'Includes white-glove onboarding and a dedicated account manager.',
          },
        ],
      } as any,
    });

    strapi.log.info('[Seed] Solution page content seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding solution page content: ${message}`);
  }
}

export default seedSolutionPage;
