import { createApiKeyStrategy } from '../api-key-strategy'
import { requestContextStorage } from '../../utils/request-context'

const user = { id: 7, username: 'issuer', role: { id: 2 } }
const ability = { can: (action: string) => action !== 'api::billing.billing.checkout' }

function makeStrapi(resolve: any) {
  return {
    service: (uid: string) => {
      if (uid === 'api::api-key.api-key') return { resolve }
      throw new Error(uid)
    },
    plugin: () => ({ service: () => ({ findRolePermissions: async () => [{ action: 'x' }], toContentAPIPermission: (p: any) => p }) }),
    contentAPI: { permissions: { engine: { generateAbility: async () => ability } } },
  }
}

function makeCtx(authorization: string | undefined, route = { method: 'POST', path: '/credentials/issue' }) {
  return { request: { header: { authorization } }, state: { route } as any }
}

const goodKey = { key: { id: 1, documentId: 'k1', name: 'SIS sync', prefix: 'crt_abcdefgh', scopes: ['issue'], organizationId: 3, user } }

describe('api-key auth strategy', () => {
  it('ignores requests that are not made with a crt_ key', async () => {
    const resolve = jest.fn()
    const strategy = createApiKeyStrategy(makeStrapi(resolve))
    expect(await strategy.authenticate(makeCtx(undefined))).toEqual({ authenticated: false })
    expect(await strategy.authenticate(makeCtx('Bearer eyJ.jwt.token'))).toEqual({ authenticated: false })
    expect(resolve).not.toHaveBeenCalled()
  })

  it('rejects an unknown, revoked or expired key', async () => {
    const strategy = createApiKeyStrategy(makeStrapi(async () => ({ error: 'Invalid API key' })))
    expect(await strategy.authenticate(makeCtx('Bearer crt_nope'))).toEqual({ error: 'Invalid API key' })
  })

  it('authenticates as the member who created the key and records the key', async () => {
    const strategy = createApiKeyStrategy(makeStrapi(async () => goodKey))
    const ctx = makeCtx('Bearer crt_good')
    const store: any = { requestId: 'r1' }
    const result = await requestContextStorage.run(store, () => strategy.authenticate(ctx))
    expect(result).toEqual({ authenticated: true, credentials: user, ability })
    expect(ctx.state.user).toBe(user)
    expect(ctx.state.apiKey).toEqual({ id: 1, documentId: 'k1', name: 'SIS sync', scopes: ['issue'], organizationId: 3 })
    expect(store.apiKey).toEqual({ documentId: 'k1', name: 'SIS sync', prefix: 'crt_abcdefgh' })
  })

  it('refuses a route outside the key\'s scopes with 403 before anything runs', async () => {
    const strategy = createApiKeyStrategy(makeStrapi(async () => goodKey))
    const ctx = makeCtx('Bearer crt_good', { method: 'POST', path: '/credentials/:id/revoke' })
    await expect(strategy.authenticate(ctx)).rejects.toMatchObject({ name: 'ForbiddenError' })
    expect(ctx.state.user).toBeUndefined()
  })

  it('limits requests per key and says when to retry', async () => {
    const strategy = createApiKeyStrategy(makeStrapi(async () => goodKey), { rateLimit: 2 })
    const headers: Record<string, string> = {}
    const ctx = () => ({ ...makeCtx('Bearer crt_good'), set: (k: string, v: string) => { headers[k] = v } })
    expect((await strategy.authenticate(ctx())).authenticated).toBe(true)
    expect((await strategy.authenticate(ctx())).authenticated).toBe(true)
    expect(headers['X-RateLimit-Remaining']).toBe('0')
    await expect(strategy.authenticate(ctx())).rejects.toMatchObject({ name: 'RateLimitError' })
    expect(headers['X-RateLimit-Limit']).toBe('2')
    expect(Number(headers['Retry-After'])).toBeGreaterThanOrEqual(1)
  })

  it('still applies the member\'s role permissions', async () => {
    const strategy = createApiKeyStrategy(makeStrapi(async () => goodKey))
    await expect(strategy.verify({ ability }, { scope: ['api::credential.credential.issue'] })).resolves.toBeUndefined()
    await expect(strategy.verify({ ability }, { scope: ['api::billing.billing.checkout'] })).rejects.toMatchObject({ name: 'ForbiddenError' })
    await expect(strategy.verify({ ability: null }, {})).rejects.toMatchObject({ name: 'UnauthorizedError' })
  })
})
