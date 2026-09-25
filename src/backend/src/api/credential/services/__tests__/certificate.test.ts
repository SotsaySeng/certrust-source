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

describe('certificate service: PNG download', () => {
  it('renders the certificate area (without the empty strip) as a 2x PNG', async () => {
    const { strapi } = strapiReturning({ ...baseCredential, issuer: { name: 'Jane Smith', organization: null } })
    const png = await certificateServiceFactory({ strapi }).generateCertificatePng(1)

    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
    // IHDR: width and height are the first two big-endian ints after the header
    expect(png.readUInt32BE(16)).toBe(1600)
    expect(png.readUInt32BE(20)).toBe(1200)
  })
})
