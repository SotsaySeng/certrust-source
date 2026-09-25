<script setup lang="ts">
import { apiClient } from '~/api/api-client'

const { t } = useI18n()
definePageMeta({
  middleware: ['auth']
})

interface Certificate {
  id: string
  credentialId?: string
  title: string
  description: string
  issueDate: string
  recipientCount: number
  status: 'active' | 'draft' | 'archived'
  type?: string
  recipient?: {
    name: string
    email: string
  }
  issuer?: {
    name: string
    url: string
  }
}

interface DashboardStats {
  credentialsIssued: number
  credentialsRevoked: number
  credentialsExpired: number
  credentialsReceived: number
  achievementsCreated: number
  uniqueRecipients: number
  topAchievements: { id: number, name: string, count: number }[]
  memberSince: string
  scheduledCredentials: number
  draftCredentials: number
  issuanceByMonth: { month: string, count: number }[]
}

interface OrganizationUsage {
  tier: string | null
  limit: number | null
}

const authStore = useAuthStore()
const loading = ref(false)
const error = ref<string | null>(null)
const pageDescription = ref('Your Certrust dashboard: manage your issued and received digital credentials')

const receivedCertificates = ref<Certificate[]>([])
const issuedCertificates = ref<Certificate[]>([])
const dashboardStats = ref<DashboardStats | null>(null)
const organizationUsage = ref<OrganizationUsage>({ tier: null, limit: null })

// Usage-bar math, derived from real stats rather than guessed.
const usageRatio = computed(() => {
  const limit = organizationUsage.value.limit
  if (!limit || limit <= 0) {
    return 0
  }
  const used = dashboardStats.value?.credentialsIssued ?? 0
  return used / limit
})

const usagePercentage = computed(() => Math.min(100, Math.round(usageRatio.value * 100)))

const usageStatus = computed<'ok' | 'near' | 'at'>(() => {
  if (usageRatio.value >= 1) {
    return 'at'
  }
  if (usageRatio.value >= 0.8) {
    return 'near'
  }
  return 'ok'
})

const usageBarColor = computed(() => {
  if (usageStatus.value === 'at') {
    return '#DC2626'
  }
  if (usageStatus.value === 'near') {
    return '#F59E0B'
  }
  return '#28A745'
})

const tierLabel = computed(() => {
  const tier = organizationUsage.value.tier
  if (!tier) {
    return ''
  }
  return tier.charAt(0).toUpperCase() + tier.slice(1)
})

// Utility to generate LinkedIn Add to Profile URL
function getLinkedInAddToProfileUrl(cert: Certificate) {
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: cert.title,
    organizationName: cert.issuer?.name || 'Certrust',
    issueYear: cert.issueDate ? new Date(cert.issueDate).getFullYear().toString() : '',
    issueMonth: cert.issueDate ? (new Date(cert.issueDate).getMonth() + 1).toString() : '',
    certId: cert.credentialId || cert.id,
    certUrl: `${window.location.origin}/credentials/${encodeURIComponent(cert.credentialId || cert.id)}`
  })
  return `https://www.linkedin.com/profile/add?${params.toString()}`
}

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value
})

