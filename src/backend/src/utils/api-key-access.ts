/**
 * What an organization API key is and what it may call. Pure functions,
 * no Strapi access, so the rules are easy to read and test in one place.
 *
 * A key is `crt_` followed by 32 random bytes in base64url. Only its
 * SHA-256 is stored; the key is high-entropy, so a slow hash adds nothing.
 *
 * Keys are deny-by-default: a request made with a key reaches a route only
 * if the route is listed in ROUTES below under one of the key's scopes. A
 * key can never reach billing, account deletion, admin pages or the API
 * key routes themselves (apart from GET /api-keys/me), and a route added
 * later is closed to keys until it is listed here. Routes that pin
 * `auth.strategies` must also list 'api-key' (see API_KEY_AUTH) for the
 * key to be authenticated there at all.
 */
import { createHash, randomBytes } from 'node:crypto'

export const KEY_PREFIX = 'crt_'

export const SCOPES = ['read', 'issue', 'revoke', 'manage'] as const
export type Scope = typeof SCOPES[number]

/** Auth config for routes that keys may use: the browser session or a key. */
export const API_KEY_AUTH = { strategies: ['users-permissions', 'api-key'] }

type RouteRule = { method: string, path: string }

// Paths as written in the route files (without the /api prefix).
const ROUTES: Record<Scope | 'always', RouteRule[]> = {
  always: [
    { method: 'GET', path: '/api-keys/me' },
  ],
  read: [
    { method: 'GET', path: '/credentials' },
    { method: 'GET', path: '/achievements/creator/:creatorId' },
    { method: 'GET', path: '/achievements/:id/credentials' },
    { method: 'GET', path: '/events' },
    { method: 'GET', path: '/events/:id' },
    { method: 'GET', path: '/scheduled-issuances' },
    { method: 'GET', path: '/profiles/me' },
    { method: 'GET', path: '/profiles/:id/issued-credentials' },
    { method: 'GET', path: '/custom-attributes' },
    { method: 'GET', path: '/issuance-jobs' },
    { method: 'GET', path: '/issuance-jobs/:id' },
  ],
  issue: [
    { method: 'POST', path: '/credentials/issue' },
    { method: 'POST', path: '/credentials/batch-issue' },
    { method: 'POST', path: '/credentials/:id/renew' },
    { method: 'POST', path: '/scheduled-issuances' },
    { method: 'POST', path: '/scheduled-issuances/:id/cancel' },
    { method: 'POST', path: '/issuance-jobs' },
    { method: 'GET', path: '/issuance-jobs' },
    { method: 'GET', path: '/issuance-jobs/:id' },
    { method: 'POST', path: '/issuance-jobs/:id/cancel' },
  ],
  revoke: [
    { method: 'POST', path: '/credentials/:id/revoke' },
  ],
  manage: [
    { method: 'POST', path: '/achievements/create' },
    { method: 'PUT', path: '/achievements/:id' },
    { method: 'POST', path: '/events' },
    { method: 'PUT', path: '/events/:id' },
  ],
}

export function generateKey(): { key: string, prefix: string, hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString('base64url')
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 8), hash: hashKey(key) }
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** The key in an `Authorization: Bearer crt_...` header, or null. */
export function keyFromAuthorization(header: unknown): string | null {
  if (typeof header !== 'string') return null
  const [scheme, token, extra] = header.trim().split(/\s+/)
  if (extra !== undefined || scheme?.toLowerCase() !== 'bearer' || !token?.startsWith(KEY_PREFIX)) return null
  return token
}

/** Valid, de-duplicated scopes from user input, or null if any is unknown or none given. */
export function normalizeScopes(input: unknown): Scope[] | null {
  if (!Array.isArray(input) || input.length === 0) return null
  const out = new Set<Scope>()
  for (const s of input) {
    if (!SCOPES.includes(s as Scope)) return null
    out.add(s as Scope)
  }
  return SCOPES.filter(s => out.has(s))
}

export function isRouteAllowed(method: string, path: string, scopes: readonly string[]): boolean {
  const m = String(method).toUpperCase()
  const groups: Array<Scope | 'always'> = ['always', ...SCOPES.filter(s => scopes.includes(s))]
  return groups.some(g => ROUTES[g].some(r => r.method === m && r.path === path))
}

/** Every route a key with these scopes may call, for docs and the UI. */
export function routesFor(scopes: readonly string[]): RouteRule[] {
  const seen = new Set<string>()
  return (['always', ...SCOPES] as const)
    .filter(g => g === 'always' || scopes.includes(g))
    .flatMap(g => ROUTES[g])
    .filter((r) => {
      const id = `${r.method} ${r.path}`
      return seen.has(id) ? false : !!seen.add(id)
    })
}
