import { errors } from '@strapi/utils'
import lifecycles from '../lifecycles'

function makeEvent(data: Record<string, any>) {
  return { params: { data } }
}

describe('Achievement lifecycles', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('beforeCreate - tag sanitization (preserved, original logic)', () => {
    it('defaults undefined tags to an empty array', async () => {
      global.strapi = {
        entityService: { findOne: jest.fn().mockResolvedValue(null) },
        service: jest.fn(),
      } as any

      const event = makeEvent({ tags: undefined })
      await lifecycles.beforeCreate(event as any)

      expect(event.params.data.tags).toEqual([])
    })

    it('defaults an empty-string tags value to an empty array', async () => {
      global.strapi = {
        entityService: { findOne: jest.fn().mockResolvedValue(null) },
        service: jest.fn(),
      } as any

      const event = makeEvent({ tags: '' })
      await lifecycles.beforeCreate(event as any)

      expect(event.params.data.tags).toEqual([])
    })

    it('leaves a real tags array untouched', async () => {
      global.strapi = {
        entityService: { findOne: jest.fn().mockResolvedValue(null) },
        service: jest.fn(),
      } as any

      const event = makeEvent({ tags: ['a', 'b'] })
      await lifecycles.beforeCreate(event as any)

      expect(event.params.data.tags).toEqual(['a', 'b'])
    })
  })

  describe('beforeUpdate - unaffected by this rollout', () => {
    it('still sanitizes tags synchronously, unchanged', () => {
      const event = makeEvent({ tags: '' })
      ;(lifecycles.beforeUpdate as any)(event)
      expect(event.params.data.tags).toEqual([])
    })
  })

  describe('beforeCreate - tier-limit enforcement', () => {
    it('allows creation when no creator is given at all (nothing to scope)', async () => {
      const findOne = jest.fn()
      global.strapi = { entityService: { findOne }, service: jest.fn() } as any

      const event = makeEvent({ tags: [] })
      await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
      expect(findOne).not.toHaveBeenCalled()
    })

    it('allows creation when the creator profile has no organization (legacy carve-out)', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 5, organization: null })
      global.strapi = { entityService: { findOne }, service: jest.fn() } as any

      const event = makeEvent({ tags: [], creator: 5 })
      await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
      expect(findOne).toHaveBeenCalledWith('api::profile.profile', 5, {
        status: 'published',
        populate: ['organization'],
      })
    })

    it('allows creation when the creator profile cannot be resolved at all', async () => {
      const findOne = jest.fn().mockResolvedValue(null)
      global.strapi = { entityService: { findOne }, service: jest.fn() } as any

      const event = makeEvent({ tags: [], creator: { connect: [{ id: 9 }] } })
      await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
      expect(findOne).toHaveBeenCalledWith('api::profile.profile', 9, expect.anything())
    })

    it('allows creation when the tier has no achievement limit set (unlimited)', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier: 'enterprise' } })
      const getTierLimit = jest.fn().mockResolvedValue(null)
      const countOrganizationAchievements = jest.fn()
      global.strapi = {
        entityService: { findOne },
        service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationAchievements }),
      } as any

      const event = makeEvent({ tags: [], creator: { id: 5 } })
      await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
      expect(getTierLimit).toHaveBeenCalledWith('enterprise', 'achievement')
      expect(countOrganizationAchievements).not.toHaveBeenCalled()
    })

    it('allows creation when the organization is under its achievement limit', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier: 'free' } })
      const getTierLimit = jest.fn().mockResolvedValue(50)
      const countOrganizationAchievements = jest.fn().mockResolvedValue(49)
      global.strapi = {
        entityService: { findOne },
        service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationAchievements }),
      } as any

      const event = makeEvent({ tags: [], creator: { id: 5 } })
      await expect(lifecycles.beforeCreate(event as any)).resolves.toBeUndefined()
      expect(countOrganizationAchievements).toHaveBeenCalledWith(42)
    })

    it('throws ApplicationError when the organization is at its achievement limit', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier: 'free' } })
      const getTierLimit = jest.fn().mockResolvedValue(50)
      const countOrganizationAchievements = jest.fn().mockResolvedValue(50)
      global.strapi = {
        entityService: { findOne },
        service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationAchievements }),
      } as any

      const event = makeEvent({ tags: [], creator: { id: 5 } })
      await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
      await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(/free.*50 achievements/)
    })

    it('throws when the organization is over its achievement limit', async () => {
      const findOne = jest.fn().mockResolvedValue({ id: 5, organization: { id: 42, tier: 'free' } })
      const getTierLimit = jest.fn().mockResolvedValue(50)
      const countOrganizationAchievements = jest.fn().mockResolvedValue(51)
      global.strapi = {
        entityService: { findOne },
        service: jest.fn().mockReturnValue({ getTierLimit, countOrganizationAchievements }),
      } as any

      const event = makeEvent({ tags: [], creator: { id: 5 } })
      await expect(lifecycles.beforeCreate(event as any)).rejects.toThrow(errors.ApplicationError)
    })
  })
})
