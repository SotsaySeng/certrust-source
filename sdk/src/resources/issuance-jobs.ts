import type { HttpClient } from '../http.js';
import type { IssuanceJob, CreateIssuanceJobInput, WriteOptions } from '../types.js';

export class IssuanceJobsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Issue to a large group (up to 2,000 recipients) in the background.
   * Returns at once with the queued job; use `wait()` or `get()` to follow it.
   * Needs an API key with the `issue` scope.
   *
   * @example
   * const job = await client.issuanceJobs.create({
   *   achievementId: 12,
   *   recipients: students.map(s => ({ email: s.email, name: s.name })),
   * }, { idempotencyKey: 'graduation-2026' });
   * const done = await client.issuanceJobs.wait(job.documentId);
   * console.log(`${done.succeeded} issued, ${done.skipped} skipped, ${done.failed} failed`);
   */
  async create(input: CreateIssuanceJobInput, opts: WriteOptions = {}): Promise<IssuanceJob> {
    const res = await this.http.post<{ data: IssuanceJob }>('/api/issuance-jobs', {
      data: { ...input, skipExisting: input.skipExisting ?? true },
    }, opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined);
    return res.data;
  }

  /** A job with its progress and per-recipient results so far. */
  async get(documentId: string): Promise<IssuanceJob> {
    return (await this.http.get<{ data: IssuanceJob }>(`/api/issuance-jobs/${encodeURIComponent(documentId)}`)).data;
  }

  /** The organization's 50 most recent jobs, without results. */
  async list(): Promise<IssuanceJob[]> {
    return (await this.http.get<{ data: IssuanceJob[] }>('/api/issuance-jobs')).data;
  }

  /** Stop a queued or running job. Credentials already issued stay issued. */
  async cancel(documentId: string): Promise<IssuanceJob> {
    return (await this.http.post<{ data: IssuanceJob }>(`/api/issuance-jobs/${encodeURIComponent(documentId)}/cancel`)).data;
  }

  /**
   * Poll until the job is completed, failed or cancelled, then return it.
   * Rejects if it is still running after `timeoutMs` (default 30 minutes).
   */
  async wait(documentId: string, opts: { intervalMs?: number; timeoutMs?: number; onProgress?: (job: IssuanceJob) => void } = {}): Promise<IssuanceJob> {
    const interval = opts.intervalMs ?? 3000;
    const deadline = Date.now() + (opts.timeoutMs ?? 30 * 60 * 1000);
    for (;;) {
      const job = await this.get(documentId);
      opts.onProgress?.(job);
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job;
      if (Date.now() > deadline) throw new Error(`Issuance job ${documentId} is still ${job.status} after the timeout`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}
