import { addIntegrationsDefaults, addPlatformStatsDefaults, applyAiAssistantRefresh, applyCopyRefresh, applyNoFreeOfferRefresh as homepageNoFree } from '../homepage-seed'
import { applyConnectionsRefresh, applyNoFreeOfferRefresh as pricingNoFree, applyPricingRefresh } from '../solution-page-seed'
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
      '/guide/connect-ai-assistant',
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
      integrationsSubheader: 'Keep your records where they are. Connect a spreadsheet, a form or your student records system, or use an MCP connection with Claude and ChatGPT. Certificates go out without retyping a single name.',
    })
  })
})

const FIRST_SUBHEADER = 'Keep your records where they are. Connect a spreadsheet, a form or your student records system, and certificates go out on their own.'
const FIRST_CARDS = [
  { id: 1, title: 'Google Sheets', url: '/integrations/google-sheets', icon: 'table-cells' },
  { id: 2, title: 'Google Forms', url: '/integrations/google-forms', icon: 'clipboard-document-list' },
  { id: 3, title: 'Universities and colleges', url: '/integrations/student-records', icon: 'academic-cap' },
  { id: 4, title: 'API for any system', url: '/integrations/guide', icon: 'code-bracket', description: 'One request issues a credential. Keys with limited permissions, safe retries and background jobs for large groups.' },
]

describe('applyAiAssistantRefresh', () => {
  it('adds the MCP connection card after Google Forms on an unedited install', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', integrationsSubheader: FIRST_SUBHEADER, integrations: FIRST_CARDS })
    await applyAiAssistantRefresh(strapi, EXISTING)
    const { data } = update.mock.calls[0][0]
    expect(data.integrations.map((i: any) => i.url)).toEqual([
      '/integrations/google-sheets',
      '/integrations/google-forms',
      '/guide/connect-ai-assistant',
      '/integrations/student-records',
      '/integrations/guide',
    ])
    expect(data.integrations[2].icon).toBe('sparkles')
    expect(data.integrations[4].description).toMatch(/MCP server/)
    expect(data.integrations.some((i: any) => 'id' in i)).toBe(false)
    expect(data.integrationsSubheader).toMatch(/MCP connection with Claude and ChatGPT/)
  })

  it('keeps an API card description an admin rewrote', async () => {
    const cards = FIRST_CARDS.map(c => c.url === '/integrations/guide' ? { ...c, description: 'Ours' } : c)
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', integrationsSubheader: FIRST_SUBHEADER, integrations: cards })
    await applyAiAssistantRefresh(strapi, EXISTING)
    expect(update.mock.calls[0][0].data.integrations.at(-1).description).toBe('Ours')
  })

  it('never runs once the subheader changed (already applied or edited)', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', integrationsSubheader: 'Edited', integrations: FIRST_CARDS })
    await applyAiAssistantRefresh(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('applyConnectionsRefresh', () => {
  const tiers = [
    { id: 1, tierId: 'event', extraFeature: 'Buy 50 or more' },
    { id: 2, tierId: 'pro', extraFeature: 'Google Sheets connector and priority email support' },
    { id: 3, tierId: 'enterprise', extraFeature: 'Integration API and a dedicated account manager' },
  ]

  it('updates the paid cards still showing the first wording', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', tiers })
    await applyConnectionsRefresh(strapi, EXISTING)
    const next = update.mock.calls[0][0].data.tiers
    expect(next[0]).toEqual({ tierId: 'event', extraFeature: 'Buy 50 or more' })
    expect(next[1].extraFeature).toMatch(/MCP connection with Claude and ChatGPT/)
    expect(next[2].extraFeature).toMatch(/dedicated account manager/)
  })

  it('leaves edited cards alone and does nothing when none match', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', tiers: tiers.map(t => ({ ...t, extraFeature: 'Edited' })) })
    await applyConnectionsRefresh(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
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

describe('applyNoFreeOfferRefresh', () => {
  it('takes the free offer off the homepage, keeping edited fields', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      heroButtonLabel: 'Issue your first 50 free',
      closingButtonLabel: 'Ours',
      closingSubheader: 'Set up your organization today. Your first 50 certificates are free, and recipients never pay.',
    })
    await homepageNoFree(strapi, EXISTING)
    const { data } = update.mock.calls[0][0]
    expect(data).toEqual({
      heroButtonLabel: 'Get started',
      closingSubheader: 'Set up your organization today. Recipients never pay to receive, share or check their certificates.',
    })
  })

  it('takes the free offer off the pricing page', async () => {
    const { strapi, update } = fakeStrapi({
      documentId: 'abc123',
      subheader: 'Your first 50 are free. After that, buy certificates for a single event or keep a plan running all year. Recipients and the people who check a certificate never pay.',
      tiers: [
        { id: 1, tierId: 'event', ctaLabel: 'Issue your first 50 free', note: 'Pay once. There is no subscription.' },
        { id: 2, tierId: 'pro', ctaLabel: 'Start free', note: 'Every organisation starts free and can move up later.' },
        { id: 3, tierId: 'enterprise', ctaLabel: 'Talk to us', note: 'Cancel any time.' },
      ],
    })
    await pricingNoFree(strapi, EXISTING)
    const { data } = update.mock.calls[0][0]
    expect(data.subheader).not.toMatch(/free/i)
    expect(data.tiers.map((t: any) => t.ctaLabel)).toEqual(['Get started', 'Get started', 'Talk to us'])
    expect(data.tiers[1].note).toBe('Move between plans whenever you need to.')
    expect(data.tiers[0].note).toBe('Pay once. There is no subscription.')
    expect(data.tiers.some((t: any) => 'id' in t)).toBe(false)
  })

  it('does nothing once the text has changed', async () => {
    const { strapi, update } = fakeStrapi({ documentId: 'abc123', subheader: 'Edited', heroButtonLabel: 'Edited', tiers: [{ id: 1, tierId: 'pro', ctaLabel: 'Get started' }] })
    await homepageNoFree(strapi, EXISTING)
    await pricingNoFree(strapi, EXISTING)
    expect(update).not.toHaveBeenCalled()
  })
})
