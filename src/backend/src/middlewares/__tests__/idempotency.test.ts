import idempotency from '../idempotency'

function makeStore() {
  const rows = new Map<string, any>()
  let nextId = 1
  const byId = (id: number) => [...rows.values()].find(r => r.id === id)
  return {
    rows,
    service: {
      claim: async (lookup: string, fingerprint: string) => {
        const existing = rows.get(lookup)
        if (existing) return { existing }
        const row = { id: nextId++, lookup, fingerprint, state: 'processing' }
        rows.set(lookup, row)
        return { id: row.id }
      },
      complete: async (id: number, status: number, body: unknown) => Object.assign(byId(id), { state: 'completed', responseStatus: status, responseBody: body }),
      release: async (id: number) => { rows.delete(byId(id).lookup) },
    },
  }
}

function makeCtx({ method = 'POST', path = '/api/credentials/issue', key = 'k-1', auth = 'Bearer crt_a', body = { data: { email: 'a@x.test' } } as any } = {}) {
  const headers: Record<string, string> = {}
  if (key) headers['idempotency-key'] = key
  if (auth) headers.authorization = auth
  const set: Record<string, string> = {}
  return {
    method,
    path,
    status: 404,
    body: undefined as any,
    request: { body },
    get: (h: string) => headers[h.toLowerCase()] ?? '',
    set: (h: string, v: string) => { set[h] = v },
    headersSet: set,
  } as any
}

function setup() {
  const store = makeStore()
  const mw = idempotency(null, { strapi: { service: () => store.service } })
  let runs = 0
  const handler = (status = 200, body: any = { data: { id: 1 } }) => async (ctx: any) => {
    runs++
    ctx.status = status
    ctx.body = body
  }
  return { store, mw, handler, runs: () => runs }
}

describe('idempotency middleware', () => {
  it('runs the request once and replays the stored response on retry', async () => {
    const { mw, handler, runs } = setup()
    const first = makeCtx()
    await mw(first, () => handler()(first))
    const retry = makeCtx()
    await mw(retry, () => handler(200, { data: { id: 2 } })(retry))
    expect(runs()).toBe(1)
    expect(retry.status).toBe(200)
    expect(retry.body).toEqual({ data: { id: 1 } })
    expect(retry.headersSet['Idempotent-Replayed']).toBe('true')
  })

  it('refuses the same key for a different request', async () => {
    const { mw, handler } = setup()
    const first = makeCtx()
    await mw(first, () => handler()(first))
    const other = makeCtx({ body: { data: { email: 'b@x.test' } } })
    await mw(other, () => handler()(other))
    expect(other.status).toBe(422)
    expect(other.body.error.name).toBe('IdempotencyKeyReused')
  })

  it('refuses a retry while the first request is still running', async () => {
    const { mw, handler } = setup()
    let release!: () => void
    const first = makeCtx()
    const running = mw(first, () => new Promise<void>((r) => { release = r }))
    const retry = makeCtx()
    await mw(retry, () => handler()(retry))
    expect(retry.status).toBe(409)
    release()
    await running
  })

  it('keeps callers apart: the same key from another credential runs separately', async () => {
    const { mw, handler, runs } = setup()
    const a = makeCtx()
    await mw(a, () => handler()(a))
    const b = makeCtx({ auth: 'Bearer crt_b' })
    await mw(b, () => handler()(b))
    expect(runs()).toBe(2)
    expect(b.headersSet['Idempotent-Replayed']).toBeUndefined()
  })

  it('does not store server errors or thrown errors, so a retry runs again', async () => {
    const { mw, handler, runs, store } = setup()
    const failed = makeCtx()
    await mw(failed, () => handler(500, { error: 'boom' })(failed))
    expect(store.rows.size).toBe(0)
    const thrown = makeCtx()
    await expect(mw(thrown, async () => { throw new Error('bad') })).rejects.toThrow('bad')
    expect(store.rows.size).toBe(0)
    const ok = makeCtx()
    await mw(ok, () => handler()(ok))
    expect(runs()).toBe(2)
  })

  it('does nothing without the header, on reads, or without a credential', async () => {
    const { mw, handler, runs, store } = setup()
    for (const ctx of [makeCtx({ key: '' }), makeCtx({ method: 'GET' }), makeCtx({ auth: '' })]) {
      await mw(ctx, () => handler()(ctx))
      await mw(ctx, () => handler()(ctx))
    }
    expect(runs()).toBe(6)
    expect(store.rows.size).toBe(0)
  })

  it('rejects an over-long key', async () => {
    const { mw, handler, runs } = setup()
    const ctx = makeCtx({ key: 'x'.repeat(256) })
    await mw(ctx, () => handler()(ctx))
    expect(ctx.status).toBe(400)
    expect(runs()).toBe(0)
  })
})
