import { addPlatformStatsDefaults } from '../homepage-seed'

/**
 * The back-fill's whole job is to add the stats fields to installs that
 * predate them WITHOUT trampling anything an admin has since changed. Each
 * case below pins down one value that a naive truthiness check would silently
 * reset on every single boot.
 */
function fakeStrapi(record: any) {
  const update = jest.fn().mockResolvedValue(undefined)
  return {
    update,
    strapi: {
      documents: jest.fn(() => ({ findFirst: jest.fn().mockResolvedValue(record), update })),
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    },
  }
}

const EXISTING = { documentId: 'abc123' }

const FULLY_POPULATED = {
  documentId: 'abc123',
  statsEnabled: true,
  statsMinimumCount: 5,
  statsHeading: 'Live on Certrust today',
  statsOrganizationsLabel: 'Organizations',
  statsAchievementsLabel: 'Achievements',
  statsEventsLabel: 'Events',
  statsCredentialsLabel: 'Credentials issued',
}

describe('addPlatformStatsDefaults', () => {
  it('fills every stats field on a record that predates the feature', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', heroHighlight: 'verify in seconds' })
    await addPlatformStatsDefaults(strapi, EXISTING)

    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).toMatchObject({
      documentId: 'abc123',
      data: {
        statsEnabled: true,
        statsMinimumCount: 5,
        statsHeading: 'Live on Certrust today',
        statsOrganizationsLabel: 'Organizations',
        statsAchievementsLabel: 'Achievements',
        statsEventsLabel: 'Events',
        statsCredentialsLabel: 'Credentials issued',
      },
    })
  })

  it('writes nothing at all once every field is present (idempotent across boots)', async () => {
    const { strapi, update } = fakeStrapi(FULLY_POPULATED)
    await addPlatformStatsDefaults(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps statsEnabled: false — an admin switching the strip off must survive a restart', async () => {
    const { strapi, update } = fakeStrapi({ ...FULLY_POPULATED, statsEnabled: false })
    await addPlatformStatsDefaults(strapi, EXISTING)
    // A truthiness check here would turn the strip back on at every boot.
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps statsMinimumCount: 0 — typeof 0 is "number", so it is present, not missing', async () => {
    const { strapi, update } = fakeStrapi({ ...FULLY_POPULATED, statsMinimumCount: 0 })
    await addPlatformStatsDefaults(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps a deliberately blank label or heading instead of re-filling it', async () => {
    const { strapi, update } = fakeStrapi({ ...FULLY_POPULATED, statsHeading: '', statsEventsLabel: '' })
    await addPlatformStatsDefaults(strapi, EXISTING)
    // Re-filling a cleared field would be an un-undoable bug: the admin could
    // never get rid of the eyebrow.
    expect(update).not.toHaveBeenCalled()
  })

  it('adds only the missing fields, leaving customised ones untouched', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      statsEnabled: false,
      statsMinimumCount: 7,
      statsHeading: 'Trusted by real programs',
      // the four labels are still missing
    })
    await addPlatformStatsDefaults(strapi, EXISTING)

    const data = update.mock.calls[0][0].data
    expect(Object.keys(data).sort()).toEqual([
      'statsAchievementsLabel',
      'statsCredentialsLabel',
      'statsEventsLabel',
      'statsOrganizationsLabel',
    ])
    expect(data).not.toHaveProperty('statsEnabled')
    expect(data).not.toHaveProperty('statsMinimumCount')
    expect(data).not.toHaveProperty('statsHeading')
  })

  it('does nothing when there is no homepage record to patch', async () => {
    const { strapi, update } = fakeStrapi(null)
    await addPlatformStatsDefaults(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })
})
