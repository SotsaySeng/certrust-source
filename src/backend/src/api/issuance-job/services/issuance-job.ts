/**
 * Background issuance jobs: a large group of recipients issued without
 * holding a request open.
 *
 * POST /api/issuance-jobs stores the job and returns at once; one worker
 * loop in this process then issues the recipients a chunk at a time and
 * saves progress after every chunk, so a client can poll for progress and
 * a restart (every deploy restarts the container) picks up where it
 * stopped. The backend runs as a single instance, so one in-process loop
 * is the whole queue - the same assumption as revocation-list and
 * idempotency-record.
 *
 * A job interrupted mid-chunk may have issued some of that chunk before
 * its progress was saved, so the first chunk after a resume always skips
 * recipients who already hold the credential.
 *
 * Recipients are cleared from the record when the job ends; per-recipient
 * results are kept for RETENTION_DAYS.
 */
import { errors } from '@strapi/utils'
import {
  BATCH_ISSUE_CONCURRENCY,
  createRecipientIssuer,
  mapWithConcurrency,
  prepareBatchIssue,
  type RecipientResult,
} from '../../../utils/batch-issue'
import { requestContextStorage } from '../../../utils/request-context'

const UID = 'api::issuance-job.issuance-job'
export const MAX_JOB_RECIPIENTS = 2000
const MAX_ACTIVE_JOBS_PER_ORGANIZATION = 3
const CHUNK_SIZE = 20
const RETENTION_DAYS = 30
const ACTIVE = ['queued', 'running']

let loopRunning = false

function compactResult(r: RecipientResult) {
  if ('error' in r) return { recipient: r.recipient, success: false, error: r.error }
  if ('skipped' in r) {
    return { recipient: r.recipient, success: true, skipped: true, note: r.note, ...(r.existing ? { id: r.existing.id, credentialId: r.existing.credentialId } : {}) }
  }
  return { recipient: r.recipient, success: true, id: r.data?.credential?.id ?? null, credentialId: r.data?.credential?.credentialId ?? null }
}

function publicView(row: any, withResults = false) {
  return {
    documentId: row.documentId,
    status: row.status,
    achievementId: row.achievementId,
    achievementName: row.achievementName ?? null,
    total: row.total ?? 0,
    processed: row.processed ?? 0,
    succeeded: row.succeeded ?? 0,
    skipped: row.skipped ?? 0,
    failed: row.failed ?? 0,
    error: row.error ?? null,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
    ...(withResults ? { results: row.results ?? [] } : {}),
  }
}

