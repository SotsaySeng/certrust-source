import { apiClient } from './api-client'

interface AuthUser {
  id: number
  username: string
  email: string
  provider: string
  confirmed: boolean
  blocked: boolean
  createdAt: string
  updatedAt: string
  role: {
    id: number
    name: string
    type: string
  }
}

/**
 * The API keeps the session in an HttpOnly cookie and answers website
 * sign-ins with `session: true` instead of a `jwt` (backend
 * middlewares/auth-cookie.ts).
 */
interface LoginResponse {
  session?: boolean
  jwt?: string
  user: AuthUser
}

interface RegisterResponse {
  // No `session` (and no `jwt`) when email confirmation is required - the
  // user must confirm before they have a session. See stores/auth.ts's
  // register() for the branch this drives.
  session?: boolean
  jwt?: string
  user: AuthUser
}

interface RegisterData {
  username: string
  email: string
  password: string
  /** Required by the backend's register override - creates the user's Organization. */
  organizationName: string
  /** Optional org-type id (from GET /api/org-types), forwarded to api::organization.provisioning. */
  organizationType?: number | string
}

interface LoginData {
  identifier: string
  password: string
}

/**
 * Authentication client. Holds no credentials itself: the session is the
 * HttpOnly `certrust_jwt` cookie set by the API, which page scripts cannot
 * read (and so cannot leak).
 */
export class AuthClient {
  /** The signed-in user (with role), or null if there is no valid session. */
  async fetchCurrentUser(): Promise<any | null> {
    try {
      return await apiClient.get<any>('/api/users/me', { populate: '*' })
    }
    catch {
      return null
    }
  }

  async register(data: RegisterData): Promise<RegisterResponse> {
    return apiClient.post<RegisterResponse>('/api/auth/local/register', data)
  }

  async login(data: LoginData): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/api/auth/local', data)
  }

  /**
   * Complete an OAuth/OIDC sign-in: the provider callback redirect carries
   * a JWT in its URL (see /auth/callback and docs/oauth-setup.md). Hand it
   * to the API once to turn it into the session cookie.
   */
  async loginWithToken(jwt: string): Promise<{ user: any }> {
    apiClient.setToken(jwt)
    try {
      await apiClient.post<void>('/api/auth/session', {})
    }
    finally {
      apiClient.clearToken()
    }
    return { user: await this.fetchCurrentUser() }
  }

  /** Ends the session (clears the cookie on the API). */
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>('/api/auth/logout', {})
    }
    catch {
      // Already signed out, or offline - the local state is cleared anyway.
    }
  }
}

// Export a singleton instance
export const authClient = new AuthClient()

export default authClient
