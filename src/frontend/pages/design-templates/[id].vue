<script setup lang="ts">
import { apiClient } from '~/api/api-client'
import { getTemplateTypeChipClass, getTemplateTypeIcon, TEMPLATE_TYPES } from '~/constants/templateTypes'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

definePageMeta({
  middleware: ['auth']
})

useHead({
  title: t('designTemplates.editTitle'),
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/design-templates/${route.params.id}` }
  ]
})

const templateId = computed(() => route.params.id as string)

const template = ref<any>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

const name = ref('')
const description = ref('')
const type = ref('badge')
const isDefault = ref(false)
const layoutConfigText = ref('{}')
const layoutConfigError = ref<string | null>(null)

const isSaving = ref(false)
const saveError = ref<string | null>(null)
const saveSuccess = ref(false)

const isDuplicating = ref(false)
const duplicateError = ref<string | null>(null)

const isDeleting = ref(false)
const deleteError = ref<string | null>(null)
const showDeleteConfirm = ref(false)

function getTemplateTypeLabel(templateType: string): string {
  return t(`issue.templateTypes.${templateType}`)
}

const previewImageUrl = computed(() => {
  const image = template.value?.previewImage
  if (!image?.url) {
    return null
  }
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl
  return image.url.startsWith('http') ? image.url : `${apiUrl}${image.url}`
})

const isGlobalTemplate = computed(() => !!template.value && !template.value.organization)

async function loadTemplate() {
  loading.value = true
  loadError.value = null
  try {
    const response = await apiClient.getDesignTemplate(templateId.value)
    template.value = response?.data || null
    if (!template.value) {
      loadError.value = t('designTemplates.notFound')
      return
    }
    name.value = template.value.name || ''
    description.value = template.value.description || ''
    type.value = template.value.type || 'badge'
    isDefault.value = !!template.value.isDefault
    layoutConfigText.value = JSON.stringify(template.value.layoutConfig ?? {}, null, 2)
  }
  catch (err) {
    console.error('Error loading design template:', err)
    loadError.value = err instanceof Error ? err.message : 'Failed to load design template'
  }
  finally {
    loading.value = false
  }
}

async function handleSave() {
  if (isGlobalTemplate.value) {
    return
  }

  saveError.value = null
  saveSuccess.value = false
  layoutConfigError.value = null

  let parsedLayoutConfig: any = {}
  try {
    parsedLayoutConfig = layoutConfigText.value.trim() ? JSON.parse(layoutConfigText.value) : {}
  }
  catch {
    layoutConfigError.value = t('designTemplates.invalidJson')
    return
  }

  if (!name.value.trim()) {
    saveError.value = t('designTemplates.nameRequired')
    return
  }

  isSaving.value = true
  try {
    const response = await apiClient.updateDesignTemplate(templateId.value, {
      name: name.value.trim(),
      description: description.value,
      type: type.value,
      isDefault: isDefault.value,
      layoutConfig: parsedLayoutConfig
    })
    template.value = response?.data || template.value
    saveSuccess.value = true
  }
  catch (err) {
    console.error('Error saving design template:', err)
    // Same convention as issue.vue's credential-limit error surfacing -
    // show the backend's own message verbatim (this won't normally fire
    // on an update since the tier-limit hook only runs on create, but a
    // type change could still race a since-reached limit elsewhere).
    saveError.value = err instanceof Error ? err.message : 'Failed to save design template'
  }
  finally {
    isSaving.value = false
  }
}

async function handleDuplicate() {
  isDuplicating.value = true
  duplicateError.value = null
  try {
    const created = await apiClient.duplicateDesignTemplate(templateId.value)
    const newId = created?.data?.documentId ?? created?.data?.id
    if (newId) {
      router.push(`/design-templates/${newId}`)
    }
  }
  catch (err) {
    console.error('Error duplicating design template:', err)
    duplicateError.value = err instanceof Error ? err.message : 'Failed to duplicate design template'
  }
  finally {
    isDuplicating.value = false
  }
}

async function handleDelete() {
  if (isGlobalTemplate.value) {
    return
  }

  isDeleting.value = true
  deleteError.value = null
  try {
    await apiClient.deleteDesignTemplate(templateId.value)
    router.push('/design-templates')
  }
  catch (err) {
    console.error('Error deleting design template:', err)
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete design template'
    isDeleting.value = false
    showDeleteConfirm.value = false
  }
}

onMounted(() => {
  loadTemplate()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/design-templates" class="inline-flex items-center text-sm text-text-secondary hover:text-text-primary mb-4">
        <div class="i-heroicons-arrow-left w-4 h-4 mr-1" />
        {{ t('designTemplates.backToGallery') }}
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

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <!-- Edit Form -->
        <div class="lg:col-span-2 bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
          <div class="flex items-center gap-2 flex-wrap mb-6">
            <h1 class="text-2xl font-bold text-text-primary">
              {{ t('designTemplates.editTitle') }}
            </h1>
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getTemplateTypeChipClass(type)"
            >
              <span class="w-3 h-3" :class="getTemplateTypeIcon(type)" />
              {{ getTemplateTypeLabel(type) }}
            </span>
            <span
              v-if="template?.isDefault"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#28A745]/10 text-[#28A745]"
            >
              {{ t('designTemplates.defaultBadge') }}
            </span>
            <span
              v-if="isGlobalTemplate"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700"
            >
              <span class="w-3 h-3 i-heroicons-check-badge" />
              {{ t('designTemplates.officialBadge') }}
            </span>
          </div>

          <div v-if="isGlobalTemplate" class="rounded-lg bg-violet-50 p-4 mb-6 flex items-start gap-2">
            <div class="w-5 h-5 i-heroicons-information-circle text-violet-600 flex-shrink-0 mt-0.5" />
            <p class="text-sm text-violet-800">
              {{ t('designTemplates.officialTemplateNotice') }}
            </p>
          </div>

          <form class="space-y-6" @submit.prevent="handleSave">
            <div>
              <label for="templateName" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('designTemplates.nameLabel') }}
              </label>
              <input
                id="templateName"
                v-model="name"
                type="text"
                required
                :disabled="isGlobalTemplate"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:bg-gray-100 disabled:text-text-secondary"
              >
            </div>

            <div>
              <label for="templateDescription" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('designTemplates.descriptionLabel') }}
              </label>
              <textarea
                id="templateDescription"
                v-model="description"
                rows="3"
                :disabled="isGlobalTemplate"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:bg-gray-100 disabled:text-text-secondary"
              />
            </div>

            <div>
              <label for="templateType" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('designTemplates.typeLabel') }}
              </label>
              <select
                id="templateType"
                v-model="type"
                :disabled="isGlobalTemplate"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:bg-gray-100 disabled:text-text-secondary"
              >
                <option v-for="templateType in TEMPLATE_TYPES" :key="templateType" :value="templateType">
                  {{ getTemplateTypeLabel(templateType) }}
                </option>
              </select>
            </div>

            <div class="flex items-center">
              <input
                id="templateIsDefault"
                v-model="isDefault"
                type="checkbox"
                :disabled="isGlobalTemplate"
                class="h-4 w-4 text-[#28A745] focus:ring-[#28A745] border-gray-300 rounded disabled:opacity-50"
              >
              <label for="templateIsDefault" class="ml-2 block text-sm text-text-secondary">
                {{ t('designTemplates.isDefaultLabel') }}
              </label>
            </div>

            <div>
              <label for="templateLayoutConfig" class="block text-sm font-medium text-text-primary mb-1">
                {{ t('designTemplates.layoutConfigLabel') }}
              </label>
              <p class="text-xs text-text-secondary mb-2">
                {{ t('designTemplates.layoutConfigHint') }}
              </p>
              <textarea
                id="templateLayoutConfig"
                v-model="layoutConfigText"
                rows="8"
                spellcheck="false"
                :disabled="isGlobalTemplate"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent disabled:bg-gray-100 disabled:text-text-secondary"
              />
              <p v-if="layoutConfigError" class="mt-1 text-xs text-red-600">
                {{ layoutConfigError }}
              </p>
            </div>

            <div v-if="saveError" class="rounded-lg bg-red-50 p-4">
              <p class="text-sm text-red-800">
                {{ saveError }}
              </p>
            </div>
            <div v-if="saveSuccess" class="rounded-lg bg-green-50 p-4">
              <p class="text-sm text-green-800">
                {{ t('designTemplates.saveSuccess') }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <button
                v-if="!isGlobalTemplate"
                type="submit"
                :disabled="isSaving"
                class="px-6 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50"
              >
                <span v-if="!isSaving">{{ t('common.save') }}</span>
                <div v-else class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              </button>
              <button
                type="button"
                :disabled="isDuplicating"
                class="px-6 py-2 border border-[#28A745] text-[#28A745] rounded-full hover:bg-[#28A745]/10 transition-colors disabled:opacity-50"
                @click="handleDuplicate"
              >
                {{ isDuplicating ? t('common.loading') : t('designTemplates.duplicate') }}
              </button>
              <button
                v-if="!isGlobalTemplate"
                type="button"
                class="px-6 py-2 border border-red-300 text-red-600 rounded-full hover:bg-red-50 transition-colors sm:ml-auto"
                @click="showDeleteConfirm = true"
              >
                {{ t('common.delete') }}
              </button>
            </div>
            <p v-if="duplicateError" class="text-sm text-red-600">
              {{ duplicateError }}
            </p>
          </form>
        </div>

        <!-- Preview -->
        <div class="lg:col-span-1">
          <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-lg">
            <h2 class="text-lg font-medium text-text-primary mb-4">
              {{ t('designTemplates.previewLabel') }}
            </h2>
            <div class="aspect-[3/4] bg-white rounded-lg shadow-md flex items-center justify-center overflow-hidden">
              <img v-if="previewImageUrl" :src="previewImageUrl" :alt="name" class="max-w-full max-h-full object-contain">
              <span v-else class="w-16 h-16 text-[#28A745]" :class="getTemplateTypeIcon(type)" />
            </div>
          </div>
        </div>
      </div>

      <!-- Delete confirmation -->
      <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
          <h3 class="text-lg font-medium text-text-primary mb-2">
            {{ t('designTemplates.deleteConfirmTitle') }}
          </h3>
          <p class="text-sm text-text-secondary mb-4">
            {{ t('designTemplates.deleteConfirmBody') }}
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
