import type { HttpClient } from '../http.js';
import type {
  Credential,
  IssueCredentialInput,
  ListCredentialsOptions,
  ProfileExport,
  StrapiListResponse,
  StrapiSingleResponse,
  VerifyResult,
  WriteOptions,
  BatchIssueResult,
} from '../types.js';

export class CredentialsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List credentials. Without a token returns only publicly visible records;
   * with an issuer/admin token returns all matching credentials.
   *
   * @example
   * const { data, meta } = await client.credentials.list({ page: 1, pageSize: 20 });
   */
  list(opts: ListCredentialsOptions = {}): Promise<StrapiListResponse<Credential>> {
    const qs = new URLSearchParams();
    if (opts.page) qs.set('pagination[page]', String(opts.page));
    if (opts.pageSize) qs.set('pagination[pageSize]', String(opts.pageSize));
    if (opts.status) qs.set('filters[status][$eq]', opts.status);
    const query = qs.toString() ? `?${qs}` : '';
    return this.http.get<StrapiListResponse<Credential>>(`/api/credentials${query}`);
  }

  /**
   * Retrieve a single credential by numeric id or full URN
   * (e.g. `"urn:uuid:…"`).
   *
   * @example
   * const { data } = await client.credentials.get('urn:uuid:abc123');
   */
  get(id: number | string): Promise<StrapiSingleResponse<Credential>> {
    return this.http.get<StrapiSingleResponse<Credential>>(
      `/api/credentials/${encodeURIComponent(String(id))}`,
    );
  }

  /**
   * Issue a credential for a recipient against an existing achievement.
   * Needs an API key with the `issue` scope (or a signed-in issuer).
   *
   * @example
   * const result = await client.credentials.issue({
   *   achievementId: 1,
   *   recipientEmail: 'alice@example.com',
   *   recipientName: 'Alice Smith',
   * }, { idempotencyKey: 'student-1042-course-7' });
   */
  issue(input: IssueCredentialInput, opts: WriteOptions = {}): Promise<{ credential: Credential }> {
    return this.http.post<{ credential: Credential }>('/api/credentials/issue', {
      data: {
        achievementId: input.achievementId,
        recipientId: 0,
        recipient: { email: input.recipientEmail, name: input.recipientName },
        expirationDate: input.expirationDate,
        evidence: input.evidence,
        customFields: input.customFields,
        eventId: input.eventId,
      },
    }, idempotencyHeader(opts));
  }

  /**
   * Verify a credential by id or URN. Works without authentication.
   *
   * @example
   * const result = await client.credentials.verify('urn:uuid:abc123');
   * if (result.verified) console.log('✓ Valid');
   */
  verify(id: number | string): Promise<VerifyResult> {
    return this.http.get<VerifyResult>(
      `/api/credentials/${encodeURIComponent(String(id))}/verify`,
    );
  }

  /**
   * Revoke a credential. Requires an issuer or admin token.
   *
   * @example
   * await client.credentials.revoke('urn:uuid:abc123', 'Duplicate issuance');
   */
  revoke(id: number | string, reason?: string, opts: WriteOptions = {}): Promise<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `/api/credentials/${encodeURIComponent(String(id))}/revoke`,
      { reason },
      idempotencyHeader(opts),
    );
  }

  /**
   * Download the PDF/SVG certificate for a credential.
   * Returns a `Response` so callers can stream or save the file.
   *
   * @example
   * const res = await client.credentials.certificate('urn:uuid:abc123');
   * const svg = await res.text();
   */
  async certificate(id: number | string): Promise<Response> {
    const url = `${this.http.baseUrl}/api/credentials/${encodeURIComponent(String(id))}/certificate`;
    const headers: Record<string, string> = {};
    // Access the protected token via the http client helper
    const token = (this.http as any).token as string | undefined;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { headers });
  }

  /**
   * Export a credential as a JSON-LD Verifiable Credential document.
   *
   * @example
   * const vc = await client.credentials.export('urn:uuid:abc123');
   */
  export(id: number | string): Promise<Record<string, unknown>> {
    return this.http.get<Record<string, unknown>>(
      `/api/credentials/${encodeURIComponent(String(id))}/export`,
    );
  }

  /**
   * Import a previously exported credential (JSON-LD VC).
   * Requires authentication.
   *
   * @example
   * await client.credentials.import(vcDocument);
   */
  import(vc: Record<string, unknown>): Promise<{ credential: Credential }> {
    return this.http.post<{ credential: Credential }>('/api/credentials/import', { vc });
  }

  /**
   * Batch-issue credentials to multiple recipients in a single request.
   * Each recipient gets its own result. Recipients who already hold this
   * credential are skipped, so re-running a sync doesn't issue twice; pass
   * `skipExisting: false` to issue to them again.
   *
   * @example
   * const { results } = await client.credentials.batchIssue({
   *   achievementId: 1,
   *   recipients: [
   *     { email: 'a@example.com', name: 'Alice' },
   *     { email: 'b@example.com', name: 'Bob' },
   *   ],
   * }, { idempotencyKey: 'graduation-2026-batch-3' });
   */
  batchIssue(input: {
    achievementId: number;
    recipients: Array<{ email: string; name?: string; expirationDate?: string; customFields?: Record<string, string | number> }>;
    eventId?: string;
    skipExisting?: boolean;
  }, opts: WriteOptions = {}): Promise<BatchIssueResult> {
    return this.http.post<BatchIssueResult>('/api/credentials/batch-issue', {
      data: {
        achievementId: input.achievementId,
        recipients: input.recipients,
        eventId: input.eventId,
        skipExisting: input.skipExisting ?? true,
      },
    }, idempotencyHeader(opts));
  }
}

function idempotencyHeader(opts: WriteOptions): Record<string, string> | undefined {
  return opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : undefined;
}
