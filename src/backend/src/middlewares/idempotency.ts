/**
 * Idempotency-Key support for API writes, so an integration can retry a
 * request (after a timeout, a dropped connection) without issuing twice.
 *
 * A POST/PUT/PATCH/DELETE to /api/* that carries `Idempotency-Key: <id>`
 * (up to 255 characters, e.g. a UUID) is run once per caller and key:
 *
 *   - the first request runs; a response below 500 is stored for 24 hours
 *     (except 401, 403, 409 and 429, which say nothing about the request
 *     itself, and responses that aren't JSON);
 *   - a retry with the same key and the same request gets the stored
 *     response back, with `Idempotent-Replayed: true`;
 *   - the same key with a different method, path or body is refused (422);
 *   - a retry while the first is still running is refused (409).
 *
 * "Caller" is the credential the request was made with (the Authorization
 * header, which auth-cookie has already filled in for website sessions),
 * so two callers can never see each other's responses. Requests without a
 * credential, and requests without the header, run normally.
 *
 * Must come after strapi::body (it fingerprints the parsed body) and after
 * global::auth-cookie.
 */
import { createHash } from 'node:crypto'

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const NOT_STORED = new Set([401, 403, 409, 429])
const MAX_KEY_LENGTH = 255
const MAX_STORED_BYTES = 5 * 1024 * 1024
const SERVICE = 'api::idempotency-record.idempotency-record'

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function fingerprint(ctx: any): string {
  const files = ctx.request.files
    ? Object.values(ctx.request.files).flat().map((f: any) => `${f.originalFilename ?? f.name}:${f.size}`)
    : []
  return sha256(`${ctx.method} ${ctx.path}\n${JSON.stringify(ctx.request.body ?? null)}\n${files.join(',')}`)
}

function storable(body: unknown): unknown | undefined {
  if (body == null) return null
  if (Buffer.isBuffer(body) || typeof (body as any)?.pipe === 'function') return undefined
  try {
    const json = JSON.stringify(body)
    if (json.length > MAX_STORED_BYTES) return undefined
    return JSON.parse(json)
  }
  catch {
    return undefined
  }
}

export default (_config: unknown, { strapi }: { strapi: any }) => {
  return async (ctx: any, next: () => Promise<void>) => {
    const key = ctx.get('idempotency-key')
    if (!key || !UNSAFE.has(ctx.method) || !ctx.path.startsWith('/api/')) return next()

    const credential = ctx.get('authorization')
    if (!credential) return next()

    if (key.length > MAX_KEY_LENGTH) {
      ctx.status = 400
      ctx.body = { data: null, error: { status: 400, name: 'BadRequestError', message: `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters.` } }
      return
    }

    const service = strapi.service(SERVICE)
    const print = fingerprint(ctx)
    const claim = await service.claim(sha256(`${credential}\n${key}`), print)

    if ('existing' in claim) {
      const prior = claim.existing
      if (prior.fingerprint !== print) {
        ctx.status = 422
        ctx.body = { data: null, error: { status: 422, name: 'IdempotencyKeyReused', message: 'This Idempotency-Key was already used for a different request.' } }
        return
      }
      if (prior.state !== 'completed') {
        ctx.status = 409
        ctx.body = { data: null, error: { status: 409, name: 'IdempotencyKeyInProgress', message: 'A request with this Idempotency-Key is still being processed. Retry shortly.' } }
        return
      }
      ctx.set('Idempotent-Replayed', 'true')
      ctx.status = prior.responseStatus
      ctx.body = prior.responseBody
      return
    }

    try {
      await next()
    }
    catch (err) {
      await service.release(claim.id).catch(() => {})
      throw err
    }

    const status = ctx.status
    const body = status < 500 && !NOT_STORED.has(status) ? storable(ctx.body) : undefined
    if (body === undefined) await service.release(claim.id)
    else await service.complete(claim.id, status, body)
  }
}
