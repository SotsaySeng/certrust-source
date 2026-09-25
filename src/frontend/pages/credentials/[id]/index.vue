<script setup lang="ts">
import type {
  AchievementCredential,
  Evidence,
  VerificationResult
} from '~/types/openbadges'
import QRCode from 'qrcode'
import { apiClient } from '~/api/api-client'

const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

// ============================================================================
// 1. ROUTE PARAMS & STATIC URLs
// ============================================================================
const rawId = route.params.id
const credentialId = rawId
  ? decodeURIComponent(Array.isArray(rawId) ? rawId[0] : rawId)
  : ''

const shareableUrl = `${WEBSITE_URL}/credentials/${encodeURIComponent(credentialId)}`

// ============================================================================
// 2. DATA FETCHING
// ============================================================================
// For SSR meta tags to work, the API must be reachable from the Nuxt server process.
// In local dev: set NUXT_PUBLIC_API_URL to your backend (e.g., http://127.0.0.1:1337)
// In production: set to your production API URL

const apiUrl = config.public.apiUrl || ''

// useAsyncData fetches on server (SSR) and hydrates on client
// We catch errors to prevent page crash, but data will be null if fetch fails
const { data: verificationData, error: fetchError, status, refresh } = await useAsyncData<VerificationResult | null>(
  `credential-${credentialId}`,
  async () => {
    if (!credentialId) { return null }

    const url = `${apiUrl}/api/credentials/${encodeURIComponent(credentialId)}/verify`
    console.log(`[${import.meta.server ? 'SSR' : 'Client'}] Fetching: ${url}`)

    try {
      const result = await $fetch<VerificationResult>(url)
      console.log(`[${import.meta.server ? 'SSR' : 'Client'}] Fetch success:`, result?.credential?.name || result?.rawCredential?.name)
      return result
    }
    catch (err) {
      console.error(`[${import.meta.server ? 'SSR' : 'Client'}] Fetch failed:`, err)
      // Return null instead of throwing - page will render with fallback meta tags
      return null
    }
  },
  {
    // Nuxt 3.10+ options
    server: true, // Fetch on server for SSR
    lazy: false, // Block render until fetch completes (needed for SEO)
    default: () => null,
  }
)

// Re-fetch in the browser if SSR failed (e.g., localhost not reachable from
// the server) or the viewer is signed in: the browser sends the HttpOnly
// session cookie, so the issuer or recipient gets the full view of a private
// credential and the visibility switch. SSR never sees the cookie.
onMounted(async () => {
  const authStore = useAuthStore()
  await authStore.init()
  if (credentialId && (!verificationData.value || authStore.isAuthenticated)) {
    console.log('[Client] SSR data missing, retrying with apiClient...')
    try {
      verificationData.value = await apiClient.verifyBadge(credentialId)
      console.log('[Client] Retry success:', verificationData.value?.credential?.name)
    }
    catch (err) {
      console.error('[Client] Retry failed:', err)
    }
  }
})

// Client-only, same as the navigator.share() call in shareCredential() below -
// avoids an SSR/hydration special case for a supplementary feature.
const qrCodeDataUrl = ref('')
onMounted(async () => {
  try {
    qrCodeDataUrl.value = await QRCode.toDataURL(shareableUrl, { width: 160, margin: 1 })
  }
  catch (err) {
    console.error('Error generating QR code:', err)
  }
})

// ============================================================================
// 3. COMPUTED DATA EXTRACTION
// ============================================================================
const credential = computed<AchievementCredential | null>(() => {
  const data = verificationData.value
  if (!data) { return null }
  return data.credential || data.rawCredential as AchievementCredential || null
})

const verificationResult = computed(() => verificationData.value)
const loading = computed(() => status.value === 'pending')
const error = computed(() => {
  if (fetchError.value) { return fetchError.value.message }
  if (status.value === 'error' && !verificationData.value && credentialId) {
    return 'Failed to verify or fetch credential details'
  }
  return null
})

