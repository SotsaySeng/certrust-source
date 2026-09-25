import trustController from '../trust'

describe('trust controller', () => {
  const controller = trustController({ strapi: {} as any })

  it.each(['myVerification', 'requestVerification'] as const)('%s answers 401, not 500, without a signed-in user', async (action) => {
    const ctx: any = { state: {}, request: { body: {} }, unauthorized: jest.fn() }
    await controller[action](ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
  })
})
