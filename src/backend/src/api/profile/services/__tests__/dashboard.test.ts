import dashboardFactory from '../dashboard'

/** Minimal strapi stub that satisfies the dashboard service's queries */
function createFakeStrapi({
  credentials = [] as any[],
  achievements = [] as any[],
  scheduledIssuances = [] as any[],
  user = { createdAt: '2024-01-15T00:00:00.000Z' } as any,
} = {}) {
  const matchesCredentialWhere = (c: any, where: any) => {
    if (where.issuer !== undefined && c.issuer !== where.issuer) return false
    if (where.recipient !== undefined && c.recipient !== where.recipient) return false
    if (where.revoked !== undefined && c.revoked !== where.revoked) return false
    if (where.expirationDate?.$lt) {
      if (!c.expirationDate) return false
      if (new Date(c.expirationDate) >= new Date(where.expirationDate.$lt)) return false
    }
    if (where.publishedAt === null) {
      if (c.publishedAt !== null && c.publishedAt !== undefined) return false
    }
    if (where.publishedAt?.$notNull) {
      if (c.publishedAt === null || c.publishedAt === undefined) return false
    }
    if (where.issuanceDate?.$gte) {
      if (!c.issuanceDate) return false
      if (new Date(c.issuanceDate) < new Date(where.issuanceDate.$gte)) return false
    }
    return true
  }

  const strapi = {
    db: {
      query: (contentType: string) => ({
        count: async ({ where }: any) => {
          if (contentType === 'api::credential.credential') {
            return credentials.filter((c) => matchesCredentialWhere(c, where)).length
          }
          if (contentType === 'api::achievement.achievement') {
            return achievements.filter((a) => {
              if (a.creator !== where.creator) return false
              if (where.publishedAt?.$notNull && (a.publishedAt === null || a.publishedAt === undefined)) return false
              return true
            }).length
          }
          if (contentType === 'api::scheduled-issuance.scheduled-issuance') {
            return scheduledIssuances.filter((s) => {
              if (where.scheduledById !== undefined && s.scheduledById !== where.scheduledById) return false
              if (where.status !== undefined && s.status !== where.status) return false
              return true
            }).length
          }
          throw new Error(`Unexpected count: ${contentType}`)
        },
        findMany: async ({ where, populate, select }: any) => {
          if (contentType === 'api::credential.credential') {
            const filtered = credentials.filter((c) => matchesCredentialWhere(c, where))
            return filtered.map((c) => {
              const row: any = { id: c.id }
              if (populate?.recipient) row.recipient = c.recipient ? { id: c.recipient } : null
              if (populate?.achievement) row.achievement = c.achievement ? { id: c.achievement, achievementName: c.achievementName } : null
              if (select?.includes('documentId')) row.documentId = c.documentId
              if (select?.includes('issuanceDate')) row.issuanceDate = c.issuanceDate
              return row
            })
          }
          throw new Error(`Unexpected findMany: ${contentType}`)
        },
        findOne: async ({ where }: any) => {
          if (contentType === 'plugin::users-permissions.user') {
            return where.id === user?.id ? user : null
          }
          throw new Error(`Unexpected findOne: ${contentType}`)
        },
      }),
    },
  }
  return strapi
}

