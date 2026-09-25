import { toPublicCredential, hashedEmailIdentifier, privateOpenBadgeStub } from '../public-credential'

const row = () => ({
  id: 7,
  documentId: 'doc7',
  credentialId: 'urn:uuid:1b4e28ba-2fa1-4d2b-883f-0016d3cca427',
  name: 'Workshop completion',
  description: 'Completed the workshop',
  issuanceDate: '2026-09-01T00:00:00.000Z',
  revoked: false,
  revocationReason: 'internal note',
  achievement: { id: 3, name: 'Cloud 101', image: { url: '/uploads/a.png', formats: { small: { url: '/uploads/s.png', size: 1 } } } },
  issuer: {
    id: 2, name: 'lumen_admin', email: 'admin@issuer.test', telephone: '+1 555', url: 'https://issuer.test',
    organization: { name: 'Lumen Academy', billingEmail: 'billing@issuer.test', stripeCustomerId: 'cus_x' },
  },
  recipient: { id: 9, name: 'Jane Doe', email: 'jane@example.com', telephone: '+64 21 000' },
  evidence: [{ name: 'Project', narrative: 'Built a thing', internalNote: 'x' }],
  proof: [{ jws: 'abc' }],
})

describe('toPublicCredential', () => {
  it('never includes contact details or billing fields', () => {
    const json = JSON.stringify(toPublicCredential(row()))
    for (const secret of ['jane@example.com', '+64 21 000', 'admin@issuer.test', '+1 555', 'billing@issuer.test', 'cus_x', 'internalNote']) {
      expect(json).not.toContain(secret)
    }
  })

  it('shows the recipient name and organisation name for public credentials', () => {
    const dto: any = toPublicCredential(row())
    expect(dto.recipient).toEqual({ name: 'Jane Doe' })
    expect(dto.issuer.name).toBe('Lumen Academy')
    expect(dto.issuer.active).toBe(true)
    expect(dto.revocationReason).toBeNull()
    expect(dto.achievement.image.formats.small).toEqual({ url: '/uploads/s.png' })
  })

  it('hides recipient and achievement details for private or minor credentials', () => {
    for (const extra of [{ visibility: 'private' }, { issuedToMinor: true }]) {
      const dto: any = toPublicCredential({ ...row(), ...extra })
      expect(dto.visibility).toBe('private')
      expect(dto.recipient).toBeNull()
      expect(dto.achievement).toBeNull()
      expect(dto.evidence).toEqual([])
      expect(dto.issuer.name).toBe('Lumen Academy')
      expect(dto.name).toBeNull()
      expect(JSON.stringify(dto)).not.toContain('Cloud 101')
      expect(JSON.stringify(dto)).not.toContain('Jane Doe')
    }
  })

  it('gives the issuer or recipient the full view of a private credential, still without contact details', () => {
    const dto: any = toPublicCredential({ ...row(), visibility: 'private' }, { fullView: true })
    expect(dto.visibility).toBe('private')
    expect(dto.recipient).toEqual({ name: 'Jane Doe' })
    expect(dto.achievement.name).toBe('Cloud 101')
    expect(JSON.stringify(dto)).not.toContain('jane@example.com')
  })

  it('reports a closed issuer organisation as inactive', () => {
    const r: any = row()
    r.issuer.organization.closedAt = '2026-09-20T00:00:00.000Z'
    expect((toPublicCredential(r) as any).issuer.active).toBe(false)
  })
})

describe('hashedEmailIdentifier', () => {
  it('is stable, salted and does not contain the address', () => {
    const a = hashedEmailIdentifier('Jane@Example.com', 'urn:uuid:1')
    const b = hashedEmailIdentifier('jane@example.com', 'urn:uuid:1')
    const c = hashedEmailIdentifier('jane@example.com', 'urn:uuid:2')
    expect(a).toEqual(b)
    expect(a.identityHash).not.toEqual(c.identityHash)
    expect(JSON.stringify(a)).not.toContain('jane')
    expect(a).toMatchObject({ type: 'IdentityObject', identityType: 'emailAddress', hashed: true })
  })
})

describe('privateOpenBadgeStub', () => {
  it('names the issuer and dates but not the achievement or recipient', () => {
    const stub = privateOpenBadgeStub({ ...row(), visibility: 'private' }, 'https://api.example')
    const json = JSON.stringify(stub)
    expect(stub.issuer.name).toBe('Lumen Academy')
    expect(stub.name).toBe('Private credential')
    for (const secret of ['Cloud 101', 'Jane Doe', 'jane@example.com', 'Workshop completion']) {
      expect(json).not.toContain(secret)
    }
  })
})
