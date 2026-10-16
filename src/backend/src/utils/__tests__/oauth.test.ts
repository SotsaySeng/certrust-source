import { createHash } from 'node:crypto'
import { isAllowedRedirectUri, parseScope, pkceMatches, redirectWith, resourceMatches } from '../oauth'

describe('oauth helpers', () => {
  it('checks PKCE S256 verifiers', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    // RFC 7636 appendix B
    expect(pkceMatches(verifier, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true)
    expect(pkceMatches(verifier, createHash('sha256').update('other').digest('base64url'))).toBe(false)
    expect(pkceMatches('too-short', 'x')).toBe(false)
    expect(pkceMatches(undefined, 'x')).toBe(false)
  })

  it('allows https redirects, and http only back to this machine', () => {
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true)
    expect(isAllowedRedirectUri('http://localhost:6274/oauth/callback')).toBe(true)
    expect(isAllowedRedirectUri('http://127.0.0.1:33418/cb')).toBe(true)
    expect(isAllowedRedirectUri('http://evil.example/cb')).toBe(false)
    expect(isAllowedRedirectUri('https://claude.ai/cb#frag')).toBe(false)
    expect(isAllowedRedirectUri('javascript:alert(1)')).toBe(false)
    expect(isAllowedRedirectUri('not a url')).toBe(false)
  })

  it('keeps known scopes and drops the rest', () => {
    expect(parseScope('issue read openid')).toEqual(['read', 'issue'])
    expect(parseScope('')).toEqual([])
    expect(parseScope(undefined)).toEqual([])
  })

  it('accepts a resource only when it is this server', () => {
    expect(resourceMatches(undefined, 'https://api.certrust.app')).toBe(true)
    expect(resourceMatches('https://api.certrust.app/mcp', 'https://api.certrust.app')).toBe(true)
    expect(resourceMatches('https://api.certrust.app/', 'https://api.certrust.app')).toBe(true)
    expect(resourceMatches('https://api.certrust.app.evil.example/mcp', 'https://api.certrust.app')).toBe(false)
    expect(resourceMatches('https://other.example/mcp', 'https://api.certrust.app')).toBe(false)
  })

  it('appends response parameters, skipping empty ones', () => {
    expect(redirectWith('https://app.example/cb?x=1', { code: 'abc', state: undefined, iss: 'https://api' }))
      .toBe('https://app.example/cb?x=1&code=abc&iss=https%3A%2F%2Fapi')
  })
})
