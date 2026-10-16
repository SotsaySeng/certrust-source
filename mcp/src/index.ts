#!/usr/bin/env node
/**
 * Certrust MCP server for apps that run MCP servers locally over stdio
 * (Claude Desktop config file, Cursor, VS Code, ...).
 *
 * The tools live on the Certrust backend at POST /mcp; this is a bridge that
 * forwards every message there with your API key, so local and remote
 * clients get the same tools. Apps that can connect to a remote MCP server
 * directly (Claude.ai, ChatGPT, Claude Code) don't need this package: give
 * them https://api.certrust.app/mcp.
 *
 * Configuration (env vars):
 *   CERTRUST_API_URL    Base URL of your Certrust backend  (default: https://api.certrust.app)
 *   CERTRUST_API_KEY    Organization API key (crt_...) from Manage > API keys.
 *                       CERTRUST_API_TOKEN is still read if this is not set.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const API_URL = (process.env['CERTRUST_API_URL'] ?? 'https://api.certrust.app').replace(/\/+$/, '')
const API_KEY = process.env['CERTRUST_API_KEY'] ?? process.env['CERTRUST_API_TOKEN'] ?? ''

if (!API_KEY) {
  console.error('certrust-mcp: set CERTRUST_API_KEY to an API key from Manage > API keys (crt_...).')
  process.exit(1)
}

const local = new StdioServerTransport()
const remote = new StreamableHTTPClientTransport(new URL(`${API_URL}/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
})

// Pass messages straight through in both directions.
local.onmessage = message => remote.send(message).catch((err) => {
  console.error(`certrust-mcp: ${(err as Error).message}`)
  // Answer the request so the app doesn't wait forever.
  if ('id' in message && message.id != null) {
    local.send({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: `Certrust: ${(err as Error).message}` } })
  }
})
remote.onmessage = message => local.send(message)
remote.onerror = err => console.error(`certrust-mcp: ${err.message}`)
local.onclose = () => remote.close()

await remote.start()
await local.start()
