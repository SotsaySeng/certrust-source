import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockApiClient = {
  post: vi.fn(),
  get: vi.fn(),
  setToken: vi.fn(),
  clearToken: vi.fn(),
  baseUrl: 'http://test.local'
}

globalThis.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  length: 0,
  clear: vi.fn(),
  key: vi.fn()
} as Storage

describe('authClient', () => {
  let AuthClient: typeof import('../auth-client').AuthClient
  let authClient: InstanceType<typeof import('../auth-client').AuthClient>
  let originalProcessClient: boolean | undefined

  beforeEach(async () => {
    vi.resetAllMocks()
    // Mock process.client to true
    originalProcessClient = import.meta.client
    globalThis.process = { ...(globalThis.process || {}), client: true }
    vi.doMock('../api-client', () => ({ apiClient: mockApiClient }))
    vi.doMock('./api-client', () => ({ apiClient: mockApiClient }))
    // Import AuthClient after mocks
    AuthClient = (await import('../auth-client')).AuthClient
    authClient = new AuthClient()
    mockApiClient.baseUrl = 'http://test.local'
  })

  afterEach(() => {
    vi.resetModules()
    // Restore process.client
    if (originalProcessClient === undefined) {
      // @ts-expect-error We expect an error here
      delete import.meta.client
    }
    else {
      globalThis.process = { ...(globalThis.process || {}), client: originalProcessClient }
    }
  })

  it('login posts the credentials and stores nothing in the browser', async () => {
    mockApiClient.post.mockResolvedValue({ session: true, user: { id: 1, email: 'test@test.com' } })
    const response = await authClient.login({ identifier: 'test', password: 'pw' })
    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/local', { identifier: 'test', password: 'pw' })
    expect(response.session).toBe(true)
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('register returns the API response unchanged', async () => {
    mockApiClient.post.mockResolvedValue({ user: { id: 2, email: 'reg@test.com' } })
    const data = { username: 'reg', email: 'reg@test.com', password: 'pw', organizationName: 'Org' }
    const response = await authClient.register(data)
    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/local/register', data)
    expect(response.session).toBeUndefined()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it('logout asks the API to clear the session cookie', async () => {
    mockApiClient.post.mockResolvedValue(undefined)
    await authClient.logout()
    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/logout', {})
  })

  it('loginWithToken exchanges the OAuth JWT for the cookie and does not keep it', async () => {
    mockApiClient.post.mockResolvedValue(undefined)
    mockApiClient.get.mockResolvedValue({ id: 3, email: 'o@test.com' })
    const { user } = await authClient.loginWithToken('oauth-jwt')
    expect(mockApiClient.setToken).toHaveBeenCalledWith('oauth-jwt')
    expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/session', {})
    expect(mockApiClient.clearToken).toHaveBeenCalled()
    expect(user).toEqual({ id: 3, email: 'o@test.com' })
  })

  it('fetchCurrentUser returns null without a session', async () => {
    mockApiClient.get.mockRejectedValue(new Error('401'))
    expect(await authClient.fetchCurrentUser()).toBeNull()
  })
})
