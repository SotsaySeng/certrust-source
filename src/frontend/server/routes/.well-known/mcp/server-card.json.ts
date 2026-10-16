/**
 * GET /.well-known/mcp/server-card.json
 *
 * MCP Server Card (SEP-1649): where Certrust's MCP server is and how to
 * connect, so agent frameworks can configure themselves. The server is
 * remote (Streamable HTTP, OAuth); @certrust/mcp is a stdio bridge to it
 * for apps that only run local servers.
 */
export default defineEventHandler((event) => {
  const { site, api } = publicUrls(event)
  return {
    serverInfo: {
      name: 'certrust',
      version: '1.0.0',
      description: 'Issue, verify and manage Open Badges 3.0 digital certificates and badges for your organization.',
    },
    transport: {
      type: 'streamable-http',
      url: `${api}/mcp`,
      authentication: {
        // OAuth 2.1 + PKCE with dynamic client registration; or an API key (crt_...) as a Bearer token.
        type: 'oauth2',
        protectedResourceMetadata: `${api}/.well-known/oauth-protected-resource/mcp`,
      },
    },
    alternateTransports: [{
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@certrust/mcp'],
      env: { CERTRUST_API_URL: api, CERTRUST_API_KEY: '(API key from Manage > API keys)' },
    }],
    capabilities: {
      tools: {
        // Listed per connection by its permissions (scopes).
        list: [
          { name: 'whoami', scope: null },
          { name: 'verify_credential', scope: null },
          { name: 'list_achievements', scope: 'read' },
          { name: 'list_credentials', scope: 'read' },
          { name: 'list_events', scope: 'read' },
          { name: 'issue_credential', scope: 'issue' },
          { name: 'issue_credentials_bulk', scope: 'issue' },
          { name: 'get_issuance_job', scope: 'issue' },
          { name: 'renew_credential', scope: 'issue' },
          { name: 'revoke_credential', scope: 'revoke' },
        ],
      },
    },
    links: {
      docs: `${site}/integrations/guide#ai-assistants`,
      package: 'https://www.npmjs.com/package/@certrust/mcp',
      agentSkills: `${site}/.well-known/agent-skills/index.json`,
    },
  }
})
