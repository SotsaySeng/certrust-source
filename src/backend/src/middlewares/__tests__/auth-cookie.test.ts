import authCookie, { SESSION_COOKIE } from '../auth-cookie'

function makeCtx({ method = 'GET', path = '/api/x', cookie, headers = {} as Record<string, string> }: { method?: string; path?: string; cookie?: string; headers?: Record<string, string> } = {}) {
  const set: Array<[string, string, any]> = []
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  const ctx: any = {
    method,
    path,
    secure: false,
    status: 200,
    body: undefined,
    request: { header: { ...lower } },
    get: (name: string) => lower[name.toLowerCase()] ?? '',
    cookies: {
      get: (name: string) => (name === SESSION_COOKIE ? cookie : undefined),
      set: (name: string, value: string, opts: any) => set.push([name, value, opts]),
    },
  }
  return { ctx, set }
}

const verify = jest.fn(async (t: string) => { if (t !== 'good') throw new Error('Invalid token.'); return { id: 1 } })
const strapi = { plugin: () => ({ service: () => ({ verify }) }) }
const mw = authCookie({ isAllowedOrigin: (o: string) => o === 'https://certrust.app' }, { strapi })

describe('auth-cookie middleware', () => {
  it('turns the session cookie into a Bearer header on reads', async () => {
    const { ctx } = makeCtx({ cookie: 'abc' })
    await mw(ctx, async () => {})
    expect(ctx.request.header.authorization).toBe('Bearer abc')
  })

  it('leaves an explicit Authorization header alone', async () => {
    const { ctx } = makeCtx({ cookie: 'abc', headers: { Authorization: 'Bearer api-token' } })
    await mw(ctx, async () => {})
    expect(ctx.request.header.authorization).toBe('Bearer api-token')
  })

  it('refuses cookie-authenticated writes from other origins (CSRF)', async () => {
    const next = jest.fn()
    for (const headers of [{ Origin: 'https://evil.example' }, {}]) {
      const { ctx } = makeCtx({ method: 'POST', cookie: 'abc', headers })
      await mw(ctx, next)
      expect(ctx.status).toBe(403)
      expect(ctx.request.header.authorization).toBeUndefined()
    }
    expect(next).not.toHaveBeenCalled()
  })

  it('allows cookie-authenticated writes from the website', async () => {
    const { ctx } = makeCtx({ method: 'PUT', cookie: 'abc', headers: { Origin: 'https://certrust.app' } })
    const next = jest.fn(async () => {})
    await mw(ctx, next)
    expect(next).toHaveBeenCalled()
    expect(ctx.request.header.authorization).toBe('Bearer abc')
  })

  it('moves the JWT from a web sign-in response into an HttpOnly cookie', async () => {
    const { ctx, set } = makeCtx({ method: 'POST', path: '/api/auth/local', headers: { 'X-Certrust-Client': 'web' } })
    await mw(ctx, async () => { ctx.body = { jwt: 'fresh', user: { id: 1 } } })
    expect(ctx.body).toEqual({ user: { id: 1 }, session: true })
    expect(set[0][0]).toBe(SESSION_COOKIE)
    expect(set[0][1]).toBe('fresh')
    expect(set[0][2]).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' })
  })

  it('keeps the JWT in the body for API clients', async () => {
    const { ctx, set } = makeCtx({ method: 'POST', path: '/api/auth/local' })
    await mw(ctx, async () => { ctx.body = { jwt: 'fresh', user: { id: 1 } } })
    expect(ctx.body.jwt).toBe('fresh')
    expect(set).toHaveLength(0)
  })

  it('clears the cookie on logout', async () => {
    const { ctx, set } = makeCtx({ method: 'POST', path: '/api/auth/logout' })
    await mw(ctx, async () => {})
    expect(ctx.status).toBe(204)
    expect(set[0]).toEqual([SESSION_COOKIE, '', expect.objectContaining({ maxAge: 0, httpOnly: true })])
  })

  it('exchanges a valid Bearer token for the cookie (OAuth callback)', async () => {
    const { ctx, set } = makeCtx({ method: 'POST', path: '/api/auth/session', headers: { Authorization: 'Bearer good', Origin: 'https://certrust.app' } })
    await mw(ctx, async () => {})
    expect(ctx.status).toBe(204)
    expect(set[0][1]).toBe('good')
  })

  it('refuses the exchange for a bad token or a foreign origin', async () => {
    const bad = makeCtx({ method: 'POST', path: '/api/auth/session', headers: { Authorization: 'Bearer forged', Origin: 'https://certrust.app' } })
    await mw(bad.ctx, async () => {})
    expect(bad.ctx.status).toBe(401)
    const foreign = makeCtx({ method: 'POST', path: '/api/auth/session', headers: { Authorization: 'Bearer good', Origin: 'https://evil.example' } })
    await mw(foreign.ctx, async () => {})
    expect(foreign.ctx.status).toBe(403)
    expect([...bad.set, ...foreign.set]).toHaveLength(0)
  })
})
