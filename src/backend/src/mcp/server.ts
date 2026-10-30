/**
 * Certrust as MCP tools, served at POST /mcp (Streamable HTTP, stateless).
 *
 * Each tool calls this same backend's REST API over loopback with the
 * caller's own token, so everything that guards the API guards the tools
 * too: key scopes, organization tenancy, rate limit, Idempotency-Key and
 * the audit log. Only the tools the token's scopes allow are listed.
 *
 * The npm package @certrust/mcp (mcp/ in this repo) is a stdio bridge to
 * this endpoint, so there is one set of tools.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Scope } from '../utils/api-key-access'

type Call = (method: string, path: string, body?: unknown, headers?: Record<string, string>) => Promise<any>

/** REST calls as the token's owner, against this process. */
function restClient(baseUrl: string, token: string): Call {
  return async (method, path, body, headers = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const json: any = await res.json().catch(() => null)
    if (!res.ok) throw new Error(json?.error?.message ?? `HTTP ${res.status}`)
    return json
  }
}

const text = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }],
})

/** Errors go back to the model as a tool result it can read, not a protocol error. */
function safe<A>(fn: (args: A) => Promise<ReturnType<typeof text>>) {
  return async (args: A) => {
    try { return await fn(args) }
    catch (err) { return { ...text(`Error: ${(err as Error).message}`), isError: true } }
  }
}

function credentialSummary(c: any) {
  const expired = c.expirationDate && new Date(c.expirationDate) <= new Date()
  return {
    id: c.id,
    credentialId: c.credentialId,
    name: c.name ?? c.achievement?.name,
    achievement: c.achievement ? { id: c.achievement.id, name: c.achievement.name } : undefined,
    recipient: c.recipient ? { name: c.recipientName || c.recipient.name, email: c.recipient.email } : undefined,
    issuedAt: c.issuanceDate ?? c.createdAt,
    expiresAt: c.expirationDate ?? null,
    status: c.revoked ? 'revoked' : expired ? 'expired' : 'active',
  }
}

