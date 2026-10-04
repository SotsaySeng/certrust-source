/**
 * First-boot seeding for the homepage singleType: hero, feature grid,
 * how-it-works walkthrough, audience segments, integrations, and closing CTA. Seeded
 * with the content that was previously hardcoded in
 * composables/useHomeContent.ts + locales/en.json's `home.*` keys, so
 * nothing visually changes on first boot. Idempotent: only seeds if
 * api::homepage.homepage has no record yet.
 */

import { uploadSeedImage } from './seed-image-upload';

/**
 * Defaults for the live platform-stats strip. Kept in one place because they
 * are written from two directions: into the create() below for a fresh
 * install, and by addPlatformStatsDefaults() into an install that predates
 * these fields.
 */
const STATS_DEFAULTS = {
  statsEnabled: true,
  statsMinimumCount: 5,
  statsHeading: 'Live on Certrust today',
  statsOrganizationsLabel: 'Organizations',
  statsAchievementsLabel: 'Achievements',
  statsEventsLabel: 'Events',
  statsCredentialsLabel: 'Credentials issued',
} as const;

const STATS_LABEL_KEYS = [
  'statsHeading',
  'statsOrganizationsLabel',
  'statsAchievementsLabel',
  'statsEventsLabel',
  'statsCredentialsLabel',
] as const;

/**
 * Records seeded before the platform-stats strip existed hold NULL in every
 * stats column - a schema `default` only applies to rows created after the
 * column was added - and controllers/homepage.ts treats a NULL statsEnabled as
 * OFF. Without this back-fill the strip would stay invisible forever on every
 * already-installed instance, with no error to explain why.
 *
 * Adds the missing fields and ONLY the missing fields, so any copy or
 * threshold an admin has already changed survives every subsequent boot.
 * Same shape as tier-settings-seed.ts's addDesignStudioDefaults().
 */
export async function addPlatformStatsDefaults(strapi: any, existing: any): Promise<void> {
  const full: any = await strapi.documents('api::homepage.homepage').findFirst();
  if (!full) return;

  const patch: any = {};

  // typeof, not truthiness: `false` is a deliberate admin choice to switch the
  // strip off, and `if (!full.statsEnabled)` would silently turn it back on
  // every boot.
  if (typeof full.statsEnabled !== 'boolean') {
    patch.statsEnabled = STATS_DEFAULTS.statsEnabled;
  }
  // typeof again, because typeof 0 === 'number': an admin who lowered the
  // threshold to 0 keeps it (the controller clamps to >= 1 at read time). A
  // truthiness check would reset them to 25 on every boot.
  if (typeof full.statsMinimumCount !== 'number') {
    patch.statsMinimumCount = STATS_DEFAULTS.statsMinimumCount;
  }
  for (const key of STATS_LABEL_KEYS) {
    // `== null` catches null and undefined only, never ''. An admin who
    // cleared statsHeading to blank meant it, and re-filling it every boot
    // would be an un-undoable bug.
    if (full[key] == null) {
      patch[key] = STATS_DEFAULTS[key];
    }
  }

  if (!Object.keys(patch).length) return;

  await strapi.documents('api::homepage.homepage').update({
    documentId: existing.documentId,
    data: patch,
  } as any);
  strapi.log.info(`[Seed] Homepage: added platform-stats defaults (${Object.keys(patch).join(', ')}).`);
}

/**
 * Defaults for the "Works with your systems" section: the integration
 * manuals under /integrations. Written into a fresh install by the create()
 * below, and into an install that predates the section by
 * addIntegrationsDefaults().
 */
const INTEGRATIONS_DEFAULTS = {
  integrationsEnabled: true,
  integrationsHeader: 'Issue from the tools you already use',
  integrationsSubheader: 'Keep your records where they are. Connect a spreadsheet, a form or your student records system, and certificates go out on their own.',
  integrationsLinkLabel: 'See how integrations work',
  integrations: [
    {
      title: 'Google Sheets',
      tag: 'No technical knowledge',
      description: 'Add a row with a name and an email. The certificate is issued and its link appears in the sheet.',
      icon: 'table-cells',
      url: '/integrations/google-sheets',
    },
    {
      title: 'Google Forms',
      tag: 'No technical knowledge',
      description: 'Everyone who submits your attendance or completion form receives their certificate.',
      icon: 'clipboard-document-list',
      url: '/integrations/google-forms',
    },
    {
      title: 'Universities and colleges',
      tag: 'For your IT team',
      description: 'Issue from your student records system with a nightly export. Student data stays with you.',
      icon: 'academic-cap',
      url: '/integrations/student-records',
    },
    {
      title: 'API for any system',
      tag: 'For developers',
      description: 'One request issues a credential. Keys with limited permissions, safe retries and background jobs for large groups.',
      icon: 'code-bracket',
      url: '/integrations/guide',
    },
  ],
} as const;

