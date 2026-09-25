import issuerKeysFactory from '../issuer-keys'

function createFakeStrapi() {
  const issuerKeys: any[] = []
  const profiles = new Map<number, any>([[1, { id: 1, did: null, publicKey: [] }]])
  let nextId = 1

  return {
    strapi: {
      config: { get: (_key: string, fallback: string) => fallback },
      db: {
        query: (contentType: string) => {
          if (contentType !== 'api::issuer-key.issuer-key') {
            throw new Error(`Unexpected content type: ${contentType}`)
          }
          return {
            findOne: async ({ where }: any) =>
              issuerKeys.find((k) => k.profile === where.profile) || null,
            create: async ({ data }: any) => {
              const record = { id: nextId++, ...data }
              issuerKeys.push(record)
              return record
            },
            delete: async ({ where }: any) => {
              const index = issuerKeys.findIndex((k) => k.id === where.id)
              if (index !== -1) issuerKeys.splice(index, 1)
            },
          }
        },
      },
      entityService: {
        findOne: async (contentType: string, id: number) => {
          if (contentType !== 'api::profile.profile') throw new Error('unexpected content type')
          return profiles.get(id) || null
        },
        // Signing must never write to the issuer's profile: on a
        // draftAndPublish type that re-publishes the document, which deletes
        // the published row and orphans every relation pointing at it (see
        // the service's header comment). Blow up loudly if it comes back.
        update: async () => {
          throw new Error('entityService.update must not be called while generating issuer keys')
        },
      },
    },
    profiles,
    issuerKeys,
  }
}

describe('issuer-keys service', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = 'test-encryption-key-do-not-use-in-prod'
  })

  it('generates and persists a keypair on first use', async () => {
    const { strapi, issuerKeys, profiles } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    const { privateKey, publicKeyJwk } = await service.getOrCreateKeyPair(1)

    expect(privateKey).toBeDefined()
    expect(publicKeyJwk).toMatchObject({ kty: 'OKP', crv: 'Ed25519' })
    expect(issuerKeys).toHaveLength(1)
    // The key is persisted on the issuer-key record only - the profile is
    // left completely untouched.
    expect(profiles.get(1).publicKey).toHaveLength(0)
  })

  it('exposes the key to profile read paths without writing to the profile', async () => {
    const { strapi, issuerKeys, profiles } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    // Nothing signed yet: nothing to expose.
    expect(await service.getPublicKeyEntry(1)).toBeNull()
    expect(await service.publicKeysForProfile(profiles.get(1))).toHaveLength(0)

    const { publicKeyJwk } = await service.getOrCreateKeyPair(1)

    const entry = await service.getPublicKeyEntry(1)
    expect(entry).toMatchObject({ type: 'Ed25519VerificationKey2020', publicKeyJwk })

    const keys = await service.publicKeysForProfile(profiles.get(1))
    expect(keys).toHaveLength(1)
    expect(keys[0].publicKeyJwk).toEqual(publicKeyJwk)
    expect(issuerKeys).toHaveLength(1)
  })

  it('does not list the same key twice for a profile mirrored before the fix', async () => {
    const { strapi, profiles } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)
    const { publicKeyJwk } = await service.getOrCreateKeyPair(1)

    // An older profile that still carries the mirrored component.
    const legacyProfile = { ...profiles.get(1), publicKey: [{ id: 'legacy', type: 'Ed25519VerificationKey2020', publicKeyJwk }] }

    const keys = await service.publicKeysForProfile(legacyProfile)
    expect(keys).toHaveLength(1)
    expect(keys[0].id).toBe('legacy')
  })

  it('creates exactly one keypair when a batch asks for it concurrently', async () => {
    // credential.batchIssue issues every recipient through Promise.all, so a
    // brand-new issuer's first batch hits this find-or-create N times at once.
    // Each caller creating its own key meant each certificate in the batch was
    // signed with a different one, and only the key findOne returns is ever
    // published - so most of the batch failed verification.
    const { strapi, issuerKeys } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    const results = await Promise.all([1, 1, 1, 1, 1].map((id) => service.getOrCreateKeyPair(id)))

    expect(issuerKeys).toHaveLength(1)
    for (const result of results) {
      expect(result.publicKeyJwk).toEqual(results[0].publicKeyJwk)
    }
  })

  it('returns the same keypair on subsequent calls (idempotent)', async () => {
    const { strapi, issuerKeys } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    const first = await service.getOrCreateKeyPair(1)
    const second = await service.getOrCreateKeyPair(1)

    expect(issuerKeys).toHaveLength(1) // no second key was created
    expect(second.publicKeyJwk).toEqual(first.publicKeyJwk)
  })

  it('the generated key can actually sign and verify a JWS', async () => {
    const { strapi } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)
    const { SignJWT, jwtVerify } = await import('jose')

    const { privateKey } = await service.getOrCreateKeyPair(1)
    const jws = await new SignJWT({ hello: 'world' }).setProtectedHeader({ alg: 'EdDSA' }).sign(privateKey)

    const publicKey = await service.getPublicKey(1)
    const { payload } = await jwtVerify(jws, publicKey as any)
    expect(payload.hello).toEqual('world')
  })

  it('getPublicKey returns null for an issuer with no key yet', async () => {
    const { strapi } = createFakeStrapi()
    const service = issuerKeysFactory({ strapi } as any)

    expect(await service.getPublicKey(999)).toBeNull()
  })
})
