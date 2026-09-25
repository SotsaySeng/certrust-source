/**
 * Organization self-service provisioning
 *
 * provisionForUser() is called from the users-permissions register
 * override (src/extensions/users-permissions/strapi-server.ts) right
 * after a brand-new user has self-registered, to auto-create the
 * Organization + Profile that back the rest of this app's multi-tenancy
 * model for that user. Always called inside the same
 * strapi.db.transaction(...) the register override opens, so a
 * validation failure here rolls back the just-created user row too - see
 * that file's header comment for the verified transaction-join mechanics.
 *
 * Deliberately NOT reachable from credential/services/credential.ts's
 * findOrCreateUser() (which auto-provisions recipient accounts via the
 * users-permissions user *service* directly, never through
 * auth.register) - a credential recipient must never get an organization
 * auto-created for them.
 */

import { errors } from '@strapi/utils';

const { ValidationError } = errors;

export interface ProvisionForUserInput {
  userId: string | number;
  userEmail: string;
  username: string;
  organizationName: unknown;
  organizationType?: unknown;
}

export default () => ({
  async provisionForUser({ userId, userEmail, username, organizationName, organizationType }: ProvisionForUserInput) {
    if (typeof organizationName !== 'string' || organizationName.trim().length === 0) {
      throw new ValidationError('organizationName is required');
    }

    let orgTypeId: string | number | undefined;
    if (organizationType !== undefined && organizationType !== null && organizationType !== '') {
      const orgType: any = await strapi.entityService.findOne('api::org-type.org-type', organizationType as any);
      if (!orgType) {
        throw new ValidationError('organizationType does not refer to a known organization type');
      }
      orgTypeId = orgType.id;
    }

    // New orgs start on the admin-configured trial (Billing Settings),
    // or on Free when trials are off / require a card up front.
    const billingFields = await strapi.service('api::billing.billing').initialBillingFields();

    const organization: any = await strapi.entityService.create('api::organization.organization', {
      data: {
        name: organizationName.trim(),
        ...(orgTypeId !== undefined ? { type: orgTypeId } : {}),
        ...billingFields,
        billingEmail: userEmail,
        publishedAt: new Date(),
      },
    } as any);

    const profile: any = await strapi.entityService.create('api::profile.profile', {
      data: {
        name: username,
        email: userEmail,
        profileType: 'Both',
        owner: userId,
        organization: organization.id,
        publishedAt: new Date(),
      },
    } as any);

    return { organization, profile };
  },
});