export function createCertrustMcpServer(opts: { baseUrl: string, token: string, scopes: readonly Scope[], websiteUrl: string }) {
  const api = restClient(opts.baseUrl, opts.token)
  const can = (s: Scope) => opts.scopes.includes(s)
  const server = new McpServer(
    { name: 'certrust', version: '1.0.0' },
    {
      instructions:
        'Certrust issues and verifies digital certificates and badges (Open Badges 3.0). '
        + 'Credentials are issued against an achievement: call list_achievements first to get its id. '
        + 'Issuing sends the recipient an email and uses the organization\'s credential allowance, '
        + 'so confirm names, emails and the achievement with the user before issuing. Revoking cannot be undone.',
    },
  )

  server.registerTool('whoami', {
    title: 'Who am I connected as',
    description: 'The organization, member and permissions this connection uses.',
    annotations: { readOnlyHint: true },
  }, safe(async () => {
    const { endpoints, ...me } = (await api('GET', '/api/api-keys/me')).data
    return text(me)
  }))

  server.registerTool('verify_credential', {
    title: 'Verify a credential',
    description: 'Check whether a credential is genuine and still valid (signature, not revoked, not expired). Works for any credential, not only your organization\'s.',
    inputSchema: { credential_id: z.string().describe('Credential URN (urn:uuid:...) or numeric id') },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, safe(async ({ credential_id }) => {
    const r = await api('GET', `/api/credentials/${encodeURIComponent(credential_id)}/verify`)
    const c = r.credential ?? {}
    return text({
      verified: r.verified,
      checks: r.checks,
      name: c.name,
      issuer: c.issuer?.name,
      issuedAt: c.validFrom ?? c.issuanceDate,
      expiresAt: c.validUntil ?? c.expirationDate ?? null,
    })
  }))

  if (can('read')) {
    server.registerTool('list_achievements', {
      title: 'List achievements',
      description: 'The achievements (certificate and badge types) your organization issues. Use the id with issue_credential.',
      annotations: { readOnlyHint: true },
    }, safe(async () => {
      const me = (await api('GET', '/api/api-keys/me')).data
      if (!me.issuerProfileId) return text('This organization has no issuer profile yet.')
      const r = await api('GET', `/api/achievements/creator/${me.issuerProfileId}`)
      const items: any[] = r.data ?? r ?? []
      return text(items.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        criteria: a.criteria?.narrative ?? a.criteria,
        type: a.achievementType,
      })))
    }))

    server.registerTool('list_credentials', {
      title: 'List issued credentials',
      description: 'Credentials your organization has issued, newest first.',
      inputSchema: {
        status: z.enum(['all', 'active', 'revoked', 'expired']).default('all'),
        achievement_id: z.number().int().optional().describe('Only this achievement'),
        search: z.string().optional().describe('Match recipient name or email'),
        limit: z.number().int().min(1).max(200).default(50),
      },
      annotations: { readOnlyHint: true },
    }, safe(async ({ status, achievement_id, search, limit }) => {
      const r = await api('GET', '/api/credentials')
      const q = search?.toLowerCase()
      const all = (r.data ?? []).map(credentialSummary)
        .filter((c: any) => status === 'all' || c.status === status)
        .filter((c: any) => achievement_id == null || c.achievement?.id === achievement_id)
        .filter((c: any) => !q || `${c.recipient?.name ?? ''} ${c.recipient?.email ?? ''}`.toLowerCase().includes(q))
        .sort((a: any, b: any) => String(b.issuedAt).localeCompare(String(a.issuedAt)))
      return text({ total: all.length, shown: Math.min(limit, all.length), credentials: all.slice(0, limit) })
    }))

    server.registerTool('list_events', {
      title: 'List events',
      description: 'Your organization\'s events (workshops, courses, conferences) that credentials can be issued for.',
      annotations: { readOnlyHint: true },
    }, safe(async () => text((await api('GET', '/api/events')).data)))
  }

  if (can('issue')) {
    server.registerTool('issue_credential', {
      title: 'Issue a credential',
      description: 'Issue one credential. The recipient gets an email straight away. Retrying the same achievement + email within 24 hours returns the first credential instead of a duplicate.',
      inputSchema: {
        achievement_id: z.number().int().describe('From list_achievements'),
        recipient_email: z.string().email(),
        recipient_name: z.string().optional(),
        expiration_date: z.string().optional().describe('YYYY-MM-DD; leave out for no expiry'),
        event_id: z.number().int().optional().describe('From list_events, to show the event on the certificate'),
      },
      annotations: { destructiveHint: false, openWorldHint: true },
    }, safe(async ({ achievement_id, recipient_email, recipient_name, expiration_date, event_id }) => {
      const r = await api('POST', '/api/credentials/issue', {
        data: {
          achievementId: achievement_id,
          recipient: { email: recipient_email, ...(recipient_name ? { name: recipient_name } : {}) },
          ...(expiration_date ? { expirationDate: expiration_date } : {}),
          ...(event_id ? { eventId: event_id } : {}),
        },
      }, { 'Idempotency-Key': `mcp-issue-${achievement_id}-${recipient_email.toLowerCase()}` })
      const id = r.credential?.credentialId
      return text({ issued: true, credentialId: id, recipient: recipient_email, page: id ? `${opts.websiteUrl}/credentials/${encodeURIComponent(id)}` : undefined })
    }))

    server.registerTool('issue_credentials_bulk', {
      title: 'Issue credentials to many people',
      description: 'Issue one achievement to up to 2,000 recipients as a background job. Everyone gets an email. Recipients who already hold this achievement are skipped. Returns a job id; check it with get_issuance_job.',
      inputSchema: {
        achievement_id: z.number().int(),
        recipients: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1).max(2000),
        expiration_date: z.string().optional().describe('YYYY-MM-DD'),
      },
      annotations: { destructiveHint: false, openWorldHint: true },
    }, safe(async ({ achievement_id, recipients, expiration_date }) => {
      const r = await api('POST', '/api/issuance-jobs', {
        data: { achievementId: achievement_id, recipients, skipExisting: true, ...(expiration_date ? { expirationDate: expiration_date } : {}) },
      })
      return text(r.data ?? r)
    }))

    server.registerTool('get_issuance_job', {
      title: 'Check a bulk issuing job',
      description: 'Progress and results of a job from issue_credentials_bulk.',
      inputSchema: { job_id: z.string() },
      annotations: { readOnlyHint: true },
    }, safe(async ({ job_id }) => text((await api('GET', `/api/issuance-jobs/${encodeURIComponent(job_id)}`)).data)))

    server.registerTool('renew_credential', {
      title: 'Renew a credential',
      description: 'Re-issue a credential with a new expiry date.',
      inputSchema: {
        credential_id: z.union([z.string(), z.number()]).describe('Numeric id from list_credentials'),
        new_expiration_date: z.string().describe('YYYY-MM-DD'),
      },
      annotations: { destructiveHint: false, openWorldHint: true },
    }, safe(async ({ credential_id, new_expiration_date }) => {
      const r = await api('POST', `/api/credentials/${encodeURIComponent(String(credential_id))}/renew`, { newExpirationDate: new_expiration_date })
      return text({ renewed: true, newCredentialId: r.credential?.credential?.credentialId, expiresAt: new_expiration_date })
    }))
  }

  if (can('revoke')) {
    server.registerTool('revoke_credential', {
      title: 'Revoke a credential',
      description: 'Permanently mark a credential as revoked; it will fail verification from now on. Cannot be undone. Confirm with the user first.',
      inputSchema: {
        credential_id: z.union([z.string(), z.number()]).describe('Numeric id from list_credentials'),
        reason: z.string().optional(),
      },
      annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, safe(async ({ credential_id, reason }) => {
      await api('POST', `/api/credentials/${encodeURIComponent(String(credential_id))}/revoke`, { reason: reason ?? 'Revoked by AI assistant' })
      return text({ revoked: true, credential_id })
    }))
  }

  return server
}
