/**
 * Controller-side counterpart of the global::is-platform-admin policy: true
 * when the user's users-permissions role is "Platform Admin" (type
 * `platform-admin`) and the account isn't blocked. Re-reads the role from
 * the database, same as the policy, so a role change applies immediately.
 */
import { PLATFORM_ADMIN_ROLE_TYPE } from '../policies/is-platform-admin'

export async function isPlatformAdminUser(userId: number | string | undefined | null): Promise<boolean> {
  if (!userId) return false
  const user = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    populate: ['role'],
  })
  return user?.role?.type === PLATFORM_ADMIN_ROLE_TYPE && !user?.blocked
}
