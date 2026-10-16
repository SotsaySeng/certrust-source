/**
 * Root-level routes for AI apps: the MCP endpoint and the OAuth endpoints
 * apps call themselves. Mounted outside /api (MCP and OAuth clients look
 * for these exact paths), from register() like monitoring/routes.ts.
 *
 *   POST /mcp                                         MCP, Streamable HTTP (stateless, JSON responses)
 *   GET  /.well-known/oauth-protected-resource[/mcp]  RFC 9728
 *   GET  /.well-known/oauth-authorization-server      RFC 8414
 *   POST /oauth/register                              RFC 7591
 *   POST /oauth/token
 *
 * The consent screen is the website's /oauth/authorize page, backed by
 * /api/oauth/consent (api/oauth-client).
 */
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { keyFromAuthorization } from '../utils/api-key-access'
import { authorizationServerMetadata, protectedResourceMetadata } from '../utils/oauth'
import { createRateLimiter } from '../utils/rate-limit'
import { createCertrustMcpServer } from './server'

const open = { auth: false as const, policies: [], middlewares: [] }

export function registerMcpRoutes(strapi: any) {
  const apiUrl = () => String(strapi.config.get('server.url')).replace(/\/+$/, '')
  const websiteUrl = () => String(strapi.config.get('frontend.url')).replace(/\/+$/, '')
  const loopbackUrl = () => `http://127.0.0.1:${strapi.config.get('server.port')}`
  const resourceMetadataUrl = () => `${apiUrl()}/.well-known/oauth-protected-resource/mcp`
  // Registration is open (MCP clients register themselves); cap it per address.
  const registrations = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 })

  const metadata = (build: (api: string, web: string) => object) => async (ctx: any) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.body = build(apiUrl(), websiteUrl())
  }

  const respond = (ctx: any, result: { status: number, body: unknown }) => {
    ctx.set('Cache-Control', 'no-store')
    ctx.status = result.status
    ctx.body = result.body
  }

  async function mcp(ctx: any) {
    if (ctx.method !== 'POST') {
      ctx.set('Allow', 'POST')
      ctx.status = 405
      ctx.body = { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless, use POST.' }, id: null }
      return
    }
    const unauthorized = (extra: string, message: string) => {
      ctx.set('WWW-Authenticate', `Bearer resource_metadata="${resourceMetadataUrl()}"${extra}`)
      ctx.status = 401
      ctx.body = { error: 'invalid_token', error_description: message }
    }
    const token = keyFromAuthorization(ctx.request.header.authorization)
    if (!token) return unauthorized('', 'Connect your Certrust account, or send an API key as a Bearer token.')
    const resolved = await strapi.service('api::api-key.api-key').resolve(token)
    if ('error' in resolved) return unauthorized(`, error="invalid_token", error_description="${resolved.error}"`, resolved.error)

    const server = createCertrustMcpServer({
      baseUrl: loopbackUrl(),
      token,
      scopes: resolved.key.scopes,
      websiteUrl: websiteUrl(),
    })
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    ctx.respond = false
    ctx.res.on('close', () => {
      transport.close()
      server.close()
    })
    await server.connect(transport)
    await transport.handleRequest(ctx.req, ctx.res, ctx.request.body)
  }

  strapi.server.routes([
    { method: 'POST', path: '/mcp', handler: mcp, config: open },
    { method: 'GET', path: '/mcp', handler: mcp, config: open },
    { method: 'DELETE', path: '/mcp', handler: mcp, config: open },
    { method: 'GET', path: '/.well-known/oauth-protected-resource', handler: metadata(protectedResourceMetadata), config: open },
    { method: 'GET', path: '/.well-known/oauth-protected-resource/mcp', handler: metadata(protectedResourceMetadata), config: open },
    { method: 'GET', path: '/.well-known/oauth-authorization-server', handler: metadata(authorizationServerMetadata), config: open },
    {
      method: 'POST',
      path: '/oauth/register',
      config: open,
      handler: async (ctx: any) => {
        if (!registrations.take(ctx.ip).allowed) {
          return respond(ctx, { status: 429, body: { error: 'too_many_requests', error_description: 'Too many registrations from this address. Try again later.' } })
        }
        respond(ctx, await strapi.service('api::oauth-client.oauth').register(ctx.request.body))
      },
    },
    {
      method: 'POST',
      path: '/oauth/token',
      config: open,
      handler: async (ctx: any) => {
        respond(ctx, await strapi.service('api::oauth-client.oauth').token(ctx.request.body, ctx.request.header.authorization))
      },
    },
  ])
}
