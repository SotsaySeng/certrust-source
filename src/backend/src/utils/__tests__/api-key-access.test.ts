import { generateKey, hashKey, isRouteAllowed, keyFromAuthorization, normalizeScopes, routesFor } from '../api-key-access'

describe('api key access rules', () => {
  it('generates crt_ keys whose prefix and hash match', () => {
    const { key, prefix, hash } = generateKey()
    expect(key).toMatch(/^crt_[A-Za-z0-9_-]{43}$/)
    expect(key.startsWith(prefix)).toBe(true)
    expect(prefix).toHaveLength(12)
    expect(hash).toBe(hashKey(key))
    expect(generateKey().key).not.toBe(key)
  })

  it('only picks up crt_ Bearer tokens', () => {
    expect(keyFromAuthorization('Bearer crt_abc')).toBe('crt_abc')
    expect(keyFromAuthorization('bearer crt_abc')).toBe('crt_abc')
    expect(keyFromAuthorization('Bearer eyJhbGciOi.jwt.sig')).toBeNull()
    expect(keyFromAuthorization('Basic crt_abc')).toBeNull()
    expect(keyFromAuthorization('Bearer crt_abc extra')).toBeNull()
    expect(keyFromAuthorization(undefined)).toBeNull()
  })

  it('accepts known scopes only', () => {
    expect(normalizeScopes(['issue', 'read', 'issue'])).toEqual(['read', 'issue'])
    expect(normalizeScopes(['read', 'admin'])).toBeNull()
    expect(normalizeScopes([])).toBeNull()
    expect(normalizeScopes('read')).toBeNull()
  })

  it('opens each route only to the scope that lists it', () => {
    expect(isRouteAllowed('POST', '/credentials/issue', ['issue'])).toBe(true)
    expect(isRouteAllowed('POST', '/credentials/issue', ['read'])).toBe(false)
    expect(isRouteAllowed('POST', '/credentials/:id/revoke', ['issue'])).toBe(false)
    expect(isRouteAllowed('POST', '/credentials/:id/revoke', ['revoke'])).toBe(true)
    expect(isRouteAllowed('get', '/credentials', ['read'])).toBe(true)
    expect(isRouteAllowed('PUT', '/achievements/:id', ['read', 'issue'])).toBe(false)
    expect(isRouteAllowed('PUT', '/achievements/:id', ['manage'])).toBe(true)
  })

  it('always allows /api-keys/me and never key management, billing or account deletion', () => {
    const all = ['read', 'issue', 'revoke', 'manage']
    expect(isRouteAllowed('GET', '/api-keys/me', [])).toBe(true)
    expect(isRouteAllowed('POST', '/api-keys', all)).toBe(false)
    expect(isRouteAllowed('POST', '/api-keys/:id/revoke', all)).toBe(false)
    expect(isRouteAllowed('POST', '/billing/checkout', all)).toBe(false)
    expect(isRouteAllowed('DELETE', '/profiles/me', all)).toBe(false)
    expect(isRouteAllowed('GET', '/profiles/me/export', all)).toBe(false)
  })

  it('lists the routes a key can call', () => {
    expect(routesFor(['revoke'])).toEqual([
      { method: 'GET', path: '/api-keys/me' },
      { method: 'POST', path: '/credentials/:id/revoke' },
    ])
  })
})
