<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { getTemplateTypeIcon, TEMPLATE_TYPES } from '~/constants/templateTypes'

/**
 * Create an achievement: the thing a credential is issued FOR (e.g.
 * "Workshop Completion Certificate"). Until this page existed there was no
 * way to create one outside the REST API, so a new organisation could not
 * issue anything. Posts to /api/achievements with the issuer's own profile
 * as creator; the backend's global::is-in-organization policy checks the
 * caller really owns that profile.
 */

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

definePageMeta({
  middleware: ['auth']
})

useHead({
  title: t('achievements.createTitle'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/achievements/create` }
  ]
})

const name = ref('')
const description = ref('')
const templateType = ref('certificate')
const criteria = ref('')

const isCreating = ref(false)
const createError = ref<string | null>(null)

// English, independent of the UI language: stored as the Open Badge
// achievementType, which recipients' wallets and LinkedIn read.
const ACHIEVEMENT_TYPE_NAMES: Record<string, string> = {
  certificate: 'Certificate',
  badge: 'Badge',
  transcript: 'Transcript',
  training_record: 'Training Record',
  assessment: 'Assessment',
  letter: 'Letter',
}

function getTemplateTypeLabel(type: string): string {
  return t(`issue.templateTypes.${type}`)
}

/** Unique, URL-safe id derived from the name (the schema's required uid). */
function makeAchievementId(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'achievement'
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`
}

async function handleCreate() {
  if (!name.value.trim()) {
    createError.value = t('achievements.nameRequired')
    return
  }
  if (!description.value.trim()) {
    createError.value = t('achievements.descriptionRequired')
    return
  }
  if (!authStore.profile?.id) {
    createError.value = t('achievements.noProfile')
    return
  }

  isCreating.value = true
  createError.value = null

  try {
    const created = await apiClient.createBadge({
      name: name.value.trim(),
      description: description.value.trim(),
      templateType: templateType.value,
      achievementType: ACHIEVEMENT_TYPE_NAMES[templateType.value] ?? 'Certificate',
      achievementId: makeAchievementId(name.value),
      ...(criteria.value.trim() ? { criteria: { narrative: criteria.value.trim() } } : {}),
      creator: authStore.profile.id,
      publishedAt: new Date().toISOString(),
    })
    const id = created?.data?.id
    router.push(id ? `/issue?achievement=${id}` : '/issue')
  }
  catch (err) {
    console.error('Error creating achievement:', err)
    createError.value = err instanceof Error ? err.message : t('achievements.createFailed')
  }
  finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <NuxtLink to="/issue" class="inline-flex items-center text-sm text-text-secondary hover:text-text-primary mb-4">
          <div class="i-heroicons-arrow-left w-4 h-4 mr-1" />
          {{ t('achievements.backToIssue') }}
        </NuxtLink>
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('achievements.createTitle') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('achievements.createSubtitle') }}
        </p>
      </div>

      <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <form class="space-y-6" @submit.prevent="handleCreate">
          <div>
            <label for="achievementName" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('achievements.nameLabel') }}
            </label>
            <input
              id="achievementName"
              v-model="name"
              type="text"
              required
              maxlength="200"
              :placeholder="t('achievements.namePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            >
          </div>

          <div>
            <label for="achievementDescription" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('achievements.descriptionLabel') }}
            </label>
            <textarea
              id="achievementDescription"
              v-model="description"
              rows="3"
              required
              :placeholder="t('achievements.descriptionPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            />
            <p class="mt-1 text-xs text-text-secondary">
              {{ t('achievements.descriptionHint') }}
            </p>
          </div>

          <div>
            <span class="block text-sm font-medium text-text-primary mb-2">
              {{ t('achievements.typeLabel') }}
            </span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label
                v-for="type in TEMPLATE_TYPES"
                :key="type"
                class="flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm transition-colors"
                :class="templateType === type ? 'border-[#28A745] bg-[#28A745]/5' : 'border-gray-200 hover:border-[#28A745]/50'"
              >
                <input v-model="templateType" type="radio" name="templateType" :value="type" class="sr-only">
                <span class="w-4 h-4 text-[#28A745]" :class="getTemplateTypeIcon(type)" />
                {{ getTemplateTypeLabel(type) }}
              </label>
            </div>
          </div>

          <div>
            <label for="achievementCriteria" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('achievements.criteriaLabel') }}
            </label>
            <textarea
              id="achievementCriteria"
              v-model="criteria"
              rows="3"
              :placeholder="t('achievements.criteriaPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            />
            <p class="mt-1 text-xs text-text-secondary">
              {{ t('achievements.criteriaHint') }}
            </p>
          </div>

          <div v-if="createError" class="rounded-lg bg-red-50 p-4">
            <p class="text-sm text-red-800">
              {{ createError }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="submit"
              :disabled="isCreating"
              class="px-6 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50"
            >
              <span v-if="!isCreating">{{ t('achievements.createAction') }}</span>
              <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
