#!/usr/bin/env node
/**
 * Repairs revocation status-list indexes shared by more than one credential.
 *
 * Until the batch-issuance fix, every recipient in a CSV batch read the
 * list's nextIndex at the same time, so credentials issued together often
 * got the same statusListIndex. Revoking one of them would then make
 * verification report the others as revoked too.
 *
 * For each status list this keeps the oldest credential on each index,
 * moves the others to fresh indexes past the end of the list, rebuilds the
 * list's revoked indexes from the credentials' own `revoked` flag (which is
 * authoritative), and sets nextIndex past the highest index in use. The
 * index is not part of the signed proof, so no credential needs re-signing.
 *
 *   node --env-file=.env.production scripts/repair-status-lists.js           # report only
 *   node --env-file=.env.production scripts/repair-status-lists.js --apply   # write, in one transaction
 *   DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/x.db node scripts/repair-status-lists.js
 *
 * Prints counts and document ids only, never names or emails.
 */
require('dotenv').config()
const path = require('path')
const knexFactory = require('knex')

const APPLY = process.argv.includes('--apply')

function connect() {
  const client = process.env.DATABASE_CLIENT || 'sqlite'
  if (client === 'postgres') {
    return knexFactory({
      client: 'pg',
      connection: process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false } }
        : {
            host: process.env.DATABASE_HOST, port: Number(process.env.DATABASE_PORT || 5432), database: process.env.DATABASE_NAME,
            user: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
          },
      pool: { min: 1, max: 1 },
    })
  }
  return knexFactory({
    client: 'better-sqlite3',
    connection: { filename: path.join(__dirname, '..', process.env.DATABASE_FILENAME || '.tmp/data.db') },
    useNullAsDefault: true,
  })
}

async function main() {
  const knex = connect()
  const isPostgres = knex.client.config.client === 'pg'
  let summary
  try {
    summary = await knex.transaction(async (trx) => {
      if (isPostgres && !APPLY) await trx.raw('SET TRANSACTION READ ONLY')

      // One row per credential document and the list document it sits in.
      // Draft and published rows of a credential share its index, so the
      // credential document is the unit.
      const creds = await trx('credentials as c')
        .join('credentials_status_list_lnk as l', 'l.credential_id', 'c.id')
        .join('revocation_lists as rl', 'rl.id', 'l.revocation_list_id')
        .whereNotNull('c.published_at')
        .whereNotNull('c.status_list_index')
        .select('c.document_id as credential', 'c.id as id', 'c.status_list_index as idx', 'c.revoked as revoked', 'rl.document_id as list')
        .orderBy('c.id')

      const byList = new Map()
      for (const c of creds) {
        if (!byList.has(c.list)) byList.set(c.list, new Map())
        const docs = byList.get(c.list)
        if (!docs.has(c.credential)) docs.set(c.credential, c) // oldest published row first
      }

      const report = { lists: byList.size, credentials: 0, moved: 0, listsChanged: [] }
      for (const [list, docs] of byList) {
        const holders = new Map()
        const moves = []
        let max = -1
        for (const c of docs.values()) {
          report.credentials++
          const idx = Number(c.idx)
          max = Math.max(max, idx)
          if (holders.has(idx)) moves.push(c)
          else holders.set(idx, c)
        }
        const listRows = await trx('revocation_lists').where({ document_id: list }).select('id', 'next_index', 'encoded_list')
        let next = Math.max(max + 1, ...listRows.map(r => Number(r.next_index) || 0))
        for (const c of moves) {
          c.idx = next++
          if (APPLY) {
            await trx('credentials').where({ document_id: c.credential }).update({ status_list_index: c.idx })
          }
        }
        const revoked = [...docs.values()].filter(c => c.revoked === true || c.revoked === 1).map(c => Number(c.idx)).sort((a, b) => a - b).join(',')
        const listDrift = listRows.some(r => (Number(r.next_index) || 0) !== next || (r.encoded_list || '') !== revoked)
        if (moves.length || listDrift) {
          report.moved += moves.length
          report.listsChanged.push({ list, credentials: docs.size, moved: moves.length, nextIndex: next, revoked: revoked || '-' })
          if (APPLY) {
            await trx('revocation_lists').where({ document_id: list }).update({ next_index: next, encoded_list: revoked })
          }
        }
      }
      return report
    })
  }
  finally {
    await knex.destroy()
  }

  console.log(`${APPLY ? 'APPLIED' : 'REPORT ONLY (pass --apply to write)'}`)
  console.log(`status lists: ${summary.lists}, credentials checked: ${summary.credentials}, credentials given a new index: ${summary.moved}`)
  if (summary.listsChanged.length) console.table(summary.listsChanged)
  else console.log('Nothing to repair.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
