import { issuerDisplayName } from '../issuer-display-name'

describe('issuerDisplayName', () => {
  it("prefers the organisation's name over the admin's profile name", () => {
    expect(issuerDisplayName({ name: 'lumen_admin', organization: { name: 'Lumen Certification Academy' } }))
      .toBe('Lumen Certification Academy')
  })

  it('falls back to the profile name when there is no organisation', () => {
    expect(issuerDisplayName({ name: 'Jane Doe', organization: null })).toBe('Jane Doe')
    expect(issuerDisplayName({ name: 'Jane Doe', organization: { name: '  ' } })).toBe('Jane Doe')
  })

  it('falls back to the given default when nothing is set', () => {
    expect(issuerDisplayName(null)).toBe('Certrust')
    expect(issuerDisplayName({ name: '' }, 'the issuer')).toBe('the issuer')
  })
})
