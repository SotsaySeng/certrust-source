# @certrust/mcp

Connect AI assistants to [Certrust](https://certrust.app): issue, verify and manage Open Badges 3.0 / Verifiable Credentials in plain language.

Certrust's MCP server is **remote**: `https://api.certrust.app/mcp` (Streamable HTTP). This package is a small stdio bridge to it, for apps that only run MCP servers locally from a settings file. If your app can add a remote server, use the URL directly and skip this package.

## Connect

### Claude, ChatGPT and other assistants (OAuth)

Add a custom connector with the URL `https://api.certrust.app/mcp` and choose **Connect**. A member of your organization signs in to Certrust, picks what the assistant may do, and approves. No key to copy. The connection shows under **Manage > API keys** as a *Connected app*, where it can be disconnected.

### Claude Code

```bash
claude mcp add --transport http certrust https://api.certrust.app/mcp
```

### Claude Desktop, Cursor, VS Code (this package)

Create an API key in Certrust under **Manage > API keys** with only the permissions the assistant needs, then:

```json
{
  "mcpServers": {
    "certrust": {
      "command": "npx",
      "args": ["-y", "@certrust/mcp"],
      "env": { "CERTRUST_API_KEY": "crt_..." }
    }
  }
}
```

(VS Code: put the same under `"servers"` in `.vscode/mcp.json`, with `"type": "stdio"`.)

### Your own agents

Call `https://api.certrust.app/mcp` with `Authorization: Bearer crt_...`.

Connecting AI apps and API keys are included in the Pro and Enterprise plans.

## Tools

A connection only sees the tools its permissions allow.

| Tool | Permission | What it does |
|---|---|---|
| `whoami` | any | The organization, member and permissions in use |
| `verify_credential` | any | Check a credential is genuine, not revoked, not expired |
| `list_achievements` | read | Certificate and badge types your organization issues |
| `list_credentials` | read | Issued credentials, filter by status, achievement, recipient |
| `list_events` | read | Your events, to show on certificates |
| `issue_credential` | issue | Issue one credential (emails the recipient) |
| `issue_credentials_bulk` | issue | Issue to up to 2,000 people as a background job |
| `get_issuance_job` | issue | Progress of a bulk job |
| `renew_credential` | issue | Re-issue with a new expiry date |
| `revoke_credential` | revoke | Revoke a credential (cannot be undone) |

Everything goes through the Certrust API as the member who created the key or approved the connection, so the same organization rules, rate limit (120 requests a minute) and audit log apply. `issue_credential` sends an `Idempotency-Key`, so a retried call within 24 hours returns the first credential instead of issuing a duplicate.

## Configuration (this package)

| Variable | Description | Default |
|---|---|---|
| `CERTRUST_API_KEY` | Organization API key (`crt_...`) | required |
| `CERTRUST_API_URL` | Your Certrust backend, if self-hosted | `https://api.certrust.app` |
| `CERTRUST_API_TOKEN` | Older name; read when `CERTRUST_API_KEY` is not set | |

## Example prompts

```
"Is credential urn:uuid:abc123 genuine?"
"Which achievements can we issue?"
"Issue the Web Development certificate to alice@example.com, expiring 2027-12-31"
"Here is the attendee list from Friday's workshop: issue everyone the workshop badge"
"Who received the safety badge this month?"
"Revoke credential 42, reason: issued in error"
```

## Development

The tools themselves live in the backend (`src/backend/src/mcp/`). This package only forwards messages.

```bash
cd mcp
npm install
npm run build   # compile to dist/
```
