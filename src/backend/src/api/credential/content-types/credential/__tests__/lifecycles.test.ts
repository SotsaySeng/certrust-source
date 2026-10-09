import { errors } from '@strapi/utils'
import lifecycles from '../lifecycles'

function makeEvent(data: Record<string, any>) {
  return { params: { data } }
}

function mockStrapi({ tier = 'free', limit = 50 as number | null, current = 0, existingRows = 0 } = {}) {
  const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier } })
  const getCredentialLimit = jest.fn().mockResolvedValue(limit)
  const countOrganizationCredentials = jest.fn().mockResolvedValue(current)
  const count = jest.fn().mockResolvedValue(existingRows)
  global.strapi = {
    entityService: { findOne },
    db: { query: () => ({ count }) },
    service: jest.fn().mockReturnValue({ getCredentialLimit, countOrganizationCredentials }),
  } as any
  return { findOne, getCredentialLimit, countOrganizationCredentials, count }
}

describe('Credential lifecycles - beforeCreate tier limit', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('allows creation when no issuer is given at all (nothing to scope)', async () => {
    const { findOne } = mockStrapi()
    await expect(lifecycles.beforeCreate(makeEvent({}) as any)).resolves.toBeUndefined()
    expect(findOne).not.toHaveBeenCalled()
  })

  it('allows creation when the organization is under its credential limit', async () => {
    const { findOne, countOrganizationCredentials, getCredentialLimit } = mockStrapi({ current: 49 })
    await expect(lifecycles.beforeCreate(makeEvent({ issuer: { connect: [{ id: 5 }] } }) as any)).resolves.toBeUndefined()
    expect(findOne).toHaveBeenCalledWith('api::profile.profile', 5, { populate: ['organization'] })
    expect(countOrganizationCredentials).toHaveBeenCalledWith(42)
    expect(getCredentialLimit).toHaveBeenCalledWith({ id: 42, tier: 'free' })
  })

  it('throws ApplicationError when the organization is at its credential limit', async () => {
    mockStrapi({ current: 50 })
    const event = makeEvent({ issuer: 5 })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(/limit of 50 credentials/)
  })

  it('does not count a republish of an existing credential (revoke, renew, ...) against the limit', async () => {
    const { count, getCredentialLimit } = mockStrapi({ current: 51, existingRows: 1 })
    const event = makeEvent({ issuer: 5, documentId: 'abc123', revoked: true })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(count).toHaveBeenCalledWith({ where: { documentId: 'abc123' } })
    expect(getCredentialLimit).not.toHaveBeenCalled()
  })

  it('still enforces the limit for a new document that already has its documentId assigned', async () => {
    const { count } = mockStrapi({ current: 50, existingRows: 0 })
    const event = makeEvent({ issuer: 5, documentId: 'new123' })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    expect(count).toHaveBeenCalledWith({ where: { documentId: 'new123' } })
  })
})
