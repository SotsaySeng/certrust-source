/**
 * Organization API keys: create, list, revoke, and resolve a key on each
 * request. See utils/api-key-access.ts for the key format and which routes
 * each scope opens.
 *
 * A key belongs to an organization and acts with the permissions of the
 * member who created it. It stops working when it is revoked or expires,
 * when that member leaves the organization or is blocked, or when the
 * organization's tier no longer includes API access.
 */
import { errors } from '@strapi/utils'
import { generateKey, hashKey, normalizeScopes, type Scope } from '../../../utils/api-key-access'
import { ACCESS_TOKEN_TTL_S, REFRESH_PREFIX, REFRESH_TOKEN_TTL_MS, randomToken, sha256 } from '../../../utils/oauth'

const UID = 'api::api-key.api-key'
const MAX_KEYS_PER_ORGANIZATION = 20
// lastUsedAt is written at most this often per key, not on every request.
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

export interface ResolvedKey {
  id: number
  documentId: string
  name: string
  prefix: string
  scopes: Scope[]
  organizationId: number
  user: any
}

// Keys that still count against the per-organization limit: not revoked,
// and for OAuth connections, not lapsed (refresh token unused for 30 days).
function activeWhere(organizationId: number) {
  return {
    organization: { id: organizationId },
    revokedAt: { $null: true },
    $or: [{ kind: { $null: true } }, { kind: 'key' }, { refreshExpiresAt: { $gt: new Date() } }],
  }
}

async function assertRoomForKey(strapi: any, organizationId: number) {
  const active = await strapi.db.query(UID).count({ where: activeWhere(organizationId) })
  if (active >= MAX_KEYS_PER_ORGANIZATION) {
    throw new errors.ValidationError(`An organization can have up to ${MAX_KEYS_PER_ORGANIZATION} active keys and connected apps. Revoke one you no longer use first.`)
  }
}

/** A fresh access token (an ordinary crt_ key) + refresh token for an OAuth connection. */
function mintOAuthTokens() {
  const { key, prefix, hash } = generateKey()
  const refreshToken = randomToken(REFRESH_PREFIX)
  return {
    tokens: { access_token: key, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refreshToken },
    data: {
      prefix,
      keyHash: hash,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000),
      refreshTokenHash: sha256(refreshToken),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  }
}