// ============================================================================
// 4. SEO METADATA
// Per Nuxt 3 docs: use getter functions () => value for reactive meta tags
// https://nuxt.com/docs/api/composables/use-seo-meta
// ============================================================================

// Helper functions to extract data (keeps useSeoMeta clean)
function getCredentialName(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.name || cred?.title || ''
}

function getCredentialDescription(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.description || ''
}

function getIssuerName(): string {
  const cred = verificationData.value?.credential || verificationData.value?.rawCredential
  return cred?.issuer?.name || 'Certrust'
}

// Recipient names are deliberately kept out of titles, descriptions and
// structured data: verification pages are noindex, but link previews and
// crawlers that ignore robots rules would still pick them up.
const isPrivate = computed(() => verificationData.value?.rawCredential?.visibility === 'private')
const canManage = computed(() => !!verificationData.value?.viewer?.canManage)

// Link preview picture for Facebook/WhatsApp/LinkedIn: the rendered
// certificate (backend share-image endpoint). It shows the recipient's name,
// so private, revoked or unloaded credentials get the generic site image.
const ogImageUrl = computed(() => {
  const raw = verificationData.value?.rawCredential
  if (!raw || isPrivate.value || raw.revoked || !apiUrl) {
    return `${WEBSITE_URL}/og-default.png`
  }
  return `${apiUrl}/api/credentials/${encodeURIComponent(credentialId)}/share-image`
})

function onVisibilityChanged(visibility: 'public' | 'private') {
  if (verificationData.value?.rawCredential) {
    verificationData.value.rawCredential.visibility = visibility
  }
}

// SEO with getter functions (Nuxt 3 documented pattern)
useSeoMeta({
  // Title
  // app.vue's titleTemplate appends " | Certrust".
  title: () => getCredentialName() || 'Credential details',

  // Description
  description: () => {
    const desc = getCredentialDescription()
    if (desc) { return desc }

    const name = getCredentialName()
    if (name) {
      return `View and verify "${name}" issued by ${getIssuerName()} via Certrust.`
    }
    return 'View and verify this digital credential issued via Certrust.'
  },

  // Open Graph
  ogType: 'website',
  ogSiteName: 'Certrust',
  ogUrl: shareableUrl,
  ogTitle: () => {
    const name = getCredentialName()
    return name ? `${name} | Certrust` : 'Credential Details | Certrust'
  },
  ogDescription: () => {
    const desc = getCredentialDescription()
    if (desc) { return desc }
    const name = getCredentialName()
    if (name) { return `View and verify "${name}" issued by ${getIssuerName()} via Certrust.` }
    return 'View and verify this digital credential issued via Certrust.'
  },
  ogImage: () => ogImageUrl.value,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: () => {
    const name = getCredentialName()
    return name ? `${name} - verified credential` : 'Certrust credential'
  },

  // Twitter
  twitterCard: 'summary_large_image',
  twitterTitle: () => {
    const name = getCredentialName()
    return name ? `${name} | Certrust` : 'Credential Details | Certrust'
  },
  twitterDescription: () => {
    const desc = getCredentialDescription()
    if (desc) { return desc }
    const name = getCredentialName()
    if (name) { return `View and verify "${name}" issued by ${getIssuerName()} via Certrust.` }
    return 'View and verify this digital credential issued via Certrust.'
  },
  twitterImage: () => ogImageUrl.value,
  twitterImageAlt: () => {
    const name = getCredentialName()
    return name ? `${name} - verified credential` : 'Certrust credential'
  },

  // Author
  author: () => getIssuerName(),

  // Verification pages are for people who hold the link, not for search
  // engines (Privacy Policy s.4). Also sent as an X-Robots-Tag header - see
  // routeRules in nuxt.config.ts.
  robots: 'noindex, nofollow',
})

