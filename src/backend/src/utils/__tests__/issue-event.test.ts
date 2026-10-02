import { resolveIssueEvent } from '../issue-event'

const org = { id: 4, documentId: 'org-a' }
const achievement = { id: 9, documentId: 'ach-1' }

function withEvent(event: any) {
  ;(globalThis as any).strapi = { documents: () => ({ findOne: async () => event }) }
}

describe('resolveIssueEvent', () => {
  afterEach(() => { delete (globalThis as any).strapi })

  it('returns null when no event was chosen', async () => {
    expect(await resolveIssueEvent(undefined, achievement, org)).toBeNull()
    expect(await resolveIssueEvent('', achievement, org)).toBeNull()
  })

  it('copies the event details for an event of this organization and achievement', async () => {
    withEvent({ id: 12, name: 'TETL Workshop', startDate: '2026-10-01T01:00:00.000Z', endDate: '2026-10-02T09:00:00.000Z', location: 'Pakpasak Technical College', description: 'not copied', organization: { documentId: 'org-a' }, achievement: { documentId: 'ach-1' } })
    expect(await resolveIssueEvent('ev-1', achievement, org)).toEqual({
      id: 12,
      snapshot: { name: 'TETL Workshop', startDate: '2026-10-01T01:00:00.000Z', endDate: '2026-10-02T09:00:00.000Z', location: 'Pakpasak Technical College' },
    })
  })

  it('accepts an organization event that is not tied to an achievement', async () => {
    withEvent({ id: 13, name: 'Graduation', organization: { documentId: 'org-a' }, achievement: null })
    expect((await resolveIssueEvent('ev-2', achievement, org))?.snapshot).toEqual({ name: 'Graduation', startDate: null, endDate: null, location: null })
  })

  it('refuses another organization\'s event, another achievement\'s event, or a missing one', async () => {
    withEvent({ id: 14, name: 'x', organization: { documentId: 'org-b' }, achievement: null })
    await expect(resolveIssueEvent('ev-3', achievement, org)).rejects.toThrow('belongs to another organization')
    withEvent({ id: 15, name: 'x', organization: { documentId: 'org-a' }, achievement: { documentId: 'ach-2' } })
    await expect(resolveIssueEvent('ev-4', achievement, org)).rejects.toThrow('different achievement')
    withEvent(null)
    await expect(resolveIssueEvent('ev-5', achievement, org)).rejects.toThrow('no longer exists')
  })
})
