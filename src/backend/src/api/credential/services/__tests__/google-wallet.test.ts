import { generateKeyPairSync } from 'node:crypto'
import { decodeJwt, decodeProtectedHeader } from 'jose'
import googleWalletServiceFactory from '../google-wallet'

const strapi = {
  config: {
    get: jest.fn((key: string) => (key === 'frontend.url' ? 'https://certrust.app' : 'https://api.certrust.app')),
  },
}
const service = googleWalletServiceFactory({ strapi })

const credential = {
  credentialId: 'urn:uuid:abc-123',
  name: 'Workshop Completion',
  issuanceDate: '2026-09-25T00:00:00.000Z',
  expirationDate: '2027-09-25T00:00:00.000Z',
  recipient: { name: 'Jane Doe' },
  issuer: { name: 'admin', organization: { name: 'Zettabyte Lab' } },
  badgeDesignSnapshot: { some: 'design' },
}

describe('google wallet service', () => {
  const env = { ...process.env }
  afterEach(() => { process.env = { ...env } })

  it('is off and returns no link until all three env vars are set', async () => {
    delete process.env.GOOGLE_WALLET_ISSUER_ID
    expect(service.isConfigured()).toBe(false)
    expect(await service.saveUrl(credential)).toBeNull()
  })

  it('signs a savetowallet JWT holding the pass', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    process.env.GOOGLE_WALLET_ISSUER_ID = '3388000000012345678'
    process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL = 'wallet@certrust.iam.gserviceaccount.com'
    // Escaped newlines, as the key sits in an env file.
    process.env.GOOGLE_WALLET_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, '\\n')

    const url = await service.saveUrl(credential)
    expect(url).toMatch(/^https:\/\/pay\.google\.com\/gp\/v\/save\//)
    const jwt = url!.split('/').pop()!
    expect(decodeProtectedHeader(jwt).alg).toBe('RS256')
    const claims: any = decodeJwt(jwt)
    expect(claims).toMatchObject({
      iss: 'wallet@certrust.iam.gserviceaccount.com',
      aud: 'google',
      typ: 'savetowallet',
      origins: ['https://certrust.app'],
    })
    const [obj] = claims.payload.genericObjects
    expect(obj.id).toBe('3388000000012345678.urn_uuid_abc-123')
    expect(obj.classId).toBe(claims.payload.genericClasses[0].id)
    expect(obj.cardTitle.defaultValue.value).toBe('Zettabyte Lab')
    expect(obj.header.defaultValue.value).toBe('Jane Doe')
    expect(obj.barcode.value).toBe('https://certrust.app/credentials/urn%3Auuid%3Aabc-123')
    // Static images only: Google rejects a pass whose image loads slowly.
    expect(obj.heroImage).toBeUndefined()
    expect(obj.logo.sourceUri.uri).toBe('https://certrust.app/android-chrome-512x512.png')
    expect(obj.validTimeInterval.end.date).toBe('2027-09-25T00:00:00.000Z')
  })

  it('leaves the expiry off a credential that does not expire', () => {
    const obj: any = service.buildObject({ ...credential, expirationDate: null }, 'x')
    expect(obj.validTimeInterval).toBeUndefined()
    expect(obj.textModulesData).toHaveLength(1)
  })
})
