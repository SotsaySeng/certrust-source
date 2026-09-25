<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { EVENT_STATUSES } from '~/constants/eventStatus'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const useApiClientComposable = useApiClient()

definePageMeta({
  middleware: ['auth']
})

const pageDescription = ref('Add a cohort, ceremony, or conference your organization issues credentials for.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value
})

useHead({
  title: t('events.createTitle'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/events/create` }
  ]
})

function getStatusLabel(status: string): string {
  return t(`events.status.${status}`)
}

const name = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const location = ref('')
const status = ref('scheduled')
const achievementId = ref('')

const achievements = ref<any[]>([])
const isLoadingAchievements = ref(true)

const isCreating = ref(false)
const createError = ref<string | null>(null)

async function loadAchievements() {
  isLoadingAchievements.value = true
  try {
    const response = await useApiClientComposable.getAvailableBadges(authStore.profile?.id?.toString())
    achievements.value = response.data || []
  }
  catch (err) {
    console.error('Error loading achievements:', err)
  }
  finally {
    isLoadingAchievements.value = false
  }
}

async function handleCreate() {
  if (!name.value.trim()) {
    createError.value = t('events.nameRequired')
    return
  }

  isCreating.value = true
  createError.value = null

  try {
    const created = await apiClient.createEvent({
      name: name.value.trim(),
      description: description.value,
      startDate: startDate.value || null,
      endDate: endDate.value || null,
      location: location.value,
      status: status.value,
      achievement: achievementId.value || null,
      creator: authStore.profile?.id
    })
    const documentId = created?.data?.documentId ?? created?.data?.id
    if (documentId) {
      router.push(`/events/${documentId}`)
    }
    else {
      router.push('/events')
    }
  }
  catch (err) {
    console.error('Error creating event:', err)
    createError.value = err instanceof Error ? err.message : 'Failed to create event'
  }
  finally {
    isCreating.value = false
  }
}

onMounted(() => {
  loadAchievements()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <NuxtLink to="/events" class="inline-flex items-center text-sm text-text-secondary hover:text-text-primary mb-4">
          <div class="i-heroicons-arrow-left w-4 h-4 mr-1" />
          {{ t('events.backToList') }}
        </NuxtLink>
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('events.createTitle') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('events.createSubtitle') }}
        </p>
      </div>

      <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <form class="space-y-6" @submit.prevent="handleCreate">
          <div>
            <label for="eventName" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('events.nameLabel') }}
            </label>
            <input
              id="eventName"
              v-model="name"
              type="text"
              required
              :placeholder="t('events.namePlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            >
          </div>

          <div>
            <label for="eventDescription" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('events.descriptionLabel') }}
            </label>
            <textarea
              id="eventDescription"
              v-model="description"
              rows="3"
              :placeholder="t('events.descriptionPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label for="eventStartDate" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('events.startDateLabel') }}
              </label>
              <input
                id="eventStartDate"
                v-model="startDate"
                type="datetime-local"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
              >
            </div>
            <div>
              <label for="eventEndDate" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('events.endDateLabel') }}
              </label>
              <input
                id="eventEndDate"
                v-model="endDate"
                type="datetime-local"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
              >
            </div>
          </div>

          <div>
            <label for="eventLocation" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('events.locationLabel') }}
            </label>
            <input
              id="eventLocation"
              v-model="location"
              type="text"
              :placeholder="t('events.locationPlaceholder')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
            >
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label for="eventStatus" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('events.statusLabel') }}
              </label>
              <select
                id="eventStatus"
                v-model="status"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
              >
                <option v-for="eventStatus in EVENT_STATUSES" :key="eventStatus" :value="eventStatus">
                  {{ getStatusLabel(eventStatus) }}
                </option>
              </select>
            </div>

            <div>
              <label for="eventAchievement" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('events.achievementLabel') }}
              </label>
              <select
                id="eventAchievement"
                v-model="achievementId"
                :disabled="isLoadingAchievements"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:bg-gray-100"
              >
                <option value="">
                  {{ t('events.achievementPlaceholder') }}
                </option>
                <option v-for="achievement in achievements" :key="achievement.id" :value="achievement.id">
                  {{ achievement.name }}
                </option>
              </select>
              <p class="mt-1 text-xs text-text-secondary">
                {{ achievements.length === 0 && !isLoadingAchievements ? t('events.noAchievements') : t('events.achievementHint') }}
              </p>
            </div>
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
              <span v-if="!isCreating">{{ t('events.createAction') }}</span>
              <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
