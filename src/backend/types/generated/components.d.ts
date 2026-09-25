import type { Schema, Struct } from '@strapi/strapi';

export interface BadgeAlignment extends Struct.ComponentSchema {
  collectionName: 'components_badge_alignments';
  info: {
    description: 'Alignment to standards, skills, or competencies';
    displayName: 'Alignment';
  };
  attributes: {
    targetCode: Schema.Attribute.String;
    targetDescription: Schema.Attribute.Text;
    targetFramework: Schema.Attribute.String;
    targetName: Schema.Attribute.String & Schema.Attribute.Required;
    targetUrl: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface BadgeCriteria extends Struct.ComponentSchema {
  collectionName: 'components_badge_criteria';
  info: {
    description: 'Criteria for achievement completion';
    displayName: 'Criteria';
  };
  attributes: {
    narrative: Schema.Attribute.Text;
    url: Schema.Attribute.String;
  };
}

export interface BadgeProof extends Struct.ComponentSchema {
  collectionName: 'components_badge_proofs';
  info: {
    description: 'Cryptographic proof for verifiable credentials';
    displayName: 'Proof';
  };
  attributes: {
    created: Schema.Attribute.DateTime & Schema.Attribute.Required;
    jws: Schema.Attribute.Text;
    proofPurpose: Schema.Attribute.String & Schema.Attribute.Required;
    proofValue: Schema.Attribute.Text;
    type: Schema.Attribute.String & Schema.Attribute.Required;
    verificationMethod: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface BadgePublicKey extends Struct.ComponentSchema {
  collectionName: 'components_badge_public_keys';
  info: {
    description: 'Public key for verification of signatures';
    displayName: 'Public Key';
  };
  attributes: {
    controller: Schema.Attribute.String & Schema.Attribute.Required;
    expirationDate: Schema.Attribute.DateTime;
    identifier: Schema.Attribute.String & Schema.Attribute.Required;
    publicKeyJwk: Schema.Attribute.JSON;
    publicKeyMultibase: Schema.Attribute.String;
    revoked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    type: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface BadgeSkill extends Struct.ComponentSchema {
  collectionName: 'components_badge_skills';
  info: {
    description: 'Skills associated with achievements';
    displayName: 'Skill';
  };
  attributes: {
    level: Schema.Attribute.String;
    skillDescription: Schema.Attribute.Text;
    skillName: Schema.Attribute.String & Schema.Attribute.Required;
    skillType: Schema.Attribute.String;
    skillUrl: Schema.Attribute.String;
  };
}

export interface MarketingAudienceSegment extends Struct.ComponentSchema {
  collectionName: 'components_marketing_audience_segments';
  info: {
    description: "One card in the homepage's 'Who it's for' grid (Government / Education / Corporate / Nonprofit, etc.).";
    displayName: 'Audience Segment';
  };
  attributes: {
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    icon: Schema.Attribute.Enumeration<
      [
        'pencil-square',
        'rocket-launch',
        'shield-check',
        'building-library',
        'academic-cap',
        'briefcase',
        'heart',
        'check-circle',
        'star',
        'document-text',
        'clipboard-document-check',
        'clipboard-document-list',
        'envelope-open',
        'globe-alt',
        'lock-closed',
        'chart-bar',
        'users',
        'sparkles',
        'bolt',
        'flag',
        'check',
      ]
    > &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MarketingFeatureItem extends Struct.ComponentSchema {
  collectionName: 'components_marketing_feature_items';
  info: {
    description: "One card in the homepage's 'What it does' feature grid.";
    displayName: 'Feature Item';
  };
  attributes: {
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    icon: Schema.Attribute.Enumeration<
      [
        'pencil-square',
        'rocket-launch',
        'shield-check',
        'building-library',
        'academic-cap',
        'briefcase',
        'heart',
        'check-circle',
        'star',
        'document-text',
        'clipboard-document-check',
        'clipboard-document-list',
        'envelope-open',
        'globe-alt',
        'lock-closed',
        'chart-bar',
        'users',
        'sparkles',
        'bolt',
        'flag',
        'check',
      ]
    > &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MarketingHowItWorksSection extends Struct.ComponentSchema {
  collectionName: 'components_marketing_how_it_works_sections';
  info: {
    description: "One step (Design & Create / Issue & Deliver / Share & Verify) in the homepage's 'How it works' walkthrough. feature1..4 are fixed slots (blanks are filtered out on the frontend) rather than a repeatable list, and this component is used via 3 separate fixed fields on the homepage singleType rather than one repeatable list - HomeSection.vue hardcodes a lookup from exactly 3 section ids to 3 specific illustration components, so a freely-addable 4th section would have no illustration to map to.";
    displayName: 'How It Works Section';
  };
  attributes: {
    badgeCalloutFeature1: Schema.Attribute.String;
    badgeCalloutFeature2: Schema.Attribute.String;
    badgeCalloutFeature3: Schema.Attribute.String;
    badgeCalloutTitle: Schema.Attribute.String;
    feature1: Schema.Attribute.String;
    feature2: Schema.Attribute.String;
    feature3: Schema.Attribute.String;
    feature4: Schema.Attribute.String;
    header: Schema.Attribute.String & Schema.Attribute.Required;
    illustrationImage: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MarketingLinkItem extends Struct.ComponentSchema {
  collectionName: 'components_marketing_link_items';
  info: {
    description: 'A single {label, url} pair used for admin-editable footer link lists (Quick Links, Resources, Legal). On the frontend, a url starting with \'/\' renders as a client-side NuxtLink (internal route); anything else renders as an external <a target="_blank">.';
    displayName: 'Link Item';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface MarketingPricingTier extends Struct.ComponentSchema {
  collectionName: 'components_marketing_pricing_tiers';
  info: {
    description: "One plan card on the Solution page. Limit fields are flat sibling strings, not a nested usage-limits component, because Strapi 5's populate=* only expands one level deep and this codebase has no existing precedent for populating a component nested inside another component - nesting here would come back undefined. Deliberately separate from settings.usage-limits (tier-settings' real enforced numeric limits) since this is marketing display copy, allowed to include non-numeric strings like 'Unlimited', and may legitimately diverge from the enforced values.";
    displayName: 'Pricing Tier';
  };
  attributes: {
    achievementsLimit: Schema.Attribute.String & Schema.Attribute.Required;
    credentialsLimit: Schema.Attribute.String & Schema.Attribute.Required;
    ctaHref: Schema.Attribute.String & Schema.Attribute.Required;
    ctaLabel: Schema.Attribute.String & Schema.Attribute.Required;
    designTemplatesLimit: Schema.Attribute.String & Schema.Attribute.Required;
    extraFeature: Schema.Attribute.String;
    highlighted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.String;
    price: Schema.Attribute.String & Schema.Attribute.Required;
    tagline: Schema.Attribute.String;
    tierId: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SettingsUsageLimits extends Struct.ComponentSchema {
  collectionName: 'components_settings_usage_limits';
  info: {
    description: 'Per-dimension usage caps for a single tier. Each field null = unlimited for that dimension.';
    displayName: 'Usage Limits';
  };
  attributes: {
    achievementLimit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    credentialLimit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
    designTemplateLimit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      >;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'badge.alignment': BadgeAlignment;
      'badge.criteria': BadgeCriteria;
      'badge.proof': BadgeProof;
      'badge.public-key': BadgePublicKey;
      'badge.skill': BadgeSkill;
      'marketing.audience-segment': MarketingAudienceSegment;
      'marketing.feature-item': MarketingFeatureItem;
      'marketing.how-it-works-section': MarketingHowItWorksSection;
      'marketing.link-item': MarketingLinkItem;
      'marketing.pricing-tier': MarketingPricingTier;
      'settings.usage-limits': SettingsUsageLimits;
    }
  }
}
