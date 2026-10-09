import usageFactory from '../usage'

describe('Organization Usage Service', () => {
  let service: ReturnType<typeof usageFactory>

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('getCredentialLimit', () => {
    const settings = { free: { credentialLimit: 50 }, enterprise: { credentialLimit: null } }

    it('adds purchased credentials to the tier limit', async () => {
      global.strapi = { documents: () => ({ findFirst: jest.fn().mockResolvedValue(settings) }) } as any
      service = usageFactory()

      expect(await service.getCredentialLimit({ tier: 'free', purchasedCredentials: 120 })).toBe(170)
      expect(await service.getCredentialLimit({ tier: 'free' })).toBe(50)
      expect(await service.getCredentialLimit({ tier: 'free', purchasedCredentials: null })).toBe(50)
    })

    it('stays unlimited on a tier with no limit', async () => {
      global.strapi = { documents: () => ({ findFirst: jest.fn().mockResolvedValue(settings) }) } as any
      service = usageFactory()

      expect(await service.getCredentialLimit({ tier: 'enterprise', purchasedCredentials: 120 })).toBeNull()
    })
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
    it('counts credentials scoped through issuer.organization', async () => {
      const count = jest.fn().mockResolvedValue(7)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationCredentials(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          issuer: { organization: 42 },
        },
      })
      expect(result).toBe(7)
    })
  })

  describe('countOrganizationDesignTemplates', () => {
    it('counts design templates scoped by the direct organization column', async () => {
      const count = jest.fn().mockResolvedValue(3)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationDesignTemplates(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          organization: 42,
        },
      })
      expect(result).toBe(3)
    })
  })

  describe('countOrganizationAchievements', () => {
    it('counts achievements scoped through creator.organization', async () => {
      const count = jest.fn().mockResolvedValue(5)
      global.strapi = { db: { query: () => ({ count }) } } as any
      service = usageFactory()

      const result = await service.countOrganizationAchievements(42)

      expect(count).toHaveBeenCalledWith({
        where: {
          creator: { organization: 42 },
        },
      })
      expect(result).toBe(5)
    })
  })

  describe('getDesignLimits', () => {
    const settings = {
      free: { designTemplateLimit: 3, premiumTemplates: false },
      pro: { designTemplateLimit: 50, premiumTemplates: true },
      enterprise: { designTemplateLimit: null, premiumTemplates: true },
      trial: { designTemplateLimit: 10, premiumTemplates: false },
    }
    const withSettings = (value: any) => {
      global.strapi = { documents: () => ({ findFirst: jest.fn().mockResolvedValue(value) }) } as any
      return usageFactory()
    }

    it('uses the trial column while trialing, whatever the tier', async () => {
      const s = withSettings(settings)
      expect(await s.getDesignLimits({ tier: 'pro', subscriptionStatus: 'trialing' })).toEqual({ source: 'trial', designTemplateLimit: 10, premiumTemplates: false })
      expect(await s.getDesignLimits({ tier: 'enterprise', subscriptionStatus: 'trialing' })).toEqual({ source: 'trial', designTemplateLimit: 10, premiumTemplates: false })
    })

    it('uses the tier column when active, and free after a trial lapses', async () => {
      const s = withSettings(settings)
      expect(await s.getDesignLimits({ tier: 'pro', subscriptionStatus: 'active' })).toEqual({ source: 'pro', designTemplateLimit: 50, premiumTemplates: true })
      expect(await s.getDesignLimits({ tier: 'enterprise', subscriptionStatus: 'active' })).toEqual({ source: 'enterprise', designTemplateLimit: null, premiumTemplates: true })
      expect(await s.getDesignLimits({ tier: 'free', subscriptionStatus: 'none' })).toEqual({ source: 'free', designTemplateLimit: 3, premiumTemplates: false })
    })

    it('falls back to the tier when no trial column is configured', async () => {
      const { trial, ...noTrial } = settings
      const s = withSettings(noTrial)
      expect((await s.getDesignLimits({ tier: 'pro', subscriptionStatus: 'trialing' })).source).toBe('pro')
    })

    it('defaults premiumTemplates by tier when the flag was never set', async () => {
      const s = withSettings({ free: { designTemplateLimit: 50 }, pro: { designTemplateLimit: 1000 } })
      expect((await s.getDesignLimits({ tier: 'free' })).premiumTemplates).toBe(false)
      expect((await s.getDesignLimits({ tier: 'pro' })).premiumTemplates).toBe(true)
    })

    it('fails open (unlimited) without a settings record', async () => {
      const s = withSettings(null)
      expect(await s.getDesignLimits({ tier: 'free' })).toEqual({ source: 'free', designTemplateLimit: null, premiumTemplates: false })
    })
  })
})
