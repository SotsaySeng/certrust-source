import { errors } from '@strapi/utils'
import lifecycles from '../lifecycles'

function makeEvent(data: Record<string, any>) {
  return { params: { data } }
}

describe('Design Template lifecycles - beforeCreate tier-limit enforcement', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('allows creation when no organization is given at all (system/global template)', async () => {
    const findOne = jest.fn()
    global.strapi = { entityService: { findOne }, service: jest.fn() } as any

    const event = makeEvent({ name: 'Blank' })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(findOne).not.toHaveBeenCalled()
  })

  it('allows creation when the organization id does not resolve to a real, published organization', async () => {
    const findOne = jest.fn().mockResolvedValue(null)
    global.strapi = { entityService: { findOne }, service: jest.fn() } as any

    const event = makeEvent({ name: 'Blank', organization: 42 })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(findOne).toHaveBeenCalledWith('api::organization.organization', 42, { status: 'published' })
  })

  it('normalizes a { connect: [{ id }] } organization shape', async () => {
    const findOne = jest.fn().mockResolvedValue(null)
    global.strapi = { entityService: { findOne }, service: jest.fn() } as any

    const event = makeEvent({ name: 'Blank', organization: { connect: [{ id: 7 }] } })
    await lifecycles.beforeCreate(event as any)
    expect(findOne).toHaveBeenCalledWith('api::organization.organization', 7, expect.anything())
  })

  it('allows creation when the tier has no design-template limit set (unlimited)', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 42, tier: 'enterprise' })
    const getTierLimit = jest.fn().mockResolvedValue(null)
    const countOrganizationDesignTemplates = jest.fn()
    global.strapi = {
      entityService: { findOne },
      service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationDesignTemplates }),
    } as any

    const event = makeEvent({ name: 'Blank', organization: 42 })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(getTierLimit).toHaveBeenCalledWith('enterprise', 'designTemplate')
    expect(countOrganizationDesignTemplates).not.toHaveBeenCalled()
  })

  it('allows creation when the organization is under its design-template limit', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 42, tier: 'free' })
    const getTierLimit = jest.fn().mockResolvedValue(50)
    const countOrganizationDesignTemplates = jest.fn().mockResolvedValue(49)
    global.strapi = {
      entityService: { findOne },
      service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationDesignTemplates }),
    } as any

    const event = makeEvent({ name: 'Blank', organization: 42 })
    await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
    expect(countOrganizationDesignTemplates).toHaveBeenCalledWith(42)
  })

  it('throws ApplicationError when the organization is at its design-template limit', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 42, tier: 'free' })
    const getTierLimit = jest.fn().mockResolvedValue(50)
    const countOrganizationDesignTemplates = jest.fn().mockResolvedValue(50)
    global.strapi = {
      entityService: { findOne },
      service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationDesignTemplates }),
    } as any

    const event = makeEvent({ name: 'Blank', organization: 42 })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(/free.*50 design templates/)
  })

  it('throws when the organization is over its design-template limit', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 42, tier: 'free' })
    const getTierLimit = jest.fn().mockResolvedValue(50)
    const countOrganizationDesignTemplates = jest.fn().mockResolvedValue(60)
    global.strapi = {
      entityService: { findOne },
      service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationDesignTemplates }),
    } as any

    const event = makeEvent({ name: 'Blank', organization: 42 })
    await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
  })
})