useHead({
  title: t('dashboard.title'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/dashboard` }
  ]
})

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    return
  }

  loading.value = true
  error.value = null

  try {
    const [receivedResponse, issuedResponse, statsResponse, usageResponse] = await Promise.all([
      apiClient.getReceivedCertificates(),
      authStore.isIssuer ? apiClient.getIssuedCertificates() : Promise.resolve({ data: [] }),
      authStore.isIssuer ? apiClient.getDashboardStats() : Promise.resolve({ data: null }),
      authStore.isIssuer ? apiClient.getOrganizationUsage() : Promise.resolve({ data: { tier: null, limit: null } })
    ])

    receivedCertificates.value = receivedResponse.data || []
    issuedCertificates.value = issuedResponse.data || []
    dashboardStats.value = statsResponse.data || null
    organizationUsage.value = usageResponse.data || { tier: null, limit: null }
  }
  catch (err) {
    console.error('Error fetching dashboard data:', err)
    error.value = 'Failed to load dashboard data. Please try again.'
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
      <p class="text-red-800">
        {{ error }}
      </p>
      <button
        class="mt-2 text-sm text-red-600 hover:text-red-800"
        @click="$router.go(0)"
      >
        Try Again
      </button>
    </div>

    <template v-else>
      <BillingBanner v-if="authStore.isIssuer" />

      <!-- Usage Section (issuers with an organization only) -->
      <div
        v-if="authStore.isIssuer && organizationUsage.tier"
        class="mb-8 bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg"
      >
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-medium text-text-primary">
            {{ t('dashboard.usage.title') }}
          </h2>
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#28A745]/10 text-[#28A745] capitalize">
            {{ tierLabel }}
          </span>
        </div>

        <div class="flex items-center justify-between text-sm text-text-secondary mb-2">
          <span>{{ t('dashboard.usage.credentialsIssued') }}</span>
          <span class="font-medium text-text-primary">
            {{ dashboardStats?.credentialsIssued ?? 0 }} / {{ organizationUsage.limit === null ? t('dashboard.usage.unlimited') : organizationUsage.limit }}
          </span>
        </div>

        <div v-if="organizationUsage.limit !== null" class="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :style="{ width: `${usagePercentage}%`, backgroundColor: usageBarColor }"
          />
        </div>

        <p v-if="usageStatus === 'at'" class="mt-2 text-xs font-medium" :style="{ color: usageBarColor }">
          {{ t('dashboard.usage.atLimit') }}
        </p>
        <p v-else-if="usageStatus === 'near'" class="mt-2 text-xs font-medium" :style="{ color: usageBarColor }">
          {{ t('dashboard.usage.nearLimit') }}
        </p>
      </div>

      <!-- Analytics Section (issuers only) - real numbers from
           GET /api/dashboard/stats, no tracking-dependent metrics (email
           open rate/views/shares/downloads/LinkedIn performance) since no
           backend data exists for any of that. -->
      <div v-if="authStore.isIssuer && dashboardStats" class="mb-8">
        <h2 class="text-lg font-medium text-text-primary mb-3">
          {{ t('dashboard.analytics.title') }}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-[#28A745]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <div class="w-5 h-5 i-heroicons-document-check text-[#28A745]" />
              </div>
              <div>
                <p class="text-2xl font-semibold text-text-primary">
                  {{ dashboardStats.credentialsIssued }}
                </p>
                <p class="text-sm text-text-secondary">
                  {{ t('dashboard.analytics.issued') }}
                </p>
              </div>
            </div>
          </div>
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <div class="w-5 h-5 i-heroicons-clock text-amber-600" />
              </div>
              <div>
                <p class="text-2xl font-semibold text-text-primary">
                  {{ dashboardStats.scheduledCredentials }}
                </p>
                <p class="text-sm text-text-secondary">
                  {{ t('dashboard.analytics.scheduled') }}
                </p>
              </div>
            </div>
          </div>
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <div class="w-5 h-5 i-heroicons-document-text text-slate-600" />
              </div>
              <div>
                <p class="text-2xl font-semibold text-text-primary">
                  {{ dashboardStats.draftCredentials }}
                </p>
                <p class="text-sm text-text-secondary">
                  {{ t('dashboard.analytics.draft') }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
          <h3 class="text-sm font-medium text-text-primary mb-4">
            {{ t('dashboard.analytics.chartTitle') }}
          </h3>
          <IssuanceTrendChart :data="dashboardStats.issuanceByMonth" />
        </div>
      </div>

      <!-- Received Certificates Section -->
      <div v-if="!authStore.isIssuer" class="mb-12">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-semibold">
            {{ t('dashboard.received') }}
          </h2>
        </div>
        <div v-if="receivedCertificates.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
          <div class="i-heroicons-inbox w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 class="text-lg font-medium mb-2">
            {{ t('dashboard.noCredentials') }}
          </h3>
          <p class="text-gray-600">
            You haven't received any certificates yet.
          </p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CertificateCard
            v-for="cert in receivedCertificates"
            :key="cert.id"
            :certificate="cert"
            :show-recipient="false"
          >
            <template #actions>
              <a
                :href="getLinkedInAddToProfileUrl(cert)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0077b5] text-white rounded hover:bg-[#005983] transition-colors text-sm font-medium mt-2"
                aria-label="Add this certificate to your LinkedIn profile"
              >
                <img src="https://download.linkedin.com/desktop/add2profile/buttons/en_US.png" alt="LinkedIn Add to Profile" class="h-5 w-auto">
                Add to LinkedIn
              </a>
            </template>
          </CertificateCard>
        </div>
      </div>

      <!-- Issued Certificates Section (Only for issuers) -->
      <div v-if="authStore.isIssuer">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-semibold">
            {{ t('dashboard.issued') }}
          </h2>
          <NuxtLink
            to="/issue"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors"
          >
            <span class="i-heroicons-plus w-4 h-4" aria-hidden="true" />
            Issue New
          </NuxtLink>
        </div>
        <div v-if="issuedCertificates.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
          <div class="i-heroicons-document-plus w-12 h-12 mx-auto text-gray-400 mb-3" />
          <h3 class="text-lg font-medium mb-2">
            {{ t('dashboard.noCredentials') }}
          </h3>
          <p class="text-gray-600 mb-4">
            You haven't issued any certificates yet.
          </p>
          <NuxtLink
            to="/issue"
            class="inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors"
          >
            <div class="i-heroicons-plus w-5 h-5 mr-2" />
            Issue Your First Certificate
          </NuxtLink>
        </div>
        <IssuedCredentialsTable v-else :credentials="issuedCertificates" />
      </div>
    </template>
  </div>
</template>
