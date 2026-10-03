# @certrust/mcp

MCP server for the [Certrust](https://github.com/Schroedinger-Hat/certo) credential platform.

Lets AI assistants (Claude Desktop, Cursor, GitHub Copilot, etc.) issue, verify, and manage
Open Badges 3.0 / Verifiable Credentials via natural language.

## Tools

| Tool | Description | Auth required |
|---|---|---|
| `verify_credential` | Verify a credential by URN or ID | No |
| `list_achievements` | List available badge definitions | No |
| `list_credentials` | List credentials for the authenticated user | Yes |
| `issue_credential` | Issue a credential to a recipient | Yes |
| `revoke_credential` | Revoke a credential | Yes |
| `renew_credential` | Renew a credential with a new expiry date | Yes |
| `get_credential` | Get full credential details + verification | No |
| `run_expiration_check` | Trigger expiration notification scan | Yes (admin) |
| `export_profile_data` | Export all profile data | Yes |

## Setup

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "certrust": {
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": {
        "CERTRUST_API_URL": "https://your-certrust-instance.example.com",
        "CERTRUST_API_KEY": "crt_..."
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP config (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "certrust": {
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": {
        "CERTRUST_API_URL": "https://your-certrust-instance.example.com",
        "CERTRUST_API_KEY": "crt_..."
      }
    }
  }
}
```

### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "certrust": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": {
        "CERTRUST_API_URL": "https://your-certrust-instance.example.com",
        "CERTRUST_API_KEY": "crt_..."
      }
    }
  }
}
```

## Configuration

| Variable | Description | Default |
|---|---|---|
| `CERTRUST_API_URL` | Base URL of your Certrust backend | `http://localhost:1337` |
| `CERTRUST_API_KEY` | Organization API key (`crt_...`) | _(empty — only public tools work)_ |
| `CERTRUST_API_TOKEN` | Older name; read when `CERTRUST_API_KEY` is not set | |

To create an API key: sign in to Certrust → **Manage → API keys** → Create key (paid plans). Give it only the permissions the assistant needs: `read` and `issue` for issuing, `revoke` to revoke. The key acts with the permissions of the member who created it and stops working if they leave the organization.

`issue_credential` sends an `Idempotency-Key` built from the achievement and recipient email, so an assistant that retries the tool call within 24 hours gets the first credential back instead of issuing a duplicate. `export_profile_data` and `run_expiration_check` need a signed-in user token; API keys can't call them.

## Example prompts

```
"Verify credential urn:uuid:abc123"

"List all available achievements"

"Issue the 'Web Development' badge to alice@example.com, expiring 2027-12-31"

"Revoke credential 42 — reason: employee left the company"

"Show me all expired credentials"

"Run the expiration notification check"
```

## Development

```bash
cd mcp
npm install
npm run dev     # run via tsx (no build needed)
npm run build   # compile to dist/
```