useHead({
  link: [{ rel: 'canonical', href: shareableUrl }],
  script: [
    {
      // JSON-LD structured data — schema.org EducationalOccupationalCredential.
      // Describes the credential only (never the recipient).
      type: 'application/ld+json',
      innerHTML: () => {
        const cred = verificationData.value?.credential ?? verificationData.value?.rawCredential
        if (!cred) { return JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage' }) }
        return JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'EducationalOccupationalCredential',
          '@id': shareableUrl,
          'name': cred.name ?? cred.title ?? 'Digital Credential',
          'description': cred.description ?? '',
          'url': shareableUrl,
          'credentialCategory': 'badge',
          'dateCreated': cred.issuanceDate ?? undefined,
          'expires': cred.expirationDate ?? undefined,
          'recognizedBy': cred.issuer
            ? {
                '@type': 'Organization',
                'name': typeof cred.issuer === 'string' ? cred.issuer : cred.issuer.name ?? '',
                'url': typeof cred.issuer === 'object' ? cred.issuer.url ?? undefined : undefined,
              }
            : undefined,
          'image': verificationData.value?.rawCredential?.achievement?.image?.url ?? undefined,
          // Open Badges 3.0 extension
          'identifier': credentialId,
          'publisher': {
            '@type': 'Organization',
            'name': 'Certrust',
            'url': WEBSITE_URL,
          },
        })
      },
    },
  ],
})

// ============================================================================
// 5. UI HELPERS
// ============================================================================
async function refreshCredentialDetails() {
  await refresh()
  // If useAsyncData refresh failed, try apiClient (client-side only)
  if (!verificationData.value && credentialId && import.meta.client) {
    try {
      verificationData.value = await apiClient.verifyBadge(credentialId)
    }
    catch (err) {
      console.error('Refresh retry failed:', err)
    }
  }
}

// Client-side only state for image handling
const currentImageIndex = ref(0)
const imageLoadError = ref(false)

// Format dates with proper localization
const formattedIssuanceDate = computed(() => {
  const date = credential.value?.issuanceDate
  if (!date) { return 'Unknown' }
  return formatDate(date)
})

const formattedExpirationDate = computed(() => {
  const date = credential.value?.expirationDate
  if (!date) { return 'No expiration' }
  return formatDate(date)
})

// Get all possible image URLs for display
const imageUrlOptions = computed(() => {
  if (!credential.value) { return [] }

  const cred = credential.value
  const rawCred = verificationData.value?.rawCredential

  const options = [
    // Option 1: Direct certificate endpoint URL
    apiClient.getCertificateUrl(cred.id),

    // Option 2: Raw credential achievement image URL (Strapi format)
    rawCred?.achievement?.image?.url,

    // Option 3: Raw credential achievement image formats (Strapi responsive images)
    rawCred?.achievement?.image?.formats?.large?.url,
    rawCred?.achievement?.image?.formats?.medium?.url,
    rawCred?.achievement?.image?.formats?.small?.url,

    // Option 4: OpenBadges achievement image ID
    typeof cred.credentialSubject?.achievement?.image?.id === 'string'
      ? cred.credentialSubject.achievement.image.id.replace('https://bold-approval-5bde4fbd5d.strapiapp.comhttps://', 'https://')
      : null,

    // Option 5: OpenBadges issuer image
    typeof cred.issuer?.image === 'string' ? cred.issuer.image : null
  ].filter(Boolean) as string[]

  return [...new Set(options)]
})

// Get the current image URL based on the current index
const displayImageUrl = computed(() => {
  if (imageUrlOptions.value.length === 0) { return null }
  return imageUrlOptions.value[currentImageIndex.value]
})

// Handle image error by trying the next URL in the options
function handleImageError() {
  if (currentImageIndex.value < imageUrlOptions.value.length - 1) {
    currentImageIndex.value++
  }
  else {
    imageLoadError.value = true
  }
}

function formatDate(dateString: string) {
  if (!dateString) { return 'Unknown' }

  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date)
  }
  catch (err) {
    console.error('Error formatting date:', err)
    return dateString
  }
}

