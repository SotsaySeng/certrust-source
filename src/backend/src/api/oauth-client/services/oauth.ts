/**
 * The OAuth flow behind "Connect Certrust" in Claude, ChatGPT and other
 * MCP clients. See utils/oauth.ts for the pieces and why a connection is
 * an API key row.
 *
 *   1. The app registers itself:      POST /oauth/register (RFC 7591)
 *   2. It sends the member to the website's /oauth/authorize page, which
 *      asks GET /api/oauth/consent what the app is, then posts the
 *      member's decision to POST /api/oauth/consent; that returns where to
 *      send the browser back to, with a one-time code.
 *   3. The app swaps the code (+ PKCE verifier) for tokens: POST /oauth/token
 *
 * Authorization codes live in memory for 10 minutes: the backend is a
 * single instance, and a code lost to a restart only means connecting again.
 */
import { errors } from '@strapi/utils'
import { normalizeScopes, type Scope } from '../../../utils/api-key-access'
import {
  CODE_TTL_MS, DEFAULT_SCOPES, isAllowedRedirectUri, parseScope, pkceMatches, randomToken,
  redirectWith, resourceMatches, sha256,
} from '../../../utils/oauth'

const CLIENT_UID = 'api::oauth-client.oauth-client'
const AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const

interface PendingCode {
  clientId: number
  redirectUri: string
  codeChallenge: string
  userId: number
  organizationId: number
  scopes: Scope[]
  expiresAt: number
}

const codes = new Map<string, PendingCode>()

function takeCode(code: string): PendingCode | null {
  const now = Date.now()
  for (const [k, v] of codes) if (v.expiresAt <= now) codes.delete(k)
  const pending = codes.get(code)
  codes.delete(code) // single use, even when the exchange then fails
  return pending ?? null
}

/** An RFC 6749 error response. */
function oauthError(error: string, description: string, status = 400) {
  return { status, body: { error, error_description: description } }
}

export interface AuthorizeParams {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  state?: string
  scope?: string
  resource?: string
}

