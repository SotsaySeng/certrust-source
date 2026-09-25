import certificateServiceFactory from '../certificate'

function strapiReturning(credential: any) {
  const findOne = jest.fn().mockResolvedValue(credential)
  return {
    findOne,
    strapi: {
      entityService: { findOne },
      config: { get: jest.fn((_key: string, fallback: any) => fallback) },
    },
  }
}

const baseCredential = {
  credentialId: 'urn:uuid:abc',
  issuanceDate: '2026-09-25T00:00:00.000Z',
  recipient: { name: 'Jane Doe' },
  achievement: { name: 'Workshop Completion' },
}

describe('certificate service', () => {
  it("prints the issuing organisation's name, not the admin's username", async () => {
    const { strapi, findOne } = strapiReturning({
      ...baseCredential,
      issuer: { name: 'zettabytelab', organization: { name: 'Zettabyte Lab & Consulting Sole Co., Ltd.' } },
    })
    const svg = await certificateServiceFactory({ strapi }).generateCertificate(1)

    expect(svg).toContain('Zettabyte Lab &amp; Consulting Sole Co., Ltd.')
    expect(svg).not.toContain('zettabytelab')
    expect(findOne.mock.calls[0][2].populate).toContain('issuer.organization')
  })

  it('falls back to the profile name for an issuer without an organisation', async () => {
    const { strapi } = strapiReturning({ ...baseCredential, issuer: { name: 'Jane Smith', organization: null } })
    const svg = await certificateServiceFactory({ strapi }).generateCertificate(1)
    expect(svg).toContain('Jane Smith')
  })
})
