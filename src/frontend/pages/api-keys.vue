<script setup lang="ts">
import type { ApiKeyInfo, ApiKeyScope } from '~/api/api-client'
import { apiClient } from '~/api/api-client'

const { t } = useI18n()
const config = useRuntimeConfig()

definePageMeta({
  middleware: ['auth']
})

useSeoMeta({
  description: 'Create API keys so your own systems can issue credentials.',
  ogUrl: `${WEBSITE_URL}/api-keys`
})

useHead({
  title: t('apiKeys.title'),
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/api-keys` }]
})

const SCOPES: ApiKeyScope[] = ['read', 'issue', 'revoke', 'manage']
const apiUrl = computed(() => String(config.public.apiUrl || 'https://api.certrust.app').replace(/\/$/, ''))

const keys = ref<ApiKeyInfo[]>([])
const apiAccess = ref(true)
const loading = ref(true)
const loadError = ref<string | null>(null)

const form = reactive({ name: '', scopes: ['read', 'issue'] as ApiKeyScope[], expiresAt: '' })
const creating = ref(false)
const createError = ref<string | null>(null)
const newKey = ref<string | null>(null)
const copied = ref(false)

const keyPendingRevoke = ref<ApiKeyInfo | null>(null)
const revoking = ref(false)
const revokeError = ref<string | null>(null)

const minExpiry = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
})

function formatDate(value?: string | null): string {
  if (!value) {
    return ''
  }
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function status(key: ApiKeyInfo): 'active' | 'revoked' | 'expired' | 'paused' {
  if (key.revokedAt) {
    return 'revoked'
  }
  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
    return 'expired'
  }
  return apiAccess.value ? 'active' : 'paused'
}

const STATUS_CLASS = {
  active: 'bg-[#28A745]/10 text-[#1e7e34]',
  revoked: 'bg-gray-100 text-gray-600',
  expired: 'bg-amber-100 text-amber-800',
  paused: 'bg-amber-100 text-amber-800',
}

async function loadKeys() {
  loading.value = true
  loadError.value = null
  try {
    const response = await apiClient.getApiKeys()
    keys.value = response.data || []
    apiAccess.value = response.meta?.apiAccess !== false
  }
  catch (err) {
    console.error('Error loading API keys:', err)
    loadError.value = t('apiKeys.loadError')
  }
  finally {
    loading.value = false
  }
}

async function createKey() {
  createError.value = null
  if (!form.name.trim()) {
    createError.value = t('apiKeys.form.nameRequired')
    return
  }
  if (form.scopes.length === 0) {
    createError.value = t('apiKeys.form.scopeRequired')
    return
  }
  creating.value = true
  try {
    const created = await apiClient.createApiKey({
      name: form.name.trim(),
      scopes: form.scopes,
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
    })
    newKey.value = created.key
    copied.value = false
    form.name = ''
    form.expiresAt = ''
    await loadKeys()
  }
  catch (err: any) {
    createError.value = err?.data?.error?.message || t('apiKeys.form.createError')
  }
  finally {
    creating.value = false
  }
}

async function copyKey() {
  if (!newKey.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(newKey.value)
    copied.value = true
  }
  catch {
    copied.value = false
  }
}

async function confirmRevoke() {
  if (!keyPendingRevoke.value) {
    return
  }
  revoking.value = true
  revokeError.value = null
  try {
    await apiClient.revokeApiKey(keyPendingRevoke.value.documentId)
    keyPendingRevoke.value = null
    await loadKeys()
  }
  catch (err: any) {
    revokeError.value = err?.data?.error?.message || t('apiKeys.revoke.error')
  }
  finally {
    revoking.value = false
  }
}

onMounted(loadKeys)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('apiKeys.title') }}
        </h1>
        <p class="mt-2 text-text-secondary max-w-3xl">
          {{ t('apiKeys.subtitle') }}
        </p>
        <NuxtLink to="/integrations/guide" class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#1f7a34] hover:underline" data-testid="api-keys-guide-link">
          <div class="i-heroicons-book-open w-4 h-4" />
          {{ t('apiKeys.guideLink') }}
        </NuxtLink>
      </div>

      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p class="text-red-800">
          {{ loadError }}
        </p>
        <button class="mt-2 text-sm text-red-600 hover:text-red-800" @click="loadKeys">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <template v-else>
        <!-- Not in plan -->
        <div v-if="!apiAccess" class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg mb-8" data-testid="api-keys-upgrade">
          <div class="flex items-start gap-3">
            <div class="i-heroicons-lock-closed w-6 h-6 text-text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <h2 class="text-lg font-medium text-text-primary">
                {{ t('apiKeys.notInPlan.title') }}
              </h2>
              <p class="mt-1 text-sm text-text-secondary">
                {{ t('apiKeys.notInPlan.body') }}
              </p>
              <NuxtLink to="/billing" class="mt-4 inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors">
                {{ t('apiKeys.notInPlan.cta') }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- The new key, shown once -->
        <div v-if="newKey" class="rounded-2xl border-2 border-[#28A745] bg-white p-6 shadow-lg mb-8" data-testid="api-key-created">
          <h2 class="text-lg font-medium text-text-primary">
            {{ t('apiKeys.created.title') }}
          </h2>
          <p class="mt-1 text-sm text-text-secondary">
            {{ t('apiKeys.created.body') }}
          </p>
          <div class="mt-4 flex flex-col sm:flex-row gap-2">
            <code class="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono break-all select-all" data-testid="api-key-value">{{ newKey }}</code>
            <button type="button" class="px-4 py-2 rounded-full border border-gray-300 text-sm hover:bg-gray-50" @click="copyKey">
              {{ copied ? t('apiKeys.created.copied') : t('apiKeys.created.copy') }}
            </button>
          </div>
          <button type="button" class="mt-4 text-sm font-medium text-[#28A745] hover:text-[#28A745]/80" @click="newKey = null">
            {{ t('apiKeys.created.done') }}
          </button>
        </div>

        <!-- Create -->
        <form v-if="apiAccess && !newKey" class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg mb-8" @submit.prevent="createKey">
          <h2 class="text-lg font-medium text-text-primary mb-4">
            {{ t('apiKeys.form.title') }}
          </h2>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="api-key-name" class="block text-sm font-medium text-text-primary mb-1">{{ t('apiKeys.form.name') }}</label>
              <input id="api-key-name" v-model="form.name" type="text" maxlength="80" :placeholder="t('apiKeys.form.namePlaceholder')" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            </div>
            <div>
              <label for="api-key-expiry" class="block text-sm font-medium text-text-primary mb-1">{{ t('apiKeys.form.expiry') }}</label>
              <input id="api-key-expiry" v-model="form.expiresAt" type="date" :min="minExpiry" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <p class="mt-1 text-xs text-text-secondary">
                {{ t('apiKeys.form.expiryHint') }}
              </p>
            </div>
          </div>
          <fieldset class="mt-4">
            <legend class="text-sm font-medium text-text-primary mb-2">
              {{ t('apiKeys.form.permissions') }}
            </legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label v-for="scope in SCOPES" :key="scope" class="flex items-start gap-2 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                <input v-model="form.scopes" type="checkbox" :value="scope" class="mt-1">
                <span>
                  <span class="block text-sm font-medium text-text-primary">{{ t(`apiKeys.scopes.${scope}.label`) }}</span>
                  <span class="block text-xs text-text-secondary">{{ t(`apiKeys.scopes.${scope}.description`) }}</span>
                </span>
              </label>
            </div>
          </fieldset>
          <p class="mt-4 text-xs text-text-secondary">
            {{ t('apiKeys.form.actsAs') }}
          </p>
          <p v-if="createError" class="mt-3 text-sm text-red-600">
            {{ createError }}
          </p>
          <button type="submit" :disabled="creating" class="mt-4 inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 disabled:opacity-50">
            <div class="i-heroicons-key w-5 h-5 mr-2" />
            {{ creating ? t('common.loading') : t('apiKeys.form.create') }}
          </button>
        </form>

        <!-- Keys -->
        <div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden mb-8">
          <div v-if="keys.length === 0" class="p-8 text-center text-text-secondary">
            <div class="i-heroicons-key w-10 h-10 mx-auto text-gray-400 mb-2" />
            {{ t('apiKeys.empty') }}
          </div>
          <ul v-else class="divide-y divide-gray-100">
            <li v-for="key in keys" :key="key.documentId" class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="api-key-row">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-text-primary">{{ key.name }}</span>
                  <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="STATUS_CLASS[status(key)]">{{ t(`apiKeys.status.${status(key)}`) }}</span>
                </div>
                <div class="mt-1 text-sm text-text-secondary font-mono">
                  {{ key.prefix }}…
                </div>
                <div class="mt-2 flex flex-wrap gap-1">
                  <span v-for="scope in key.scopes" :key="scope" class="px-2 py-0.5 rounded bg-gray-100 text-xs text-text-secondary">{{ t(`apiKeys.scopes.${scope}.label`) }}</span>
                </div>
                <div class="mt-2 text-xs text-text-secondary">
                  {{ t('apiKeys.meta.created', { date: formatDate(key.createdAt), by: key.createdBy?.username || '—' }) }}
                  · {{ key.lastUsedAt ? t('apiKeys.meta.lastUsed', { date: formatDate(key.lastUsedAt) }) : t('apiKeys.meta.neverUsed') }}
                  <template v-if="key.expiresAt">
                    · {{ t('apiKeys.meta.expires', { date: formatDate(key.expiresAt) }) }}
                  </template>
                </div>
              </div>
              <button
                v-if="status(key) === 'active' || status(key) === 'paused'"
                type="button"
                class="self-start sm:self-center text-sm font-medium text-red-600 hover:text-red-800"
                @click="keyPendingRevoke = key; revokeError = null"
              >
                {{ t('apiKeys.revoke.action') }}
              </button>
            </li>
          </ul>
        </div>

        <!-- How to use -->
        <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
          <h2 class="text-lg font-medium text-text-primary">
            {{ t('apiKeys.usage.title') }}
          </h2>
          <p class="mt-1 text-sm text-text-secondary">
            {{ t('apiKeys.usage.body') }}
          </p>
          <pre class="mt-4 overflow-x-auto rounded-lg bg-gray-900 text-gray-100 p-4 text-xs leading-relaxed"><code>curl -X POST {{ apiUrl }}/api/credentials/issue \
  -H "Authorization: Bearer crt_…" \
  -H "Idempotency-Key: student-1042-course-7" \
  -H "Content-Type: application/json" \
  -d '{"data":{"achievementId":12,"recipient":{"name":"Ada Lovelace","email":"ada@example.edu"}}}'</code></pre>
          <p class="mt-3 text-sm text-text-secondary">
            {{ t('apiKeys.usage.idempotency') }}
          </p>
          <NuxtLink to="/integrations/guide#developers" class="mt-3 inline-block text-sm font-medium text-[#1f7a34] hover:underline">
            {{ t('apiKeys.guideLink') }} →
          </NuxtLink>
        </div>
      </template>

      <!-- Revoke confirmation -->
      <div v-if="keyPendingRevoke" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
          <h3 class="text-lg font-medium text-text-primary mb-2">
            {{ t('apiKeys.revoke.title', { name: keyPendingRevoke.name }) }}
          </h3>
          <p class="text-sm text-text-secondary mb-4">
            {{ t('apiKeys.revoke.body') }}
          </p>
          <p v-if="revokeError" class="text-sm text-red-600 mb-4">
            {{ revokeError }}
          </p>
          <div class="flex justify-end gap-3">
            <button type="button" class="px-4 py-2 text-text-secondary hover:text-text-primary" @click="keyPendingRevoke = null">
              {{ t('common.cancel') }}
            </button>
            <button type="button" :disabled="revoking" class="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50" @click="confirmRevoke">
              {{ revoking ? t('common.loading') : t('apiKeys.revoke.confirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