const INTEGRATIONS_TEXT_KEYS = ['integrationsHeader', 'integrationsSubheader', 'integrationsLinkLabel'] as const;

/**
 * Adds the integrations section to a homepage record that predates it.
 *
 * integrationsEnabled doubles as the "already back-filled" marker: it is
 * NULL only on a record that has never had the section. The cards are
 * written that one time only, so an admin who later removes or rewrites
 * them (or switches the section off) is never overridden on a later boot.
 * The three text fields follow addPlatformStatsDefaults: filled when null,
 * left alone when an admin has cleared them to ''.
 */
export async function addIntegrationsDefaults(strapi: any, existing: any): Promise<void> {
  const full: any = await strapi.documents('api::homepage.homepage').findFirst();
  if (!full) return;

  const patch: any = {};
  if (typeof full.integrationsEnabled !== 'boolean') {
    patch.integrationsEnabled = INTEGRATIONS_DEFAULTS.integrationsEnabled;
    patch.integrations = INTEGRATIONS_DEFAULTS.integrations.map(item => ({ ...item }));
  }
  for (const key of INTEGRATIONS_TEXT_KEYS) {
    if (full[key] == null) {
      patch[key] = INTEGRATIONS_DEFAULTS[key];
    }
  }

  if (!Object.keys(patch).length) return;

  await strapi.documents('api::homepage.homepage').update({
    documentId: existing.documentId,
    data: patch,
  } as any);
  strapi.log.info(`[Seed] Homepage: added integrations defaults (${Object.keys(patch).join(', ')}).`);
}

