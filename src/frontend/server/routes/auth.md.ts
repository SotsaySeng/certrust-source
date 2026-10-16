/**
 * GET /auth.md
 *
 * Auth.md — agent registration and authentication instructions.
 * https://workos.com/auth.md
 *
 * Returns text/markdown so agents can parse human-readable + machine-readable
 * registration guidance in one document.
 */
export default defineEventHandler((event) => {
  const { site, api } = publicUrls(event)
  setResponseHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  return `# Auth Instructions for Certrust

## Overview

Certrust issues and verifies Open Badges 3.0 / W3C Verifiable Credentials for organizations.
The API lives at \`${api}/api\`. Verifying a credential (\`GET /api/credentials/:id/verify\`) needs no authentication; everything an organization does needs a token.

## AI assistants (MCP)

Certrust's MCP server is at \`${api}/mcp\` (Streamable HTTP).

- **OAuth (recommended for assistants people use, e.g. Claude, ChatGPT):** the server answers an unauthenticated request with \`401\` and \`WWW-Authenticate: Bearer resource_metadata="${api}/.well-known/oauth-protected-resource/mcp"\`. Register with dynamic client registration (\`POST ${api}/oauth/register\`), then use the authorization code flow with PKCE (S256). A member of the organization approves the connection and picks its permissions. Access tokens last one hour; refresh tokens rotate.
- **API key:** send an organization API key as \`Authorization: Bearer crt_...\`.

Local stdio apps can use the \`@certrust/mcp\` bridge:

\`\`\`json
{
  "mcpServers": {
    "certrust": {
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": { "CERTRUST_API_KEY": "crt_..." }
    }
  }
}
\`\`\`

## API keys (integrations)

1. Sign in at \`${site}\` and open **Manage > API keys** (Pro and Enterprise plans).
2. Create a key with only the permissions it needs: \`read\`, \`issue\`, \`revoke\`, \`manage\`.
3. Send it as \`Authorization: Bearer crt_...\`. It is shown once.

A key acts as the member who created it, is limited to 120 requests a minute, and supports \`Idempotency-Key\` on writes.

## Resources

- Setup guide: \`${site}/integrations/guide\`
- OAuth Protected Resource Metadata: \`${api}/.well-known/oauth-protected-resource/mcp\`
- OAuth Authorization Server Metadata: \`${api}/.well-known/oauth-authorization-server\`
- MCP Server Card: \`${site}/.well-known/mcp/server-card.json\`
- API Catalog: \`${site}/.well-known/api-catalog\`
- Agent Skills: \`${site}/.well-known/agent-skills/index.json\`
`
})
