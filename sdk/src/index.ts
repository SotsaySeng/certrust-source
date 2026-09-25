/**
 * @certrust/sdk — Official JavaScript/TypeScript SDK for the Certrust credential platform.
 *
 * @example
 * ```typescript
 * import { CertrustClient } from '@certrust/sdk';
 *
 * const client = new CertrustClient({ baseUrl: 'https://api.example.com' });
 * await client.auth.login({ identifier: 'admin@example.com', password: 'secret' });
 *
 * // Issue a credential
 * const result = await client.credentials.issue({
 *   achievementId: 1,
 *   recipientEmail: 'alice@example.com',
 *   recipientName: 'Alice Smith',
 * });
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
} from './types.js';
