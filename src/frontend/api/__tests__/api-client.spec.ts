import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClient } from '../api-client'

globalThis.fetch = vi.fn()
globalThis.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()

} as any

describe('apiClient', () => {
  let apiClient: ApiClient

  beforeEach(() => {
    vi.resetAllMocks()
    apiClient = new ApiClient('http://test.local')
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('never persists tokens, and sends the session cookie plus the web client header', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    apiClient.setToken('abc123')
    expect(localStorage.setItem).not.toHaveBeenCalled()
    await apiClient.get('/test')
    const [, init] = (fetch as any).mock.calls[0]
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Certrust-Client']).toBe('web')
    expect(init.headers.Authorization).toBe('Bearer abc123')

    apiClient.clearToken()
    await apiClient.get('/test')
    expect((fetch as any).mock.calls[1][1].headers.Authorization).toBeUndefined()
  })

  it('get makes a GET request with correct headers', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ result: 1 }) })
    const result = await apiClient.get('/test')
    expect(fetch).toHaveBeenCalledWith('http://test.local/test', expect.objectContaining({ method: 'GET' }))
    expect(result).toEqual({ result: 1 })
  })

  it('post makes a POST request with correct body', async () => {
    ;(fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    const result = await apiClient.post('/test', { foo: 'bar' })
    expect(fetch).toHaveBeenCalledWith('http://test.local/test', expect.objectContaining({ method: 'POST', body: JSON.stringify({ foo: 'bar' }) }))
    expect(result).toEqual({ ok: true })
  })

  it('throws on non-ok response', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: { message: 'fail' } }) })
    await expect(apiClient.get('/fail')).rejects.toThrow('fail')
  })
})
