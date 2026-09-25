<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { EVENT_STATUSES, getEventStatusChipClass } from '~/constants/eventStatus'

const { t } = useI18n()

definePageMeta({
  middleware: ['auth']
})

const pageDescription = ref('Manage the real-world events your organization issues credentials for.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/events`
})

useHead({
  title: t('events.title'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/events` }
  ]
})

const events = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const deletingId = ref<number | string | null>(null)
const eventPendingDelete = ref<any>(null)
const deleteError = ref<string | null>(null)

function getStatusLabel(status: string): string {
  return t(`events.status.${status}`)
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

async function loadEvents() {
  loading.value = true
  error.value = null
  try {
    const response = await apiClient.getEvents()
    events.value = response.data || []
  }
  catch (err) {
    console.error('Error loading events:', err)
    error.value = 'Failed to load events. Please try again.'
  }
  finally {
    loading.value = false
  }
}

async function confirmDelete() {
  if (!eventPendingDelete.value) return
  const id = eventPendingDelete.value.documentId || eventPendingDelete.value.id
  deletingId.value = id
  deleteError.value = null
  try {
    await apiClient.deleteEvent(id)
    events.value = events.value.filter(event => (event.documentId || event.id) !== id)
    eventPendingDelete.value = null
  }
  catch (err) {
    console.error('Error deleting event:', err)
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete event'
  }
  finally {
    deletingId.value = null
  }
}

onMounted(() => {
  loadEvents()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-4xl font-bold text-text-primary">
            {{ t('events.title') }}
          </h1>
          <p class="mt-2 text-text-secondary">
            {{ t('events.subtitle') }}
          </p>
        </div>
        <NuxtLink
          to="/events/create"
          class="inline-flex items-center justify-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors whitespace-nowrap"
        >
          <div class="i-heroicons-plus w-5 h-5 mr-2" />
          {{ t('events.create') }}
        </NuxtLink>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
        <p class="text-red-800">
          {{ error }}
        </p>
        <button class="mt-2 text-sm text-red-600 hover:text-red-800" @click="loadEvents">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="events.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
        <div class="i-heroicons-calendar-days w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 class="text-lg font-medium mb-2">
          {{ t('events.empty.title') }}
        </h3>
        <p class="text-gray-600 mb-4">
          {{ t('events.empty.subtitle') }}
        </p>
        <NuxtLink
          to="/events/create"
          class="inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors"
        >
          <div class="i-heroicons-plus w-5 h-5 mr-2" />
          {{ t('events.createFirst') }}
        </NuxtLink>
      </div>

      <!-- Events Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="event in events"
          :key="event.id"
          class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg flex flex-col gap-3"
        >
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-lg font-medium text-text-primary truncate">
              {{ event.name }}
            </h3>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
              :class="getEventStatusChipClass(event.status)"
            >
              {{ getStatusLabel(event.status) }}
            </span>
          </div>

          <p v-if="event.description" class="text-sm text-text-secondary line-clamp-2">
            {{ event.description }}
          </p>

          <div class="flex flex-col gap-1 text-sm text-text-secondary mt-auto pt-2">
            <div v-if="event.startDate" class="flex items-center gap-2">
              <div class="i-heroicons-calendar w-4 h-4 flex-shrink-0" />
              <span>{{ formatDate(event.startDate) }}<template v-if="event.endDate"> – {{ formatDate(event.endDate) }}</template></span>
            </div>
            <div v-if="event.location" class="flex items-center gap-2">
              <div class="i-heroicons-map-pin w-4 h-4 flex-shrink-0" />
              <span class="truncate">{{ event.location }}</span>
            </div>
            <div v-if="event.achievement" class="flex items-center gap-2">
              <div class="i-heroicons-star w-4 h-4 flex-shrink-0" />
              <span class="truncate">{{ event.achievement.name }}</span>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
            <NuxtLink
              :to="`/events/${event.documentId || event.id}`"
              class="text-sm font-medium text-[#28A745] hover:text-[#28A745]/80"
            >
              {{ t('common.edit') }}
            </NuxtLink>
            <button
              type="button"
              class="text-sm font-medium text-red-600 hover:text-red-800 ml-auto"
              @click="eventPendingDelete = event"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Delete confirmation -->
      <div v-if="eventPendingDelete" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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
            <button type="button" class="px-4 py-2 text-text-secondary hover:text-text-primary" @click="eventPendingDelete = null">
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              :disabled="deletingId !== null"
              class="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50"
              @click="confirmDelete"
            >
              {{ deletingId !== null ? t('common.loading') : t('common.delete') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