function publicView(row: any) {
  return {
    documentId: row.documentId,
    name: row.name,
    kind: row.kind === 'oauth' ? 'oauth' : 'key',
    connectionExpiresAt: row.kind === 'oauth' ? row.refreshExpiresAt ?? null : undefined,
    prefix: row.prefix,
    scopes: row.scopes ?? [],
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt ?? null,
    expiresAt: row.expiresAt ?? null,
    revokedAt: row.revokedAt ?? null,
    createdBy: row.createdByUser ? { username: row.createdByUser.username, email: row.createdByUser.email } : null,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  publicView,

  async listForOrganization(organizationId: number) {
    const rows: any[] = await strapi.db.query(UID).findMany({
      where: { organization: { id: organizationId } },
      populate: { createdByUser: { select: ['username', 'email'] } },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(publicView)
  },

  async create(input: { organizationId: number, userId: number, name: unknown, scopes: unknown, expiresAt?: unknown }) {
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    if (!name || name.length > 80) throw new errors.ValidationError('Give the key a name of up to 80 characters.')
    const scopes = normalizeScopes(input.scopes)
    if (!scopes) throw new errors.ValidationError('Choose at least one permission: read, issue, revoke or manage.')
    let expiresAt: Date | null = null
    if (input.expiresAt != null && input.expiresAt !== '') {
      expiresAt = new Date(String(input.expiresAt))
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw new errors.ValidationError('The expiry date must be in the future.')
      }
    }
    await assertRoomForKey(strapi, input.organizationId)

    const { key, prefix, hash } = generateKey()
    const created = await strapi.documents(UID).create({
      data: { name, prefix, keyHash: hash, scopes, expiresAt, organization: input.organizationId, createdByUser: input.userId },
    })
    const row = await strapi.db.query(UID).findOne({
      where: { id: created.id },
      populate: { createdByUser: { select: ['username', 'email'] } },
    })
    return { key, apiKey: publicView(row) }
  },

  /**
   * A new OAuth connection: an API key row (kind 'oauth') named after the
   * app, acting as the member who approved it, with the scopes they chose.
   */
  async createOAuthConnection(input: { organizationId: number, userId: number, clientId: number, name: string, scopes: Scope[] }) {
    await assertRoomForKey(strapi, input.organizationId)
    const { tokens, data } = mintOAuthTokens()
    const created = await strapi.documents(UID).create({
      data: {
        ...data,
        name: input.name.slice(0, 80) || 'Connected app',
        kind: 'oauth',
        scopes: input.scopes,
        organization: input.organizationId,
        createdByUser: input.userId,
        oauthClient: input.clientId,
      },
    })
    return { tokens: { ...tokens, scope: input.scopes.join(' ') }, documentId: created.documentId }
  },

  /**
   * Swap a refresh token for new tokens (both rotate). Null when the token
   * is unknown, revoked, lapsed or belongs to another client. Whether the
   * organization may still use the API is checked when the access token is
   * used (resolve), as for any key.
   */
  async refreshOAuthConnection(refreshToken: string, clientId: number) {
    const row = await strapi.db.query(UID).findOne({
      where: { refreshTokenHash: sha256(refreshToken), kind: 'oauth' },
      populate: { oauthClient: { select: ['id'] } },
    })
    if (!row || row.revokedAt || row.oauthClient?.id !== clientId) return null
    if (!row.refreshExpiresAt || new Date(row.refreshExpiresAt).getTime() <= Date.now()) return null
    const { tokens, data } = mintOAuthTokens()
    await strapi.db.query(UID).update({ where: { id: row.id }, data })
    return { ...tokens, scope: (normalizeScopes(row.scopes) ?? []).join(' ') }
  },

  /** Revoke one of the organization's keys. False if it isn't theirs. */
  async revoke(organizationId: number, documentId: string): Promise<boolean> {
    const row = await strapi.db.query(UID).findOne({
      where: { documentId, organization: { id: organizationId } },
      select: ['id', 'revokedAt'],
    })
    if (!row) return false
    if (!row.revokedAt) {
      await strapi.db.query(UID).update({ where: { id: row.id }, data: { revokedAt: new Date() } })
    }
    return true
  },

  /**
   * The key behind a `crt_` token, with the user it acts as, or a reason
   * it can't be used. Never says which check failed beyond the message.
   */
  async resolve(key: string): Promise<{ key: ResolvedKey } | { error: string }> {
    const invalid = { error: 'Invalid API key' }
    const row = await strapi.db.query(UID).findOne({
      where: { keyHash: hashKey(key) },
      populate: { organization: true, createdByUser: true },
    })
    if (!row || row.revokedAt) return invalid
    if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) {
      return { error: row.kind === 'oauth' ? 'Access token expired' : 'API key expired' }
    }
    if (!row.organization || !row.createdByUser || row.organization.closedAt) return invalid

    const user = await strapi.plugin('users-permissions').service('user').fetchAuthenticatedUser(row.createdByUser.id)
    if (!user || user.blocked || user.confirmed === false) return invalid
    const orgId = await strapi.service('api::profile.multi-tenancy').getUserOrganizationId(user.id)
    if (String(orgId) !== String(row.organization.id)) return invalid
    if (row.organization.suspendedAt) return { error: 'Organization suspended' }
    if (!(await strapi.service('api::organization.usage').getApiAccess(row.organization))) {
      return { error: 'API access is not included in this organization\'s plan' }
    }

    if (!row.lastUsedAt || Date.now() - new Date(row.lastUsedAt).getTime() > TOUCH_INTERVAL_MS) {
      await strapi.db.query(UID).update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
    }
    return {
      key: {
        id: row.id,
        documentId: row.documentId,
        name: row.name,
        prefix: row.prefix,
        scopes: normalizeScopes(row.scopes) ?? [],
        organizationId: row.organization.id,
        user,
      },
    }
  },
})
