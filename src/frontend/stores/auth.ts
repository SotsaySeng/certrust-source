import { apiClient } from '~/api/api-client'
import { authClient } from '~/api/auth-client'

interface User {
  id: number
  username: string
  email: string
  provider?: string
  confirmed?: boolean
  blocked?: boolean
  createdAt?: string
  updatedAt?: string
  role?: {
    name: string
    type?: string
  }
}

interface Profile {
  id: number
  name: string
  email: string
  description?: string | null
  url?: string | null
  telephone?: string | null
  profileType: 'Issuer' | 'Recipient' | 'Both' | null
  // Populated since Phase B's `profile.me` change (previously populated
  // nothing here). Used by the design-template create flow to know which
  // organization to scope a new template to.
  organization?: {
    id: number
    documentId?: string
    name: string
    tier?: string
  } | null
}

/** Return contract for register() - see its own doc comment for the two states. */
type RegisterResult = { status: 'confirmed' } | { status: 'pending-confirmation' } | { status: 'error' }

interface ProfileResponse {
  data: Profile | Profile[]
  meta: {
    pagination?: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

// Flag to prevent multiple initializations
// Not a credential: remembers that this browser has signed in, so page
// loads only ask the API "who am I?" when there may be a session cookie.
// Anonymous visitors (almost everyone on verification pages) skip the
// round trip, which would otherwise delay every page's hydration.
const SESSION_HINT = 'certrust_signed_in'
function setSessionHint(on: boolean) {
  try {
    if (on) {
      localStorage.setItem(SESSION_HINT, '1')
    }
    else {
      localStorage.removeItem(SESSION_HINT)
    }
  }
  catch {}
}
function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(SESSION_HINT) === '1'
  }
  catch {
    return true
  }
}