async function shareCredential() {
  try {
    if (navigator.share) {
      await navigator.share({
        title: credential.value?.name || 'Credential',
        text: `View my credential: ${credential.value?.name}`,
        url: shareableUrl
      })
    }
    else {
      await navigator.clipboard.writeText(shareableUrl)
    }
  }
  catch (err) {
    console.error('Error sharing:', err)
  }
}

async function downloadCredential() {
  const imageUrl = displayImageUrl.value
  if (!imageUrl) { return }

  try {
    // The certificate endpoint serves SVG: converted to a real PNG here.
    await downloadImageFile(imageUrl, credential.value?.name || 'credential')
  }
  catch (err) {
    console.error('Error downloading credential:', err)
  }
}

function getLinkedInAddToProfileUrl() {
  if (!credential.value) { return '#' }

  const cert = credential.value
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.name || cert.title || '',
    organizationName: getIssuerName(),
    issueYear: cert.issuanceDate ? new Date(cert.issuanceDate).getFullYear().toString() : '',
    issueMonth: cert.issuanceDate ? (new Date(cert.issuanceDate).getMonth() + 1).toString() : '',
    certId: cert.id,
    certUrl: shareableUrl
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

// Plain share links, no Facebook/WhatsApp SDK or tracking script on the page.
// Both apps build the preview (title, description, certificate picture) from
// this page's og: tags, so there is nothing else to pass.
const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareableUrl)}`

function getWhatsAppShareUrl() {
  const text = t('credential.whatsappShareText', {
    name: getCredentialName() || t('credential.title'),
    issuer: getIssuerName(),
    url: shareableUrl,
  })
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

// ============================================================================
// EXPIRATION & RENEWAL
// ============================================================================
const isExpired = computed(() => {
  const d = credential.value?.expirationDate
  return d ? new Date(d) < new Date() : false
})

const daysUntilExpiry = computed(() => {
  const d = credential.value?.expirationDate
  if (!d) { return null }
  const diff = new Date(d).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const isExpiringSoon = computed(() => {
  const days = daysUntilExpiry.value
  return days !== null && days > 0 && days <= 30
})

const renewalState = ref<'idle' | 'picking' | 'loading' | 'success' | 'error'>('idle')
const renewalError = ref('')
const renewalNewExpiry = ref('')

async function submitRenewal() {
  if (!renewalNewExpiry.value) { return }
  renewalState.value = 'loading'
  renewalError.value = ''
  try {
    const numericId = verificationData.value?.rawCredential?.id
    if (!numericId) { throw new Error('Credential ID not available') }
    await apiClient.renewCredential(numericId, renewalNewExpiry.value)
    renewalState.value = 'success'
    await refreshCredentialDetails()
  }
  catch (err: any) {
    renewalState.value = 'error'
    renewalError.value = err?.data?.error?.message || err?.message || 'Renewal failed'
  }
}
</script>

<template>
  <div class="container mx-auto py-10 px-4">
    <!-- Loading State -->
    <div
      v-if="loading"
      class="max-w-lg mx-auto p-8 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
    >
      <div class="flex flex-col items-center justify-center">
        <div class="i-lucide-loader-2 w-12 h-12 animate-spin text-primary-500 mb-4" />
        <h2 class="text-xl font-medium">
          {{ t('credential.loadingVerification') }}
        </h2>
      </div>
    </div>

    <!-- Invalid Credential ID -->
    <div
      v-else-if="!credentialId"
      class="max-w-lg mx-auto p-8 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
    >
      <div class="text-center">
        <div class="i-lucide-alert-triangle w-16 h-16 mx-auto text-amber-500 mb-4" />
        <h2 class="text-2xl font-semibold mb-3">
          {{ t('errors.notFound') }}
        </h2>
        <p class="text-gray-600 mb-6">
          {{ t('errors.notFoundMessage') }}
        </p>
        <NuxtLink
          to="/verify"
          class="inline-flex items-center px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
        >
          <div class="i-lucide-search mr-2" />
          {{ t('credential.verifyAnother') }}
        </NuxtLink>
      </div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="max-w-lg mx-auto p-8 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
    >
      <div class="text-center">
        <div class="i-lucide-x-circle w-16 h-16 mx-auto text-red-500 mb-4" />
        <h2 class="text-2xl font-semibold mb-3">
          Error Loading Credential
        </h2>
        <p class="text-gray-600 mb-6">
          {{ error }}
        </p>
        <button
          class="inline-flex items-center px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
          @click="refreshCredentialDetails"
        >
          <div class="i-lucide-refresh-cw mr-2" />
          Try Again
        </button>
      </div>
    </div>

    <!-- Credential Details -->
    <div v-else-if="credential" class="max-w-4xl mx-auto">
      <!-- Expiration / Renewal Banner -->
      <div
        v-if="isExpired || isExpiringSoon"
        class="mb-6 p-5 rounded-2xl border shadow-md"
        :class="isExpired ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-300'"
      >
        <div class="flex items-start gap-4">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            :class="isExpired ? 'bg-red-100' : 'bg-amber-100'"
          >
            <div
              class="w-6 h-6"
              :class="isExpired ? 'i-lucide-clock-alert text-red-600' : 'i-lucide-alarm-clock text-amber-600'"
            />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold mb-1" :class="isExpired ? 'text-red-700' : 'text-amber-700'">
              {{ isExpired ? 'This credential has expired' : `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}` }}
            </h3>
            <p class="text-sm" :class="isExpired ? 'text-red-600' : 'text-amber-600'">
              {{ isExpired ? 'This credential is no longer valid. Contact the issuer to renew it.' : 'Consider asking the issuer to renew this credential soon.' }}
            </p>

            <!-- Renewal form (issuer only - shown when logged in) -->
            <div v-if="renewalState === 'idle' || renewalState === 'picking'" class="mt-3">
              <button
                v-if="renewalState === 'idle'"
                class="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                :class="isExpired ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'"
                @click="renewalState = 'picking'"
              >
                Renew Credential
              </button>
              <div v-else class="flex flex-wrap items-center gap-2 mt-2">
                <label class="text-sm font-medium text-gray-700">New expiration date:</label>
                <input
                  v-model="renewalNewExpiry"
                  type="date"
                  :min="new Date(Date.now() + 86400000).toISOString().split('T')[0]"
                  class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                <button
                  class="text-sm font-medium px-4 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors disabled:opacity-50"
                  :disabled="!renewalNewExpiry"
                  @click="submitRenewal"
                >
                  Confirm
                </button>
                <button
                  class="text-sm text-gray-500 hover:text-gray-700"
                  @click="renewalState = 'idle'"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div v-else-if="renewalState === 'loading'" class="mt-3 flex items-center gap-2 text-sm text-gray-600">
              <div class="i-lucide-loader-2 w-4 h-4 animate-spin" /> Renewing…
            </div>
            <div v-else-if="renewalState === 'success'" class="mt-3 text-sm text-green-700 font-medium">
              ✓ Credential renewed successfully.
            </div>
            <div v-else-if="renewalState === 'error'" class="mt-3 text-sm text-red-700">
              ✗ {{ renewalError }}
            </div>
          </div>
        </div>
      </div>

      <!-- Verification Status -->
      <div
        class="mb-8 p-6 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
        :class="{
          'border-green-500': verificationResult?.verified,
          'border-red-500': verificationResult && !verificationResult.verified,
        }"
      >
        <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center lg:shrink-0">
            <div
              class="w-12 h-12 shrink-0 rounded-full flex items-center justify-center mr-4"
              :class="{
                'bg-green-100': verificationResult?.verified,
                'bg-red-100': verificationResult && !verificationResult.verified,
              }"
            >
              <div
                v-if="verificationResult?.verified"
                class="i-lucide-check-circle w-8 h-8 text-green-500"
              />
              <div
                v-else
                class="i-lucide-x-circle w-8 h-8 text-red-500"
              />
            </div>
            <div>
              <h3 class="text-xl font-semibold mb-1 flex items-center gap-1">
                {{ verificationResult?.verified ? t('credential.verificationSuccess') : t('credential.verificationFailed') }}
                <button
                  class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  title="Refresh verification"
                  aria-label="Refresh verification"
                  @click="refreshCredentialDetails"
                >
                  <div class="i-lucide-refresh-cw w-4 h-4" />
                </button>
              </h3>
              <p class="text-gray-600">
                {{ verificationResult?.error || (verificationResult?.verified ? t('credential.allChecksPassed') : t('credential.someChecksFailed')) }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 lg:justify-end">
            <!-- LinkedIn / Facebook / WhatsApp (not for visitors of a private credential) -->
            <template v-if="!isPrivate || canManage">
              <a
                :href="getLinkedInAddToProfileUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="share-button bg-[#0a66c2] hover:bg-[#004182]"
                title="Add this certificate to your LinkedIn profile"
                aria-label="Add this certificate to your LinkedIn profile"
              >
                <span class="i-simple-icons-linkedin w-5 h-5" aria-hidden="true" />
                LinkedIn
              </a>
              <!-- A private credential has no public page to preview, so only
                   LinkedIn (which records it on the holder's own profile) stays. -->
              <template v-if="!isPrivate">
                <a
                  :href="facebookShareUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="share-button bg-[#0866ff] hover:bg-[#0654d4]"
                  data-testid="share-facebook"
                  :title="t('credential.shareFacebook')"
                  :aria-label="t('credential.shareFacebook')"
                >
                  <span class="i-simple-icons-facebook w-5 h-5" aria-hidden="true" />
                  Facebook
                </a>
                <a
                  :href="getWhatsAppShareUrl()"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="share-button bg-[#128c4a] hover:bg-[#0c6b37]"
                  data-testid="share-whatsapp"
                  :title="t('credential.shareWhatsApp')"
                  :aria-label="t('credential.shareWhatsApp')"
                >
                  <span class="i-simple-icons-whatsapp w-5 h-5" aria-hidden="true" />
                  WhatsApp
                </a>
              </template>
            </template>
          </div>
        </div>

        <!-- Verification Checks -->
        <div v-if="verificationResult?.checks?.length" class="mt-6">
          <h4 class="font-medium mb-4 text-gray-700">
            Verification Checks
          </h4>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="check in verificationResult.checks"
              :key="check.check"
              class="group relative overflow-hidden rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
              :class="{
                'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200/60': check.result === 'success',
                'bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200/60': check.result === 'warning',
                'bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/60': check.result === 'error',
              }"
            >
              <!-- Background decoration -->
              <div
                class="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-30"
                :class="{
                  'bg-green-400': check.result === 'success',
                  'bg-amber-400': check.result === 'warning',
                  'bg-red-400': check.result === 'error',
                }"
              />

              <div class="relative flex items-start gap-3">
                <!-- Icon container with ring -->
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 transition-transform group-hover:scale-110"
                  :class="{
                    'bg-green-100 ring-green-200/50': check.result === 'success',
                    'bg-amber-100 ring-amber-200/50': check.result === 'warning',
                    'bg-red-100 ring-red-200/50': check.result === 'error',
                  }"
                >
                  <div
                    class="h-5 w-5"
                    :class="{
                      'i-lucide-shield-check text-green-600': check.check === 'not_revoked' && check.result === 'success',
                      'i-lucide-calendar-check text-green-600': check.check === 'not_expired' && check.result === 'success',
                      'i-lucide-file-check-2 text-green-600': check.check === 'proof' && check.result === 'success',
                      'i-lucide-check-circle text-green-600': check.result === 'success' && !['not_revoked', 'not_expired', 'proof'].includes(check.check),
                      'i-lucide-alert-triangle text-amber-600': check.result === 'warning',
                      'i-lucide-x-circle text-red-600': check.result === 'error',
                    }"
                  />
                </div>

                <div class="min-w-0 flex-1">
                  <!-- Status badge -->
                  <div class="mb-1.5 flex items-center gap-2">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                      :class="{
                        'bg-green-100 text-green-700': check.result === 'success',
                        'bg-amber-100 text-amber-700': check.result === 'warning',
                        'bg-red-100 text-red-700': check.result === 'error',
                      }"
                    >
                      {{ check.result === 'success' ? 'Passed' : check.result === 'warning' ? 'Warning' : 'Failed' }}
                    </span>
                  </div>

                  <!-- Check name with friendly label -->
                  <div class="font-semibold text-gray-800">
                    {{
                      check.check === 'not_revoked' ? t('credential.checks.not_revoked')
                      : check.check === 'not_expired' ? t('credential.checks.not_expired')
                        : check.check === 'proof' ? 'Valid Signature'
                          : check.check.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    }}
                  </div>

                  <!-- Description based on check type and result -->
                  <p class="mt-1 text-xs text-gray-500">
                    {{
                      check.result === 'error' || check.result === 'warning'
                        ? (check.message || 'Verification check failed')
                        : check.check === 'not_revoked' ? 'This credential has not been revoked by the issuer'
                          : check.check === 'not_expired' ? 'This credential is within its validity period'
                            : check.check === 'proof' ? 'Cryptographic signature verified successfully'
                              : 'Verification check completed'
                    }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Private credential: notice for visitors, switch for the holder/issuer -->
      <CredentialPrivacy
        v-if="verificationResult?.rawCredential && (isPrivate || canManage)"
        :credential-id="credentialId"
        :visibility="isPrivate ? 'private' : 'public'"
        :issued-to-minor="verificationResult.rawCredential.issuedToMinor"
        :can-manage="canManage"
        :issuer-name="verificationResult.rawCredential.issuer?.name"
        :issuance-date="verificationResult.rawCredential.issuanceDate"
        @changed="onVisibilityChanged"
      />

      <!-- Main Credential Card -->
      <div v-if="!isPrivate || canManage" class="mb-8 overflow-hidden rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl">
        <!-- Credential Image -->
        <div
          v-if="displayImageUrl && !imageLoadError"
          class="relative aspect-video bg-gray-100"
        >
          <img
            :src="displayImageUrl"
            :alt="credential.name || 'Credential Image'"
            class="w-full h-full object-contain"
            @error="handleImageError"
          >
          <div class="absolute bottom-4 right-4 flex gap-2">
            <button
              class="p-2 rounded-lg bg-white/90 hover:bg-white shadow-lg transition-colors"
              title="Download image"
              @click="downloadCredential"
            >
              <div class="i-lucide-download w-5 h-5" />
            </button>
            <button
              class="p-2 rounded-lg bg-white/90 hover:bg-white shadow-lg transition-colors"
              title="Share credential"
              @click="shareCredential"
            >
              <div class="i-lucide-share w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Credential Details -->
        <div class="p-6">
          <h1 class="text-3xl font-bold mb-4">
            {{ credential.name || 'Unnamed Credential' }}
          </h1>

          <div class="prose max-w-none mb-6">
            <p>{{ credential.description }}</p>
          </div>

          <!-- Metadata Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Dates -->
            <div class="space-y-4">
              <div>
                <div class="text-sm font-medium text-gray-500">
                  Issued On
                </div>
                <div class="mt-1">
                  {{ formattedIssuanceDate }}
                </div>
              </div>
              <div>
                <div class="text-sm font-medium text-gray-500">
                  Expires On
                </div>
                <div class="mt-1">
                  {{ formattedExpirationDate }}
                </div>
              </div>
              <!-- Recipient Name -->
              <div v-if="verificationResult?.rawCredential?.recipient?.name">
                <div class="text-sm font-medium text-gray-500">
                  Recipient
                </div>
                <div class="mt-1">
                  {{ verificationResult?.rawCredential?.recipient?.name }}
                </div>
              </div>
            </div>

            <!-- Issuer -->
            <div v-if="credential.issuer" class="space-y-2">
              <div class="text-sm font-medium text-gray-500">
                Issued By
              </div>
              <div class="flex items-center">
                <img
                  v-if="typeof credential.issuer.image === 'string'"
                  :src="credential.issuer.image"
                  :alt="credential.issuer.name"
                  class="w-10 h-10 rounded-full object-cover mr-3"
                >
                <div>
                  <div class="font-medium">
                    {{ credential.issuer.name }}
                  </div>
                  <a
                    v-if="credential.issuer.url"
                    :href="credential.issuer.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary-500 hover:text-primary-600"
                  >
                    Visit Website
                  </a>
                </div>
              </div>
            </div>

            <!-- Verify -->
            <div class="space-y-2">
              <div class="text-sm font-medium text-gray-500">
                Verify
              </div>
              <img
                v-if="qrCodeDataUrl"
                :src="qrCodeDataUrl"
                alt="QR code linking to this credential's verification page"
                class="w-20 h-20"
              >
              <a
                :href="shareableUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="block text-sm text-primary-500 hover:text-primary-600 break-all"
              >
                {{ shareableUrl }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Achievement Details -->
      <div
        v-if="credential.credentialSubject?.achievement"
        class="mb-8 p-6 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
      >
        <h2 class="text-2xl font-semibold mb-4">
          Achievement Details
        </h2>

        <div class="prose max-w-none">
          <h3>{{ credential.credentialSubject.achievement.name }}</h3>
          <p>{{ credential.credentialSubject.achievement.description }}</p>

          <!-- Criteria -->
          <div v-if="credential.credentialSubject.achievement.criteria?.narrative" class="mt-6">
            <h4 class="font-medium mb-2">
              Criteria
            </h4>
            <p>{{ credential.credentialSubject.achievement.criteria.narrative }}</p>
          </div>

          <!-- Alignments -->
          <div
            v-if="credential.credentialSubject.achievement.alignments?.length"
            class="mt-6"
          >
            <h4 class="font-medium mb-2">
              Alignments
            </h4>
            <div class="space-y-4">
              <div
                v-for="alignment in credential.credentialSubject.achievement.alignments"
                :key="alignment.targetUrl"
                class="p-4 rounded-lg bg-gray-50"
              >
                <h5 class="font-medium">
                  {{ alignment.targetName }}
                </h5>
                <p v-if="alignment.targetDescription" class="text-sm">
                  {{ alignment.targetDescription }}
                </p>
                <div class="mt-2">
                  <a
                    :href="alignment.targetUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary-500 hover:text-primary-600"
                  >
                    Learn More
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Evidence -->
      <div
        v-if="credential.evidence?.length"
        class="mb-8 p-6 rounded-2xl bg-white/80 backdrop-blur-lg border border-gray-200 shadow-xl"
      >
        <h2 class="text-2xl font-semibold mb-4">
          Evidence
        </h2>
        <div class="space-y-4">
          <div
            v-for="item in (credential.evidence as Evidence[])"
            :key="item.id"
            class="p-4 rounded-lg bg-gray-50"
          >
            <h3 class="font-medium mb-2">
              {{ item.name }}
            </h3>
            <p v-if="item.description" class="text-gray-600">
              {{ item.description }}
            </p>
            <div v-if="item.narrative" class="mt-2 text-sm">
              {{ item.narrative }}
            </div>
          </div>
        </div>
      </div>

      <!-- What a verification does and does not confirm, issuer status, report link -->
      <VerificationNotice
        v-if="verificationResult"
        :issuer="verificationResult.rawCredential?.issuer"
        :credential-id="credentialId"
      />
    </div>
  </div>
</template>

<style scoped>
/* Share buttons: the main thing a recipient does on this page, so they are
   large, solid and lift on hover. */
.share-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.25rem;
  border-radius: 9999px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25rem;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
  transition: transform 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
}
.share-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.2);
}
/* Phones and tablets: buttons sit on their own row(s), so fill it evenly. */
@media (max-width: 1023px) {
  .share-button {
    flex: 1 1 auto;
    justify-content: center;
  }
}
.share-button:focus-visible {
  outline: 3px solid #1a202c;
  outline-offset: 2px;
}
</style>
