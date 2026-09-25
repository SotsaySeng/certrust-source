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

Certrust is an open-source platform for issuing and verifying Open Badges 3.0 and W3C Verifiable Credentials.

The API lives at \`${api}/api\`.
Public endpoints (e.g. \`GET /api/credentials/:id/verify\`) require no authentication.
Write endpoints require a Bearer token.

## Getting an API Token

1. Log in to the Certrust admin panel at \`${api}/admin\`
2. Go to **Settings → API Tokens**
3. Click **Create new API Token**
4. Choose a name, expiry, and permission level (\`Full access\` or \`Custom\`)
5. Copy the token — it is shown only once

## Authentication

Pass the token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer YOUR_API_TOKEN
\`\`\`

## Token Endpoint (programmatic login)

Alternatively, obtain a short-lived JWT by posting user credentials:

\`\`\`
POST ${api}/api/auth/local
Content-Type: application/json

{ "identifier": "user@example.com", "password": "your-password" }
\`\`\`

Response includes \`jwt\` (use as Bearer token) and \`user\` details.

## Scopes

Certrust uses Strapi role-based permissions. Common roles:

| Role | Can do |
|---|---|
| **Issuer** | issue, revoke, renew credentials; manage achievements |
| **Authenticated** | read credentials and achievements |
| **Public** | verify credentials (no token needed) |

## MCP Server

For AI agents, use the \`@certrust/mcp\` MCP server instead of raw API calls.
See: \`${site}/.well-known/mcp/server-card.json\`

\`\`\`json
{
  "mcpServers": {
    "certrust": {
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": {
        "CERTRUST_API_URL": "${api}",
        "CERTRUST_API_TOKEN": "YOUR_API_TOKEN"
      }
    }
  }
}
\`\`\`

## Resources

- OAuth Protected Resource Metadata: \`${site}/.well-known/oauth-protected-resource\`
- OAuth AS Metadata: \`${site}/.well-known/oauth-authorization-server\`
- API Catalog: \`${site}/.well-known/api-catalog\`
- Agent Skills: \`${site}/.well-known/agent-skills/index.json\`
- MCP Server Card: \`${site}/.well-known/mcp/server-card.json\`
- API documentation (Swagger UI): \`${api}/documentation\`
`
})
