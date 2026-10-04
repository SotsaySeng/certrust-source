/**
 * @certrust/sdk — Official JavaScript/TypeScript SDK for the Certrust credential platform.
 *
 * @example
 * ```typescript
 * import { CertrustClient } from '@certrust/sdk';
 *
 * const client = new CertrustClient({
 *   baseUrl: 'https://api.certrust.app',
 *   apiKey: process.env.CERTRUST_API_KEY, // Manage > API keys
 * });
 *
 * // Issue a credential; a retry with the same idempotencyKey never issues twice
 * const result = await client.credentials.issue({
 *   achievementId: 1,
 *   recipientEmail: 'alice@example.com',
 *   recipientName: 'Alice Smith',
 * }, { idempotencyKey: 'student-1042-course-7' });
 *
 * // Verify a credential (no auth needed)
 * const { verified } = await client.credentials.verify('urn:uuid:…');
 * ```
 */

export { CertrustClient } from './client.js';
export { CertrustApiError } from './errors.js';
export { HttpClient } from './http.js';

// Resource classes (useful for extension / mocking in tests)
export { AuthResource } from './resources/auth.js';
export { AchievementsResource } from './resources/achievements.js';
export { CredentialsResource } from './resources/credentials.js';
export { ProfilesResource } from './resources/profiles.js';
export { ScheduledResource } from './resources/scheduled.js';
export { RequestsResource } from './resources/requests.js';
export { IssuanceJobsResource } from './resources/issuance-jobs.js';

// All types
export type {
  CertrustClientOptions,
  StrapiListResponse,
  StrapiSingleResponse,
  StrapiMeta,
  LoginOptions,
  AuthResponse,
  Profile,
  ProfileType,
  ProfileExport,
  Achievement,
  CreateAchievementInput,
  Credential,
  CredentialStatus,
  IssueCredentialInput,
  VerifyResult,
  ListCredentialsOptions,
  RevocationCheckResult,
  ScheduledIssuance,
  CreateScheduledIssuanceInput,
  CredentialRequest,
  CredentialRequestStatus,
  CreateCredentialRequestInput,
  WriteOptions,
  BatchIssueResult,
  ApiKeyInfo,
  CreateIssuanceJobInput,
  IssuanceJob,
} from './types.js';
