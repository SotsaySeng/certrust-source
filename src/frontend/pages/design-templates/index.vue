<script setup lang="ts">
import { apiClient } from '~/api/api-client'

const { t } = useI18n()
const router = useRouter()

definePageMeta({
  middleware: ['auth']
})

const pageDescription = ref('Manage your organization\'s design templates for badges, certificates, and other credentials.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/design-templates`
})

useHead({
  title: t('designTemplates.title'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/design-templates` }
  ]
})

const templates = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function loadTemplates() {
  loading.value = true
  error.value = null
  try {
    const response = await apiClient.getDesignTemplates()
    templates.value = response.data || []
  }
  catch (err) {
    console.error('Error loading design templates:', err)
    error.value = 'Failed to load design templates. Please try again.'
  }
  finally {
    loading.value = false
  }
}

async function handleDelete(id: number | string) {
  try {
    await apiClient.deleteDesignTemplate(id)
    templates.value = templates.value.filter(template => (template.documentId || template.id) !== id)
  }
  catch (err) {
    console.error('Error deleting design template:', err)
    error.value = err instanceof Error ? err.message : 'Failed to delete design template'
  }
}

async function handleDuplicate(id: number | string) {
  try {
    const created = await apiClient.duplicateDesignTemplate(id)
    const newId = created?.data?.documentId ?? created?.data?.id
    if (newId) {
      router.push(`/design-templates/${newId}`)
    }
    else {
      await loadTemplates()
    }
  }
  catch (err) {
    console.error('Error duplicating design template:', err)
    error.value = err instanceof Error ? err.message : 'Failed to duplicate design template'
  }
}

onMounted(() => {
  loadTemplates()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-4xl font-bold text-text-primary">
            {{ t('designTemplates.title') }}
          </h1>
          <p class="mt-2 text-text-secondary">
            {{ t('designTemplates.subtitle') }}
          </p>
        </div>
        <NuxtLink
          to="/design-templates/create"
          class="inline-flex items-center justify-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors whitespace-nowrap"
        >
          <div class="i-heroicons-plus w-5 h-5 mr-2" />
          {{ t('designTemplates.create') }}
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
        <button class="mt-2 text-sm text-red-600 hover:text-red-800" @click="loadTemplates">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <!-- Empty State (matches dashboard.vue's "No credentials yet" convention) -->
      <div v-else-if="templates.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
        <div class="i-heroicons-swatch w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 class="text-lg font-medium mb-2">
          {{ t('designTemplates.empty.title') }}
        </h3>
        <p class="text-gray-600 mb-4">
          {{ t('designTemplates.empty.subtitle') }}
        </p>
        <NuxtLink
          to="/design-templates/create"
          class="inline-flex items-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors"
        >
          <div class="i-heroicons-plus w-5 h-5 mr-2" />
          {{ t('designTemplates.createFirst') }}
        </NuxtLink>
      </div>

      <!-- Templates Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DesignTemplateCard
          v-for="template in templates"
          :key="template.id"
          :template="template"
          @delete="handleDelete(template.documentId || template.id)"
          @duplicate="handleDuplicate(template.documentId || template.id)"
        />
      </div>
    </div>
  </div>
</template>