export default ({ strapi }: { strapi: any }) => {
  const apiUrl = () => String(strapi.config.get('server.url')).replace(/\/+$/, '')

  async function findClient(clientId: unknown) {
    if (typeof clientId !== 'string' || !clientId) return null
    return strapi.db.query(CLIENT_UID).findOne({ where: { clientId } })
  }

  /** Client authentication at the token endpoint, per its registered method. */
  async function authenticateClient(body: any, authorization: unknown) {
    let id = body?.client_id
    let secret = body?.client_secret
    if (typeof authorization === 'string' && /^basic\s/i.test(authorization)) {
      const decoded = Buffer.from(authorization.slice(6).trim(), 'base64').toString('utf8')
      const i = decoded.indexOf(':')
      if (i > 0) {
        id = decodeURIComponent(decoded.slice(0, i))
        secret = decodeURIComponent(decoded.slice(i + 1))
      }
    }
    const client = await findClient(id)
    if (!client) return null
    if (client.secretHash && (typeof secret !== 'string' || sha256(secret) !== client.secretHash)) return null
    return client
  }

  /**
   * Check an authorization request before showing the consent screen.
   * `redirectable` is false when the error can't be sent back to the app
   * (unknown client or redirect URI): the page must show it instead.
   */
  async function checkAuthorizeRequest(q: AuthorizeParams): Promise<any> {
    const client = await findClient(q.client_id)
    if (!client) return { error: 'This app is not registered with Certrust. Start the connection again from the app.', redirectable: false }
    if (!q.redirect_uri || !(client.redirectUris ?? []).includes(q.redirect_uri)) {
      return { error: 'The app sent an unexpected return address, so the connection was stopped.', redirectable: false }
    }
    if (q.response_type !== 'code') return { error: 'unsupported_response_type', redirectable: true, client }
    if (!q.code_challenge || q.code_challenge_method !== 'S256') {
      return { error: 'invalid_request', description: 'PKCE with S256 is required.', redirectable: true, client }
    }
    if (!resourceMatches(q.resource, apiUrl())) {
      return { error: 'invalid_target', description: 'resource is not this server.', redirectable: true, client }
    }
    return { client }
  }

  return {
    /** RFC 7591 dynamic client registration. Open, as MCP clients expect. */
    async register(body: any) {
      const redirectUris = body?.redirect_uris
      if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10
        || !redirectUris.every(isAllowedRedirectUri)) {
        return oauthError('invalid_redirect_uri', 'redirect_uris must list 1-10 https URLs (http only for localhost).')
      }
      const method = body?.token_endpoint_auth_method ?? 'none'
      if (!AUTH_METHODS.includes(method)) {
        return oauthError('invalid_client_metadata', `token_endpoint_auth_method must be one of ${AUTH_METHODS.join(', ')}.`)
      }
      const grantTypes = body?.grant_types ?? ['authorization_code', 'refresh_token']
      if (!Array.isArray(grantTypes) || grantTypes.some((g: unknown) => g !== 'authorization_code' && g !== 'refresh_token')) {
        return oauthError('invalid_client_metadata', 'Only authorization_code and refresh_token grants are supported.')
      }
      const clientName = typeof body?.client_name === 'string' ? body.client_name.trim().slice(0, 120) : ''

      const clientId = randomToken('crtc_')
      const clientSecret = method === 'none' ? null : randomToken('crts_')
      await strapi.db.query(CLIENT_UID).create({
        data: {
          clientId,
          clientName: clientName || null,
          redirectUris,
          secretHash: clientSecret ? sha256(clientSecret) : null,
          tokenEndpointAuthMethod: method,
        },
      })
      return {
        status: 201,
        body: {
          client_id: clientId,
          ...(clientSecret ? { client_secret: clientSecret, client_secret_expires_at: 0 } : {}),
          client_id_issued_at: Math.floor(Date.now() / 1000),
          client_name: clientName || undefined,
          redirect_uris: redirectUris,
          grant_types: grantTypes,
          response_types: ['code'],
          token_endpoint_auth_method: method,
        },
      }
    },

    /** What the consent screen shows. */
    async describeRequest(q: AuthorizeParams) {
      const check: any = await checkAuthorizeRequest(q)
      if (check.error && !check.redirectable) throw new errors.ValidationError(check.error)
      const requested = parseScope(q.scope)
      return {
        clientName: check.client.clientName || 'An app',
        redirectHost: new URL(q.redirect_uri!).host,
        requestedScopes: requested.length ? requested : DEFAULT_SCOPES,
        // Already invalid: the page sends the member straight back with this.
        errorRedirect: check.error
          ? redirectWith(q.redirect_uri!, { error: check.error, error_description: check.description, state: q.state, iss: apiUrl() })
          : null,
      }
    },

    /**
     * The member's decision. Returns where to send their browser: back to
     * the app with a code, or with access_denied.
     */
    async decide(input: { userId: number, organizationId: number, params: AuthorizeParams, approve: boolean, scopes: unknown }) {
      const q = input.params
      const check: any = await checkAuthorizeRequest(q)
      if (check.error && !check.redirectable) throw new errors.ValidationError(check.error)
      const back = (params: Record<string, string | undefined>) =>
        redirectWith(q.redirect_uri!, { ...params, state: q.state, iss: apiUrl() })
      if (check.error) return back({ error: check.error, error_description: check.description })
      if (!input.approve) return back({ error: 'access_denied', error_description: 'The member declined the connection.' })

      const scopes = normalizeScopes(input.scopes)
      if (!scopes) throw new errors.ValidationError('Choose at least one permission.')
      const code = randomToken()
      codes.set(code, {
        clientId: check.client.id,
        redirectUri: q.redirect_uri!,
        codeChallenge: q.code_challenge!,
        userId: input.userId,
        organizationId: input.organizationId,
        scopes,
        expiresAt: Date.now() + CODE_TTL_MS,
      })
      return back({ code })
    },

    /** POST /oauth/token: authorization_code and refresh_token grants. */
    async token(body: any, authorization: unknown) {
      const client = await authenticateClient(body, authorization)
      if (!client) return oauthError('invalid_client', 'Unknown client or wrong client secret.', 401)

      if (body?.grant_type === 'authorization_code') {
        const pending = typeof body.code === 'string' ? takeCode(body.code) : null
        if (!pending || pending.expiresAt <= Date.now() || pending.clientId !== client.id) {
          return oauthError('invalid_grant', 'The authorization code is invalid or expired.')
        }
        if (body.redirect_uri !== pending.redirectUri) return oauthError('invalid_grant', 'redirect_uri does not match.')
        if (!pkceMatches(body.code_verifier, pending.codeChallenge)) return oauthError('invalid_grant', 'PKCE verification failed.')
        if (!resourceMatches(body.resource, apiUrl())) return oauthError('invalid_target', 'resource is not this server.')

        let result
        try {
          result = await strapi.service('api::api-key.api-key').createOAuthConnection({
            organizationId: pending.organizationId,
            userId: pending.userId,
            clientId: client.id,
            name: client.clientName || 'Connected app',
            scopes: pending.scopes,
          })
        }
        catch (err: any) {
          if (err instanceof errors.ValidationError) return oauthError('invalid_grant', err.message)
          throw err
        }
        await strapi.service('api::audit-log-entry.audit-log').record({
          action: 'api-key.create',
          entityType: 'api-key',
          entityId: result.documentId,
          actorId: pending.userId,
          metadata: { name: client.clientName, kind: 'oauth', clientId: client.clientId, scopes: pending.scopes },
        })
        return { status: 200, body: result.tokens }
      }

      if (body?.grant_type === 'refresh_token') {
        if (typeof body.refresh_token !== 'string') return oauthError('invalid_request', 'refresh_token is required.')
        const tokens = await strapi.service('api::api-key.api-key').refreshOAuthConnection(body.refresh_token, client.id)
        if (!tokens) return oauthError('invalid_grant', 'The refresh token is invalid, expired or revoked.')
        return { status: 200, body: tokens }
      }

      return oauthError('unsupported_grant_type', 'Use authorization_code or refresh_token.')
    },
  }
}
