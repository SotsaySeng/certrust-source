<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { useAuthStore } from '~/stores/auth'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

definePageMeta({
  middleware: ['auth']
})

interface Stats {
  credentialsIssued: number
  credentialsRevoked: number
  credentialsExpired: number
  credentialsReceived: number
  achievementsCreated: number
  uniqueRecipients: number
  topAchievements: { id: number, name: string, count: number }[]
  memberSince: string
}

const loading = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)
const pageDescription = ref('Everything regarding your profile from your Certrust account')

const form = ref({
  name: '',
  description: '',
  url: '',
  telephone: '',
})

// Seeded from the real, already-fetched profile (authStore.profile - see
// stores/auth.ts's init()/login()), not a separate fetch or hardcoded
// placeholder data. A watch (not a one-time assignment) because this
// page can render before authStore.init()'s async profile fetch resolves.
watch(
  () => authStore.profile,
  (p) => {
    if (p) {
      form.value = {
        name: p.name || '',
        description: p.description || '',
        url: p.url || '',
        telephone: p.telephone || '',
      }
    }
  },
  { immediate: true }
)

const stats = ref<Stats>({
  credentialsIssued: 0,
  credentialsRevoked: 0,
  credentialsExpired: 0,
  credentialsReceived: 0,
  achievementsCreated: 0,
  uniqueRecipients: 0,
  topAchievements: [],
  memberSince: new Date().toISOString(),
})
const statsLoading = ref(false)

// Change password
const showPasswordForm = ref(false)
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const passwordLoading = ref(false)
const passwordError = ref<string | null>(null)
const passwordSuccess = ref(false)

// Export data
const exportLoading = ref(false)
const exportError = ref<string | null>(null)

// Delete account
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const deleteError = ref<string | null>(null)

// Fetch real stats from the backend
onMounted(async () => {
  statsLoading.value = true
  try {
    const result = await apiClient.getDashboardStats()
    if (result.data) {
      stats.value = result.data
    }
  }
  catch (err) {
    console.error('Failed to load dashboard stats', err)
  }
  finally {
    statsLoading.value = false
  }
})

async function handleSubmit() {
  if (!authStore.profile) {
    return
  }
  saveError.value = null
  saveSuccess.value = false
  loading.value = true
  try {
    const response = await apiClient.updateProfile(authStore.profile.id, {
      name: form.value.name,
      description: form.value.description,
      url: form.value.url,
      telephone: form.value.telephone,
    })
    if (response?.data) {
      authStore.profile = { ...authStore.profile, ...response.data }
    }
    saveSuccess.value = true
  }
  catch (error: any) {
    console.error('Failed to update profile:', error)
    saveError.value = error?.message || 'Failed to update profile'
  }
  finally {
    loading.value = false
  }
}

function handleChangePassword() {
  showPasswordForm.value = !showPasswordForm.value
  passwordError.value = null
  passwordSuccess.value = false
  passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
}

async function submitPasswordChange() {
  passwordError.value = null
  passwordSuccess.value = false

  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    passwordError.value = 'New passwords do not match'
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    passwordError.value = 'New password must be at least 6 characters'
    return
  }

  passwordLoading.value = true
  try {
    await apiClient.post<{ session?: boolean }>('/api/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      password: passwordForm.value.newPassword,
      // Strapi's change-password validation is .noUnknown() and requires
      // exactly these 3 keys - passwordConfirmation was missing here
      // before, which made this request 400 every single time.
      passwordConfirmation: passwordForm.value.confirmPassword,
    })
    // Strapi issues a fresh JWT; the API puts it straight into the HttpOnly
    // session cookie (backend middlewares/auth-cookie.ts).
    passwordSuccess.value = true
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  }
  catch (err: any) {
    passwordError.value = err?.message || 'Failed to change password'
  }
  finally {
    passwordLoading.value = false
  }
}

