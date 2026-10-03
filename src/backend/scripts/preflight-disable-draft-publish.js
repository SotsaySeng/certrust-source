#!/usr/bin/env node
/**
 * Read-only report of what turning off draft & publish would destroy.
 *
 * When a content type's draftAndPublish goes from true to false, Strapi
 * (core/migrations/draft-publish.js) runs
 *   DELETE FROM <table> WHERE published_at IS NULL
 * on the next boot. Link rows cascade with the deleted rows. That is
 * harmless for the draft "shadow" row every published document carries,
 * but it loses:
 *   1. documents that exist only as a draft (never published), and
 *   2. links from a surviving row (published, or a type without draft &
 *      publish) to a draft row, which is the same silent relation loss
 *      that republishing caused.
 *
 * It also checks pending scheduled issuances, which keep the achievement
 * as a plain numeric row id rather than a link.
 *
 * With --apply, links and scheduled issuances that point at a draft row
 * are moved to the published row of the same document, in one
 * transaction. Run it right before the deploy that turns draft & publish
 * off: Strapi deletes the drafts before the app's own database
 * migrations run, so this cannot be a migration.
 *
 *   node --env-file=.env.production scripts/preflight-disable-draft-publish.js           # report only
 *   node --env-file=.env.production scripts/preflight-disable-draft-publish.js --apply   # re-point, in one transaction
 *   DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/x.db node scripts/preflight-disable-draft-publish.js
 *
 * Prints names and document ids only, never emails.
 */
require('dotenv').config()
const path = require('path')
const knexFactory = require('knex')

const APPLY = process.argv.includes('--apply')

// Content types whose draftAndPublish is being turned off.
const TABLES = ['achievements', 'credentials', 'design_templates', 'endorsements', 'events', 'evidences', 'organizations', 'profiles', 'revocation_lists']

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
    connection: { filename: path.join(__dirname, '..', process.env.DATABASE_FILENAME || '.tmp/data.db'), readonly: !APPLY },
    useNullAsDefault: true,
  })
}

// Every *_lnk table with the table each of its id columns points at.
async function linkTables(trx, isPostgres) {
  const links = new Map()
  if (isPostgres) {
    const { rows } = await trx.raw(`
      select kcu.table_name as lnk, kcu.column_name as col, ccu.table_name as target
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY' and kcu.table_name like '%\\_lnk' and tc.table_schema = current_schema()`)
    for (const r of rows) {
      if (!links.has(r.lnk)) links.set(r.lnk, [])
      if (!links.get(r.lnk).some(c => c.col === r.col)) links.get(r.lnk).push({ col: r.col, target: r.target })
    }
  }
  else {
    const tables = await trx.raw(`select name from sqlite_master where type = 'table' and name like '%\\_lnk' escape '\\'`)
    for (const { name } of tables) {
      const fks = await trx.raw(`pragma foreign_key_list("${name}")`)
      const cols = []
      for (const fk of fks) if (!cols.some(c => c.col === fk.from)) cols.push({ col: fk.from, target: fk.table })
      links.set(name, cols)
    }
  }
  return links
}

