/**
 * First-boot seeding for the homepage singleType: hero, feature grid,
 * how-it-works walkthrough, audience segments, and closing CTA. Seeded
 * with the content that was previously hardcoded in
 * composables/useHomeContent.ts + locales/en.json's `home.*` keys, so
 * nothing visually changes on first boot. Idempotent: only seeds if
 * api::homepage.homepage has no record yet.
 */

import { uploadSeedImage } from './seed-image-upload';

export async function seedHomepage(strapi: any): Promise<void> {
  try {
    const existing = await strapi.documents('api::homepage.homepage').findFirst();

    if (existing) {
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
