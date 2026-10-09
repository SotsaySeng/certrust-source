/**
 * First-boot seeding for the homepage singleType: hero, feature grid,
 * how-it-works walkthrough, audience segments, integrations, and closing CTA.
 * Idempotent: only seeds if api::homepage.homepage has no record yet. An
 * existing record gets the back-fills below instead.
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

/**
 * The homepage's words, as opposed to its settings (stats strip,
 * integrations) above. Kept in one place because a fresh install gets them
 * from create() and an install still showing the first version gets them
 * from applyCopyRefresh().
 *
 * Organized around the moment someone needs a certificate rather than the
 * kind of organization they work for. Icons must be in the feature-item /
 * audience-segment enum.
 */
const homepageCopy = () => ({
  heroTitleBefore: 'Your workshop ends today. The certificates go out ',
  heroHighlight: 'tonight',
  heroTitleAfter: '',
  heroSubtitle: 'Upload your attendance list, choose a design and send. Each person gets their own certificate by email, and anyone they show it to can scan it to see it came from you and has not been changed. There is nothing to print or sign, and it is free for recipients.',
  heroButtonLabel: 'Issue your first 50 free',

  featuresHeader: 'From attendance list to verified certificate in one sitting',
  featuresSubheader: 'All you need to start is a list of names and emails.',
  features: [
    {
      title: 'Start from a finished design',
      description: 'Pick a certificate or badge design, add your logo and wording, and it is ready to send. You can also build your own in the design editor.',
      icon: 'pencil-square',
    },
    {
      title: 'Send to one person or a full hall',
      description: 'Type in a single name, or upload a CSV file and send hundreds at once. Each person gets an email with a private link.',
      icon: 'rocket-launch',
    },
    {
      title: 'Anyone can check it',
      description: 'Every certificate is digitally signed and has a public page. An employer opens it and sees who issued it and whether it is still valid, without creating an account.',
      icon: 'shield-check',
    },
  ],

  audienceHeader: 'For the moments when people need proof',
  audienceSubheader: 'Pick the situation closest to yours.',
  audienceSegments: [
    {
      title: 'After a workshop or event',
      description: 'Create the event, upload who attended, and each person receives a certificate with the event\'s details on it.',
      icon: 'users',
    },
    {
      title: 'At the end of a course',
      description: 'Send completion certificates or diplomas to a whole cohort from one file, on the day or scheduled in advance.',
      icon: 'academic-cap',
    },
    {
      title: 'For training that expires',
      description: 'Set an expiry date for first aid, safety or licence training. After that date the certificate shows as expired to anyone who opens it.',
      icon: 'clipboard-document-check',
    },
    {
      title: 'When an employer has to check',
      description: 'A recruiter or registrar opens the link or scans the QR code and sees who issued the certificate and whether it has been revoked. Organizations that have proved who they are carry a Verified issuer mark.',
      icon: 'shield-check',
    },
  ],

  howItWorksHeader: 'How it works',
  howItWorksSubheader: 'Design it, send it, and let people check it.',

  closingHeader: 'Have an event coming up?',
  closingSubheader: 'Set up your organization today. Your first 50 certificates are free, and recipients never pay.',
  closingButtonLabel: 'Issue your first 50 free',
});

/**
 * The three how-it-works sections, without their illustrationImage: create()
 * attaches the seeded images and applyCopyRefresh() keeps whatever is there.
 * The standards are named once on the page, in the callout for IT.
 */
const HOW_IT_WORKS_SECTIONS = ['certificateSection', 'recipientSection', 'exportSection'] as const;

