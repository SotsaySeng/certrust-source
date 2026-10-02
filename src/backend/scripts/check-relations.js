#!/usr/bin/env node
/**
 * Read-only report of relations lost to Strapi republishing.
 *
 * Until the relations were made one-way, publishing a record (an admin
 * "Publish", a profile or achievement edit) deleted every two-way link
 * that pointed at it from the other side. This counts what is missing and
 * whether it can be restored from data the bug never touched.
 *
 *   node --env-file=.env.production scripts/check-relations.js
 *   DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/x.db node scripts/check-relations.js
 *
 * Runs inside a READ ONLY transaction (Postgres) and prints names and
 * document ids only, never emails.
 */
require('dotenv').config()
const path = require('path')
const knexFactory = require('knex')

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
    connection: { filename: path.join(__dirname, '..', process.env.DATABASE_FILENAME || '.tmp/data.db'), readonly: true },
    useNullAsDefault: true,
  })
}

// Published rows that should have a link but have none.
const CHECKS = [
  { label: 'Issuer profiles with no organization', restorable: 'yes where [org] is shown: the org\'s billing email is this account\'s email', sql: `
      select p.document_id, p.name,
        (select o.name from organizations o
          join profiles_owner_lnk po on po.profile_id = p.id
          join up_users u on u.id = po.user_id
          where o.published_at is not null and lower(o.billing_email) = lower(u.email)
          limit 1) as detail
      from profiles p
      where p.published_at is not null and p.profile_type in ('Issuer', 'Both')
        and not exists (select 1 from profiles_organization_lnk l where l.profile_id = p.id)` },
  { label: 'Organization designs now shown to everyone as platform templates', restorable: 'yes: from the design creator', sql: `
      select t.document_id, t.name, cp.name as detail from design_templates t
      join design_templates_creator_lnk c on c.design_template_id = t.id
      join profiles cp on cp.id = c.profile_id
      where t.published_at is not null
        and not exists (select 1 from design_templates_organization_lnk l where l.design_template_id = t.id)` },
  { label: 'Events that lost their organization', restorable: 'yes: from the event creator', sql: `
      select e.document_id, e.name, null as detail from events e
      where e.published_at is not null
        and not exists (select 1 from events_organization_lnk l where l.event_id = e.id)` },
  { label: 'Achievements that lost their creator', restorable: 'check: from the audit log', sql: `
      select a.document_id, a.name, null as detail from achievements a
      where a.published_at is not null
        and not exists (select 1 from achievements_creator_lnk l where l.achievement_id = a.id)` },
  { label: 'Credentials that lost their achievement', restorable: 'check: name + issuer, audit log', sql: `
      select c.document_id, c.name, c.credential_id as detail from credentials c
      where c.published_at is not null
        and not exists (select 1 from credentials_achievement_lnk l where l.credential_id = c.id)` },
  { label: 'Credentials that lost their issuer', restorable: 'check: audit log', sql: `
      select c.document_id, c.name, c.credential_id as detail from credentials c
      where c.published_at is not null
        and not exists (select 1 from credentials_issuer_lnk l where l.credential_id = c.id)` },
  { label: 'Credentials that lost their recipient', restorable: 'check: audit log', sql: `
      select c.document_id, c.name, c.credential_id as detail from credentials c
      where c.published_at is not null
        and not exists (select 1 from credentials_recipient_lnk l where l.credential_id = c.id)` },
  { label: 'Revocation lists that lost their issuer', restorable: 'check', sql: `
      select r.document_id, null as name, null as detail from revocation_lists r
      where r.published_at is not null
        and not exists (select 1 from revocation_lists_issuer_lnk l where l.revocation_list_id = r.id)` },
  { label: 'Evidence that lost its credential', restorable: 'check', sql: `
      select e.document_id, e.name, null as detail from evidences e
      where e.published_at is not null
        and not exists (select 1 from evidences_credential_lnk l where l.evidence_id = e.id)` },
]

async function main() {
  const db = connect()
  try {
    await db.transaction(async (trx) => {
      if (db.client.config.client === 'pg') await trx.raw('set transaction read only')
      const totals = {}
      for (const t of ['organizations', 'profiles', 'achievements', 'credentials', 'design_templates', 'events']) {
        totals[t] = Number((await trx(t).whereNotNull('published_at').count({ n: '*' }))[0].n)
      }
      console.log('Published records:', JSON.stringify(totals))
      let problems = 0
      for (const check of CHECKS) {
        const rows = (await trx.raw(check.sql)).rows ?? (await trx.raw(check.sql))
        problems += rows.length
        console.log(`\n${rows.length ? '!!' : 'ok'} ${check.label}: ${rows.length}${rows.length ? `   (restorable: ${check.restorable})` : ''}`)
        for (const r of rows.slice(0, 15)) console.log(`     - ${r.name ?? '(no name)'}${r.detail ? `  [${r.detail}]` : ''}  ${r.document_id}`)
        if (rows.length > 15) console.log(`     ... and ${rows.length - 15} more`)
      }
      console.log(problems ? `\nTotal missing links: ${problems}` : '\nNo missing links found.')
    })
  } finally {
    await db.destroy()
  }
}

main().catch((err) => { console.error('check-relations failed:', err.message); process.exit(1) })
