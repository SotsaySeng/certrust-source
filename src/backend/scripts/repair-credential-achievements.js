#!/usr/bin/env node
/**
 * Re-links credentials that lost their achievement.
 *
 * Republishing an achievement (before c97f926) or issuing with a stale
 * achievement id (before f5d38cd) left some credentials with no
 * achievement link. Verification needs the achievement to build the
 * Open Badge, so those credentials show "Credential not found".
 *
 * For each such credential this looks for the one published achievement
 * that has the credential's name and was created inside the issuer's
 * organization (or by the issuing profile itself). The audit log's
 * `credential.issue` entry is used as a cross-check when its achievement
 * row still exists. A credential is re-linked only when there is exactly
 * one candidate and the audit log does not contradict it; anything else
 * is reported for a manual decision. When the achievement was renamed
 * after issuance and the organization has only one achievement, that one
 * is used and the report says so.
 *
 *   node --env-file=.env.production scripts/repair-credential-achievements.js           # report only
 *   node --env-file=.env.production scripts/repair-credential-achievements.js --apply   # write, in one transaction
 *   DATABASE_CLIENT=sqlite DATABASE_FILENAME=.tmp/x.db node scripts/repair-credential-achievements.js
 *
 * Prints names and document ids only, never emails.
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

const norm = s => String(s ?? '').trim().toLowerCase()

async function orgOfProfile(trx, profileId) {
  const row = await trx('profiles_organization_lnk as l')
    .join('organizations as o', 'o.id', 'l.organization_id')
    .where('l.profile_id', profileId)
    .select('o.document_id')
    .first()
  return row?.document_id ?? null
}

async function main() {
  const knex = connect()
  const isPostgres = knex.client.config.client === 'pg'
  let report
  try {
    report = await knex.transaction(async (trx) => {
      if (isPostgres && !APPLY) await trx.raw('SET TRANSACTION READ ONLY')

      // Credential documents whose published row has no achievement.
      const orphans = await trx('credentials as c')
        .whereNotNull('c.published_at')
        .whereNotExists(trx('credentials_achievement_lnk as l').whereRaw('l.credential_id = c.id'))
        .select('c.id', 'c.document_id', 'c.name')

      // Published achievements with the profile and organization that created them.
      const achievements = []
      for (const a of await trx('achievements as a')
        .leftJoin('achievements_creator_lnk as cl', 'cl.achievement_id', 'a.id')
        .whereNotNull('a.published_at')
        .select('a.id', 'a.document_id', 'a.name', 'cl.profile_id as creator')) {
        achievements.push({ ...a, org: a.creator ? await orgOfProfile(trx, a.creator) : null })
      }

      const results = []
      for (const cred of orphans) {
        const rows = await trx('credentials').where({ document_id: cred.document_id }).select('id')
        const rowIds = rows.map(r => r.id)

        const issuer = await trx('credentials_issuer_lnk').whereIn('credential_id', rowIds).select('profile_id').first()
        const issuerOrg = issuer ? await orgOfProfile(trx, issuer.profile_id) : null

        const inIssuerOrg = achievements.filter(a => (issuerOrg && a.org === issuerOrg) || (issuer && a.creator === issuer.profile_id))
        let candidates = inIssuerOrg.filter(a => norm(a.name) === norm(cred.name))
        let match = 'name'
        // The credential keeps the achievement's name at issue time, so a
        // renamed achievement no longer matches. An organization with a
        // single achievement can only have issued that one.
        if (!candidates.length && new Set(inIssuerOrg.map(a => a.document_id)).size === 1) {
          candidates = inIssuerOrg
          match = 'only achievement in org'
        }
        const candidateDocs = [...new Set(candidates.map(a => a.document_id))]

        // Cross-check with the issue-time audit entry when its achievement row still exists.
        let audit = 'no entry'
        let auditDoc = null
        const entries = await trx('audit_log_entries')
          .where({ action: 'credential.issue', entity_type: 'credential' })
          .whereIn('entity_id', rowIds.map(String))
          .select('metadata')
        for (const e of entries) {
          const meta = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata
          if (!meta?.achievementId) continue
          const row = await trx('achievements').where({ id: meta.achievementId }).select('document_id').first()
          auditDoc = row?.document_id ?? null
          audit = auditDoc ?? `row ${meta.achievementId} gone`
        }

        let action
        if (candidateDocs.length !== 1) action = `manual: ${candidateDocs.length} candidates`
        else if (auditDoc && auditDoc !== candidateDocs[0]) action = `manual: audit log points at ${auditDoc}`
        else action = `relink (${match})`

        const target = action.startsWith('relink') ? candidates.find(a => a.document_id === candidateDocs[0]) : null
        if (APPLY && target) {
          for (const id of rowIds) {
            const has = await trx('credentials_achievement_lnk').where({ credential_id: id }).first()
            if (!has) await trx('credentials_achievement_lnk').insert({ credential_id: id, achievement_id: target.id })
          }
        }
        results.push({ credential: cred.document_id, name: cred.name, achievement: target?.document_id ?? '-', audit, action })
      }
      return results
    })
  }
  finally {
    await knex.destroy()
  }

  console.log(APPLY ? 'APPLIED' : 'REPORT ONLY (pass --apply to write)')
  if (report.length) console.table(report)
  else console.log('No credentials are missing their achievement.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
