<script setup lang="ts">
import { apiClient } from '~/api/api-client'

definePageMeta({
  middleware: ['route-guard']
})
const { t } = useI18n()
// Don't import useAuthStore directly
const router = useRouter()
const firstName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const acceptTerms = ref(false)
const validationError = ref('')
const authStore = ref(null)
const isStoreReady = ref(false)
const isLoading = ref(false)
const pageDescription = ref('Create a Certrust account to issue, manage, and verify digital credentials.')

// Organization fields - a self-service registration auto-creates an
// Organization (free tier) + Profile server-side (see
// api::organization.provisioning on the backend). Name is required by that
// service; type is optional.
const organizationName = ref('')
const organizationType = ref('')
const orgTypes = ref<{ id: number, name: string }[]>([])
const isLoadingOrgTypes = ref(false)

// Registration can land in one of two post-submit states depending on
// whether email confirmation is enabled (it is, in this app - see
// bootstrap/email-confirmation-setup.ts on the backend): either the user
// is logged in immediately, or they have no token yet and must confirm
// their email first. 'idle' keeps rendering the form.
const registrationStatus = ref<'idle' | 'pending-confirmation'>('idle')
const pendingEmail = ref('')

async function loadOrgTypes() {
  isLoadingOrgTypes.value = true
  try {
    const response = await apiClient.getOrgTypes()
    orgTypes.value = response.data || []
  }
  catch (error) {
    console.error('Error loading organization types:', error)
  }
  finally {
    isLoadingOrgTypes.value = false
  }
}