const howItWorksCopy = () => ({
  certificateSection: {
    title: 'Design',
    header: 'Make it look like it came from you',
    feature1: 'Start from a ready-made certificate or badge design, or build your own',
    feature2: 'Change the logo, wording and layout to match your organization',
    feature3: 'Six kinds of document: certificates, badges, transcripts, training records, assessments and letters',
    feature4: 'Save a design once and reuse it for every cohort',
    badgeCalloutTitle: 'For your IT team',
    badgeCalloutFeature1: 'Open Badges 3.0',
    badgeCalloutFeature2: 'W3C Verifiable Credentials v2',
    badgeCalloutFeature3: 'Ed25519 digital signature',
  },
  recipientSection: {
    title: 'Send',
    header: 'Upload the list and send them all at once',
    feature1: 'Upload a CSV of names and emails, and it is checked for mistakes before anything goes out',
    feature2: 'Send now, or schedule it for the day of the ceremony',
    feature3: 'Each person gets an email with a private link to their certificate',
    feature4: 'Recipients need no account and never pay',
    badgeCalloutTitle: 'Flexible Delivery',
    badgeCalloutFeature1: 'Instant or scheduled issuance',
    badgeCalloutFeature2: 'Automatic email delivery',
    badgeCalloutFeature3: 'Bulk CSV import with validation',
  },
  exportSection: {
    title: 'Prove',
    header: 'They share it, and anyone can check it',
    feature1: 'One click adds it to a LinkedIn profile',
    feature2: 'A link they can send by WhatsApp, email or anywhere else',
    feature3: 'A public page with a QR code for checking in person',
    feature4: 'The page shows who issued it and whether it has expired or been revoked',
    badgeCalloutTitle: 'Verification Options',
    badgeCalloutFeature1: 'Public verification page',
    badgeCalloutFeature2: 'QR code for in-person scanning',
    badgeCalloutFeature3: 'REST API for programmatic checks',
  },
});

/** heroTitleBefore of the first homepage copy. */
const FIRST_HERO_TITLE = 'Skip the paper. Issue certificates people can ';

/**
 * Replaces the first homepage copy with the current one on an install that
 * is still showing it. The first headline is the test: once an admin (or
 * this function) has changed it, nothing here runs again, so later edits
 * in the Content Manager are never overwritten. Settings and the
 * integrations section are not touched.
 */
export async function applyCopyRefresh(strapi: any, existing: any): Promise<void> {
  const image = { populate: ['illustrationImage'] };
  const full: any = await strapi.documents('api::homepage.homepage').findFirst({
    populate: { certificateSection: image, recipientSection: image, exportSection: image },
  } as any);
  if (!full || full.heroTitleBefore !== FIRST_HERO_TITLE) return;

  const sections: any = howItWorksCopy();
  for (const key of HOW_IT_WORKS_SECTIONS) {
    const imageId = full[key]?.illustrationImage?.id;
    if (imageId) sections[key].illustrationImage = imageId;
  }

  await strapi.documents('api::homepage.homepage').update({
    documentId: existing.documentId,
    data: { ...homepageCopy(), ...sections },
  } as any);
  strapi.log.info('[Seed] Homepage: replaced the first copy with the current one.');
}

export async function seedHomepage(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::homepage.homepage').findFirst();

    if (existing) {
      // Not a plain early return: fields added after this record was first
      // seeded still need back-filling on every existing install.
      await addPlatformStatsDefaults(strapi, existing);
      await addIntegrationsDefaults(strapi, existing);
      await applyCopyRefresh(strapi, existing);
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

    const sections = howItWorksCopy();
    await strapi.documents('api::homepage.homepage').create({
      data: {
        ...homepageCopy(),

        // Rendered between the audience heading and the audience segments.
        // A fresh install starts below the default threshold, so the strip
        // stays hidden until the platform has something worth showing.
        ...STATS_DEFAULTS,

        certificateSection: { ...sections.certificateSection, illustrationImage: graduationImageId ?? undefined },
        recipientSection: { ...sections.recipientSection, illustrationImage: csvImageId ?? undefined },
        exportSection: { ...sections.exportSection, illustrationImage: planeImageId ?? undefined },

        // "Works with your systems": cards linking to the integration manuals.
        ...INTEGRATIONS_DEFAULTS,
        integrations: INTEGRATIONS_DEFAULTS.integrations.map(item => ({ ...item })),
      } as any,
    });

    strapi.log.info('[Seed] Homepage content seeded.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strapi.log.error(`[Seed] Error seeding homepage content: ${message}`);
  }
}

export default seedHomepage;
