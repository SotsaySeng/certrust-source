<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { EVENT_STATUSES } from '~/constants/eventStatus'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const useApiClientComposable = useApiClient()

definePageMeta({
  middleware: ['auth']
})

useHead({
  title: t('events.editTitle'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/events/${route.params.id}` }
  ]
})

const eventId = computed(() => route.params.id as string)

const event = ref<any>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

const name = ref('')
const description = ref('')
const startDate = ref('')
const endDate = ref('')
const location = ref('')
const status = ref('scheduled')
const achievementId = ref('')

const achievements = ref<any[]>([])
const isLoadingAchievements = ref(true)

const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)

const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteConfirm = ref(false)

function getStatusLabel(eventStatus: string): string {
  return t(`events.status.${eventStatus}`)
}

/**
 * Strapi returns ISO datetimes (2026-09-15T05:00:00.000Z); a
 * `datetime-local` input needs `YYYY-MM-DDTHH:mm` in the browser's own
 * timezone - toISOString() would silently shift the displayed time.
 */
function toLocalInputValue(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

async function loadEvent() {
  loading.value = true
  loadError.value = null
  try {
    const response = await apiClient.getEvent(eventId.value)
    event.value = response?.data || null
    if (!event.value) {
      loadError.value = t('events.notFound')
      return
    }
    name.value = event.value.name || ''
    description.value = event.value.description || ''
    startDate.value = toLocalInputValue(event.value.startDate)
    endDate.value = toLocalInputValue(event.value.endDate)
    location.value = event.value.location || ''
    status.value = event.value.status || 'scheduled'
    achievementId.value = event.value.achievement?.id ? String(event.value.achievement.id) : ''
  }
  catch (err) {
    console.error('Error loading event:', err)
    loadError.value = err instanceof Error ? err.message : 'Failed to load event'
  }
  finally {
    loading.value = false
  }
}

async function handleSave() {
  saveError.value = null
  saveSuccess.value = false

  if (!name.value.trim()) {
    saveError.value = t('events.nameRequired')
    return
  }

  isSaving.value = true
  try {
    const response = await apiClient.updateEvent(eventId.value, {
      name: name.value.trim(),
      description: description.value,
      startDate: startDate.value || null,
      endDate: endDate.value || null,
      location: location.value,
      status: status.value,
      achievement: achievementId.value || null
    })
    event.value = response?.data || event.value
    saveSuccess.value = true
  }
  catch (err) {
    console.error('Error saving event:', err)
    saveError.value = err instanceof Error ? err.message : 'Failed to save event'
  }
  finally {
    isSaving.value = false
  }
}

async function handleDelete() {
  isDeleting.value = true
  deleteError.value = null
  try {
    await apiClient.deleteEvent(eventId.value)
    router.push('/events')
  }
  catch (err) {
    console.error('Error deleting event:', err)
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete event'
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

onMounted(() => {
  loadEvent()
  loadAchievements()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/events" class="inline-flex items-center text-sm text-text-secondary hover:text-text-primary mb-4">
        <div class="i-heroicons-arrow-left w-4 h-4 mr-1" />
        {{ t('events.backToList') }}
      </NuxtLink>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Error State -->
      <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800">
          {{ loadError }}
        </p>
      </div>

      <div v-else class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <h1 class="text-2xl font-bold text-text-primary mb-6">
          {{ t('events.editTitle') }}
        </h1>

        <form class="space-y-6" @submit.prevent="handleSave">
          <div>
            <label for="eventName" class="block text-sm font-medium text-text-primary mb-1">
              {{ t('events.nameLabel') }}
            </label>
            <input
              id="eventName"
              v-model="name"
              type="text"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
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
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
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
                <option v-for="achievement in achievements" :key="achievement.id" :value="String(achievement.id)">
                  {{ achievement.name }}
                </option>
              </select>
              <p class="mt-1 text-xs text-text-secondary">
                {{ achievements.length === 0 && !isLoadingAchievements ? t('events.noAchievements') : t('events.achievementHint') }}
              </p>
            </div>
          </div>

          <div v-if="saveError" class="rounded-lg bg-red-50 p-4">
            <p class="text-sm text-red-800">
              {{ saveError }}
            </p>
          </div>
          <div v-if="saveSuccess" class="rounded-lg bg-green-50 p-4">
            <p class="text-sm text-green-800">
              {{ t('events.saveSuccess') }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              :disabled="isSaving"
              class="px-6 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50"
            >
              <span v-if="!isSaving">{{ t('common.save') }}</span>
              <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            </button>
            <button
              type="button"
              class="px-6 py-2 border border-red-300 text-red-600 rounded-full hover:bg-red-50 transition-colors ml-auto"
              @click="showDeleteConfirm = true"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </form>
      </div>

      <!-- Delete confirmation -->
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
          <h3 class="text-lg font-medium text-text-primary mb-2">
            {{ t('events.deleteConfirmTitle') }}
          </h3>
          <p class="text-sm text-text-secondary mb-4">
            {{ t('events.deleteConfirmBody') }}
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
              :disabled="isDeleting"
              class="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50"
              @click="handleDelete"
            >
              {{ isDeleting ? t('common.loading') : t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
