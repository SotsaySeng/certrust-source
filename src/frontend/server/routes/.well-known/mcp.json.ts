/**
 * GET /.well-known/mcp.json
 *
 * Short MCP discovery file: where Certrust's MCP server is. The fuller
 * description is the server card (/.well-known/mcp/server-card.json).
 */
export default defineEventHandler((event) => {
  const { site, api } = publicUrls(event)
  return {
    name: 'Certrust',
    description: 'Issue, verify and manage Open Badges 3.0 digital certificates and badges.',
    mcp_server: {
      url: `${api}/mcp`,
      transport: 'streamable-http',
      authentication: 'OAuth 2.1 (dynamic client registration, PKCE) or an API key as a Bearer token',
      stdio_package: '@certrust/mcp',
    },
    server_card: `${site}/.well-known/mcp/server-card.json`,
    documentation: `${site}/integrations/guide#ai-assistants`,
  }
})
