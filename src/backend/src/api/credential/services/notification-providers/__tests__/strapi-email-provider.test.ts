import { createStrapiEmailProvider } from '../strapi-email-provider'

function createFakeStrapi() {
  const sentEmails: any[] = []
  return {
    strapi: {
      plugins: {
        email: {
          services: {
            email: {
              send: async (options: any) => {
                sentEmails.push(options)
              },
            },
          },
        },
      },
    },
    sentEmails,
  }
}

describe('strapi-email-provider', () => {
  it('sends via the Strapi email plugin using the credential-issuance template', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Test Badge', description: 'A test badge' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'http://localhost:3000',
      user: { username: 'recipient', email: 'recipient@example.com' },
    })

    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0].to).toBe('recipient@example.com')
    expect(sentEmails[0].subject).toMatch(/Test Badge/)
    expect(sentEmails[0].html).toMatch(/urn:uuid:abc/)
  })

  it('tells the recipient who holds their data and how to correct it (IPP 3A / GDPR Art. 14)', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    ;(strapi as any).config = { get: (key: string) => (key === 'custom.privacyEmail' ? 'privacy@example.org' : undefined) }
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Test Badge' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.example',
      user: null,
      issuerName: 'R&D Lab',
    })

    for (const body of [sentEmails[0].text, sentEmails[0].html]) {
      expect(body).toMatch(/gave Certrust your name and email address/)
      expect(body).toMatch(/Singapore/)
      expect(body).toMatch(/privacy@example.org/)
      expect(body).toMatch(/make this credential private/)
      expect(body).toMatch(/https:\/\/certrust.example\/privacy-policy/)
    }
  })

  it('names the issuer, links only to the credential, and never leaks upstream defaults', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Workshop Completion', description: 'Two-day workshop' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.app',
      user: null,
      issuerName: 'R&D Lab',
      supportEmail: 'support@certrust.app',
    })

    const { html, text, subject } = sentEmails[0]
    expect(subject).toBe('Your certificate from R&D Lab: Workshop Completion')
    for (const body of [html, text]) {
      expect(body).not.toMatch(/localhost|schroedinger|53115782/)
      expect(body).toContain('support@certrust.app')
      expect(body).toContain('https://certrust.app/credentials/urn:uuid:abc')
      expect(body).toContain('Two-day workshop')
    }
    expect(html).toContain('R&amp;D Lab')
    expect(text).toContain('R&D Lab has issued you the credential "Workshop Completion"')
    // one call to action, no remote images
    expect(html.match(/<a /g)).toHaveLength(1)
    expect(html).not.toMatch(/<img/i)
  })

  it('sends as "<issuer> via Certrust" from the configured address', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    ;(strapi as any).config = { get: (key: string) => key === 'plugin::email.settings.defaultFrom' ? 'Certrust <certificates@certrust.app>' : undefined }
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Workshop Completion' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.app',
      user: null,
      issuerName: 'Zettabyte "Lab"',
    })

    expect(sentEmails[0].from).toBe('"Zettabyte Lab via Certrust" <certificates@certrust.app>')
  })

  it('has no account/sign-in or set-password block', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Workshop Completion' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.app',
      user: { username: 'recipient1790', email: 'recipient@example.com' },
    })

    const { html, text } = sentEmails[0]
    for (const body of [html, text]) {
      expect(body).not.toMatch(/Username|recipient1790|Set Your Password/i)
      expect(body).not.toMatch(/Forgot password|signing in|sign in/i)
    }
  })

  it('omits the support line when no support address is configured', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendCredentialIssued({
      to: 'recipient@example.com',
      achievement: { name: 'Test Badge' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.app',
      user: null,
    })

    expect(sentEmails[0].html).not.toContain('Questions?')
    expect(sentEmails[0].text).not.toContain('Questions?')
    expect(sentEmails[0].from).toBeUndefined()
  })

  it('expiration warnings name the issuer and support address', async () => {
    const { strapi, sentEmails } = createFakeStrapi()
    const provider = createStrapiEmailProvider(strapi)

    await provider.sendExpirationWarning({
      to: 'recipient@example.com',
      achievement: { name: 'Test Badge' },
      credential: { id: 1, credentialId: 'urn:uuid:abc' },
      frontendUrl: 'https://certrust.app',
      user: null,
      daysLeft: 7,
      expirationDate: new Date('2026-12-01'),
      issuerName: 'ZettaByte Lab',
      supportEmail: 'support@certrust.app',
    })

    const { html, text } = sentEmails[0]
    expect(html).not.toMatch(/schroedinger/)
    expect(text).toContain('contact ZettaByte Lab or reach us at support@certrust.app')
    expect(html).toContain('mailto:support@certrust.app')
  })

  it('propagates errors from the underlying email plugin', async () => {
    const provider = createStrapiEmailProvider({
      plugins: { email: { services: { email: { send: async () => { throw new Error('SMTP down') } } } } },
    })

    await expect(
      provider.sendCredentialIssued({
        to: 'recipient@example.com',
        achievement: { name: 'Test Badge' },
        credential: { id: 1, credentialId: 'urn:uuid:abc' },
        frontendUrl: 'http://localhost:3000',
        user: null,
      })
    ).rejects.toThrow('SMTP down')
  })
})
