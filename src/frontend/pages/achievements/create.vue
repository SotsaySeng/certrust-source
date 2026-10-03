<script setup lang="ts">
import type { AchievementFormValues } from '~/components/AchievementForm.vue'
import { apiClient } from '~/api/api-client'
import { ACHIEVEMENT_TYPE_NAMES } from '~/constants/templateTypes'

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

const form = ref<AchievementFormValues>({
  name: '',
  description: '',
  templateType: 'certificate',
  criteria: '',
  // Design Studio: default certificate/badge designs for this achievement.
  certificateDesignId: null,
  badgeDesignId: null,
})

// Preselect the organization's most recently edited certificate design.
onMounted(async () => {
  try {
    const mine = await apiClient.listDesignTemplates('mine')
    const latest = mine.find(d => (d.kind || d.type) === 'certificate' && d.layoutConfig?.elements?.length)
    if (latest && !form.value.certificateDesignId) {
      form.value.certificateDesignId = latest.documentId
    }
  }
  catch {}
})

const isCreating = ref(false)
const createError = ref<string | null>(null)

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
  const f = form.value
  if (!f.name.trim()) {
    createError.value = t('achievements.nameRequired')
    return
  }
  if (!f.description.trim()) {
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
      name: f.name.trim(),
      description: f.description.trim(),
      templateType: f.templateType,
      achievementType: ACHIEVEMENT_TYPE_NAMES[f.templateType as keyof typeof ACHIEVEMENT_TYPE_NAMES] ?? 'Certificate',
      achievementId: makeAchievementId(f.name),
      ...(f.criteria.trim() ? { criteria: { narrative: f.criteria.trim() } } : {}),
      creator: authStore.profile.id,
      certificateDesignId: f.certificateDesignId,
      badgeDesignId: f.badgeDesignId,
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
        <AchievementForm
          v-model="form"
          :submit-label="t('achievements.createAction')"
          :busy="isCreating"
          :error="createError"
          @submit="handleCreate"
        />
      </div>
    </div>
  </div>
</template>
