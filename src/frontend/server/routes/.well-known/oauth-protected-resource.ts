/**
 * GET /.well-known/oauth-protected-resource
 *
 * RFC 9728 metadata for Certrust's MCP server, advertised from the website
 * too so agents that start here find it. The MCP endpoint and its
 * authorization server are the backend (api.certrust.app), which serves the
 * authoritative copy at /.well-known/oauth-protected-resource/mcp.
 */
export default defineEventHandler((event) => {
  const { site, api } = publicUrls(event)
  return {
    resource: `${api}/mcp`,
    authorization_servers: [api],
    scopes_supported: ['read', 'issue', 'revoke', 'manage'],
    bearer_methods_supported: ['header'],
    resource_name: 'Certrust',
    resource_documentation: `${site}/integrations/guide`,
  }
})
