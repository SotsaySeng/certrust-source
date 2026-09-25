/**
 * The signed-in user on an `auth: false` route, if the request carries a
 * valid JWT (Authorization header, or the session cookie once
 * middlewares/auth-cookie has turned it into one); otherwise null.
 * Public routes use it to show owners more than anonymous visitors see.
 */
export async function optionalUser(strapi: any, ctx: any): Promise<{ id: number; email: string } | null> {
  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').getToken(ctx)
    if (!payload?.id) return null
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
      select: ['id', 'email', 'blocked'],
    })
    return user && !user.blocked ? user : null
  } catch {
    return null
  }
}
