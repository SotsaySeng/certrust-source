import { parseMailbox, setupEmailSender } from '../email-sender-setup'

const STRAPI_DEFAULT_TEMPLATES = () => ({
  reset_password: {
    display: 'Email.template.reset_password',
    options: {
      from: { name: 'Administration Panel', email: 'no-reply@strapi.io' },
      response_email: '',
      object: 'Reset password',
      message: '<p>custom body</p>',
    },
  },
  email_confirmation: {
    display: 'Email.template.email_confirmation',
    options: {
      from: { name: 'Administration Panel', email: 'no-reply@strapi.io' },
      response_email: '',
      object: 'Account confirmation',
      message: '<p>another body</p>',
    },
  },
})

function fakeStrapi(templates: any) {
  const store = { get: jest.fn().mockResolvedValue(templates), set: jest.fn().mockResolvedValue(undefined) }
  return {
    store,
    strapi: {
      store: jest.fn(() => store),
      log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    },
  }
}

describe('parseMailbox', () => {
  it('parses "Name <addr>", quoted names and bare addresses', () => {
    expect(parseMailbox('Certrust <certificates@certrust.app>')).toEqual({ name: 'Certrust', email: 'certificates@certrust.app' })
    expect(parseMailbox('"Certrust Team" <a@b.co>')).toEqual({ name: 'Certrust Team', email: 'a@b.co' })
    expect(parseMailbox('a@b.co')).toEqual({ name: 'Certrust', email: 'a@b.co' })
    expect(parseMailbox('<a@b.co>')).toEqual({ name: 'Certrust', email: 'a@b.co' })
  })

  it('returns null for empty or address-less values', () => {
    expect(parseMailbox(undefined)).toBeNull()
    expect(parseMailbox('  ')).toBeNull()
    expect(parseMailbox('Certrust')).toBeNull()
  })
})

describe('setupEmailSender', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
  })

  afterAll(() => {
    process.env = env
  })

  it('replaces the seeded no-reply@strapi.io sender and keeps the templates themselves', async () => {
    process.env.SMTP_FROM = 'Certrust <certificates@certrust.app>'
    process.env.SMTP_REPLY_TO = 'support@certrust.app'
    const { strapi, store } = fakeStrapi(STRAPI_DEFAULT_TEMPLATES())

    await setupEmailSender(strapi)

    expect(store.set).toHaveBeenCalledTimes(1)
    const saved = store.set.mock.calls[0][0].value
    for (const key of ['reset_password', 'email_confirmation']) {
      expect(saved[key].options.from).toEqual({ name: 'Certrust', email: 'certificates@certrust.app' })
      expect(saved[key].options.response_email).toBe('support@certrust.app')
    }
    expect(saved.reset_password.options.message).toBe('<p>custom body</p>')
    expect(saved.email_confirmation.options.object).toBe('Account confirmation')
  })

  it('defaults Reply-To to the sender address', async () => {
    process.env.SMTP_FROM = 'certificates@certrust.app'
    delete process.env.SMTP_REPLY_TO
    const { strapi, store } = fakeStrapi(STRAPI_DEFAULT_TEMPLATES())

    await setupEmailSender(strapi)

    expect(store.set.mock.calls[0][0].value.reset_password.options.response_email).toBe('certificates@certrust.app')
  })

  it('does not write when already in sync', async () => {
    process.env.SMTP_FROM = 'Certrust <certificates@certrust.app>'
    process.env.SMTP_REPLY_TO = 'support@certrust.app'
    const templates = STRAPI_DEFAULT_TEMPLATES()
    for (const t of Object.values<any>(templates)) {
      t.options.from = { name: 'Certrust', email: 'certificates@certrust.app' }
      t.options.response_email = 'support@certrust.app'
    }
    const { strapi, store } = fakeStrapi(templates)

    await setupEmailSender(strapi)

    expect(store.set).not.toHaveBeenCalled()
  })

  it('leaves the store alone when SMTP_FROM is not set', async () => {
    delete process.env.SMTP_FROM
    const { strapi, store } = fakeStrapi(STRAPI_DEFAULT_TEMPLATES())

    await setupEmailSender(strapi)

    expect(store.get).not.toHaveBeenCalled()
    expect(store.set).not.toHaveBeenCalled()
  })
})
