/**
 * A fixed-window request counter, kept in memory. The backend runs as a
 * single instance, so the count is the whole picture; it resets on a
 * restart, which only ever errs in the caller's favour.
 */
export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  /** When the current window ends (ms since epoch). */
  resetAt: number
}

export function createRateLimiter(opts: { limit: number, windowMs: number }) {
  const windows = new Map<string, { start: number, count: number }>()
  return {
    take(id: string, now = Date.now()): RateLimitResult {
      let w = windows.get(id)
      if (!w || now - w.start >= opts.windowMs) {
        // Forget callers that have gone quiet before the map can grow.
        if (windows.size > 5000) {
          for (const [key, value] of windows) {
            if (now - value.start >= opts.windowMs) windows.delete(key)
          }
        }
        w = { start: now, count: 0 }
        windows.set(id, w)
      }
      w.count++
      return {
        allowed: w.count <= opts.limit,
        limit: opts.limit,
        remaining: Math.max(0, opts.limit - w.count),
        resetAt: w.start + opts.windowMs,
      }
    },
  }
}