onMounted(() => {
  // Public endpoint, no auth needed - fetch independently of the auth
  // store dance below.
  loadOrgTypes()

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

async function handleSubmit() {
  // Clear previous errors
  validationError.value = ''

  if (!isStoreReady.value || !authStore.value) {
    validationError.value = 'Authentication system not ready. Please try again in a moment.'
    return
  }

  // Form validation
  if (password.value !== confirmPassword.value) {
    validationError.value = 'Passwords do not match'
    return
  }

  if (!acceptTerms.value) {
    validationError.value = 'You must accept the terms and conditions'
    return
  }

  if (!organizationName.value.trim()) {
    validationError.value = t('auth.organizationNameRequired')
    return
  }

  if (firstName.value && email.value && password.value) {
    isLoading.value = true

    try {
      // The form only ever collects a single "Username" field (bound to
      // firstName) - there is no separate last-name input. Pre-existing
      // bug fixed here: this gate previously also required a `lastName`
      // ref that was declared but never bound to any template input, so
      // it was always an empty string - the whole if-block (and therefore
      // registration itself) could never run, for any user, silently.
      const username = firstName.value.toLowerCase()

      const result = await authStore.value.register(
        username,
        email.value,
        password.value,
        organizationName.value.trim(),
        organizationType.value || undefined
      )

      if (result.status === 'confirmed') {
        router.push('/dashboard')
      }
      else if (result.status === 'pending-confirmation') {
        pendingEmail.value = email.value
        registrationStatus.value = 'pending-confirmation'
      }
      else {
        validationError.value = authStore.value.error || 'Registration failed'
      }
    }
    catch (error) {
      console.error('Registration error:', error)
      validationError.value = 'Registration failed. Please try again.'
    }
    finally {
      isLoading.value = false
    }
  }
}

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/register`
})

useHead({
  title: 'Register',
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/register` }
  ]
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div class="text-center">
        <h2 class="text-4xl font-bold text-text-primary">
          {{ t('auth.signUpTitle') }}
        </h2>
        <p class="mt-2 text-text-secondary">
          {{ t('auth.signUpSubtitle') }}
        </p>
      </div>

      <!-- Pending email confirmation -->
      <div v-if="registrationStatus === 'pending-confirmation'" class="mt-8 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg text-center">
        <div class="w-16 h-16 bg-[#28A745]/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <div class="w-8 h-8 i-heroicons-envelope text-[#28A745]" />
        </div>
        <h3 class="text-lg font-medium text-text-primary mb-2">
          {{ t('auth.checkEmailTitle') }}
        </h3>
        <p class="text-text-secondary text-sm">
          {{ t('auth.checkEmailSubtitle', { email: pendingEmail }) }}
        </p>
        <div class="mt-6 text-center">
          <p class="text-sm text-text-secondary">
            <NuxtLink to="/login" class="font-medium text-[#28A745] hover:text-[#28A745]/80">
              {{ t('nav.login') }}
            </NuxtLink>
          </p>
        </div>
      </div>

      <!-- Form -->
      <div v-else class="mt-8 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <!-- Validation Error -->
        <div v-if="validationError" class="rounded-lg bg-red-50 p-4 mb-6">
          <div class="flex">
            <div class="flex-shrink-0">
              <div class="w-5 h-5 i-heroicons-x-circle text-red-400" />
            </div>
            <div class="ml-3">
              <p class="text-sm text-red-800">
                {{ validationError }}
              </p>
            </div>
          </div>
        </div>

        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- Username -->
          <div>
            <label for="username" class="block text-sm font-medium text-text-primary">
              Username
            </label>
            <div class="mt-1">
              <input
                id="username"
                v-model="firstName"
                name="username"
                type="text"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                placeholder="Choose a username"
              >
            </div>
          </div>

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

          <!-- Organization Name -->
          <div>
            <label for="organizationName" class="block text-sm font-medium text-text-primary">
              {{ t('auth.organizationName') }}
            </label>
            <div class="mt-1">
              <input
                id="organizationName"
                v-model="organizationName"
                name="organizationName"
                type="text"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                :placeholder="t('auth.organizationNamePlaceholder')"
              >
            </div>
          </div>

          <!-- Organization Type -->
          <div>
            <label for="organizationType" class="block text-sm font-medium text-text-primary">
              {{ t('auth.organizationType') }}
            </label>
            <div class="mt-1">
              <select
                id="organizationType"
                v-model="organizationType"
                name="organizationType"
                :disabled="isLoadingOrgTypes"
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:opacity-50"
              >
                <option value="">
                  {{ t('auth.organizationTypePlaceholder') }}
                </option>
                <option v-for="orgType in orgTypes" :key="orgType.id" :value="orgType.id">
                  {{ orgType.name }}
                </option>
              </select>
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
                placeholder="Create a strong password"
              >
            </div>
          </div>

          <!-- Confirm Password -->
          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-text-primary">
              {{ t('auth.confirmPassword') }}
            </label>
            <div class="mt-1">
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                class="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
                placeholder="Confirm your password"
              >
            </div>
          </div>

          <!-- Terms -->
          <div class="flex items-center">
            <input
              id="terms"
              v-model="acceptTerms"
              name="terms"
              type="checkbox"
              required
              class="h-4 w-4 text-[#28A745] focus:ring-[#28A745] border-gray-300 rounded"
            >
            <label for="terms" class="ml-2 block text-sm text-text-secondary">
              <span>{{ t('auth.termsAgree') }}</span>
              <NuxtLink to="/terms-and-conditions" class="font-medium text-[#28A745] hover:text-[#28A745]/80">Terms and Conditions</NuxtLink>,
              <NuxtLink to="/data-processing-agreement" class="font-medium text-[#28A745] hover:text-[#28A745]/80">Data Processing Agreement</NuxtLink>
              and
              <NuxtLink to="/privacy-policy" class="font-medium text-[#28A745] hover:text-[#28A745]/80">Privacy Policy</NuxtLink>
            </label>
          </div>

          <!-- Submit Button -->
          <div>
            <button
              type="submit"
              :disabled="isLoading"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-full shadow-sm text-white bg-[#28A745] hover:bg-[#28A745]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#28A745] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!isLoading">{{ t('auth.signUp') }}</span>
              <div v-else class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </button>
          </div>
        </form>

        <!-- Sign in link -->
        <div class="mt-6 text-center">
          <p class="text-sm text-text-secondary">
            {{ t('auth.alreadyHaveAccount') }}
            <NuxtLink to="/login" class="font-medium text-[#28A745] hover:text-[#28A745]/80">
              {{ t('nav.login') }}
            </NuxtLink>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
