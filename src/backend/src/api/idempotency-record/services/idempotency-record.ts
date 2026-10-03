/**
 * Storage for Idempotency-Key requests (see middlewares/idempotency.ts).
 *
 * Claims for one lookup are serialized in-process, so of two identical
 * requests arriving together only one gets to run; the other finds its
 * record and is told to wait. Strapi's `unique` is not a database
 * constraint, and the backend runs as a single instance - the same
 * approach as revocation-list's listsInFlight.
 */
const UID = 'api::idempotency-record.idempotency-record'
export const RETENTION_MS = 24 * 60 * 60 * 1000

const claimsInFlight = new Map<string, Promise<unknown>>()

export default ({ strapi }: { strapi: any }) => ({
  /**
   * Claim a key. Returns the new record's id, or the record already there
   * (an expired one is replaced).
   */
  async claim(lookup: string, fingerprint: string): Promise<{ id: number } | { existing: any }> {
    while (claimsInFlight.has(lookup)) await claimsInFlight.get(lookup)!.catch(() => {})
    const claiming = (async () => {
      const existing = await strapi.db.query(UID).findOne({ where: { lookup } })
      if (existing && new Date(existing.expiresAt).getTime() > Date.now()) return { existing }
      if (existing) await strapi.db.query(UID).delete({ where: { id: existing.id } })
      const row = await strapi.db.query(UID).create({
        data: { lookup, fingerprint, state: 'processing', expiresAt: new Date(Date.now() + RETENTION_MS) },
      })
      return { id: row.id }
    })()
    claimsInFlight.set(lookup, claiming)
    try {
      return await claiming
    }
    finally {
      claimsInFlight.delete(lookup)
    }
  },

  async complete(id: number, status: number, body: unknown) {
    await strapi.db.query(UID).update({
      where: { id },
      data: { state: 'completed', responseStatus: status, responseBody: body ?? null },
    })
  },

  /** Forget a claim so the same key can be retried (failed or unstorable responses). */
  async release(id: number) {
    await strapi.db.query(UID).delete({ where: { id } })
  },

  async purgeExpired(): Promise<number> {
    const { count } = await strapi.db.query(UID).deleteMany({ where: { expiresAt: { $lt: new Date() } } })
    return count ?? 0
  },
})