let isInitialized = false
// The in-flight init() call, if one is running. init() used to only set
// isInitialized *after* awaiting its profile fetch, so two concurrent
// callers both ran the whole body. Route middleware now awaits init()
// before reading isAuthenticated/isIssuer (see middleware/auth.ts), which
// makes a concurrent call the normal case rather than an edge case, so
// callers share one promise instead of racing duplicate requests.
let initPromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  // The session itself is the HttpOnly `certrust_jwt` cookie, which scripts
  // cannot read. Kept for callers that only check whether a user is signed
  // in; never holds a real token.
  const token = ref<string | null>(null)
  const profile = ref<Profile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const userRole = computed(() => user.value?.role?.name || null)
  const isAuthenticated = computed(() => !!user.value)
  // Issuer-ness is an application concept (Profile.profileType), not a
  // Strapi Users & Permissions role - a fresh instance only ever has the
  // built-in Public/Authenticated roles, so checking user.role.name here
  // could never be true.
  const isIssuer = computed(() => profile.value?.profileType === 'Issuer' || profile.value?.profileType === 'Both')
  // ZettaByte Lab staff: the "Platform Admin" users-permissions role,
  // assigned in Strapi admin. UI-only gate - the revenue API enforces it
  // server-side (global::is-platform-admin).
  const isPlatformAdmin = computed(() => user.value?.role?.type === 'platform-admin')

  /**
   * Initialize auth state from the HttpOnly session cookie (via /api/users/me).
   *
   * Safe (and cheap) to await from anywhere: it runs at most once, and a
   * caller arriving while it is already in flight awaits the same promise
   * rather than starting a second one. Awaiting it is what guarantees
   * `profile` - and therefore `isIssuer` - is populated before a caller
   * makes a decision based on it.
   */
  async function init() {
    // Prevent multiple initializations
    if (isInitialized) {
      return
    }

    if (initPromise) {
      return initPromise
    }

    initPromise = runInit()
    try {
      await initPromise
    }
    finally {
      initPromise = null
    }
  }

  async function runInit() {
    isLoading.value = true

    try {
      // The browser sends the session cookie; /api/users/me says who it is.
      if (import.meta.client && hasSessionHint()) {
        const currentUser = await authClient.fetchCurrentUser()
        if (currentUser) {
          user.value = currentUser
          token.value = 'cookie'
          await loadProfile()
        }
        else {
          setSessionHint(false)
        }
      }

      isInitialized = true
    }
    catch (e) {
      console.error('Error initializing auth store:', e)
    }
    finally {
      isLoading.value = false
    }
  }

  async function loadProfile() {
    try {
      const profileResponse = await apiClient.get<ProfileResponse>('/api/profiles/me')
      if (profileResponse.data) {
        profile.value = Array.isArray(profileResponse.data)
          ? profileResponse.data[0]
          : profileResponse.data
      }
    }
    catch (profileError) {
      console.error('Error loading profile:', profileError)
    }
  }

  /** Re-read the user (with role) from /api/users/me and persist it. */
  async function refreshUser() {
    try {
      const fullUser = await apiClient.get<User>('/api/users/me', { populate: '*' })
      if (fullUser) {
        user.value = fullUser
      }
    }
    catch (userError) {
      console.error('Error loading full user:', userError)
    }
  }

  async function login(identifier: string, password: string) {
    error.value = null
    isLoading.value = true

    try {
      const response = await authClient.login({ identifier, password })

      user.value = response.user
      token.value = 'cookie'
      setSessionHint(true)
      await refreshUser()
      await loadProfile()

      return true
    }
    catch (err) {
      console.error('Login error:', err)
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  /**
   * Register a new user + organization.
   *
   * Returns a status object instead of a bare boolean because a successful
   * registration has two genuinely different outcomes depending on whether
   * email confirmation is enabled (see bootstrap/email-confirmation-setup.ts
   * on the backend, which forces it on for this app):
   *  - 'confirmed': Strapi returned a jwt - the user is logged in immediately.
   *  - 'pending-confirmation': Strapi returned only `{ user }`, no jwt - the
   *    account exists but can't authenticate until the confirmation link is
   *    clicked. There is no token, so every side effect below (saving the
   *    user/profile, setting the auth cookie) is skipped entirely rather
   *    than running against `undefined` - the calling page renders a
   *    "check your email" panel instead of redirecting.
   *  - 'error': registration itself failed (see `error` for the message).
   */
  async function register(
    username: string,
    email: string,
    password: string,
    organizationName: string,
    organizationType?: string | number
  ): Promise<RegisterResult> {
    error.value = null
    isLoading.value = true

    try {
      const response = await authClient.register({ username, email, password, organizationName, organizationType })

      if (!response.session && !response.jwt) {
        return { status: 'pending-confirmation' }
      }

      user.value = response.user
      token.value = 'cookie'
      setSessionHint(true)
      await refreshUser()
      await loadProfile()

      return { status: 'confirmed' }
    }
    catch (err) {
      console.error('Registration error:', err)
      error.value = err instanceof Error ? err.message : 'Registration failed'
      return { status: 'error' }
    }
    finally {
      isLoading.value = false
    }
  }

  async function loginWithOAuthToken(jwt: string) {
    error.value = null
    isLoading.value = true

    try {
      const response = await authClient.loginWithToken(jwt)
      if (!response.user) {
        throw new Error('OAuth sign-in failed')
      }

      user.value = response.user
      token.value = 'cookie'
      setSessionHint(true)
      await loadProfile()

      return true
    }
    catch (err) {
      console.error('OAuth login error:', err)
      error.value = err instanceof Error ? err.message : 'OAuth sign-in failed'
      return false
    }
    finally {
      isLoading.value = false
    }
  }

  function logout() {
    if (import.meta.client) {
      setSessionHint(false)
      // Fire and forget: the API clears the HttpOnly cookie.
      authClient.logout()
    }

    user.value = null
    token.value = null
    profile.value = null
  }

  return {
    user,
    token,
    profile,
    isLoading,
    error,
    isAuthenticated,
    isIssuer,
    isPlatformAdmin,
    userRole,
    login,
    loginWithOAuthToken,
    register,
    logout,
    init
  }
})
