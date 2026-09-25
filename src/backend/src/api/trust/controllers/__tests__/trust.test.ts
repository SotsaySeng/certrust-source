import trustController from '../trust'

describe('trust controller', () => {
  const controller = trustController({ strapi: {} as any })

  it.each(['myVerification', 'requestVerification', 'uploadVerificationDocuments', 'deleteVerificationDocument'] as const)('%s answers 401, not 500, without a signed-in user', async (action) => {
    const ctx: any = { state: {}, request: { body: {} }, params: {}, unauthorized: jest.fn() }
    await controller[action](ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
  })
})

describe('verification documents', () => {
  const org = { id: 3, documentId: 'org-3', name: 'Acme Academy', verificationStatus: 'unverified' }

  function setup(overrides: { org?: any, docCount?: number, findOwn?: any } = {}) {
    const docs = {
      list: jest.fn(async () => []),
      count: jest.fn(async () => overrides.docCount ?? 0),
      store: jest.fn(async (_org: string, files: any[]) => files.map((_f, i) => ({ id: i + 1, fileName: 'x.pdf', size: 1 }))),
      findOwn: jest.fn(async () => overrides.findOwn ?? null),
      remove: jest.fn(),
      keep: jest.fn(),
      read: jest.fn(async () => ({ id: 9, organizationDocumentId: 'org-3', fileName: 'reg.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-') })),
      scheduleDeletion: jest.fn(),
    }
    const updateOrg = jest.fn()
    const services: Record<string, any> = {
      'api::profile.multi-tenancy': { getUserOrganizationId: async () => 3 },
      'api::trust.verification-documents': docs,
      'api::billing.billing': { updateOrg },
      'api::audit-log-entry.audit-log': { record: jest.fn() },
      'email': { send: jest.fn() },
    }
    const strapi: any = {
      service: (uid: string) => services[uid],
      db: { query: () => ({ findOne: async () => overrides.org ?? org, findMany: async () => [] }) },
      config: { get: () => 'privacy@example.test' },
      plugins: { email: { services: { email: { send: jest.fn() } } } },
      log: { error: jest.fn() },
    }
    const ctx = (extra: any = {}): any => ({
      state: { user: { id: 11, email: 'owner@gmail.com' } },
      request: { body: {}, files: {} },
      params: {},
      badRequest: jest.fn(),
      notFound: jest.fn(),
      forbidden: jest.fn(),
      unauthorized: jest.fn(),
      set: jest.fn(),
      ...extra,
    })
    return { controller: trustController({ strapi }), docs, updateOrg, ctx }
  }

  it('asks for a domain or a document before submitting', async () => {
    const { controller, ctx, updateOrg } = setup()
    const c = ctx()
    await controller.requestVerification(c)
    expect(c.badRequest).toHaveBeenCalledWith(expect.stringMatching(/domain or upload/))
    expect(updateOrg).not.toHaveBeenCalled()
  })

  it('accepts a request with documents and no domain', async () => {
    const { controller, ctx, updateOrg, docs } = setup({ docCount: 2 })
    const c = ctx({ request: { body: { message: 'We are a registered school' } } })
    const res: any = await controller.requestVerification(c)
    expect(updateOrg).toHaveBeenCalledWith('org-3', expect.objectContaining({ verificationStatus: 'pending', verificationDomain: null, verificationMessage: 'We are a registered school' }))
    expect(docs.keep).toHaveBeenCalledWith('org-3')
    expect(res.data.verificationStatus).toBe('pending')
  })

  it('rejects an invalid domain even when documents are on file', async () => {
    const { controller, ctx } = setup({ docCount: 1 })
    const c = ctx({ request: { body: { domain: 'not a domain' } } })
    await controller.requestVerification(c)
    expect(c.badRequest).toHaveBeenCalled()
  })

  it('stores uploads against the caller\'s own organisation', async () => {
    const { controller, ctx, docs } = setup()
    const c = ctx({ request: { body: {}, files: { files: [{ filepath: '/tmp/a' }, { filepath: '/tmp/b' }] } } })
    await controller.uploadVerificationDocuments(c)
    expect(docs.store).toHaveBeenCalledWith('org-3', expect.any(Array), c.state.user)
    expect(docs.store.mock.calls[0][1]).toHaveLength(2)
  })

  it('refuses uploads once verified', async () => {
    const { controller, ctx, docs } = setup({ org: { ...org, verificationStatus: 'verified' } })
    const c = ctx({ request: { body: {}, files: { files: { filepath: '/tmp/a' } } } })
    await controller.uploadVerificationDocuments(c)
    expect(c.badRequest).toHaveBeenCalled()
    expect(docs.store).not.toHaveBeenCalled()
  })

  it('cannot delete another organisation\'s document', async () => {
    const { controller, ctx, docs } = setup({ findOwn: null })
    const c = ctx({ params: { id: '99' } })
    await controller.deleteVerificationDocument(c)
    expect(docs.findOwn).toHaveBeenCalledWith('org-3', 99)
    expect(c.notFound).toHaveBeenCalled()
    expect(docs.remove).not.toHaveBeenCalled()
  })

  it('serves documents to admins as inert, uncached downloads', async () => {
    const { controller, ctx } = setup()
    const c = ctx({ params: { id: '9' } })
    await controller.adminDownloadDocument(c)
    const headers = Object.fromEntries(c.set.mock.calls)
    expect(headers['Content-Disposition']).toBe('attachment; filename="reg.pdf"')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Cache-Control']).toBe('no-store')
    expect(c.body).toBeInstanceOf(Buffer)
  })

  it('starts the retention clock when an admin decides', async () => {
    const { controller, ctx, docs } = setup()
    const c = ctx({ params: { id: '3' }, request: { body: { status: 'verified' } } })
    await controller.adminSetVerification(c)
    expect(docs.scheduleDeletion).toHaveBeenCalledWith('org-3')
  })
})