async function main() {
  const db = connect()
  const isPostgres = db.client.config.client === 'pg'
  let problems = 0
  let fixed = 0
  try {
    await db.transaction(async (trx) => {
      if (isPostgres && !APPLY) await trx.raw('set transaction read only')

      // Published row id of the same document as a draft row, or null.
      const publishedTwin = async (table, draftId) => {
        const row = await trx(`${table} as p`)
          .join(`${table} as d`, 'd.document_id', 'p.document_id')
          .where('d.id', draftId)
          .whereNotNull('p.published_at')
          .select('p.id')
          .first()
        return row?.id ?? null
      }

      // Before the deploy every document has a draft row; after it there
      // should be none. Any left after the deploy were written by the old
      // container during the switch-over.
      const drafts = {}
      for (const table of TABLES) drafts[table] = Number((await trx(table).whereNull('published_at').count({ n: '*' }))[0].n)
      console.log('Draft rows:', JSON.stringify(drafts), '\n')

      console.log('1. Documents that exist only as a draft (deleted entirely)')
      for (const table of TABLES) {
        const rows = await trx(`${table} as d`)
          .whereNull('d.published_at')
          .whereNotExists(trx(`${table} as p`).whereRaw('p.document_id = d.document_id').whereNotNull('p.published_at'))
          .select('d.document_id', await trx.schema.hasColumn(table, 'name') ? 'd.name' : trx.raw('null as name'))
        problems += rows.length
        console.log(`   ${rows.length ? '!!' : 'ok'} ${table}: ${rows.length}`)
        for (const r of rows.slice(0, 10)) console.log(`        - ${r.name ?? '(no name)'}  ${r.document_id}`)
        if (rows.length > 10) console.log(`        ... and ${rows.length - 10} more`)
      }

      console.log('\n2. Links from a surviving row to a draft row (cascade-deleted)')
      for (const [lnk, cols] of await linkTables(trx, isPostgres)) {
        if (cols.length !== 2 || !cols.some(c => TABLES.includes(c.target))) continue
        // The link table is named after the side that owns the link
        // (credentials_recipient_lnk belongs to credentials). Links owned
        // by a deleted draft row are just its shadow and go with it.
        const from = cols.find(c => lnk.startsWith(`${c.target}_`))
        const to = cols.find(c => c !== from)
        if (!from || !to || from.target === to.target) {
          console.log(`   ?? ${lnk}: owner side unclear, not checked`)
          continue
        }
        if (!TABLES.includes(to.target)) continue
        const q = trx(`${lnk} as l`)
          .join(`${to.target} as t`, 't.id', `l.${to.col}`)
          .join(`${from.target} as f`, 'f.id', `l.${from.col}`)
          .whereNull('t.published_at')
          .select('l.id', `l.${from.col} as owner`, `l.${to.col} as target`)
        // The source row survives if it is published, or its type has no draft & publish.
        if (TABLES.includes(from.target)) q.whereNotNull('f.published_at')
        const rows = await q
        if (!rows.length) continue
        problems += rows.length
        let moved = 0
        let dropped = 0
        for (const r of rows) {
          const twin = await publishedTwin(to.target, r.target)
          if (!twin) continue
          if (APPLY) {
            const already = await trx(lnk).where({ [from.col]: r.owner, [to.col]: twin }).first()
            if (already) {
              await trx(lnk).where({ id: r.id }).delete()
              dropped++
            }
            else {
              await trx(lnk).where({ id: r.id }).update({ [to.col]: twin })
              moved++
            }
          }
          else moved++
        }
        fixed += moved + dropped
        const unfixable = rows.length - moved - dropped
        console.log(`   !! ${lnk}: ${rows.length} ${from.target} -> draft ${to.target}`
          + `   (${APPLY ? 'moved' : 'can move'} ${moved} to the published row${dropped ? `, dropped ${dropped} duplicates` : ''}${unfixable ? `, ${unfixable} have no published row` : ''})`)
      }

      console.log('\n3. Pending scheduled issuances whose achievement id is a draft row')
      if (await trx.schema.hasTable('scheduled_issuances')) {
        const pending = await trx('scheduled_issuances as s')
          .leftJoin('achievements as a', 'a.id', 's.achievement_id')
          .where('s.status', 'pending')
          .where(q => q.whereNull('a.id').orWhereNull('a.published_at'))
          .select('s.id', 's.document_id', 's.achievement_id', 'a.id as exists')
        for (const s of pending) {
          problems++
          const twin = s.exists ? await publishedTwin('achievements', s.achievement_id) : null
          if (twin) {
            if (APPLY) await trx('scheduled_issuances').where({ id: s.id }).update({ achievement_id: twin })
            fixed++
          }
          console.log(`   !! ${s.document_id}: achievement row ${s.achievement_id} ${twin ? `-> ${APPLY ? 'moved to' : 'can move to'} ${twin}` : s.exists ? '(no published row)' : '(row no longer exists, fix by hand)'}`)
        }
        if (!pending.length) console.log('   ok none')
      }

      console.log(problems
        ? `\nTotal at risk: ${problems}, ${APPLY ? 'fixed' : 'fixable with --apply'}: ${fixed}`
        : '\nNothing would be lost.')
    })
  }
  finally {
    await db.destroy()
  }
}

main().catch((err) => { console.error('preflight failed:', err.message); process.exit(1) })
