import jobServiceFactory from '../issuance-job'
import * as batch from '../../../../utils/batch-issue'

jest.mock('../../../../utils/batch-issue', () => {
  const actual = jest.requireActual('../../../../utils/batch-issue')
  return { ...actual, prepareBatchIssue: jest.fn(), createRecipientIssuer: jest.fn() }
})

const prepare = batch.prepareBatchIssue as jest.Mock
const createIssuer = batch.createRecipientIssuer as jest.Mock

/** One-row fake of strapi.db.query(UID) - enough for run(). */
function makeStrapi(job: any) {
  const updates: any[] = []
  const query = {
    findOne: async ({ where }: any) => (where.id === job.id ? { status: job.status } : null),
    update: async ({ data }: any) => { Object.assign(job, data); updates.push({ ...data }) },
    updateMany: async ({ where, data }: any) => { if (!where.status || where.status === job.status) Object.assign(job, data) },
  }
  return { strapi: { db: { query: () => query }, log: { error: jest.fn() } }, updates }
}

const recipients = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `p${i}@x.test` }))

function makeJob(overrides: any = {}) {
  return { id: 1, documentId: 'job1', status: 'queued', achievementId: 5, options: { skipExisting: false }, recipients: recipients(45), results: [], processed: 0, ...overrides }
}

beforeEach(() => {
  prepare.mockReset().mockResolvedValue({ achievement: { name: 'A' } })
  createIssuer.mockReset().mockImplementation(() => async (r: any) => (
    r.email.startsWith('bad')
      ? { success: false, recipient: r.email, error: 'nope' }
      : { success: true, recipient: r.email, data: { credential: { id: 9, credentialId: `urn:${r.email}` } } }
  ))
})

describe('issuance job runner', () => {
  it('issues every recipient in chunks, saving progress after each, then completes', async () => {
    const job = makeJob({ recipients: [...recipients(44), { email: 'bad@x.test' }] })
    const { strapi, updates } = makeStrapi(job)
    await jobServiceFactory({ strapi }).run(job)

    expect(updates.filter(u => u.processed !== undefined).map(u => u.processed)).toEqual([20, 40, 45])
    expect(job).toMatchObject({ status: 'completed', processed: 45, succeeded: 44, failed: 1, skipped: 0, recipients: null })
    expect(job.results).toHaveLength(45)
    expect(job.results[0]).toEqual({ recipient: 'p0@x.test', success: true, id: 9, credentialId: 'urn:p0@x.test' })
    expect(job.results[44]).toEqual({ recipient: 'bad@x.test', success: false, error: 'nope' })
    expect(job.finishedAt).toBeInstanceOf(Date)
  })

  it('resumes an interrupted job where it stopped, skipping existing holders for the first chunk only', async () => {
    const done = recipients(20).map(r => ({ recipient: r.email, success: true }))
    const job = makeJob({ status: 'running', processed: 20, succeeded: 20, results: done })
    const { strapi } = makeStrapi(job)
    await jobServiceFactory({ strapi }).run(job)

    expect(createIssuer.mock.calls.map(c => c[1].skipExisting)).toEqual([true, false])
    expect(job).toMatchObject({ status: 'completed', processed: 45, succeeded: 45 })
    expect(job.results).toHaveLength(45)
    // Recipients handled before the restart count as seen for de-duplication.
    expect(createIssuer.mock.calls[0][1].seen.has('p0@x.test')).toBe(true)
  })

  it('stops at the next chunk when cancelled, and stays cancelled', async () => {
    const job = makeJob()
    const { strapi } = makeStrapi(job)
    createIssuer.mockImplementationOnce(() => async (r: any) => {
      job.status = 'cancelled' // cancelled while the first chunk is running
      return { success: true, recipient: r.email, data: {} }
    })
    await jobServiceFactory({ strapi }).run(job)

    expect(job.status).toBe('cancelled')
    expect(job.processed).toBe(20)
    expect(createIssuer).toHaveBeenCalledTimes(1)
  })

  it('fails the job, without issuing, when the achievement can no longer be used', async () => {
    prepare.mockRejectedValueOnce(new Error('Achievement not found'))
    const job = makeJob()
    const { strapi } = makeStrapi(job)
    await jobServiceFactory({ strapi }).run(job)

    expect(job).toMatchObject({ status: 'failed', error: 'Achievement not found', recipients: null })
    expect(createIssuer).not.toHaveBeenCalled()
  })
})
