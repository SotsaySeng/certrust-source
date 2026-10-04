import { createRateLimiter } from '../rate-limit'

describe('rate limiter', () => {
  it('allows up to the limit per window, then refuses', () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 })
    const t = 1_000_000
    expect(limiter.take('a', t)).toMatchObject({ allowed: true, remaining: 2, limit: 3, resetAt: t + 60_000 })
    expect(limiter.take('a', t + 1).allowed).toBe(true)
    expect(limiter.take('a', t + 2)).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.take('a', t + 3)).toMatchObject({ allowed: false, remaining: 0, resetAt: t + 60_000 })
  })

  it('counts each caller separately', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.take('a', 0).allowed).toBe(true)
    expect(limiter.take('b', 0).allowed).toBe(true)
    expect(limiter.take('a', 1).allowed).toBe(false)
  })

  it('starts a fresh window once the old one ends', () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 })
    expect(limiter.take('a', 0).allowed).toBe(true)
    expect(limiter.take('a', 59_999).allowed).toBe(false)
    expect(limiter.take('a', 60_000)).toMatchObject({ allowed: true, resetAt: 120_000 })
  })
})
