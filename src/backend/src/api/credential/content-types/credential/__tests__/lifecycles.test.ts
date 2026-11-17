import { errors } from '@strapi/utils'
import lifecycles from '../lifecycles'

function makeEvent(data: Record<string, any>) {
  return { params: { data } }
}

function mockStrapi({ tier = 'free', limit = 50 as number | null, current = 0, existingRows = 0, packCredit = false, since = null as Date | null, period = 'lifetime' } = {}) {
  const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier } })
  const getCredentialAllowance = jest.fn().mockResolvedValue({ limit, since, period })
  const countOrganizationCredentials = jest.fn().mockResolvedValue(current)
  const usePackCredit = jest.fn().mockResolvedValue(packCredit)
  const count = jest.fn().mockResolvedValue(existingRows)
  global.strapi = {
    entityService: { findOne },
    db: { query: () => ({ count }) },
    service: jest.fn().mockReturnValue({ getCredentialAllowance, countOrganizationCredentials, usePackCredit }),
  } as any
  return { findOne, getCredentialAllowance, countOrganizationCredentials, usePackCredit, count }
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
    const { findOne, countOrganizationCredentials, getCredentialAllowance, usePackCredit } = mockStrapi({ current: 49 })
    await expect(lifecycles.beforeCreate(makeEvent({ issuer: { connect: [{ id: 5 }] } }) as any)).resolves.toBeUndefined()
    expect(findOne).toHaveBeenCalledWith('api::profile.profile', 5, { populate: ['organization'] })
    expect(countOrganizationCredentials).toHaveBeenCalledWith(42, null)
    expect(getCredentialAllowance).toHaveBeenCalledWith({ id: 42, tier: 'free' })
    expect(usePackCredit).not.toHaveBeenCalled()
  })

  it('throws ApplicationError when the organization is at its credential limit', async () => {
    mockStrapi({ current: 50 })
    const event = makeEvent({ issuer: 5 })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(/limit of 50 credentials\./)
  })

  it('spends a pack credit once the allowance is used up', async () => {
    const { usePackCredit } = mockStrapi({ current: 50, packCredit: true })
    await expect(lifecycles.beforeCreate(makeEvent({ issuer: 5 }) as any)).resolves.toBeUndefined()
    expect(usePackCredit).toHaveBeenCalledWith(42)
  })

  it('counts only the current billing period and names it in the error', async () => {
    const since = new Date('2026-11-01T00:00:00Z')
    const { countOrganizationCredentials } = mockStrapi({ tier: 'pro', limit: 100, current: 100, since, period: 'month' })
    await expect(lifecycles.beforeCreate(makeEvent({ issuer: 5 }) as any)).rejects.toThrow(/limit of 100 credentials for this month/)
    expect(countOrganizationCredentials).toHaveBeenCalledWith(42, since)
  })

  it('does not count a republish of an existing credential (revoke, renew, ...) against the limit', async () => {
    const { count, getCredentialAllowance } = mockStrapi({ current: 51, existingRows: 1 })
    const event = makeEvent({ issuer: 5, documentId: 'abc123', revoked: true })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(count).toHaveBeenCalledWith({ where: { documentId: 'abc123' } })
    expect(getCredentialAllowance).not.toHaveBeenCalled()
  })

  it('still enforces the limit for a new document that already has its documentId assigned', async () => {
    const { count } = mockStrapi({ current: 50, existingRows: 0 })
    const event = makeEvent({ issuer: 5, documentId: 'new123' })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    expect(count).toHaveBeenCalledWith({ where: { documentId: 'new123' } })
  })
})
