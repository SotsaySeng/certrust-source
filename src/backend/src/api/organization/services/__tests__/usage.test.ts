import usageFactory from '../usage'

describe('Organization Usage Service', () => {
  let service: ReturnType<typeof usageFactory>

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getTierLimit', () => {
    it('reads the credential limit (default dimension) from the tier-settings singleType', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        free: { credentialLimit: 50, designTemplateLimit: 50, achievementLimit: 50 },
        pro: { credentialLimit: 1000, designTemplateLimit: 1000, achievementLimit: 1000 },
        enterprise: { credentialLimit: null, designTemplateLimit: null, achievementLimit: null },
      })
      global.strapi = { documents: () => ({ findFirst }) } as any
      service = usageFactory()

      const limit = await service.getTierLimit('free')

      expect(findFirst).toHaveBeenCalledWith({ populate: ['free', 'pro', 'enterprise'] })
      expect(limit).toBe(50)
    })

    it('reads the designTemplate/achievement dimensions when explicitly requested', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        free: { credentialLimit: 50, designTemplateLimit: 25, achievementLimit: 15 },
      })
      global.strapi = { documents: () => ({ findFirst }) } as any
      service = usageFactory()

      expect(await service.getTierLimit('free', 'designTemplate')).toBe(25)
      expect(await service.getTierLimit('free', 'achievement')).toBe(15)
    })

    it('returns null (unlimited) when the tier component field is null', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        enterprise: { credentialLimit: null, designTemplateLimit: null, achievementLimit: null },
      })
      global.strapi = { documents: () => ({ findFirst }) } as any
      service = usageFactory()

      expect(await service.getTierLimit('enterprise', 'credential')).toBeNull()
    })

    it('returns null when the tier is not present on the settings record', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        free: { credentialLimit: 50, designTemplateLimit: 50, achievementLimit: 50 },
      })
      global.strapi = { documents: () => ({ findFirst }) } as any
      service = usageFactory()

      expect(await service.getTierLimit('unrecognized-tier')).toBeNull()
    })

    it('fails open (returns null) when no tier-settings record exists at all', async () => {
      const findFirst = jest.fn().mockResolvedValue(null)
      global.strapi = { documents: () => ({ findFirst }) } as any
      service = usageFactory()

      expect(await service.getTierLimit('free')).toBeNull()
    })
  })

  describe('countOrganizationCredentials', () => {
    it('counts only published credentials scoped through issuer.organization', async () => {
      const count = jest.fn().mockResolvedValue(7)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationCredentials(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          issuer: { organization: 42 },
          publishedAt: { $notNull: true },
        },
      })
      expect(result).toBe(7)
    })
  })

  describe('countOrganizationDesignTemplates', () => {
    it('counts only published design templates scoped by the direct organization column', async () => {
      const count = jest.fn().mockResolvedValue(3)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationDesignTemplates(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          organization: 42,
          publishedAt: { $notNull: true },
        },
      })
      expect(result).toBe(3)
    })
  })

  describe('countOrganizationAchievements', () => {
    it('counts only published achievements scoped through creator.organization', async () => {
      const count = jest.fn().mockResolvedValue(5)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationAchievements(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          creator: { organization: 42 },
          publishedAt: { $notNull: true },
        },
      })
      expect(result).toBe(5)
    })
  })
})