async function handleExportData() {
  exportError.value = null
  exportLoading.value = true
  try {
    const data = await apiClient.get<any>('/api/profiles/me/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certrust-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  catch (err: any) {
    exportError.value = err?.message || 'Export failed'
  }
  finally {
    exportLoading.value = false
  }
}

async function confirmDeleteAccount() {
  deleteError.value = null
  deleteLoading.value = true
  try {
    await apiClient.deleteAccount()
    authStore.logout()
    router.push('/')
  }
  catch (err: any) {
    deleteError.value = err?.message || 'Failed to delete account'
    deleteLoading.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/profile`
})

useHead({
  title: t('profile.title'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/profile` }
  ]
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('profile.title') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('profile.account') }}
        </p>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Profile Info -->
        <div class="lg:col-span-2">
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
            <form class="space-y-6" @submit.prevent="handleSubmit">
              <!-- Personal Information -->
              <div class="space-y-4">
                <div>
                  <label for="name" class="block text-sm font-medium text-text-primary mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    v-model="form.name"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                    placeholder="Enter your full name"
                  >
                </div>

                <div>
                  <label class="block text-sm font-medium text-text-primary mb-2">
                    Email Address
                  </label>
                  <input
                    :value="authStore.profile?.email"
                    type="email"
                    disabled
                    class="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg shadow-sm text-text-secondary cursor-not-allowed"
                  >
                  <p class="mt-1 text-xs text-text-secondary">
                    Contact support to change your email address.
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-medium text-text-primary mb-2">
                    Organization
                  </label>
                  <input
                    :value="authStore.profile?.organization?.name || 'No organization'"
                    type="text"
                    disabled
                    class="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg shadow-sm text-text-secondary cursor-not-allowed"
                  >
                </div>

                <div>
                  <label for="website" class="block text-sm font-medium text-text-primary mb-2">
                    Website
                  </label>
                  <input
                    id="website"
                    v-model="form.url"
                    type="url"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                    placeholder="https://example.com"
                  >
                </div>

                <div>
                  <label for="telephone" class="block text-sm font-medium text-text-primary mb-2">
                    Phone
                  </label>
                  <input
                    id="telephone"
                    v-model="form.telephone"
                    type="tel"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                    placeholder="Enter your phone number"
                  >
                </div>

                <div>
                  <label for="bio" class="block text-sm font-medium text-text-primary mb-2">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    v-model="form.description"
                    rows="4"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                    placeholder="Tell us about yourself"
                  />
                </div>
              </div>

              <div v-if="saveError" class="rounded-lg bg-red-50 p-4">
                <p class="text-sm text-red-800">
                  {{ saveError }}
                </p>
              </div>
              <div v-if="saveSuccess" class="rounded-lg bg-green-50 p-4">
                <p class="text-sm text-green-800">
                  Profile updated successfully.
                </p>
              </div>

              <!-- Submit Button -->
              <div>
                <button
                  type="submit"
                  :disabled="loading"
                  class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-white bg-[#28A745] hover:bg-[#28A745]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#28A745] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!loading">{{ t('profile.save') }}</span>
                  <div v-else class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-1 space-y-8">
          <!-- Account Stats -->
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <h2 class="text-lg font-medium text-text-primary mb-4">
              Account Overview
            </h2>
            <div v-if="statsLoading" class="py-4 text-center text-text-secondary text-sm">
              Loading…
            </div>
            <div v-else class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Credentials Issued</span>
                <span class="font-medium text-text-primary">{{ stats.credentialsIssued }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Credentials Received</span>
                <span class="font-medium text-text-primary">{{ stats.credentialsReceived }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Achievements Created</span>
                <span class="font-medium text-text-primary">{{ stats.achievementsCreated }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Unique Recipients</span>
                <span class="font-medium text-text-primary">{{ stats.uniqueRecipients }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Revoked</span>
                <span class="font-medium text-text-primary">{{ stats.credentialsRevoked }}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-text-secondary">Member Since</span>
                <span class="font-medium text-text-primary">{{ formatDate(stats.memberSince) }}</span>
              </div>
            </div>
          </div>

          <!-- Issuer verification (organisation members only) -->
          <IssuerVerification v-if="authStore.profile?.organization" />

          <!-- Account Actions -->
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
            <h2 class="text-lg font-medium text-text-primary mb-4">
              Account Actions
            </h2>
            <div class="space-y-3">
              <!-- Change Password -->
              <button
                class="w-full flex items-center justify-between px-4 py-2 text-text-primary hover:bg-gray-50 rounded-lg transition-colors"
                @click="handleChangePassword"
              >
                <span>{{ t('profile.changePassword') }}</span>
                <div class="w-5 h-5" :class="showPasswordForm ? 'i-heroicons-chevron-up' : 'i-heroicons-key'" />
              </button>
              <div v-if="showPasswordForm" class="border border-gray-100 rounded-lg p-4 space-y-3">
                <div v-if="passwordSuccess" class="text-sm text-green-600 font-medium">
                  Password changed successfully.
                </div>
                <div v-if="passwordError" class="text-sm text-red-600">
                  {{ passwordError }}
                </div>
                <input
                  v-model="passwordForm.currentPassword"
                  type="password"
                  placeholder="Current password"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#28A745]"
                  autocomplete="current-password"
                >
                <input
                  v-model="passwordForm.newPassword"
                  type="password"
                  placeholder="New password"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#28A745]"
                  autocomplete="new-password"
                >
                <input
                  v-model="passwordForm.confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#28A745]"
                  autocomplete="new-password"
                >
                <button
                  class="w-full py-2 bg-[#28A745] text-white rounded-lg text-sm font-medium hover:bg-[#28A745]/90 transition-colors disabled:opacity-50"
                  :disabled="passwordLoading"
                  @click="submitPasswordChange"
                >
                  {{ passwordLoading ? 'Saving…' : 'Update Password' }}
                </button>
              </div>

              <!-- Export Data -->
              <div v-if="exportError" class="text-sm text-red-600 px-4">
                {{ exportError }}
              </div>
              <button
                class="w-full flex items-center justify-between px-4 py-2 text-text-primary hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                :disabled="exportLoading"
                @click="handleExportData"
              >
                <span>{{ exportLoading ? 'Exporting…' : t('profile.exportData') }}</span>
                <div class="w-5 h-5 i-heroicons-arrow-down-tray" />
              </button>

              <!-- Delete Account -->
              <button
                class="w-full flex items-center justify-between px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                @click="showDeleteConfirm = true"
              >
                <span>Delete Account</span>
                <div class="w-5 h-5 i-heroicons-trash" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete account confirmation -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
        <h3 class="text-lg font-medium text-text-primary mb-2">
          Delete your account?
        </h3>
        <p class="text-sm text-text-secondary mb-4">
          This permanently erases your login and contact details. Credentials you issued or received stay verifiable. If you are the last member of your organisation, it is closed and its credentials show "Issuer account inactive". This cannot be undone.
        </p>
        <p v-if="deleteError" class="text-sm text-red-600 mb-4">
          {{ deleteError }}
        </p>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-text-secondary hover:text-text-primary" @click="showDeleteConfirm = false">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="deleteLoading"
            class="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50"
            @click="confirmDeleteAccount"
          >
            {{ deleteLoading ? t('common.loading') : 'Delete Account' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