describe('dashboard service', () => {
  const PROFILE_ID = 10
  const USER_ID = 1
  /**
   * Fixtures below carry publishedAt because a real draftAndPublish create
   * writes a published row (plus a draft shadow sharing its documentId), and
   * every count in the service filters on it - see the service's own comment.
   */
  const PUBLISHED = '2024-06-01T00:00:00.000Z'

  it('returns zeros when there are no credentials or achievements', async () => {
    const strapi = createFakeStrapi({ user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.credentialsIssued).toBe(0)
    expect(stats.credentialsRevoked).toBe(0)
    expect(stats.credentialsExpired).toBe(0)
    expect(stats.credentialsReceived).toBe(0)
    expect(stats.achievementsCreated).toBe(0)
    expect(stats.uniqueRecipients).toBe(0)
    expect(stats.topAchievements).toEqual([])
    expect(stats.memberSince).toBe('2024-01-01T00:00:00.000Z')
    expect(stats.scheduledCredentials).toBe(0)
    expect(stats.draftCredentials).toBe(0)
    expect(stats.issuanceByMonth).toHaveLength(12)
    expect(stats.issuanceByMonth.every((m) => m.count === 0)).toBe(true)
  })

  it('counts issued, revoked, and expired credentials correctly', async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString()
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, publishedAt: PUBLISHED },
      { id: 2, issuer: PROFILE_ID, revoked: true, publishedAt: PUBLISHED },
      { id: 3, issuer: PROFILE_ID, revoked: false, expirationDate: past, publishedAt: PUBLISHED },
      { id: 4, issuer: PROFILE_ID, revoked: false, expirationDate: future, publishedAt: PUBLISHED },
    ]
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.credentialsIssued).toBe(4)
    expect(stats.credentialsRevoked).toBe(1)
    expect(stats.credentialsExpired).toBe(1)
  })

  it('counts unique recipients (deduplicates repeated recipients)', async () => {
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, recipient: 20, publishedAt: PUBLISHED },
      { id: 2, issuer: PROFILE_ID, revoked: false, recipient: 20, publishedAt: PUBLISHED }, // same recipient
      { id: 3, issuer: PROFILE_ID, revoked: false, recipient: 21, publishedAt: PUBLISHED },
    ]
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.uniqueRecipients).toBe(2)
  })

  it('computes top achievements sorted by credential count', async () => {
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, achievement: 100, achievementName: 'Alpha', publishedAt: PUBLISHED },
      { id: 2, issuer: PROFILE_ID, revoked: false, achievement: 100, achievementName: 'Alpha', publishedAt: PUBLISHED },
      { id: 3, issuer: PROFILE_ID, revoked: false, achievement: 101, achievementName: 'Beta', publishedAt: PUBLISHED },
    ]
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.topAchievements[0]).toEqual({ id: 100, name: 'Alpha', count: 2 })
    expect(stats.topAchievements[1]).toEqual({ id: 101, name: 'Beta', count: 1 })
  })

  it('caps topAchievements at 5 entries', async () => {
    const credentials = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      issuer: PROFILE_ID,
      revoked: false,
      achievement: 200 + i,
      achievementName: `Ach ${i}`,
      publishedAt: PUBLISHED,
    }))
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.topAchievements.length).toBeLessThanOrEqual(5)
  })

  it('counts pending scheduled credentials for the calling user, ignoring other statuses/users', async () => {
    const scheduledIssuances = [
      { id: 1, scheduledById: USER_ID, status: 'pending' },
      { id: 2, scheduledById: USER_ID, status: 'pending' },
      { id: 3, scheduledById: USER_ID, status: 'issued' }, // wrong status
      { id: 4, scheduledById: 999, status: 'pending' }, // wrong user
    ]
    const strapi = createFakeStrapi({ scheduledIssuances, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.scheduledCredentials).toBe(2)
  })

  it('draftCredentials counts only documentIds with a draft row and no published sibling', async () => {
    // 2 normally-issued credentials: each has a draft shadow row AND a
    // published row sharing one documentId (draftAndPublish's real
    // behavior - see the plan/header comment). 1 genuinely-draft
    // credential: only a draft row, created without publishedAt at all.
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, documentId: 'doc-a', publishedAt: null },
      { id: 2, issuer: PROFILE_ID, revoked: false, documentId: 'doc-a', publishedAt: '2024-01-01T00:00:00.000Z' },
      { id: 3, issuer: PROFILE_ID, revoked: false, documentId: 'doc-b', publishedAt: null },
      { id: 4, issuer: PROFILE_ID, revoked: false, documentId: 'doc-b', publishedAt: '2024-01-02T00:00:00.000Z' },
      { id: 5, issuer: PROFILE_ID, revoked: false, documentId: 'doc-c', publishedAt: null },
    ]
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)
    expect(stats.draftCredentials).toBe(1)
  })

  it('does not double-count a credential that also has a draft shadow row', async () => {
    // What a real issuance looks like on disk: every published credential is
    // accompanied by a draft row sharing its documentId. These counts run
    // through strapi.db.query(), which sees both rows, so anything that
    // forgets to filter on publishedAt reports exactly double - which is what
    // the dashboard and its Plan Usage bar used to do.
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, documentId: 'doc-a', publishedAt: null, recipient: 20, achievement: 100, achievementName: 'Alpha' },
      { id: 2, issuer: PROFILE_ID, revoked: false, documentId: 'doc-a', publishedAt: PUBLISHED, recipient: 20, achievement: 100, achievementName: 'Alpha' },
      { id: 3, issuer: PROFILE_ID, revoked: true, documentId: 'doc-b', publishedAt: null, recipient: 21, achievement: 100, achievementName: 'Alpha' },
      { id: 4, issuer: PROFILE_ID, revoked: true, documentId: 'doc-b', publishedAt: PUBLISHED, recipient: 21, achievement: 100, achievementName: 'Alpha' },
    ]
    const achievements = [
      { id: 100, creator: PROFILE_ID, publishedAt: null },
      { id: 101, creator: PROFILE_ID, publishedAt: PUBLISHED },
    ]
    const strapi = createFakeStrapi({ credentials, achievements, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)

    expect(stats.credentialsIssued).toBe(2)
    expect(stats.credentialsRevoked).toBe(1)
    expect(stats.uniqueRecipients).toBe(2)
    expect(stats.achievementsCreated).toBe(1)
    expect(stats.topAchievements[0]).toEqual({ id: 100, name: 'Alpha', count: 2 })
  })

  it('issuanceByMonth zero-fills the trailing 12 months and buckets published credentials by calendar month', async () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString()
    const credentials = [
      { id: 1, issuer: PROFILE_ID, revoked: false, documentId: 'doc-a', publishedAt: thisMonth, issuanceDate: thisMonth },
      { id: 2, issuer: PROFILE_ID, revoked: false, documentId: 'doc-b', publishedAt: thisMonth, issuanceDate: thisMonth },
      { id: 3, issuer: PROFILE_ID, revoked: false, documentId: 'doc-c', publishedAt: lastMonth, issuanceDate: lastMonth },
      // A draft-only row (publishedAt: null) must never contribute to issuanceByMonth.
      { id: 4, issuer: PROFILE_ID, revoked: false, documentId: 'doc-d', publishedAt: null, issuanceDate: thisMonth },
    ]
    const strapi = createFakeStrapi({ credentials, user: { id: USER_ID, createdAt: '2024-01-01T00:00:00.000Z' } })
    const svc = dashboardFactory({ strapi })
    const stats = await svc.getStats(USER_ID, PROFILE_ID)

    expect(stats.issuanceByMonth).toHaveLength(12)
    const currentBucket = stats.issuanceByMonth[stats.issuanceByMonth.length - 1]
    const previousBucket = stats.issuanceByMonth[stats.issuanceByMonth.length - 2]
    expect(currentBucket.count).toBe(2)
    expect(previousBucket.count).toBe(1)
    const total = stats.issuanceByMonth.reduce((sum, m) => sum + m.count, 0)
    expect(total).toBe(3)
  })
})
