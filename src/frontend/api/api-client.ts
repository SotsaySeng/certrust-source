import type {
  StrapiError,
  StrapiResponse,
  StrapiSingleResponse,
  VerificationResult,
} from '../types/openbadges'

/**
 * API client for interacting with the Strapi backend
 */
export class ApiClient {
  private baseUrl: string
  private token: string | null

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.token = null

    // Sessions used to live in localStorage (readable by any script on the
    // page). They are an HttpOnly cookie now; drop what older builds left.
    if (import.meta.client) {
      try {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      catch {}
    }
  }

  /**
   * Use an explicit bearer token for this tab only (never persisted). The
   * website normally relies on the HttpOnly session cookie instead.
   */
  setToken(token: string) {
    this.token = token
  }

  clearToken() {
    this.token = null
  }

  /**
   * Create request headers
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      // Tells the API to put sign-in tokens in the HttpOnly session cookie
      // rather than the response body (backend middlewares/auth-cookie.ts).
      'X-Certrust-Client': 'web',
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    return headers
  }

  /**
   * Generic request method
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('API baseUrl is not set. Make sure the Nuxt plugin initializes the API client before use.')
    }
    const url = `${this.baseUrl}${endpoint}`
    const headers = this.getHeaders()

    const config: RequestInit = {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
      // Sends the HttpOnly session cookie (certrust.app and api.certrust.app
      // are the same site).
      credentials: 'include',
    }

    try {
      const response = await fetch(url, config)

      if (!response.ok) {
        let errorMessage = `API request failed with status ${response.status}`
        let errorData: any = null

        try {
          errorData = await response.json() as StrapiError
          console.error('API error response:', errorData)

          if (errorData.error) {
            errorMessage = errorData.error.message || errorMessage

            // Add details for validation errors
            if (errorData.error.details && errorData.error.details.errors) {
              const errorDetails = errorData.error.details.errors
                .map((err: any) => `${err.path.join('.')}: ${err.message}`)
                .join('; ')

              if (errorDetails) {
                errorMessage += ` (${errorDetails})`
              }
            }
          }
        }
        catch (parseError) {
          console.error('Could not parse error response:', parseError)
        }

        const error = new Error(errorMessage)
        // @ts-expect-error Add response data to error for debugging
        error.response = response
        // @ts-expect-error Add parsed error data to error for debugging
        error.data = errorData
        throw error
      }

      if (response.status === 204) {
        return {} as T
      }

      return await response.json() as T
    }
    catch (error) {
      console.error('API request error:', error)
      throw error
    }
  }

  /**
   * GET request
   */
  get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const queryString = params
      ? `?${new URLSearchParams(params).toString()}`
      : ''
    return this.request<T>(`${endpoint}${queryString}`, { method: 'GET' })
  }

  /**
   * POST request
   */
  post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PUT request
   */
  put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }

  // Badge-specific methods

  /**
   * Get all badges
   */
  async getBadges(params?: Record<string, string>) {
    try {
      // Always include populate=* to get nested data including images
      const populatedParams = {
        ...params,
        populate: '*'
      }

      const response = await this.get<any>('/api/achievements', populatedParams)

      // Handle different response formats
      if (Array.isArray(response)) {
        // Direct array format
        return response
      }
      else if (response && response.data && Array.isArray(response.data)) {
        // Strapi format with data array
        return response
      }
      else {
        console.error('Unexpected badge response format:', response)
        return { data: [] }
      }
    }
    catch (error) {
      console.error('Error fetching badges:', error)
      return { data: [] }
    }
  }

  /**
   * Get a specific badge by ID
   */
  async getBadge(id: number | string) {
    return this.get<StrapiSingleResponse<any>>(`/api/achievements/${id}?populate=*`)
  }

  /**
   * Get all issuers
   */
  async getIssuers(params?: Record<string, string>) {
    return this.get<StrapiResponse<any>>('/api/profiles', {
      ...params,
      'filters[profileType][$eq]': 'issuer',
      'populate': '*'
    })
  }

  /**
   * Get a specific issuer by ID
   */
  async getIssuer(id: number | string) {
    return this.get<StrapiSingleResponse<any>>(`/api/profiles/${id}?populate=*`)
  }

  /**
   * Create a new badge achievement
   */
  async createBadge(badgeData: any) {
    return this.post<StrapiSingleResponse<any>>('/api/achievements', {
      data: badgeData
    })
  }

  /**
   * Update an existing badge
   */
  async updateBadge(id: number | string, badgeData: any) {
    return this.put<StrapiSingleResponse<any>>(`/api/achievements/${id}`, {
      data: badgeData
    })
  }

  /**
   * Delete a badge
   */
  async deleteBadge(id: number | string) {
    return this.delete<any>(`/api/achievements/${id}`)
  }

  /**
   * Issue a badge to a recipient
   */
  async issueBadge(badgeId: number | string, recipient: { id?: number, name: string, email: string }, evidence: any[] = []) {
    if (!badgeId) {
      throw new Error('Badge ID is required')
    }

    if (!recipient || !recipient.email || !recipient.name) {
      throw new Error('Recipient email and name are required')
    }

    try {
      const payload = {
        data: {
          achievementId: badgeId,
          recipientId: recipient.id || 0,
          recipient: {
            name: recipient.name,
            email: recipient.email
          },
          evidence,
        }
      }

      // Use our server proxy endpoint which will forward to backend
      const result = await this.post<any>('/api/credentials/issue', payload)

      // Add notification information for UI feedback
      if (result && !result.notification) {
        result.notification = {
          emailSent: true,
          emailError: null
        }
      }

      return result
    }
    catch (error) {
      console.error('Badge issuance error:', error)

      // Add more context to the error
      if (error instanceof Error) {
        // Check if there's a more specific error about the badge
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          error.message = `Badge with ID ${badgeId} not found or is not available for issuance`
        }
        else if (!error.message.includes('Authentication required')
          && !error.message.includes('Method not allowed')) {
          error.message = `Failed to issue badge: ${error.message}`
        }
      }

      throw error
    }
  }

  /**
   * Verify a badge assertion by ID
   */
  async verifyBadge(id: string): Promise<VerificationResult> {
    return this.get<VerificationResult>(`/api/credentials/${encodeURIComponent(id)}/verify`)
  }

  /**
   * Validate an external badge
   */
  async validateExternalBadge(badgeData: any): Promise<VerificationResult> {
    return this.post<VerificationResult>('/api/credentials/validate', {
      credential: badgeData
    })
  }

  // Certificate management methods

  /**
   * Get all certificates for the current user
   */
  async getUserCertificates() {
    try {
      const response = await this.get<StrapiResponse<any>>('/api/credentials')
      return {
        data: this.formatCredentials(response.data || []),
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching user certificates:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Get certificates issued by the current user
   * First gets the current user profile, then gets credentials issued by that profile
   */
  async getIssuedCertificates() {
    try {
      // First get the current user's profile
      const profileResponse = await this.get<any>('/api/profiles/me')

      if (!profileResponse.data) {
        console.error('No profile data returned from /api/profiles/me')
        return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
      }

      // Extract profile ID depending on response structure
      let profileId = profileResponse?.data?.id
      if (Array.isArray(profileResponse.data) && profileResponse.data.length > 0) {
        profileId = profileResponse.data[0].id
      }

      // Then get credentials issued by that profile
      const response = await this.get<StrapiResponse<any>>(`/api/profiles/${profileId}/issued-credentials`)

      return {
        data: this.formatCredentials(response.data || []),
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching issued certificates:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Get certificates received by the current user
   * First gets the current user profile, then gets credentials received by that profile
   */
  async getReceivedCertificates() {
    try {
      // First get the current user's profile
      const profileResponse = await this.get<any>('/api/profiles/me')

      if (!profileResponse.data) {
        console.error('No profile data returned from /api/profiles/me')
        return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
      }

      // Extract profile ID depending on response structure
      let profileId = profileResponse?.data?.id
      if (Array.isArray(profileResponse.data) && profileResponse.data.length > 0) {
        profileId = profileResponse.data[0].id
      }

      // Then get credentials received by that profile
      const response = await this.get<StrapiResponse<any>>(`/api/profiles/${profileId}/received-credentials`)

      return {
        data: this.formatCredentials(response.data || []),
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching received certificates:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Export a certificate by ID
   */
  async exportCertificate(id: number | string) {
    return this.get<any>(`/api/credentials/${encodeURIComponent(id)}/export`)
  }

  /**
   * Import a certificate
   */
  async importCertificate(certificateData: any) {
    return this.post<any>('/api/credentials/import', { certificateData })
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(id: number | string, reason: string) {
    return this.post<any>(`/api/credentials/${encodeURIComponent(id)}/revoke`, { reason })
  }

  /**
   * Renew a credential with a new expiration date.
   * Re-issues the credential; only the issuer can call this.
   */
  async renewCredential(id: number | string, newExpirationDate: string) {
    return this.post<any>(`/api/credentials/${encodeURIComponent(id)}/renew`, { newExpirationDate })
  }

  // ── Scheduled Issuances ───────────────────────────────────────────────

  async scheduleIssuance(data: {
    achievementId: number
    recipientEmail: string
    recipientName?: string
    scheduledDate: string
    expirationDate?: string
    note?: string
  }) {
    return this.post<any>('/api/scheduled-issuances', { data })
  }

  async getScheduledIssuances(status?: 'pending' | 'issued' | 'cancelled' | 'failed') {
    const qs = status ? `?status=${status}` : ''
    return this.get<any>(`/api/scheduled-issuances${qs}`)
  }

  async cancelScheduledIssuance(id: number | string, cancelReason?: string) {
    return this.post<any>(`/api/scheduled-issuances/${id}/cancel`, { cancelReason })
  }

  /**
   * Get issuer keys
   */
  async getIssuerKeys(id: number | string) {
    return this.get<any>(`/api/profiles/${id}/keys`)
  }

  /**
   * Get the public URL for a certificate
   */
  getCertificateUrl(id: number | string): string {
    return `${this.baseUrl}/api/credentials/${encodeURIComponent(id)}/certificate`
  }

  /**
   * Get certificate by ID
   */
  async getCertificate(id: number | string) {
    return this.get<any>(`/api/credentials/${encodeURIComponent(id)}?populate=*`)
  }

  /**
   * Get the current user's profile
   */
  async getCurrentUserProfile() {
    return this.get<any>('/api/profiles/me')
  }

  /**
   * Update the current user's own profile. Only name/description/url/
   * telephone are accepted server-side (see profile controller's update()
   * override) - anything else in profileData is silently dropped there,
   * not here, so this stays a thin pass-through.
   */
  async updateProfile(id: number | string, profileData: any) {
    return this.put<any>(`/api/profiles/${encodeURIComponent(id)}`, {
      data: profileData
    })
  }

  /**
   * Delete the current user's own account. See the backend's
   * profile.deleteAccount for why this blocks future login rather than
   * hard-deleting the profile/achievement/credential data.
   */
  async deleteAccount() {
    return this.delete<any>('/api/profiles/me')
  }

  /**
   * Search for badges by name, description, or issuer
   */
  async searchBadges(searchTerm: string) {
    return this.get<StrapiResponse<any>>('/api/achievements', {
      _q: searchTerm,
      populate: '*'
    })
  }

  /**
   * Get dashboard stats for the current user's profile.
   * Served by GET /api/dashboard/stats (profile.dashboardStats controller).
   */
  async getDashboardStats() {
    const empty = {
      credentialsIssued: 0,
      credentialsRevoked: 0,
      credentialsExpired: 0,
      credentialsReceived: 0,
      achievementsCreated: 0,
      uniqueRecipients: 0,
      topAchievements: [] as { id: number, name: string, count: number }[],
      memberSince: new Date().toISOString(),
      scheduledCredentials: 0,
      draftCredentials: 0,
      issuanceByMonth: [] as { month: string, count: number }[],
    }
    try {
      const response = await this.get<any>('/api/dashboard/stats')
      return { data: response.data || empty }
    }
    catch (error) {
      console.error('Error fetching dashboard stats:', error)
      return { data: empty }
    }
  }

  /**
   * Get the current user's organization tier and credential-issuance limit.
   * Served by GET /api/organizations/usage (organization.usage controller).
   */
  async getOrganizationUsage() {
    const empty = {
      tier: null as string | null,
      limit: null as number | null,
      limits: null as { credential: number | null, designTemplate: number | null, achievement: number | null } | null,
    }
    try {
      const response = await this.get<any>('/api/organizations/usage')
      return { data: response.data || empty }
    }
    catch (error) {
      console.error('Error fetching organization usage:', error)
      return { data: empty }
    }
  }

  /**
   * Get the list of organization types, used to populate the registration
   * form's organization-type dropdown. Served by GET /api/org-types
   * (public - no auth required, so this can be called pre-login).
   */
  async getOrgTypes() {
    const empty: { id: number, name: string }[] = []
    try {
      const response = await this.get<any>('/api/org-types')
      return { data: response.data || empty }
    }
    catch (error) {
      console.error('Error fetching organization types:', error)
      return { data: empty }
    }
  }

  /**
   * Resend the account-confirmation email for an unconfirmed user.
   * Served by Strapi's built-in POST /api/auth/send-email-confirmation.
   */
  async resendConfirmationEmail(email: string) {
    return this.post<any>('/api/auth/send-email-confirmation', { email })
  }

  // ── Design Templates ──────────────────────────────────────────────────
  // Organization-scoped on the backend (design-template.ts's find/create/
  // update/delete overrides) - these methods just talk to the plain REST
  // routes, no extra scoping needed client-side.

  /**
   * List the current organization's design templates.
   * Served by GET /api/design-templates.
   *
   * filters[publishedAt][$notNull] mirrors getAvailableBadges()'s existing
   * convention for the same underlying reason: design-template is a
   * draftAndPublish content type, so an unfiltered list can otherwise
   * surface an entry's transient draft row alongside its published one.
   */
  async getDesignTemplates() {
    try {
      const response = await this.get<StrapiResponse<any>>('/api/design-templates', {
        'populate': '*',
        'filters[publishedAt][$notNull]': 'true',
        'sort': 'updatedAt:desc'
      })
      return {
        data: Array.isArray(response.data) ? response.data : [],
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching design templates:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Get a single design template by id (documentId).
   */
  async getDesignTemplate(id: number | string) {
    return this.get<any>(`/api/design-templates/${encodeURIComponent(id)}?populate=*&status=published`)
  }

  /**
   * Create a design template.
   *
   * `?status=published` matters here, not just tidiness: Strapi 5's
   * Document Service always creates a *draft*-only row by default
   * (verified directly against @strapi/core's document-service
   * repository.js) - a plain POST with no status param would produce a
   * design template invisible to getDesignTemplates() (published-only,
   * above) and uncounted by the backend's tier-limit hook (which also
   * only counts publishedAt-not-null rows). Passing status=published as a
   * query param makes Strapi publish the same create in one round trip.
   */
  async createDesignTemplate(templateData: any) {
    return this.post<any>('/api/design-templates?status=published', {
      data: templateData
    })
  }

  /**
   * Update a design template. Same status=published reasoning as create -
   * without it, an edit would only land on the draft copy and the
   * published (visible) one would silently keep showing stale data.
   */
  async updateDesignTemplate(id: number | string, templateData: any) {
    return this.put<any>(`/api/design-templates/${encodeURIComponent(id)}?status=published`, {
      data: templateData
    })
  }

  /**
   * Delete a design template (both its draft and published rows).
   */
  async deleteDesignTemplate(id: number | string) {
    return this.delete<any>(`/api/design-templates/${encodeURIComponent(id)}`)
  }

  /**
   * Duplicate a design template: fetch it, then create a new one from the
   * same data with a modified name. Frontend-composed - no backend
   * "duplicate" action exists or is needed for this. The copy always
   * starts as non-default (isDefault: false) even if the source template
   * was marked default, so duplicating never silently creates a second
   * "default" template.
   */
  async duplicateDesignTemplate(id: number | string) {
    const existing = await this.getDesignTemplate(id)
    const source = existing?.data
    if (!source) {
      throw new Error('Design template not found')
    }
    return this.createDesignTemplate({
      name: `${source.name} (Copy)`,
      description: source.description,
      type: source.type,
      layoutConfig: source.layoutConfig,
      isDefault: false,
      previewImage: source.previewImage?.id,
      creator: source.creator?.id,
      organization: source.organization?.id,
    })
  }

  /**
   * Get the caller's organization's events. Same publishedAt-not-null
   * filter as getDesignTemplates() and same reasoning - a draftAndPublish
   * content type otherwise surfaces a transient draft row alongside its
   * published one.
   */
  async getEvents() {
    try {
      const response = await this.get<StrapiResponse<any>>('/api/events', {
        'populate': '*',
        'filters[publishedAt][$notNull]': 'true',
        'sort': 'startDate:desc'
      })
      return {
        data: Array.isArray(response.data) ? response.data : [],
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching events:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Get a single event by id (documentId).
   */
  async getEvent(id: number | string) {
    return this.get<any>(`/api/events/${encodeURIComponent(id)}?populate=*&status=published`)
  }

  /**
   * Create an event. `?status=published` matters here for the same reason
   * as createDesignTemplate - Strapi 5's Document Service creates a
   * draft-only row by default, which would be invisible to getEvents()
   * (published-only, above) without this.
   */
  async createEvent(eventData: any) {
    return this.post<any>('/api/events?status=published', {
      data: eventData
    })
  }

  /**
   * Update an event. Same status=published reasoning as create.
   */
  async updateEvent(id: number | string, eventData: any) {
    return this.put<any>(`/api/events/${encodeURIComponent(id)}?status=published`, {
      data: eventData
    })
  }

  /**
   * Delete an event (both its draft and published rows).
   */
  async deleteEvent(id: number | string) {
    return this.delete<any>(`/api/events/${encodeURIComponent(id)}`)
  }

  // ---- Billing (api::billing) ----

  /** Current org's plan, subscription status, trial/renewal dates and banner. */
  async getBillingStatus() {
    return this.get<any>('/api/billing/status')
  }

  /** Paid plans with their Stripe prices (amount in cents, null if unknown). */
  async getBillingPlans() {
    return this.get<any>('/api/billing/plans')
  }

  /** Returns { url } of a Stripe Checkout session to redirect to. */
  async startCheckout(tier: 'pro' | 'enterprise', interval: 'month' | 'year') {
    return this.post<{ url: string }>('/api/billing/checkout', { tier, interval })
  }

  /** Returns { url } of the Stripe Customer Portal (change card/plan, cancel, invoices). */
  async openBillingPortal() {
    return this.post<{ url: string }>('/api/billing/portal', {})
  }

  /** Platform admins only. */
  async getRevenueMetrics(year: number) {
    return this.get<any>(`/api/billing/admin/metrics?year=${encodeURIComponent(year)}`)
  }

  /** Platform admins only. */
  async getBillingOrgs() {
    return this.get<{ data: any[] }>('/api/billing/admin/orgs')
  }

  /** Platform admins only: the org table as CSV, fetched with auth so it can be saved as a file. */
  async downloadBillingCsv(): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/billing/admin/export`, { headers: this.getHeaders() })
    if (!response.ok) {
      throw new Error(`Export failed with status ${response.status}`)
    }
    return response.blob()
  }

  /**
   * Format credential data to normalize structure
   * This helps handle different data formats from Strapi
   */
  formatCredential(credential: any) {
    if (!credential) {
      return null
    }

    const formatted: any = {
      id: credential.id,
      credentialId: credential.attributes?.credentialId || credential.credentialId || credential.id,
    }

    // Copy all attributes if they exist
    if (credential.attributes) {
      Object.assign(formatted, credential.attributes)
    }
    else {
      // If no attributes, copy all direct properties
      Object.assign(formatted, credential)
    }

    // Handle issuer data
    if (credential.attributes?.issuer?.data) {
      // Nested Strapi format
      formatted.issuer = credential.attributes.issuer.data.attributes || {}
      formatted.issuer.id = credential.attributes.issuer.data.id
    }
    else if (credential.issuer) {
      // Direct issuer object
      formatted.issuer = credential.issuer

      // Make sure the issuer name is available
      if (!formatted.issuer.name && credential.issuer.attributes?.name) {
        formatted.issuer.name = credential.issuer.attributes.name
      }
    }

    // Handle recipient data
    if (credential.attributes?.recipient?.data) {
      formatted.recipient = credential.attributes.recipient.data.attributes || {}
      formatted.recipient.id = credential.attributes.recipient.data.id
    }
    else if (credential.recipient) {
      formatted.recipient = credential.recipient
    }

    // Handle achievement data
    if (credential.attributes?.achievement?.data) {
      formatted.achievement = credential.attributes.achievement.data.attributes || {}
      formatted.achievement.id = credential.attributes.achievement.data.id
    }
    else if (credential.achievement) {
      formatted.achievement = credential.achievement
    }

    // Handle description
    if (!formatted.description) {
      formatted.description = credential.description
        || credential.attributes?.description
        || formatted.achievement?.description
        || 'No description available'
    }

    // Handle issuance date
    if (!formatted.issuanceDate) {
      formatted.issuanceDate = credential.issuanceDate
        || credential.attributes?.issuanceDate
        || credential.issuedOn
        || credential.attributes?.issuedOn
    }

    // Extract image URL if available
    if (credential.attributes?.image?.data?.attributes?.url) {
      formatted.imageUrl = credential.attributes.image.data.attributes.url
    }
    else if (credential.attributes?.achievement?.data?.attributes?.image?.data?.attributes?.url) {
      formatted.imageUrl = credential.attributes.achievement.data.attributes.image.data.attributes.url
    }
    else if (credential.achievement?.image?.url) {
      formatted.imageUrl = credential.achievement.image.url
    }
    else if (credential.image?.url) {
      formatted.imageUrl = credential.image.url
    }

    return formatted
  }

  /**
   * Format an array of credentials
   */
  formatCredentials(credentials: any[]) {
    if (!credentials || !Array.isArray(credentials)) {
      return []
    }
    return credentials.map(credential => this.formatCredential(credential))
  }

  /**
   * Batch issue badges to multiple recipients
   */
  async batchIssueBadges(
    badgeId: number | string,
    recipients: { name: string, email: string }[],
    evidence: any[] = []
  ) {
    if (!badgeId) {
      throw new Error('Badge ID is required')
    }
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one recipient is required')
    }
    try {
      const payload = {
        data: {
          achievementId: badgeId,
          recipients,
          evidence
        }
      }
      const result = await this.post<any>('/api/credentials/batch-issue', payload)
      return result
    }
    catch (error) {
      console.error('Batch badge issuance error:', error)
      throw error
    }
  }

  /**
   * Get available badges that can be issued
   */
  async getAvailableBadges() {
    try {
      const response = await this.get<StrapiResponse<any>>('/api/achievements', {
        'populate': '*',
        'filters[publishedAt][$notNull]': 'true'
      })

      if (!response.data) {
        return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
      }

      return {
        data: Array.isArray(response.data) ? response.data : [response.data],
        meta: response.meta
      }
    }
    catch (error) {
      console.error('Error fetching available badges:', error)
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } }
    }
  }

  /**
   * Set the base URL for the API client
   */
  public setBaseUrl(url: string) {
    if (url) {
      this.baseUrl = url
    }
  }
}

// Export a singleton instance
export const apiClient = new ApiClient()

// This will be updated when the module is initialized in the browser
export function updateApiUrl(url: string) {
  apiClient.setBaseUrl(url)
}

export default apiClient
