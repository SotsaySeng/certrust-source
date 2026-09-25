import { brandMessage, setupEmailBranding } from '../email-branding'

describe('email branding', () => {
  it('injects the logo after <body> and attaches it inline', () => {
    const out = brandMessage({ to: 'a@b.c', html: '<html><body style="x"><p>Hi</p></body></html>' })
    expect(out.html).toMatch(/<body style="x"><div[^>]*><img src="cid:certrust-logo"/)
    expect(out.attachments).toHaveLength(1)
    expect(out.attachments[0]).toMatchObject({ cid: 'certrust-logo', contentType: 'image/png' })
  })

  it('builds an HTML part for text-only messages and links URLs', () => {
    const out = brandMessage({ to: 'a@b.c', text: 'Hello <b>\n\nSee https://certrust.app/x' })
    expect(out.html).toContain('cid:certrust-logo')
    expect(out.html).toContain('&lt;b&gt;')
    expect(out.html).toContain('<a href="https://certrust.app/x">')
    expect(out.text).toBe('Hello <b>\n\nSee https://certrust.app/x')
  })

  it('is idempotent and keeps existing attachments', () => {
    const once = brandMessage({ html: '<p>x</p>', attachments: [{ filename: 'f.txt' }] })
    const twice = brandMessage(once)
    expect(twice.attachments).toHaveLength(2)
    expect(twice.html.match(/cid:certrust-logo/g)).toHaveLength(1)
  })

  it('wraps provider.send once', async () => {
    const sent: any[] = []
    const provider: any = { send: async (m: any) => sent.push(m) }
    const strapi: any = { plugin: () => ({ provider }), log: { info() {}, warn() {} } }
    setupEmailBranding(strapi)
    setupEmailBranding(strapi)
    await provider.send({ to: 'a@b.c', html: '<p>x</p>' })
    expect(sent).toHaveLength(1)
    expect(sent[0].html).toContain('cid:certrust-logo')
  })
})