export default ({ strapi }: { strapi: any }) => ({
  async create(input: { organizationId: number, userId: number, apiKey?: any, data: any }) {
    const { data } = input
    const recipients = data?.recipients
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new errors.ValidationError('Missing or invalid recipients array')
    }
    if (recipients.length > MAX_JOB_RECIPIENTS) {
      throw new errors.ValidationError(`A job can have up to ${MAX_JOB_RECIPIENTS} recipients. Split larger groups into several jobs.`)
    }
    const missingEmail = recipients.findIndex(r => !r || typeof r.email !== 'string' || !r.email.trim())
    if (missingEmail !== -1) {
      throw new errors.ValidationError(`Recipient ${missingEmail + 1} has no email.`)
    }
    const active = await strapi.db.query(UID).count({
      where: { organization: { id: input.organizationId }, status: { $in: ACTIVE } },
    })
    if (active >= MAX_ACTIVE_JOBS_PER_ORGANIZATION) {
      throw new errors.RateLimitError(`An organization can have ${MAX_ACTIVE_JOBS_PER_ORGANIZATION} jobs in progress. Wait for one to finish.`)
    }

    // Fails here, before anything is queued, if the achievement, design or
    // event can't be used (BatchIssueError - the controller maps it).
    const batch = await prepareBatchIssue(data)

    const created = await strapi.documents(UID).create({
      data: {
        status: 'queued',
        achievementId: data.achievementId,
        achievementName: batch.achievement.name,
        options: {
          skipExisting: data.skipExisting === true,
          eventId: data.eventId ?? null,
          evidence: data.evidence ?? [],
          certificateDesignId: data.certificateDesignId,
          badgeDesignId: data.badgeDesignId,
          designTemplateId: data.designTemplateId,
        },
        recipients,
        results: [],
        total: recipients.length,
        apiKey: input.apiKey ?? null,
        organization: input.organizationId,
        createdByUser: input.userId,
      },
    })
    this.kick()
    return publicView(created)
  },

  async list(organizationId: number) {
    const rows: any[] = await strapi.db.query(UID).findMany({
      where: { organization: { id: organizationId } },
      select: ['documentId', 'status', 'achievementId', 'achievementName', 'total', 'processed', 'succeeded', 'skipped', 'failed', 'error', 'createdAt', 'startedAt', 'finishedAt'],
      orderBy: { id: 'desc' },
      limit: 50,
    })
    return rows.map(r => publicView(r))
  },

  async get(organizationId: number, documentId: string) {
    const row = await strapi.db.query(UID).findOne({ where: { documentId, organization: { id: organizationId } } })
    return row ? publicView(row, true) : null
  },

  /** Stop a queued or running job. Credentials already issued stay issued. */
  async cancel(organizationId: number, documentId: string) {
    const row = await strapi.db.query(UID).findOne({ where: { documentId, organization: { id: organizationId } } })
    if (!row) return null
    if (ACTIVE.includes(row.status)) {
      await strapi.db.query(UID).update({
        where: { id: row.id },
        data: { status: 'cancelled', finishedAt: new Date(), recipients: null },
      })
    }
    return this.get(organizationId, documentId)
  },

  /** Start the worker loop if it isn't running. Safe to call any time. */
  kick() {
    if (loopRunning) return
    loopRunning = true
    setImmediate(async () => {
      try {
        for (;;) {
          const job = await strapi.db.query(UID).findOne({
            where: { status: { $in: ACTIVE } },
            populate: { createdByUser: { select: ['id'] } },
            orderBy: { id: 'asc' },
          })
          if (!job) break
          await this.run(job)
        }
      }
      catch (err: any) {
        strapi.log.error(`[issuance-job] Worker stopped: ${err.message}`)
      }
      finally {
        loopRunning = false
      }
    })
  },

  async run(job: any) {
    const resumed = job.status === 'running'
    const update = (data: Record<string, unknown>) => strapi.db.query(UID).update({ where: { id: job.id }, data })
    await update({ status: 'running', startedAt: job.startedAt ?? new Date() })

    const options = job.options ?? {}
    let batch
    try {
      batch = await prepareBatchIssue({ achievementId: job.achievementId, ...options })
    }
    catch (err: any) {
      await update({ status: 'failed', error: err.message, finishedAt: new Date(), recipients: null })
      return
    }

    const recipients: any[] = Array.isArray(job.recipients) ? job.recipients : []
    const results: any[] = Array.isArray(job.results) ? job.results : []
    const seen = new Set<string>(results.map(r => String(r.recipient ?? '').trim().toLowerCase()).filter(Boolean))
    const counts = { succeeded: job.succeeded ?? 0, skipped: job.skipped ?? 0, failed: job.failed ?? 0 }
    const start = Math.min(job.processed ?? 0, recipients.length)
    // Audit entries made by the job carry the API key that created it.
    const context = { requestId: `job-${job.documentId}`, apiKey: job.apiKey ?? undefined }

    for (let i = start; i < recipients.length; i += CHUNK_SIZE) {
      const current = await strapi.db.query(UID).findOne({ where: { id: job.id }, select: ['status'] })
      if (!current || current.status !== 'running') return // cancelled (or deleted) meanwhile

      const issueOne = createRecipientIssuer(batch, {
        skipExisting: options.skipExisting === true || (resumed && i === start),
        evidence: options.evidence ?? [],
        actorUserId: job.createdByUser?.id,
        seen,
        logPrefix: 'issuance-job',
      })
      const chunk = recipients.slice(i, i + CHUNK_SIZE)
      const chunkResults = await requestContextStorage.run(context, () => mapWithConcurrency(chunk, BATCH_ISSUE_CONCURRENCY, issueOne))
      for (const r of chunkResults) {
        if ('error' in r) counts.failed++
        else if ('skipped' in r) counts.skipped++
        else counts.succeeded++
        results.push(compactResult(r))
      }
      await update({ processed: i + chunk.length, results, ...counts })
    }

    // Only finish a job that is still running: a cancel during the last
    // chunk must stay cancelled.
    await strapi.db.query(UID).updateMany({
      where: { id: job.id, status: 'running' },
      data: { status: 'completed', finishedAt: new Date(), recipients: null },
    })
  },

  async purgeOld(): Promise<number> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const { count } = await strapi.db.query(UID).deleteMany({ where: { finishedAt: { $lt: cutoff } } })
    return count ?? 0
  },
})