export async function seedHomepage(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::homepage.homepage').findFirst();

    if (existing) {
      // Not a plain early return: fields added after this record was first
      // seeded still need back-filling on every existing install.
      await addPlatformStatsDefaults(strapi, existing);
      await addIntegrationsDefaults(strapi, existing);
      strapi.log.info('[Seed] Homepage already seeded, skipping...');
      return;
    }

    strapi.log.info('[Seed] Seeding default homepage content...');

    // HomeSection.vue maps 'certificate' -> the graduation illustration,
    // 'recipient' -> the csv illustration, 'export' -> the plane
    // illustration - matched here so seeded images line up with today's
    // hand-coded illustrations.
    const graduationImageId = await uploadSeedImage(strapi, 'illustration-graduation.svg');
    const csvImageId = await uploadSeedImage(strapi, 'illustration-csv.svg');
    const planeImageId = await uploadSeedImage(strapi, 'illustration-plane.svg');

    await strapi.documents('api::homepage.homepage').create({
      data: {
        heroTitleBefore: 'Skip the paper. Issue certificates people can ',
        heroHighlight: 'verify in seconds',
        heroTitleAfter: '',
        heroSubtitle: 'Stop paying to print and ship certificates that end up lost in a drawer. Issue verifiable digital badges in minutes — save money, cut paper waste, and give recipients a credential they can share and prove instantly, anywhere. Always free for the people who receive them.',
        heroButtonLabel: 'Get started free',

        featuresHeader: 'One platform for the whole credential lifecycle',
        featuresSubheader: 'Design a template, issue it to your people, and let them prove it anywhere.',
        features: [
          {
            title: 'Design templates for every use case',
            description: 'Certificates, badges, transcripts, training records, assessments, or letters — start from a template or build your own.',
            icon: 'pencil-square',
          },
          {
            title: 'Issue at any scale',
            description: 'Issue one credential by hand or upload a CSV to issue hundreds at once. Track usage against your plan in real time.',
            icon: 'rocket-launch',
          },
          {
            title: 'Verify with confidence',
            description: 'Every credential is cryptographically signed and has a public page anyone can check — no login required.',
            icon: 'shield-check',
          },
        ],

        audienceHeader: 'Built for organizations that certify people',
        audienceSubheader: 'Government agencies, schools, companies, and nonprofits use Certrust to issue credentials for real programs.',
        audienceSegments: [
          {
            title: 'Government',
            description: 'Issue verifiable certificates for civic training, licensing programs, and public-sector workshops that citizens can check.',
            icon: 'building-library',
          },
          {
            title: 'Education',
            description: 'Universities, schools, and training providers issue diplomas, course completions, and micro-credentials at graduation or course-end.',
            icon: 'academic-cap',
          },
          {
            title: 'Private & Corporate',
            description: 'Certify employees and partners after internal training, compliance courses, or professional development programs.',
            icon: 'briefcase',
          },
          {
            title: 'NGOs & Nonprofits',
            description: 'Issue certificates for workshops, seminars, and community programs — without a budget for recipient accounts or licenses.',
            icon: 'heart',
          },
        ],

        // Rendered between the audience heading and the audience segments
        // above. A fresh install starts below the default threshold, so the
        // strip stays hidden until the platform has something worth showing.
        ...STATS_DEFAULTS,

        howItWorksHeader: 'How it works',
        howItWorksSubheader: 'From blank template to a credential your recipients can prove, in three steps.',

        certificateSection: {
          title: 'Design & Create',
          header: 'Design certificates that look as credible as they are',
          feature1: 'Start from a professional template or design one from scratch',
          feature2: 'Personalize branding, text, logos, and layout for your organization',
          feature3: 'Six template types: certificates, badges, transcripts, training records, assessments, and letters',
          feature4: 'Every credential is Open Badges 3.0 and W3C Verifiable Credentials compliant',
          illustrationImage: graduationImageId ?? undefined,
          badgeCalloutTitle: 'Open Badges 3.0',
          badgeCalloutFeature1: 'Ed25519 cryptographic signature',
          badgeCalloutFeature2: 'W3C Verifiable Credentials v2 data model',
          badgeCalloutFeature3: 'Tamper-evident by design',
        },
        recipientSection: {
          title: 'Issue & Deliver',
          header: 'Issue in bulk, deliver with one link',
          feature1: 'Create courses, cohorts, or recipient groups',
          feature2: 'Upload recipients in bulk via CSV — issue dozens or thousands at once',
          feature3: 'Recipients are emailed automatically with a private link to their credential',
          feature4: 'No account needed to receive it, and it’s always free for recipients',
          illustrationImage: csvImageId ?? undefined,
          badgeCalloutTitle: 'Flexible Delivery',
          badgeCalloutFeature1: 'Instant or scheduled issuance',
          badgeCalloutFeature2: 'Automatic email delivery',
          badgeCalloutFeature3: 'Bulk CSV import with validation',
        },
        exportSection: {
          title: 'Share & Verify',
          header: 'Recipients can prove it anywhere, instantly',
          feature1: 'One-click "Add to LinkedIn" so recipients can showcase it on their profile',
          feature2: 'Copy-to-clipboard link to share anywhere — WhatsApp, Slack, email, social media',
          feature3: 'Every credential has a public page with a QR code for instant verification',
          feature4: 'Anyone can verify a Certrust-issued credential in seconds, no account required',
          illustrationImage: planeImageId ?? undefined,
          badgeCalloutTitle: 'Verification Options',
          badgeCalloutFeature1: 'Public verification page',
          badgeCalloutFeature2: 'QR code for in-person scanning',
          badgeCalloutFeature3: 'REST API for programmatic checks',
        },

        // "Works with your systems": cards linking to the integration manuals.
        ...INTEGRATIONS_DEFAULTS,
        integrations: INTEGRATIONS_DEFAULTS.integrations.map(item => ({ ...item })),

        closingHeader: 'Ready to issue your first credential?',
        closingSubheader: 'Create a free organization account and start designing your first template today. It stays free for everyone who receives one.',
        closingButtonLabel: 'Get started free',
      } as any,
    });

    strapi.log.info('[Seed] Homepage content seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding homepage content: ${message}`);
  }
}

export default seedHomepage;
