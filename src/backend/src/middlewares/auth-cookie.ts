/**
 * Browser sessions in an HttpOnly cookie instead of localStorage.
 *
 * A JWT in localStorage can be read by any script that ever runs on the
 * site (one XSS and every session is stolen). For the website, the JWT now
 * lives in the `certrust_jwt` cookie: HttpOnly (scripts cannot read it),
 * Secure in production, SameSite=Lax, host-only on the API domain. The
 * website (certrust.app) and API (api.certrust.app) are the same site, so
 * the browser sends it on `credentials: 'include'` requests.
 *
 * 1. Requests: if there is no Authorization header but there is the
 *    cookie, it is turned into `Authorization: Bearer <jwt>` so the
 *    users-permissions plugin authenticates it as before. Cookie-borne
 *    auth on unsafe methods must come from an allowed Origin (CSRF guard).
 * 2. Responses: sign-in, sign-up confirmation, password reset and OAuth
 *    callbacks from the website (header `X-Certrust-Client: web`) get the
 *    JWT set as the cookie and removed from the JSON body.
 *    The body gets `session: true` instead, so the website can still tell
 *    a signed-in response from a "confirm your email first" one.
 * 3. POST /api/auth/logout clears the cookie; POST /api/auth/session turns
 *    a JWT handed over in the Authorization header (the OAuth callback
 *    redirect carries one in its URL) into the cookie.
 *
 * Bearer tokens keep working unchanged for the CLI, SDK, MCP server and
 * API integrations - they never send the web client header.
 */

export const SESSION_COOKIE = 'certrust_jwt'
const WEB_CLIENT_HEADER = 'x-certrust-client'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // matches the JWT's 7d expiry

// Responses whose body carries a fresh JWT for the signed-in user.
const TOKEN_ROUTES: Array<[string, RegExp]> = [
  ['POST', /^\/api\/auth\/local$/],
  ['POST', /^\/api\/auth\/local\/register$/],
  ['POST', /^\/api\/auth\/reset-password$/],
  ['POST', /^\/api\/auth\/change-password$/],
  ['GET', /^\/api\/auth\/[^/]+\/callback$/],
]

type Config = { isAllowedOrigin?: (origin: string) => boolean }

export default (config: Config, { strapi }: { strapi: any }) => {
  const isAllowedOrigin = config?.isAllowedOrigin ?? (() => false)
  const production = process.env.NODE_ENV === 'production'

  const cookieOptions = (ctx: any) => {
    // Behind Cloudflare the container sees plain HTTP; `secure` must still
    // be set in production, so tell koa-cookies the connection is secure.
    if (production) ctx.cookies.secure = true
    return {
      httpOnly: true,
      secure: production || ctx.secure,
      sameSite: 'lax' as const,
      path: '/',
      overwrite: true,
    }
  }

  return async (ctx: any, next: () => Promise<void>) => {
    if (ctx.method === 'POST' && ctx.path === '/api/auth/logout') {
      ctx.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(ctx), maxAge: 0 })
      ctx.status = 204
      return
    }

    if (ctx.method === 'POST' && ctx.path === '/api/auth/session') {
      const origin = ctx.get('origin')
      const bearer = /^Bearer\s+(\S+)$/i.exec(ctx.request.header.authorization || '')?.[1]
      if (!origin || !isAllowedOrigin(origin) || !bearer) {
        ctx.status = 403
        return
      }
      try {
        await strapi.plugin('users-permissions').service('jwt').verify(bearer)
      } catch {
        ctx.status = 401
        return
      }
      ctx.cookies.set(SESSION_COOKIE, bearer, { ...cookieOptions(ctx), maxAge: SESSION_MAX_AGE_MS })
      ctx.status = 204
      return
    }

    const token = ctx.cookies.get(SESSION_COOKIE)
    if (token && !ctx.request.header.authorization) {
      if (!SAFE_METHODS.has(ctx.method)) {
        const origin = ctx.get('origin')
        if (!origin || !isAllowedOrigin(origin)) {
          ctx.status = 403
          ctx.body = { data: null, error: { status: 403, name: 'ForbiddenError', message: 'Cross-site request refused', details: {} } }
          return
        }
      }
      ctx.request.header.authorization = `Bearer ${token}`
    }

    await next()

    const isWebClient = String(ctx.get(WEB_CLIENT_HEADER)).toLowerCase() === 'web'
    const jwt = ctx.body && typeof ctx.body === 'object' ? (ctx.body as any).jwt : undefined
    if (isWebClient && jwt && ctx.status < 400 && TOKEN_ROUTES.some(([m, re]) => m === ctx.method && re.test(ctx.path))) {
      ctx.cookies.set(SESSION_COOKIE, jwt, { ...cookieOptions(ctx), maxAge: SESSION_MAX_AGE_MS })
      const { jwt: _omit, ...rest } = ctx.body as any
      ctx.body = { ...rest, session: true }
    }
  }
}
