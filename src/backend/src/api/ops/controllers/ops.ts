/**
 * Ops controller - see routes/ops.ts.
 */

import path from 'path'
import { timingSafeEqual } from 'crypto'

const LABELS = new Set(['daily', 'predeploy', 'manual'])

export function tokenMatches(expected: string | undefined, provided: unknown): boolean {
  if (!expected || typeof provided !== 'string' || provided.length === 0) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(provided)
  return a.length === b.length && timingSafeEqual(a, b)
}

let running: Promise<unknown> | null = null

export default ({ strapi }: { strapi: any }) => ({
  async backup(ctx: any) {
    const expected = process.env.OPS_TOKEN
    if (!expected) return ctx.notFound()
    if (!tokenMatches(expected, ctx.request.headers['x-ops-token'])) return ctx.unauthorized()

    if (running) {
      ctx.status = 409
      ctx.body = { started: false, reason: 'A backup is already running.' }
      return
    }

    const requested = ctx.request.body?.label
    const label = LABELS.has(requested) ? requested : 'daily'

    // scripts/ is plain JS next to src/ (not compiled into dist/), so
    // resolve it from the app root in both `develop` and `start`.
    const { offsiteBackup } = require(path.join(strapi.dirs.app.root, 'scripts', 'backup-offsite.js'))

    // Respond immediately; the cron trigger does not need to hold a
    // request open for the length of a dump + upload.
    running = offsiteBackup({ label })
      .then((result: any) => {
        strapi.log.info(
          `[ops.backup] ${label} backup done: ${result.dbKeys.join(', ')}; uploads ${result.uploads.copied} copied, ${result.uploads.unchanged} unchanged.`
        )
      })
      .catch((error: any) => {
        strapi.log.error(`[ops.backup] ${label} backup FAILED: ${error?.message || error}`)
      })
      .finally(() => {
        running = null
      })

    ctx.status = 202
    ctx.body = { started: true, label }
  },
})
