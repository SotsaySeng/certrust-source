<script setup lang="ts">
import { apiClient } from '~/api/api-client'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const authStore = ref(null)
const isStoreReady = ref(false)
const authError = ref(null)
const isLoading = ref(false)
const pageDescription = ref('Sign in to your Certrust account to access your credentials and dashboard.')

// Exact string the backend throws for POST /api/auth/local when the
// account's email hasn't been confirmed yet (Strapi's users-permissions
// plugin, ApplicationError -> HTTP 400). Matched verbatim so we can swap
// in a translated message + a resend action instead of the raw error text.
const UNCONFIRMED_EMAIL_ERROR = 'Your account email is not confirmed'
const isUnconfirmedEmailError = computed(() => authError.value === UNCONFIRMED_EMAIL_ERROR)

// ?confirmed=true is the redirect target the backend's email-confirmation
// link sends the user to (see bootstrap/email-confirmation-setup.ts's
// email_confirmation_redirection). One-time banner, not tied to authError.
const showConfirmedBanner = ref(false)

const resendStatus = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const resendError = ref<string | null>(null)

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
})

useHead({
  title: 'Login',
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/login` }
  ]
})

async function handleSubmit() {
  if (!isStoreReady.value || !authStore.value) {
    // onMounted below attaches the store on a 100ms delay; a submit that
    // beats it (password-manager autofill + submit, automated tests) should
    // just attach it now rather than be rejected.
    try {
      const { useAuthStore } = await import('~/stores/auth')
      authStore.value = useAuthStore()
      isStoreReady.value = true
    }
    catch (error) {
      console.error('Error accessing auth store:', error)
    }
  }
  if (!isStoreReady.value || !authStore.value) {
    authError.value = 'Authentication system not ready. Please try again in a moment.'
    return
  }

  if (email.value && password.value) {
    isLoading.value = true
    authError.value = null
    resendStatus.value = 'idle'
    resendError.value = null

    try {
      const success = await authStore.value.login(email.value, password.value)

      if (success) {
        router.push('/dashboard')
      }
      else {
        authError.value = authStore.value.error
      }
    }
    catch (error) {
      console.error('Login error:', error)
      authError.value = 'Login failed. Please try again.'
    }
    finally {
      isLoading.value = false
    }
  }
}

async function handleResendConfirmation() {
  if (!email.value) {
    return
  }

  resendStatus.value = 'sending'
  resendError.value = null

  try {
    await apiClient.resendConfirmationEmail(email.value)
    resendStatus.value = 'sent'
  }
  catch (error) {
    console.error('Error resending confirmation email:', error)
    resendStatus.value = 'error'
    resendError.value = error instanceof Error ? error.message : 'Failed to resend confirmation email'
  }
}

onMounted(() => {
  if (route.query.confirmed === 'true') {
    showConfirmedBanner.value = true
  }

  // Safely initialize auth store with a delay
  setTimeout(async () => {
    try {
      const { useAuthStore } = await import('~/stores/auth')
      authStore.value = useAuthStore()
      isStoreReady.value = true

      // If user is already authenticated, redirect to dashboard
      if (authStore.value.isAuthenticated) {
        router.push('/dashboard')
      }
    }
    catch (error) {
      console.error('Error accessing auth store:', error)
    }
  }, 100)
})
</script>

<template>
  <div class="flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 h-full flex-grow-1">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2 class="text-4xl font-bold text-text-primary">
          {{ t('auth.signInTitle') }}
        </h2>
        <p class="mt-2 text-text-secondary">
          {{ t('auth.signInSubtitle') }}
        </p>
      </div>

      <!-- Form -->
      <div class="mt-8 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <!-- Email confirmed banner (redirected here from the confirmation link) -->
        <div v-if="showConfirmedBanner" class="rounded-lg bg-green-50 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="w-5 h-5 i-heroicons-check-circle text-green-400" />
            </div>
            <div class="ml-3">
              <p class="text-sm text-green-800">
                {{ t('auth.emailConfirmedSuccess') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="authError" class="rounded-lg bg-red-50 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="w-5 h-5 i-heroicons-x-circle text-red-400" />
            </div>
            <div class="ml-3 flex-1">
              <p class="text-sm text-red-800">
                {{ isUnconfirmedEmailError ? t('auth.emailNotConfirmed') : authError }}
              </p>
              <div v-if="isUnconfirmedEmailError" class="mt-2">
                <button
                  type="button"
                  class="text-sm font-medium text-[#28A745] hover:text-[#28A745]/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="resendStatus === 'sending' || resendStatus === 'sent'"
                  @click="handleResendConfirmation"
                >
                  <span v-if="resendStatus === 'sent'">{{ t('auth.resendConfirmationSent') }}</span>
                  <span v-else-if="resendStatus === 'sending'">{{ t('common.loading') }}</span>
                  <span v-else>{{ t('auth.resendConfirmation') }}</span>
                </button>
                <p v-if="resendStatus === 'error'" class="text-xs text-red-600 mt-1">
                  {{ resendError }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-text-primary">
              {{ t('auth.email') }}
            </label>
            <div class="mt-1">
              <input
                id="email"
                v-model="email"
                name="email"
                type="email"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                placeholder="Enter your email"
              >
            </div>
          </div>

          <!-- Password -->
          <div>
            <label for="password" class="block text-sm font-medium text-text-primary">
              {{ t('auth.password') }}
            </label>
            <div class="mt-1">
              <input
                id="password"
                v-model="password"
                name="password"
                type="password"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                placeholder="Enter your password"
              >
            </div>
          </div>

          <!-- Remember & Forgot -->
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                class="h-4 w-4 text-[#28A745] focus:ring-[#28A745] border-gray-300 rounded"
              >
              <label for="remember-me" class="ml-2 block text-sm text-text-secondary">
                {{ t('auth.rememberMe') }}
              </label>
            </div>

            <div class="text-sm">
              <NuxtLink to="/forgot-password" class="font-medium text-text-secondary hover:text-[#28A745]/80">
                {{ t('auth.forgotPassword') }}
              </NuxtLink>
            </div>
          </div>

          <!-- Submit Button -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-white bg-[#28A745] hover:bg-[#28A745]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#28A745] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!isLoading" class="text-[#000]">{{ t('nav.login') }}</span>
              <div v-else class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </button>
          </div>
        </form>

        <!-- Sign up link -->
        <!-- <div class="mt-6 text-center">
          <p class="text-sm text-text-secondary">
            Don't have an account?
            <NuxtLink to="/register" class="font-medium text-[#28A745] hover:text-[#28A745]/80">
              Sign up for free
            </NuxtLink>
          </p>
        </div> -->
      </div>
    </div>
  </div>
</template>
