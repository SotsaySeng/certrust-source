<script setup lang="ts">
import type { AchievementFormValues } from '~/components/AchievementForm.vue'
import { apiClient } from '~/api/api-client'
import { ACHIEVEMENT_TYPE_NAMES } from '~/constants/templateTypes'

/**
 * Edit an achievement. `id` is its documentId: saving republishes it, which
 * gives it a new numeric id, so the numeric one is never stable.
 * Organization access is enforced by the update route's policy; this page
 * only offers achievements from the caller's own list.
 */

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { getAvailableBadges } = useApiClient()

definePageMeta({
  middleware: ['auth']
})

useHead({ title: t('achievements.editTitle') })

const documentId = String(route.params.id)
const form = ref<AchievementFormValues | null>(null)
const loadError = ref<string | null>(null)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

onMounted(async () => {
  try {
    const mine = await getAvailableBadges(authStore.profile?.id?.toString())
    if (!(mine?.data as any[] | undefined)?.some(a => a.documentId === documentId)) {
      loadError.value = t('achievements.notFound')
      return
    }
    const res = await apiClient.get<{ data: any }>(`/api/achievements/${encodeURIComponent(documentId)}`, { 'populate[0]': 'criteria' })
    const a = res.data
    form.value = {
      name: a.name ?? '',
      description: a.description ?? '',
      templateType: a.templateType || 'certificate',
      criteria: a.criteria?.narrative ?? '',
      certificateDesignId: a.certificateDesignId ?? null,
      badgeDesignId: a.badgeDesignId ?? null,
    }
  }
  catch (err) {
    console.error('Error loading achievement:', err)
    loadError.value = t('achievements.notFound')
  }
})

async function handleSave() {
  const f = form.value
  if (!f) {
    return
  }
  if (!f.name.trim()) {
    saveError.value = t('achievements.nameRequired')
    return
  }
  if (!f.description.trim()) {
    saveError.value = t('achievements.descriptionRequired')
    return
  }

  isSaving.value = true
  saveError.value = null
  try {
    const updated = await apiClient.updateBadge(documentId, {
      name: f.name.trim(),
      description: f.description.trim(),
      templateType: f.templateType,
      achievementType: ACHIEVEMENT_TYPE_NAMES[f.templateType as keyof typeof ACHIEVEMENT_TYPE_NAMES] ?? 'Certificate',
      criteria: f.criteria.trim() ? { narrative: f.criteria.trim() } : null,
      certificateDesignId: f.certificateDesignId,
      badgeDesignId: f.badgeDesignId,
    })
    const id = updated?.data?.id
    router.push(id ? `/issue?achievement=${id}` : '/issue')
  }
  catch (err) {
    console.error('Error saving achievement:', err)
    saveError.value = err instanceof Error ? err.message : t('achievements.saveFailed')
  }
  finally {
    isSaving.value = false
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
          {{ t('achievements.editTitle') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('achievements.editSubtitle') }}
        </p>
      </div>

      <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <div v-if="loadError" class="rounded-lg bg-red-50 p-4" data-testid="achievement-edit-error">
          <p class="text-sm text-red-800">
            {{ loadError }}
          </p>
        </div>
        <AchievementForm
          v-else-if="form"
          v-model="form"
          :submit-label="t('achievements.saveAction')"
          :busy="isSaving"
          :error="saveError"
          @submit="handleSave"
        >
          <template #actions>
            <NuxtLink to="/issue" class="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              {{ t('achievements.cancel') }}
            </NuxtLink>
          </template>
        </AchievementForm>
        <div v-else class="flex justify-center py-12">
          <div class="w-8 h-8 border-2 border-[#28A745] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    </div>
  </div>
</template>
