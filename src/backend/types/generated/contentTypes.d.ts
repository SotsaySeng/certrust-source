import type { Schema, Struct } from '@strapi/strapi';

export interface AdminApiToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_tokens';
  info: {
    description: '';
    displayName: 'Api Token';
    name: 'Api Token';
    pluralName: 'api-tokens';
    singularName: 'api-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    encryptedKey: Schema.Attribute.Text &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::api-token'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<['read-only', 'full-access', 'custom']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'read-only'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminApiTokenPermission extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_api_token_permissions';
  info: {
    description: '';
    displayName: 'API Token Permission';
    name: 'API Token Permission';
    pluralName: 'api-token-permissions';
    singularName: 'api-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::api-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::api-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminPermission extends Struct.CollectionTypeSchema {
  collectionName: 'admin_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'Permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    actionParameters: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    conditions: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::permission'> &
      Schema.Attribute.Private;
    properties: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<'manyToOne', 'admin::role'>;
    subject: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminRole extends Struct.CollectionTypeSchema {
  collectionName: 'admin_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'Role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::role'> &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<'oneToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<'manyToMany', 'admin::user'>;
  };
}

export interface AdminTransferToken extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_tokens';
  info: {
    description: '';
    displayName: 'Transfer Token';
    name: 'Transfer Token';
    pluralName: 'transfer-tokens';
    singularName: 'transfer-token';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    accessKey: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }> &
      Schema.Attribute.DefaultTo<''>;
    expiresAt: Schema.Attribute.DateTime;
    lastUsedAt: Schema.Attribute.DateTime;
    lifespan: Schema.Attribute.BigInteger;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminTransferTokenPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_transfer_token_permissions';
  info: {
    description: '';
    displayName: 'Transfer Token Permission';
    name: 'Transfer Token Permission';
    pluralName: 'transfer-token-permissions';
    singularName: 'transfer-token-permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'admin::transfer-token-permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    token: Schema.Attribute.Relation<'manyToOne', 'admin::transfer-token'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface AdminUser extends Struct.CollectionTypeSchema {
  collectionName: 'admin_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'User';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    blocked: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    firstname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    isActive: Schema.Attribute.Boolean &
      Schema.Attribute.Private &
      Schema.Attribute.DefaultTo<false>;
    lastname: Schema.Attribute.String &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'admin::user'> &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    preferedLanguage: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    registrationToken: Schema.Attribute.String & Schema.Attribute.Private;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    roles: Schema.Attribute.Relation<'manyToMany', 'admin::role'> &
      Schema.Attribute.Private;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String;
  };
}

export interface ApiAchievementAchievement extends Struct.CollectionTypeSchema {
  collectionName: 'achievements';
  info: {
    description: 'Open Badges 3.0 Achievement (Badge Class) definition';
    displayName: 'Achievement';
    pluralName: 'achievements';
    singularName: 'achievement';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    achievementId: Schema.Attribute.UID<'name'> & Schema.Attribute.Required;
    achievementType: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Achievement'>;
    alignment: Schema.Attribute.Component<'badge.alignment', true>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    creator: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    credentials: Schema.Attribute.Relation<
      'oneToMany',
      'api::credential.credential'
    >;
    criteria: Schema.Attribute.Component<'badge.criteria', false>;
    description: Schema.Attribute.Text & Schema.Attribute.Required;
    image: Schema.Attribute.Media<'images'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::achievement.achievement'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    skills: Schema.Attribute.Component<'badge.skill', true>;
    tags: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<[]>;
    templateType: Schema.Attribute.Enumeration<
      [
        'certificate',
        'badge',
        'transcript',
        'training_record',
        'assessment',
        'letter',
      ]
    > &
      Schema.Attribute.DefaultTo<'badge'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiAuditLogEntryAuditLogEntry
  extends Struct.CollectionTypeSchema {
  collectionName: 'audit_log_entries';
  info: {
    description: 'Record of who did what, for actions that bypass or sit outside the normal permission model. Admin-panel-only: no public/authenticated REST routes are defined for this content type.';
    displayName: 'Audit Log Entry';
    pluralName: 'audit-log-entries';
    singularName: 'audit-log-entry';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    actorId: Schema.Attribute.Integer;
    actorType: Schema.Attribute.Enumeration<['user', 'system']> &
      Schema.Attribute.DefaultTo<'user'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entityId: Schema.Attribute.String & Schema.Attribute.Required;
    entityType: Schema.Attribute.String & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::audit-log-entry.audit-log-entry'
    > &
      Schema.Attribute.Private;
    metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiBillingSettingsBillingSettings
  extends Struct.SingleTypeSchema {
  collectionName: 'billing_settings';
  info: {
    description: "Admin-editable trial and reminder configuration for Stripe billing. Same pattern as tier-settings: no REST route, read server-side via strapi.documents('api::billing-settings.billing-settings').findFirst(). Prices themselves live in the Stripe dashboard (STRIPE_PRICE_* env vars).";
    displayName: 'Billing Settings';
    pluralName: 'billing-settings-list';
    singularName: 'billing-settings';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::billing-settings.billing-settings'
    > &
      Schema.Attribute.Private;
    pastDueGraceDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<7>;
    publishedAt: Schema.Attribute.DateTime;
    renewalReminderDays: Schema.Attribute.JSON;
    trialDays: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 0;
        },
        number
      > &
      Schema.Attribute.DefaultTo<14>;
    trialReminderDays: Schema.Attribute.JSON;
    trialRequiresCard: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    trialTier: Schema.Attribute.Enumeration<['pro', 'enterprise']> &
      Schema.Attribute.DefaultTo<'pro'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiCredentialCredential extends Struct.CollectionTypeSchema {
  collectionName: 'credentials';
  info: {
    description: 'Open Badges 3.0 Credential (Badge Award)';
    displayName: 'Credential';
    pluralName: 'credentials';
    singularName: 'credential';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    achievement: Schema.Attribute.Relation<
      'manyToOne',
      'api::achievement.achievement'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    credentialId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        maxLength: 255;
        minLength: 36;
      }>;
    description: Schema.Attribute.Text;
    evidence: Schema.Attribute.Relation<'oneToMany', 'api::evidence.evidence'>;
    expirationDate: Schema.Attribute.DateTime;
    image: Schema.Attribute.Media<'images'>;
    issuanceDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    issuer: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::credential.credential'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    narrative: Schema.Attribute.Text;
    proof: Schema.Attribute.Component<'badge.proof', true>;
    publishedAt: Schema.Attribute.DateTime;
    recipient: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    revocationReason: Schema.Attribute.Text;
    revoked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    statusList: Schema.Attribute.Relation<
      'manyToOne',
      'api::revocation-list.revocation-list'
    >;
    statusListIndex: Schema.Attribute.Integer;
    type: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<
        ['VerifiableCredential', 'OpenBadgeCredential']
      >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiDesignTemplateDesignTemplate
  extends Struct.CollectionTypeSchema {
  collectionName: 'design_templates';
  info: {
    description: 'Reusable visual layout (colors, background, fonts) for rendering a badge or certificate.';
    displayName: 'Design Template';
    pluralName: 'design-templates';
    singularName: 'design-template';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    creator: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    description: Schema.Attribute.Text;
    isDefault: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    layoutConfig: Schema.Attribute.JSON & Schema.Attribute.DefaultTo<{}>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::design-template.design-template'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    organization: Schema.Attribute.Relation<
      'manyToOne',
      'api::organization.organization'
    >;
    previewImage: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.Enumeration<
      [
        'certificate',
        'badge',
        'transcript',
        'training_record',
        'assessment',
        'letter',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'badge'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEndorsementEndorsement extends Struct.CollectionTypeSchema {
  collectionName: 'endorsements';
  info: {
    description: 'Open Badges 3.0 Endorsement';
    displayName: 'Endorsement';
    pluralName: 'endorsements';
    singularName: 'endorsement';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    claim: Schema.Attribute.JSON;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    endorsedObject: Schema.Attribute.String & Schema.Attribute.Required;
    endorsementId: Schema.Attribute.UID & Schema.Attribute.Required;
    endorser: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    issuanceDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::endorsement.endorsement'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    proof: Schema.Attribute.Component<'badge.proof', true>;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.JSON &
      Schema.Attribute.DefaultTo<
        ['VerifiableCredential', 'EndorsementCredential']
      >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEventEvent extends Struct.CollectionTypeSchema {
  collectionName: 'events';
  info: {
    description: 'A real-world event (cohort, ceremony, conference) that an achievement is issued in connection with.';
    displayName: 'Event';
    pluralName: 'events';
    singularName: 'event';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    achievement: Schema.Attribute.Relation<
      'manyToOne',
      'api::achievement.achievement'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    creator: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    description: Schema.Attribute.Text;
    endDate: Schema.Attribute.DateTime;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<'oneToMany', 'api::event.event'> &
      Schema.Attribute.Private;
    location: Schema.Attribute.String;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    organization: Schema.Attribute.Relation<
      'manyToOne',
      'api::organization.organization'
    >;
    publishedAt: Schema.Attribute.DateTime;
    startDate: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['draft', 'scheduled', 'completed', 'cancelled']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'draft'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiEvidenceEvidence extends Struct.CollectionTypeSchema {
  collectionName: 'evidences';
  info: {
    description: 'Open Badges 3.0 Evidence for credentials';
    displayName: 'Evidence';
    pluralName: 'evidences';
    singularName: 'evidence';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    audience: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    credential: Schema.Attribute.Relation<
      'manyToOne',
      'api::credential.credential'
    >;
    description: Schema.Attribute.Text;
    evidenceId: Schema.Attribute.UID<'name'>;
    genre: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::evidence.evidence'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    narrative: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String;
  };
}

export interface ApiGlobalSettingsGlobalSettings
  extends Struct.SingleTypeSchema {
  collectionName: 'global_settings';
  info: {
    description: "Site-wide chrome shown on every page: the header/footer logo, footer tagline/description, social links, contact info, and the footer's Quick Links / Resources / Legal link lists. Publicly readable (find only, auth: false) so the Nuxt frontend can render the header and footer without authentication - see routes/global-settings.ts and bootstrap/permissions-setup.ts's PUBLIC_PERMISSIONS.";
    displayName: 'Global Settings';
    pluralName: 'global-settings-list';
    singularName: 'global-settings';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    contactEmail: Schema.Attribute.Email;
    contactWebsiteLabel: Schema.Attribute.String;
    contactWebsiteUrl: Schema.Attribute.String;
    copyrightText: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    legalLinks: Schema.Attribute.Component<'marketing.link-item', true>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::global-settings.global-settings'
    > &
      Schema.Attribute.Private;
    logo: Schema.Attribute.Media<'images'>;
    publishedAt: Schema.Attribute.DateTime;
    quickLinks: Schema.Attribute.Component<'marketing.link-item', true>;
    resourceLinks: Schema.Attribute.Component<'marketing.link-item', true>;
    socialDiscordUrl: Schema.Attribute.String;
    socialGithubUrl: Schema.Attribute.String;
    socialTwitterUrl: Schema.Attribute.String;
    tagline: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiHomepageHomepage extends Struct.SingleTypeSchema {
  collectionName: 'homepages';
  info: {
    description: "Content for the public marketing homepage (/): hero, feature grid, how-it-works walkthrough, audience segments, and the closing CTA. Publicly readable (find only, auth: false) - see routes/homepage.ts and bootstrap/permissions-setup.ts's PUBLIC_PERMISSIONS. Pricing content lives on the separate solution-page singleType (its own /solution route); the header/footer logo lives on global-settings (shown on every page, not just this one).";
    displayName: 'Homepage';
    pluralName: 'homepages';
    singularName: 'homepage';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    audienceHeader: Schema.Attribute.String;
    audienceSegments: Schema.Attribute.Component<
      'marketing.audience-segment',
      true
    >;
    audienceSubheader: Schema.Attribute.Text;
    certificateSection: Schema.Attribute.Component<
      'marketing.how-it-works-section',
      false
    >;
    closingButtonLabel: Schema.Attribute.String;
    closingHeader: Schema.Attribute.String;
    closingSubheader: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    exportSection: Schema.Attribute.Component<
      'marketing.how-it-works-section',
      false
    >;
    features: Schema.Attribute.Component<'marketing.feature-item', true>;
    featuresHeader: Schema.Attribute.String;
    featuresSubheader: Schema.Attribute.Text;
    heroButtonLabel: Schema.Attribute.String;
    heroHighlight: Schema.Attribute.String & Schema.Attribute.Required;
    heroSubtitle: Schema.Attribute.Text;
    heroTitleAfter: Schema.Attribute.String;
    heroTitleBefore: Schema.Attribute.String;
    howItWorksHeader: Schema.Attribute.String;
    howItWorksSubheader: Schema.Attribute.Text;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::homepage.homepage'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    recipientSection: Schema.Attribute.Component<
      'marketing.how-it-works-section',
      false
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiIssuerKeyIssuerKey extends Struct.CollectionTypeSchema {
  collectionName: 'issuer_keys';
  info: {
    description: "Per-issuer signing keypairs. Never exposed over REST: no routes/controllers/services are defined for this content type, so it's reachable only from server-side code via strapi.db.query/entityService.";
    displayName: 'Issuer Key';
    pluralName: 'issuer-keys';
    singularName: 'issuer-key';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    algorithm: Schema.Attribute.String & Schema.Attribute.DefaultTo<'Ed25519'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::issuer-key.issuer-key'
    > &
      Schema.Attribute.Private;
    privateKeyEncrypted: Schema.Attribute.Text & Schema.Attribute.Required;
    profile: Schema.Attribute.Relation<'oneToOne', 'api::profile.profile'>;
    publicKeyJwk: Schema.Attribute.JSON & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOrgTypeOrgType extends Struct.CollectionTypeSchema {
  collectionName: 'org_types';
  info: {
    description: "Admin-managed flat lookup list of organization types (e.g. Private, Public, NGO) used to populate the registration form's organization-type dropdown pre-login. Not editorial content.";
    displayName: 'Organization Type';
    pluralName: 'org-types';
    singularName: 'org-type';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::org-type.org-type'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    organizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::organization.organization'
    >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiOrganizationOrganization
  extends Struct.CollectionTypeSchema {
  collectionName: 'organizations';
  info: {
    description: "Billing/tenant boundary. Owns profiles, design templates, and events, and is subject to its tier's usage limits (see api::tier-settings.tier-settings, an admin-editable singleType).";
    displayName: 'Organization';
    pluralName: 'organizations';
    singularName: 'organization';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    billedTier: Schema.Attribute.Enumeration<['pro', 'enterprise']>;
    billingEmail: Schema.Attribute.Email;
    billingInterval: Schema.Attribute.Enumeration<['month', 'year']>;
    cancelAtPeriodEnd: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    canceledAt: Schema.Attribute.DateTime;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currentPeriodEnd: Schema.Attribute.DateTime;
    designTemplates: Schema.Attribute.Relation<
      'oneToMany',
      'api::design-template.design-template'
    >;
    events: Schema.Attribute.Relation<'oneToMany', 'api::event.event'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::organization.organization'
    > &
      Schema.Attribute.Private;
    members: Schema.Attribute.Relation<
      'manyToMany',
      'plugin::users-permissions.user'
    >;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    pastDueSince: Schema.Attribute.DateTime;
    profiles: Schema.Attribute.Relation<'oneToMany', 'api::profile.profile'>;
    publishedAt: Schema.Attribute.DateTime;
    slug: Schema.Attribute.UID<'name'>;
    stripeCustomerId: Schema.Attribute.String & Schema.Attribute.Private;
    stripeSubscriptionId: Schema.Attribute.String & Schema.Attribute.Private;
    subscriptionStatus: Schema.Attribute.Enumeration<
      ['none', 'trialing', 'active', 'past_due', 'canceled']
    > &
      Schema.Attribute.DefaultTo<'none'>;
    tier: Schema.Attribute.Enumeration<['free', 'pro', 'enterprise']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'free'>;
    trialEndsAt: Schema.Attribute.DateTime;
    trialUsed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    type: Schema.Attribute.Relation<'manyToOne', 'api::org-type.org-type'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiPaymentPayment extends Struct.CollectionTypeSchema {
  collectionName: 'payments';
  info: {
    description: 'Ledger of Stripe invoices, written only by the billing webhook (api::billing). Feeds the platform revenue dashboard. Keyed to the organization by documentId rather than a relation, because organization is draftAndPublish and a republish from the admin panel re-creates its row under a new numeric id.';
    displayName: 'Payment';
    pluralName: 'payments';
    singularName: 'payment';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    amount: Schema.Attribute.Integer & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    currency: Schema.Attribute.String & Schema.Attribute.DefaultTo<'usd'>;
    interval: Schema.Attribute.Enumeration<['month', 'year']>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::payment.payment'
    > &
      Schema.Attribute.Private;
    organizationDocumentId: Schema.Attribute.String;
    organizationName: Schema.Attribute.String;
    paidAt: Schema.Attribute.DateTime;
    periodEnd: Schema.Attribute.DateTime;
    periodStart: Schema.Attribute.DateTime;
    publishedAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<['paid', 'failed', 'refunded']> &
      Schema.Attribute.Required;
    stripeInvoiceId: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    stripeSubscriptionId: Schema.Attribute.String;
    tier: Schema.Attribute.Enumeration<['pro', 'enterprise']>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiProfileProfile extends Struct.CollectionTypeSchema {
  collectionName: 'profiles';
  info: {
    description: 'Open Badges 3.0 Profile for issuers and recipients';
    displayName: 'Profile';
    pluralName: 'profiles';
    singularName: 'profile';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAchievements: Schema.Attribute.Relation<
      'oneToMany',
      'api::achievement.achievement'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.Text;
    did: Schema.Attribute.String;
    email: Schema.Attribute.Email;
    image: Schema.Attribute.Media<'images'>;
    issuedCredentials: Schema.Attribute.Relation<
      'oneToMany',
      'api::credential.credential'
    >;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::profile.profile'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    organization: Schema.Attribute.Relation<
      'manyToOne',
      'api::organization.organization'
    >;
    owner: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.user'
    >;
    profileType: Schema.Attribute.Enumeration<['Issuer', 'Recipient', 'Both']> &
      Schema.Attribute.DefaultTo<'Both'>;
    publicKey: Schema.Attribute.Component<'badge.public-key', true>;
    publishedAt: Schema.Attribute.DateTime;
    receivedCredentials: Schema.Attribute.Relation<
      'oneToMany',
      'api::credential.credential'
    >;
    revocationLists: Schema.Attribute.Relation<
      'oneToMany',
      'api::revocation-list.revocation-list'
    >;
    telephone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String;
  };
}

export interface ApiRevocationListRevocationList
  extends Struct.CollectionTypeSchema {
  collectionName: 'revocation_lists';
  info: {
    description: 'StatusList2021 credential revocation list';
    displayName: 'Revocation List';
    pluralName: 'revocation-lists';
    singularName: 'revocation-list';
  };
  options: {
    draftAndPublish: true;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    encodedList: Schema.Attribute.Text & Schema.Attribute.Required;
    issuer: Schema.Attribute.Relation<'manyToOne', 'api::profile.profile'>;
    lastUpdated: Schema.Attribute.DateTime & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::revocation-list.revocation-list'
    > &
      Schema.Attribute.Private;
    nextIndex: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<0>;
    publishedAt: Schema.Attribute.DateTime;
    statusListCredential: Schema.Attribute.String & Schema.Attribute.Required;
    statusPurpose: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'revocation'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiScheduledIssuanceScheduledIssuance
  extends Struct.CollectionTypeSchema {
  collectionName: 'scheduled_issuances';
  info: {
    description: 'Credentials queued for automatic issuance at a future date.';
    displayName: 'Scheduled Issuance';
    pluralName: 'scheduled-issuances';
    singularName: 'scheduled-issuance';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    achievementId: Schema.Attribute.Integer & Schema.Attribute.Required;
    cancelReason: Schema.Attribute.Text;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    expirationDate: Schema.Attribute.DateTime;
    failureReason: Schema.Attribute.Text;
    issuedCredentialId: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::scheduled-issuance.scheduled-issuance'
    > &
      Schema.Attribute.Private;
    note: Schema.Attribute.Text;
    publishedAt: Schema.Attribute.DateTime;
    recipientEmail: Schema.Attribute.Email & Schema.Attribute.Required;
    recipientName: Schema.Attribute.String;
    scheduledByEmail: Schema.Attribute.Email;
    scheduledById: Schema.Attribute.Integer;
    scheduledDate: Schema.Attribute.DateTime & Schema.Attribute.Required;
    status: Schema.Attribute.Enumeration<
      ['pending', 'issued', 'cancelled', 'failed']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'pending'>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiSolutionPageSolutionPage extends Struct.SingleTypeSchema {
  collectionName: 'solution_pages';
  info: {
    description: "Content for the public /solution page's pricing plans. Publicly readable (find only, auth: false) - see routes/solution-page.ts and bootstrap/permissions-setup.ts's PUBLIC_PERMISSIONS. Deliberately separate from tier-settings (the real enforced numeric limits, read server-side by organization/services/usage.ts, admin-only with no REST endpoint) - this is marketing display copy and may legitimately show different numbers than what's actually enforced.";
    displayName: 'Solution Page';
    pluralName: 'solution-pages';
    singularName: 'solution-page';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    coreFeature1: Schema.Attribute.String;
    coreFeature2: Schema.Attribute.String;
    coreFeature3: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    header: Schema.Attribute.String;
    limitLabelAchievements: Schema.Attribute.String;
    limitLabelCredentials: Schema.Attribute.String;
    limitLabelDesignTemplates: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::solution-page.solution-page'
    > &
      Schema.Attribute.Private;
    mostPopularLabel: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    subheader: Schema.Attribute.Text;
    tiers: Schema.Attribute.Component<'marketing.pricing-tier', true>;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiTierSettingsTierSettings extends Struct.SingleTypeSchema {
  collectionName: 'tier_settings';
  info: {
    description: "Single admin-editable record holding per-tier (free/pro/enterprise) usage limits, replacing config/tiers.ts so limits can be changed from the admin panel without a redeploy. No controller/route/service is defined for this content type - it has no REST endpoint by design; it is admin-panel-only, read from server-side code via strapi.documents('api::tier-settings.tier-settings').";
    displayName: 'Tier Settings';
    pluralName: 'tier-settings-list';
    singularName: 'tier-settings';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enterprise: Schema.Attribute.Component<'settings.usage-limits', false>;
    free: Schema.Attribute.Component<'settings.usage-limits', false>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::tier-settings.tier-settings'
    > &
      Schema.Attribute.Private;
    pro: Schema.Attribute.Component<'settings.usage-limits', false>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface ApiWebhookSubscriptionWebhookSubscription
  extends Struct.CollectionTypeSchema {
  collectionName: 'webhook_subscriptions';
  info: {
    description: 'Outbound webhook endpoints notified on credential lifecycle events. Managed via the admin panel content manager - no public/authenticated REST routes are defined for this content type.';
    displayName: 'Webhook Subscription';
    pluralName: 'webhook-subscriptions';
    singularName: 'webhook-subscription';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    enabled: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    events: Schema.Attribute.JSON & Schema.Attribute.Required;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'api::webhook-subscription.webhook-subscription'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    secret: Schema.Attribute.String & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface PluginContentReleasesRelease
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_releases';
  info: {
    displayName: 'Release';
    pluralName: 'releases';
    singularName: 'release';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    actions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    >;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    publishedAt: Schema.Attribute.DateTime;
    releasedAt: Schema.Attribute.DateTime;
    scheduledAt: Schema.Attribute.DateTime;
    status: Schema.Attribute.Enumeration<
      ['ready', 'blocked', 'failed', 'done', 'empty']
    > &
      Schema.Attribute.Required;
    timezone: Schema.Attribute.String;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginContentReleasesReleaseAction
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_release_actions';
  info: {
    displayName: 'Release Action';
    pluralName: 'release-actions';
    singularName: 'release-action';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentType: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    entryDocumentId: Schema.Attribute.String;
    isEntryValid: Schema.Attribute.Boolean;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::content-releases.release-action'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    release: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::content-releases.release'
    >;
    type: Schema.Attribute.Enumeration<['publish', 'unpublish']> &
      Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginI18NLocale extends Struct.CollectionTypeSchema {
  collectionName: 'i18n_locale';
  info: {
    collectionName: 'locales';
    description: '';
    displayName: 'Locale';
    pluralName: 'locales';
    singularName: 'locale';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    code: Schema.Attribute.String & Schema.Attribute.Unique;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::i18n.locale'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.SetMinMax<
        {
          max: 50;
          min: 1;
        },
        number
      >;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflow
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows';
  info: {
    description: '';
    displayName: 'Workflow';
    name: 'Workflow';
    pluralName: 'workflows';
    singularName: 'workflow';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    contentTypes: Schema.Attribute.JSON &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'[]'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    stageRequiredToPublish: Schema.Attribute.Relation<
      'oneToOne',
      'plugin::review-workflows.workflow-stage'
    >;
    stages: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginReviewWorkflowsWorkflowStage
  extends Struct.CollectionTypeSchema {
  collectionName: 'strapi_workflows_stages';
  info: {
    description: '';
    displayName: 'Stages';
    name: 'Workflow Stage';
    pluralName: 'workflow-stages';
    singularName: 'workflow-stage';
  };
  options: {
    draftAndPublish: false;
    version: '1.1.0';
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    color: Schema.Attribute.String & Schema.Attribute.DefaultTo<'#4945FF'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::review-workflows.workflow-stage'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String;
    permissions: Schema.Attribute.Relation<'manyToMany', 'admin::permission'>;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    workflow: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::review-workflows.workflow'
    >;
  };
}

export interface PluginUploadFile extends Struct.CollectionTypeSchema {
  collectionName: 'files';
  info: {
    description: '';
    displayName: 'File';
    pluralName: 'files';
    singularName: 'file';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    alternativeText: Schema.Attribute.String;
    caption: Schema.Attribute.String;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    ext: Schema.Attribute.String;
    folder: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'> &
      Schema.Attribute.Private;
    folderPath: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    formats: Schema.Attribute.JSON;
    hash: Schema.Attribute.String & Schema.Attribute.Required;
    height: Schema.Attribute.Integer;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.file'
    > &
      Schema.Attribute.Private;
    mime: Schema.Attribute.String & Schema.Attribute.Required;
    name: Schema.Attribute.String & Schema.Attribute.Required;
    previewUrl: Schema.Attribute.String;
    provider: Schema.Attribute.String & Schema.Attribute.Required;
    provider_metadata: Schema.Attribute.JSON;
    publishedAt: Schema.Attribute.DateTime;
    related: Schema.Attribute.Relation<'morphToMany'>;
    size: Schema.Attribute.Decimal & Schema.Attribute.Required;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    url: Schema.Attribute.String & Schema.Attribute.Required;
    width: Schema.Attribute.Integer;
  };
}

export interface PluginUploadFolder extends Struct.CollectionTypeSchema {
  collectionName: 'upload_folders';
  info: {
    displayName: 'Folder';
    pluralName: 'folders';
    singularName: 'folder';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    children: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.folder'>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    files: Schema.Attribute.Relation<'oneToMany', 'plugin::upload.file'>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::upload.folder'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    parent: Schema.Attribute.Relation<'manyToOne', 'plugin::upload.folder'>;
    path: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 1;
      }>;
    pathId: Schema.Attribute.Integer &
      Schema.Attribute.Required &
      Schema.Attribute.Unique;
    publishedAt: Schema.Attribute.DateTime;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsPermission
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_permissions';
  info: {
    description: '';
    displayName: 'Permission';
    name: 'permission';
    pluralName: 'permissions';
    singularName: 'permission';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    action: Schema.Attribute.String & Schema.Attribute.Required;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    > &
      Schema.Attribute.Private;
    publishedAt: Schema.Attribute.DateTime;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
  };
}

export interface PluginUsersPermissionsRole
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_roles';
  info: {
    description: '';
    displayName: 'Role';
    name: 'role';
    pluralName: 'roles';
    singularName: 'role';
  };
  options: {
    draftAndPublish: false;
  };
  pluginOptions: {
    'content-manager': {
      visible: false;
    };
    'content-type-builder': {
      visible: false;
    };
  };
  attributes: {
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    description: Schema.Attribute.String;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.role'
    > &
      Schema.Attribute.Private;
    name: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
    permissions: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.permission'
    >;
    publishedAt: Schema.Attribute.DateTime;
    type: Schema.Attribute.String & Schema.Attribute.Unique;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    users: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    >;
  };
}

export interface PluginUsersPermissionsUser
  extends Struct.CollectionTypeSchema {
  collectionName: 'up_users';
  info: {
    description: '';
    displayName: 'User';
    name: 'user';
    pluralName: 'users';
    singularName: 'user';
  };
  options: {
    draftAndPublish: false;
  };
  attributes: {
    blocked: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    confirmationToken: Schema.Attribute.String & Schema.Attribute.Private;
    confirmed: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    createdAt: Schema.Attribute.DateTime;
    createdBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    email: Schema.Attribute.Email &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    locale: Schema.Attribute.String & Schema.Attribute.Private;
    localizations: Schema.Attribute.Relation<
      'oneToMany',
      'plugin::users-permissions.user'
    > &
      Schema.Attribute.Private;
    password: Schema.Attribute.Password &
      Schema.Attribute.Private &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 6;
      }>;
    provider: Schema.Attribute.String;
    publishedAt: Schema.Attribute.DateTime;
    resetPasswordToken: Schema.Attribute.String & Schema.Attribute.Private;
    role: Schema.Attribute.Relation<
      'manyToOne',
      'plugin::users-permissions.role'
    >;
    updatedAt: Schema.Attribute.DateTime;
    updatedBy: Schema.Attribute.Relation<'oneToOne', 'admin::user'> &
      Schema.Attribute.Private;
    username: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.Unique &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 3;
      }>;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ContentTypeSchemas {
      'admin::api-token': AdminApiToken;
      'admin::api-token-permission': AdminApiTokenPermission;
      'admin::permission': AdminPermission;
      'admin::role': AdminRole;
      'admin::transfer-token': AdminTransferToken;
      'admin::transfer-token-permission': AdminTransferTokenPermission;
      'admin::user': AdminUser;
      'api::achievement.achievement': ApiAchievementAchievement;
      'api::audit-log-entry.audit-log-entry': ApiAuditLogEntryAuditLogEntry;
      'api::billing-settings.billing-settings': ApiBillingSettingsBillingSettings;
      'api::credential.credential': ApiCredentialCredential;
      'api::design-template.design-template': ApiDesignTemplateDesignTemplate;
      'api::endorsement.endorsement': ApiEndorsementEndorsement;
      'api::event.event': ApiEventEvent;
      'api::evidence.evidence': ApiEvidenceEvidence;
      'api::global-settings.global-settings': ApiGlobalSettingsGlobalSettings;
      'api::homepage.homepage': ApiHomepageHomepage;
      'api::issuer-key.issuer-key': ApiIssuerKeyIssuerKey;
      'api::org-type.org-type': ApiOrgTypeOrgType;
      'api::organization.organization': ApiOrganizationOrganization;
      'api::payment.payment': ApiPaymentPayment;
      'api::profile.profile': ApiProfileProfile;
      'api::revocation-list.revocation-list': ApiRevocationListRevocationList;
      'api::scheduled-issuance.scheduled-issuance': ApiScheduledIssuanceScheduledIssuance;
      'api::solution-page.solution-page': ApiSolutionPageSolutionPage;
      'api::tier-settings.tier-settings': ApiTierSettingsTierSettings;
      'api::webhook-subscription.webhook-subscription': ApiWebhookSubscriptionWebhookSubscription;
      'plugin::content-releases.release': PluginContentReleasesRelease;
      'plugin::content-releases.release-action': PluginContentReleasesReleaseAction;
      'plugin::i18n.locale': PluginI18NLocale;
      'plugin::review-workflows.workflow': PluginReviewWorkflowsWorkflow;
      'plugin::review-workflows.workflow-stage': PluginReviewWorkflowsWorkflowStage;
      'plugin::upload.file': PluginUploadFile;
      'plugin::upload.folder': PluginUploadFolder;
      'plugin::users-permissions.permission': PluginUsersPermissionsPermission;
      'plugin::users-permissions.role': PluginUsersPermissionsRole;
      'plugin::users-permissions.user': PluginUsersPermissionsUser;
    }
  }
}
