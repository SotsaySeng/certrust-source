/**
 * First-boot seeding for the solution-page singleType: the /solution
 * page's pricing cards. Idempotent: only seeds if
 * api::solution-page.solution-page has no record yet. An existing record
 * that still shows the first pricing copy gets applyPricingRefresh()
 * instead.
 */

/**
 * The pricing page's words. Three cards, named after the situation they
 * suit; the Free plan is not a card but the first credentials every
 * organization gets. Display copy only: the enforced limits live in Tier
 * Settings and the real prices in Stripe, so edit these in the Content
 * Manager when either changes.
 */
// What paid plans add over pay-per-certificate: the API, Google Sheets and
// Forms and the MCP connection all need API access (Pro and Enterprise).
const PRO_EXTRA_FEATURE = 'Google Sheets, Google Forms, the API and an MCP connection with Claude and ChatGPT. Priority email support';
const ENTERPRISE_EXTRA_FEATURE = 'All Year-round connections, plus a dedicated account manager';
// The cards' extra lines before that; an install still showing them gets
// applyConnectionsRefresh().
const FIRST_PRO_EXTRA_FEATURE = 'Google Sheets connector and priority email support';
const FIRST_ENTERPRISE_EXTRA_FEATURE = 'Integration API and a dedicated account manager';

const pricingCopy = () => ({
  header: 'Pay for the certificates you send',
  subheader: 'Your first 50 are free. After that, buy certificates for a single event or keep a plan running all year. Recipients and the people who check a certificate never pay.',
  mostPopularLabel: 'Start here',
  limitLabelCredentials: 'certificates',
  limitLabelDesignTemplates: 'designs',
  limitLabelAchievements: 'courses or awards',
  coreFeature1: 'A public page and QR code for every certificate',
  coreFeature2: 'Send to a whole list from one CSV file',
  coreFeature3: 'Free for recipients and for anyone checking',
  tiers: [
    {
      tierId: 'event',
      name: 'One event',
      tagline: 'A workshop, a seminar or a graduation day',
      price: '$0.20 per certificate',
      credentialsLimit: 'Prepaid',
      designTemplatesLimit: '5',
      achievementsLimit: '5',
      extraFeature: 'Buy 50 or more for $10 and up. Unused ones carry over to your next event',
      ctaLabel: 'Issue your first 50 free',
      ctaHref: '/register',
      highlighted: true,
      note: 'Pay once. There is no subscription.',
    },
    {
      tierId: 'pro',
      name: 'Year-round',
      tagline: 'Courses and trainings that run through the year',
      price: '$19/month or $199/year',
      credentialsLimit: '1,000',
      designTemplatesLimit: '50',
      achievementsLimit: '1,000',
      extraFeature: PRO_EXTRA_FEATURE,
      ctaLabel: 'Start free',
      ctaHref: '/register',
      highlighted: false,
      note: 'Every organisation starts free and can move up later.',
    },
    {
      tierId: 'enterprise',
      name: 'Institution-wide',
      tagline: 'Universities, ministries and large employers',
      price: '$59/month or $599/year',
      credentialsLimit: 'Unlimited',
      designTemplatesLimit: 'Unlimited',
      achievementsLimit: 'Unlimited',
      extraFeature: ENTERPRISE_EXTRA_FEATURE,
      ctaLabel: 'Start free',
      ctaHref: '/register',
      highlighted: false,
      note: 'Cancel any time. Your issued certificates keep verifying.',
    },
  ],
});

/** header of the first pricing copy. */
const FIRST_PRICING_HEADER = 'Plans that grow with your program';

/**
 * Replaces the first pricing copy with the current one on an install that
 * is still showing it. Same rule as homepage-seed's applyCopyRefresh: the
 * first header is the test, so once it has changed nothing here runs again
 * and later edits in the Content Manager are kept.
 */
export async function applyPricingRefresh(strapi: any, existing: any): Promise<void> {
  if (existing?.header !== FIRST_PRICING_HEADER) return;
  await strapi.documents('api::solution-page.solution-page').update({
    documentId: existing.documentId,
    data: pricingCopy(),
  } as any);
  strapi.log.info('[Seed] Solution page: replaced the first pricing copy with the current one.');
}

/**
 * Updates the Year-round and Institution-wide cards' extra line on an
 * install that still shows the first wording (Enterprise looked like the
 * only plan with the API, which Pro has too). A card whose line was edited
 * in the Content Manager is left alone, and once updated this never
 * matches again.
 */
export async function applyConnectionsRefresh(strapi: any, existing: any): Promise<void> {
  const full: any = await strapi.documents('api::solution-page.solution-page').findFirst({ populate: { tiers: true } } as any);
  const tiers: any[] = full?.tiers ?? [];
  const replace: Record<string, [string, string]> = {
    pro: [FIRST_PRO_EXTRA_FEATURE, PRO_EXTRA_FEATURE],
    enterprise: [FIRST_ENTERPRISE_EXTRA_FEATURE, ENTERPRISE_EXTRA_FEATURE],
  };
  let changed = false;
  const next = tiers.map(({ id, ...tier }) => {
    const rule = replace[tier.tierId];
    if (rule && tier.extraFeature === rule[0]) {
      changed = true;
      return { ...tier, extraFeature: rule[1] };
    }
    return tier;
  });
  if (!changed) return;
  await strapi.documents('api::solution-page.solution-page').update({
    documentId: existing.documentId,
    data: { tiers: next },
  } as any);
  strapi.log.info('[Seed] Solution page: plan cards now list Sheets, Forms, the API and the MCP connection.');
}

export async function seedSolutionPage(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::solution-page.solution-page').findFirst();

    if (existing) {
      await applyPricingRefresh(strapi, existing);
      await applyConnectionsRefresh(strapi, existing);
      strapi.log.info('[Seed] Solution page already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default solution page content...');

    await strapi.documents('api::solution-page.solution-page').create({
      data: pricingCopy() as any,
    });

    strapi.log.info('[Seed] Solution page content seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding solution page content: ${message}`);
  }
}

export default seedSolutionPage;
