/**
 * OAuth 2.1 for connecting AI apps (Claude, ChatGPT, ...) to an
 * organization, as the MCP authorization spec asks for: dynamic client
 * registration, authorization code + PKCE (S256 only), rotating refresh
 * tokens. Pure functions, no Strapi access; the flow itself lives in
 * api/oauth-client/services/oauth.ts.
 *
 * A connection is an API key row with kind 'oauth', so an access token is
 * an ordinary `crt_` key: the api-key strategy, scopes, rate limit, audit
 * and the API keys page all apply to it unchanged.
 */
import { createHash, randomBytes } from 'node:crypto'
import { SCOPES, normalizeScopes, type Scope } from './api-key-access'

export const ACCESS_TOKEN_TTL_S = 60 * 60
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
export const CODE_TTL_MS = 10 * 60 * 1000
export const REFRESH_PREFIX = 'crtr_'
/** Preselected on the consent screen when the app asks for nothing specific. */
export const DEFAULT_SCOPES: Scope[] = ['read', 'issue']

export function randomToken(prefix = ''): string {
  return prefix + randomBytes(32).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** RFC 7636 S256: BASE64URL(SHA256(verifier)) === challenge. */
export function pkceMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  return createHash('sha256').update(verifier).digest('base64url') === challenge
}

/** https anywhere; plain http only back to this machine (desktop apps, CLIs). */
export function isAllowedRedirectUri(uri: unknown): boolean {
  if (typeof uri !== 'string' || uri.length > 2000) return false
  let u: URL
  try { u = new URL(uri) }
  catch { return false }
  if (u.hash) return false
  if (u.protocol === 'https:') return true
  return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
}

/** `scope` request parameter -> known scopes. Unknown words are dropped, not fatal. */
export function parseScope(scope: unknown): Scope[] {
  if (typeof scope !== 'string') return []
  const words = scope.split(/\s+/).filter(w => (SCOPES as readonly string[]).includes(w))
  return normalizeScopes(words) ?? []
}

/** An RFC 8707 `resource` is fine when absent or pointing at this server. */
export function resourceMatches(resource: unknown, apiUrl: string): boolean {
  if (resource == null || resource === '') return true
  if (typeof resource !== 'string') return false
  const base = apiUrl.replace(/\/+$/, '')
  const r = resource.replace(/\/+$/, '')
  return r === base || r.startsWith(`${base}/`)
}

/** `redirect_uri` with the response parameters appended. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v != null && v !== '') u.searchParams.set(k, v)
  return u.toString()
}

export function authorizationServerMetadata(apiUrl: string, frontendUrl: string) {
  return {
    issuer: apiUrl,
    authorization_endpoint: `${frontendUrl}/oauth/authorize`,
    token_endpoint: `${apiUrl}/oauth/token`,
    registration_endpoint: `${apiUrl}/oauth/register`,
    scopes_supported: [...SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${frontendUrl}/integrations/guide`,
  }
}

export function protectedResourceMetadata(apiUrl: string, frontendUrl: string) {
  return {
    resource: `${apiUrl}/mcp`,
    authorization_servers: [apiUrl],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Certrust',
    resource_documentation: `${frontendUrl}/integrations/guide`,
  }
}
