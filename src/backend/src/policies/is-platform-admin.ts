/**
 * is-platform-admin policy (`global::is-platform-admin`)
 *
 * Gates the platform revenue endpoints (api::billing admin routes) to
 * users whose users-permissions role is "Platform Admin" (type
 * `platform-admin`) - assigned per user in Strapi admin under
 * Content Manager > User > role. The role itself is created at boot by
 * bootstrap/permissions-setup.ts.
 *
 * Re-reads the role from the database rather than trusting whatever is
 * on ctx.state.user, so a role change takes effect on the next request.
 * Denials throw errors.PolicyError(message) - see is-in-organization.ts.
 */

import { errors } from '@strapi/utils';

export const PLATFORM_ADMIN_ROLE_TYPE = 'platform-admin';

const isPlatformAdmin = async (ctx: any, _config: unknown, { strapi }: { strapi: any }): Promise<boolean> => {
  const userId = ctx.state?.user?.id;
  if (!userId) {
    throw new errors.PolicyError('You must be logged in.');
  }

  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: ['role'],
  });

  if (user?.role?.type !== PLATFORM_ADMIN_ROLE_TYPE || user?.blocked) {
    throw new errors.PolicyError('Platform admins only.');
  }
  return true;
};

export default isPlatformAdmin;
