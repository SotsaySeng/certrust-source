import { tokenMatches } from '../ops'

describe('ops token check', () => {
  it('accepts only the exact configured token', () => {
    expect(tokenMatches('s3cret-token', 's3cret-token')).toBe(true)
    expect(tokenMatches('s3cret-token', 's3cret-tokex')).toBe(false)
    expect(tokenMatches('s3cret-token', 's3cret')).toBe(false)
  })

  it('is closed when no token is configured or none is sent', () => {
    expect(tokenMatches(undefined, 'anything')).toBe(false)
    expect(tokenMatches('', '')).toBe(false)
    expect(tokenMatches('s3cret-token', undefined)).toBe(false)
    expect(tokenMatches('s3cret-token', ['s3cret-token'])).toBe(false)
  })
})
