<script setup lang="ts">
/**
 * "Connect Certrust" consent screen. An AI app (Claude, ChatGPT, ...) sends
 * the member here (the OAuth authorization endpoint); they choose what the
 * app may do and are sent back to it. The backend re-checks everything on
 * submit (api/oauth-client), this page only asks.
 */
import type { ApiKeyScope, OAuthConsentInfo } from '~/api/api-client'
import { apiClient } from '~/api/api-client'
import { useAuthStore } from '~/stores/auth'

const { t } = useI18n()
const route = useRoute()

useHead({ title: t('oauth.title'), meta: [{ name: 'robots', content: 'noindex' }] })

const SCOPES: ApiKeyScope[] = ['read', 'issue', 'revoke', 'manage']

const info = ref<OAuthConsentInfo | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const scopes = ref<ApiKeyScope[]>([])
const submitting = ref(false)
const submitError = ref<string | null>(null)

const params = computed(() => {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string') {
      out[k] = v
    }
  }
  return out
})

async function load() {
  const auth = useAuthStore()
  await auth.init()
  if (!auth.isAuthenticated) {
    await navigateTo(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
    return
  }
  try {
    info.value = await apiClient.getOAuthConsent(params.value)
    if (info.value.errorRedirect) {
      window.location.href = info.value.errorRedirect
      return
    }
    scopes.value = [...info.value.requestedScopes]
  }
  catch (err: any) {
    loadError.value = err?.data?.error?.message || t('oauth.loadError')
  }
  finally {
    loading.value = false
  }
}

async function decide(approve: boolean) {
  submitError.value = null
  if (approve && scopes.value.length === 0) {
    submitError.value = t('apiKeys.form.scopeRequired')
    return
  }
  submitting.value = true
  try {
    const { redirect } = await apiClient.decideOAuthConsent(params.value, approve, scopes.value)
    window.location.href = redirect
  }
  catch (err: any) {
    submitError.value = err?.data?.error?.message || t('oauth.submitError')
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-12 px-4">
    <div class="max-w-lg mx-auto">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="loadError" class="bg-white rounded-2xl p-6 shadow-lg" data-testid="oauth-error">
        <div class="flex items-start gap-3">
          <div class="i-heroicons-exclamation-triangle w-6 h-6 text-amber-600 flex-shrink-0" />
          <div>
            <h1 class="text-lg font-medium text-text-primary">
              {{ t('oauth.errorTitle') }}
            </h1>
            <p class="mt-1 text-sm text-text-secondary">
              {{ loadError }}
            </p>
          </div>
        </div>
      </div>

      <div v-else-if="info" class="bg-white rounded-2xl p-6 sm:p-8 shadow-lg" data-testid="oauth-consent">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-12 h-12 rounded-xl bg-[#28A745]/10 flex items-center justify-center flex-shrink-0">
            <div class="i-heroicons-sparkles w-6 h-6 text-[#1e7e34]" />
          </div>
          <div class="min-w-0">
            <h1 class="text-xl font-semibold text-text-primary break-words">
              {{ t('oauth.heading', { app: info.clientName }) }}
            </h1>
            <p class="text-sm text-text-secondary break-words">
              {{ t('oauth.returnsTo', { host: info.redirectHost }) }}
            </p>
          </div>
        </div>

        <template v-if="info.apiAccess && info.organization">
          <p class="text-sm text-text-primary">
            {{ t('oauth.intro', { app: info.clientName, org: info.organization.name }) }}
          </p>

          <fieldset class="mt-5">
            <legend class="text-sm font-medium text-text-primary mb-2">
              {{ t('oauth.permissions') }}
            </legend>
            <div class="grid gap-2">
              <label v-for="scope in SCOPES" :key="scope" class="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <input v-model="scopes" type="checkbox" :value="scope" class="mt-1" :data-testid="`oauth-scope-${scope}`">
                <span>
                  <span class="block text-sm font-medium text-text-primary">{{ t(`apiKeys.scopes.${scope}.label`) }}</span>
                  <span class="block text-xs text-text-secondary">{{ t(`apiKeys.scopes.${scope}.description`) }}</span>
                </span>
              </label>
            </div>
          </fieldset>

          <ul class="mt-5 space-y-2 text-xs text-text-secondary">
            <li class="flex gap-2">
              <div class="i-heroicons-user w-4 h-4 flex-shrink-0" />
              {{ t('oauth.actsAs') }}
            </li>
            <li class="flex gap-2">
              <div class="i-heroicons-envelope w-4 h-4 flex-shrink-0" />
              {{ t('oauth.emails') }}
            </li>
            <li class="flex gap-2">
              <div class="i-heroicons-x-circle w-4 h-4 flex-shrink-0" />
              {{ t('oauth.disconnect') }}
            </li>
          </ul>

          <p v-if="submitError" class="mt-4 text-sm text-red-600">
            {{ submitError }}
          </p>
          <div class="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button type="button" :disabled="submitting" class="px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50" data-testid="oauth-deny" @click="decide(false)">
              {{ t('oauth.deny') }}
            </button>
            <button type="button" :disabled="submitting" class="px-5 py-2 rounded-full bg-[#28A745] text-black text-sm font-medium hover:bg-[#28A745]/90 disabled:opacity-50" data-testid="oauth-approve" @click="decide(true)">
              {{ submitting ? t('common.loading') : t('oauth.approve', { app: info.clientName }) }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="flex items-start gap-3" data-testid="oauth-not-in-plan">
            <div class="i-heroicons-lock-closed w-6 h-6 text-text-secondary flex-shrink-0" />
            <div>
              <p class="text-sm text-text-primary">
                {{ info.organization ? t('oauth.notInPlan') : t('oauth.noOrganization') }}
              </p>
              <NuxtLink v-if="info.organization" to="/billing" class="mt-4 inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 text-sm">
                {{ t('apiKeys.notInPlan.cta') }}
              </NuxtLink>
            </div>
          </div>
          <div class="mt-6 flex justify-end">
            <button type="button" :disabled="submitting" class="px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50" @click="decide(false)">
              {{ t('oauth.backToApp') }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
