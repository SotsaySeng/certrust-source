import { addIntegrationsDefaults, addPlatformStatsDefaults, applyCopyRefresh } from '../homepage-seed'
import { applyPricingRefresh } from '../solution-page-seed'
import featureItem from '../../components/marketing/feature-item.json'
import audienceSegment from '../../components/marketing/audience-segment.json'

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

describe('addIntegrationsDefaults', () => {
  it('adds the whole section to a record that predates it', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', heroHighlight: 'verify in seconds' })
    await addIntegrationsDefaults(strapi, EXISTING)

    expect(update).toHaveBeenCalledTimes(1)
    const { documentId, data } = update.mock.calls[0][0]
    expect(documentId).toBe('abc123')
    expect(data.integrationsEnabled).toBe(true)
    expect(data.integrationsHeader).toBe('Issue from the tools you already use')
    expect(data.integrations.map((i: any) => i.url)).toEqual([
      '/integrations/google-sheets',
      '/integrations/google-forms',
      '/integrations/student-records',
      '/integrations/guide',
    ])
  })

  it('does nothing once the section exists', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      integrationsEnabled: true,
      integrationsHeader: 'Custom',
      integrationsSubheader: 'Custom',
      integrationsLinkLabel: 'Custom',
    })
    await addIntegrationsDefaults(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })

  it('never puts the cards back after an admin switched the section off or emptied it', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      integrationsEnabled: false,
      integrationsHeader: 'x',
      integrationsSubheader: 'x',
      integrationsLinkLabel: 'x',
      integrations: [],
    })
    await addIntegrationsDefaults(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps text an admin cleared to blank, and fills only what is missing', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      integrationsEnabled: true,
      integrationsHeader: 'Mine',
      integrationsSubheader: null,
      integrationsLinkLabel: '',
    })
    await addIntegrationsDefaults(strapi, EXISTING)
    expect(update.mock.calls[0][0].data).toEqual({
      integrationsSubheader: 'Keep your records where they are. Connect a spreadsheet, a form or your student records system, and certificates go out on their own.',
    })
  })
})

describe('applyCopyRefresh', () => {
  const FIRST = { documentId: 'abc123', heroTitleBefore: 'Skip the paper. Issue certificates people can ' }

  it('rewrites a homepage that still shows the first headline', async () => {
    const { strapi, update } = fakeStrapi(FIRST)
    await applyCopyRefresh(strapi, EXISTING)

    expect(update).toHaveBeenCalledTimes(1)
    const { documentId, data } = update.mock.calls[0][0]
    expect(documentId).toBe('abc123')
    expect(data.heroHighlight).toBe('tonight')
    expect(data.audienceSegments).toHaveLength(4)
    expect(data.certificateSection.badgeCalloutTitle).toBe('For your IT team')
    // Settings and the integrations section belong to the admin.
    expect(data).not.toHaveProperty('statsEnabled')
    expect(data).not.toHaveProperty('integrations')
  })

  it('uses only icons the Content Manager allows', async () => {
    const { strapi, update } = fakeStrapi(FIRST)
    await applyCopyRefresh(strapi, EXISTING)
    const { data } = update.mock.calls[0][0]
    for (const item of data.features) expect(featureItem.attributes.icon.enum).toContain(item.icon)
    for (const item of data.audienceSegments) expect(audienceSegment.attributes.icon.enum).toContain(item.icon)
  })

  it('keeps the illustration a section already has', async () => {
    const { strapi, update } = fakeStrapi({ ...FIRST, recipientSection: { illustrationImage: { id: 77 } } })
    await applyCopyRefresh(strapi, EXISTING)
    const { data } = update.mock.calls[0][0]
    expect(data.recipientSection.illustrationImage).toBe(77)
    expect(data.certificateSection).not.toHaveProperty('illustrationImage')
  })

  it('leaves a homepage alone once its headline has changed', async () => {
    for (const heroTitleBefore of ['Your workshop ends today. The certificates go out ', 'Our own headline ']) {
      const { strapi, update } = fakeStrapi({ documentId: 'abc123', heroTitleBefore })
      await applyCopyRefresh(strapi, EXISTING)
      expect(update).not.toHaveBeenCalled()
    }
  })
})

describe('applyPricingRefresh', () => {
  it('rewrites a pricing page that still shows the first header', async () => {
    const { strapi, update } = fakeStrapi(null)
    await applyPricingRefresh(strapi, { documentId: 'sol1', header: 'Plans that grow with your program' })

    expect(update).toHaveBeenCalledTimes(1)
    const { documentId, data } = update.mock.calls[0][0]
    expect(documentId).toBe('sol1')
    expect(data.tiers.map((t: any) => t.tierId)).toEqual(['event', 'pro', 'enterprise'])
    expect(data.tiers.filter((t: any) => t.highlighted)).toHaveLength(1)
  })

  it('leaves a pricing page alone once its header has changed', async () => {
    const { strapi, update } = fakeStrapi(null)
    await applyPricingRefresh(strapi, { documentId: 'sol1', header: 'Pay for the certificates you send' })
    await applyPricingRefresh(strapi, { documentId: 'sol1', header: 'Our prices' })
    expect(update).not.toHaveBeenCalled()
  })
})
