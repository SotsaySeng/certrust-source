<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { getTemplateTypeChipClass, getTemplateTypeIcon, TEMPLATE_TYPES } from '~/constants/templateTypes'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

definePageMeta({
  middleware: ['auth']
})

const pageDescription = ref('Start a new design template from scratch or duplicate an existing one.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value
})

useHead({
  title: t('designTemplates.createTitle'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/design-templates/create` }
  ]
})

function getTemplateTypeLabel(type: string): string {
  return t(`issue.templateTypes.${type}`)
}

function goToTemplate(created: any) {
  const documentId = created?.data?.documentId ?? created?.data?.id
  if (documentId) {
    router.push(`/design-templates/${documentId}`)
  }
  else {
    router.push('/design-templates')
  }
}

// Step 1: pick a type. Step 2 (below): name it and create - a small
// 2-step flow rather than creating a blank template on the first click,
// so exploring the type cards doesn't silently burn the org's
// design-template tier-limit quota on empty "Untitled" rows.
const selectedType = ref<string | null>(null)
const newTemplateName = ref('')
const isCreating = ref(false)
const createError = ref<string | null>(null)

function selectType(type: string) {
  selectedType.value = type
  newTemplateName.value = ''
  createError.value = null
}

async function handleCreate() {
  if (!selectedType.value || !newTemplateName.value.trim()) {
    return
  }

  isCreating.value = true
  createError.value = null

  try {
    const created = await apiClient.createDesignTemplate({
      name: newTemplateName.value.trim(),
      type: selectedType.value,
      description: '',
      layoutConfig: {},
      isDefault: false,
      creator: authStore.profile?.id,
      organization: authStore.profile?.organization?.id
    })
    goToTemplate(created)
  }
  catch (err) {
    console.error('Error creating design template:', err)
    // Surfaces the backend's own tier-limit message verbatim (e.g. `This
    // organization has reached its "free" tier limit of 50 design
    // templates...`) - same pattern issue.vue already uses for the
    // credential-issuance limit error, not a re-worded client-side copy.
    createError.value = err instanceof Error ? err.message : 'Failed to create design template'
  }
  finally {
    isCreating.value = false
  }
}

// Or: start from an existing template (duplicate)
const existingTemplates = ref<any[]>([])
const isLoadingExisting = ref(false)
const duplicatingId = ref<number | string | null>(null)
const duplicateError = ref<string | null>(null)

async function loadExistingTemplates() {
  isLoadingExisting.value = true
  try {
    const response = await apiClient.getDesignTemplates()
    existingTemplates.value = response.data || []
  }
  catch (err) {
    console.error('Error loading existing design templates:', err)
  }
  finally {
    isLoadingExisting.value = false
  }
}

async function handleDuplicate(id: number | string) {
  duplicatingId.value = id
  duplicateError.value = null
  try {
    const created = await apiClient.duplicateDesignTemplate(id)
    goToTemplate(created)
  }
  catch (err) {
    console.error('Error duplicating design template:', err)
    duplicateError.value = err instanceof Error ? err.message : 'Failed to duplicate design template'
  }
  finally {
    duplicatingId.value = null
  }
}

onMounted(() => {
  loadExistingTemplates()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <NuxtLink to="/design-templates" class="inline-flex items-center text-sm text-text-secondary hover:text-text-primary mb-4">
          <div class="i-heroicons-arrow-left w-4 h-4 mr-1" />
          {{ t('designTemplates.backToGallery') }}
        </NuxtLink>
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('designTemplates.createTitle') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('designTemplates.createSubtitle') }}
        </p>
      </div>

      <!-- Step 1 + 2: choose a type, then name it -->
      <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg mb-8">
        <h2 class="text-lg font-medium text-text-primary mb-4">
          {{ t('designTemplates.chooseType') }}
        </h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button
            v-for="type in TEMPLATE_TYPES"
            :key="type"
            type="button"
            class="flex flex-col items-center gap-2 p-4 border rounded-lg transition-all"
            :class="selectedType === type ? 'border-[#28A745] bg-[#28A745]/5' : 'border-gray-200 hover:border-[#28A745]/50'"
            @click="selectType(type)"
          >
            <span
              class="w-10 h-10 rounded-full flex items-center justify-center"
              :class="getTemplateTypeChipClass(type)"
            >
              <span class="w-5 h-5" :class="getTemplateTypeIcon(type)" />
            </span>
            <span class="text-sm font-medium text-text-primary">{{ getTemplateTypeLabel(type) }}</span>
          </button>
        </div>

        <div v-if="selectedType" class="mt-6 pt-6 border-t border-gray-100">
          <label for="newTemplateName" class="block text-sm font-medium text-text-primary mb-2">
            {{ t('designTemplates.nameLabel') }}
          </label>
          <div class="flex flex-col sm:flex-row gap-3">
            <input
              id="newTemplateName"
              v-model="newTemplateName"
              type="text"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
              :placeholder="t('designTemplates.namePlaceholder')"
              @keyup.enter="handleCreate"
            >
            <button
              type="button"
              :disabled="!newTemplateName.trim() || isCreating"
              class="px-6 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              @click="handleCreate"
            >
              <span v-if="!isCreating">{{ t('designTemplates.createAction') }}</span>
              <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            </button>
          </div>
          <div v-if="createError" class="mt-3 rounded-lg bg-red-50 p-3">
            <p class="text-sm text-red-800">
              {{ createError }}
            </p>
          </div>
        </div>
      </div>

      <!-- Or start from an existing template -->
      <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
        <h2 class="text-lg font-medium text-text-primary mb-4">
          {{ t('designTemplates.startFromExisting') }}
        </h2>

        <div v-if="duplicateError" class="mb-4 rounded-lg bg-red-50 p-3">
          <p class="text-sm text-red-800">
            {{ duplicateError }}
          </p>
        </div>

        <div v-if="isLoadingExisting" class="text-center py-8">
          <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
        <p v-else-if="existingTemplates.length === 0" class="text-text-secondary text-sm">
          {{ t('designTemplates.noExisting') }}
        </p>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="template in existingTemplates"
            :key="template.id"
            class="border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span
                class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                :class="getTemplateTypeChipClass(template.type)"
              >
                <span class="w-4 h-4" :class="getTemplateTypeIcon(template.type)" />
              </span>
              <span class="text-sm font-medium text-text-primary truncate">{{ template.name }}</span>
            </div>
            <button
              type="button"
              :disabled="duplicatingId === (template.documentId || template.id)"
              class="text-sm font-medium text-[#28A745] hover:text-[#28A745]/80 disabled:opacity-50 flex-shrink-0"
              @click="handleDuplicate(template.documentId || template.id)"
            >
              <span v-if="duplicatingId === (template.documentId || template.id)">{{ t('common.loading') }}</span>
              <span v-else>{{ t('designTemplates.duplicate') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
