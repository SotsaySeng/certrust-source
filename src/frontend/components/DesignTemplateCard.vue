<script setup lang="ts">
import { getTemplateTypeChipClass, getTemplateTypeIcon } from '~/constants/templateTypes'

defineOptions({
  name: 'DesignTemplateCard'
})

const props = defineProps({
  template: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['delete', 'duplicate'])

const { t } = useI18n()

const isMenuOpen = ref(false)

const typeLabel = computed(() => t(`issue.templateTypes.${props.template.type}`))
const isGlobalTemplate = computed(() => !props.template.organization)

// Same nested-vs-flat / relative-vs-absolute URL fallback pattern as
// CertificateCard.vue's badgeImageUrl.
const previewImageUrl = computed(() => {
  const image = props.template.previewImage
  if (!image?.url) {
    return null
  }
  const runtimeConfig = useRuntimeConfig()
  const apiUrl = runtimeConfig.public.apiUrl
  return image.url.startsWith('http') ? image.url : `${apiUrl}${image.url}`
})

function formatDate(dateString: string) {
  if (!dateString) {
    return ''
  }
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  catch (error) {
    console.error('Error formatting date:', error)
    return dateString
  }
}

function handleDelete() {
  isMenuOpen.value = false
  if (!import.meta.client) {
    return
  }
  // eslint-disable-next-line no-alert
  if (window.confirm(t('designTemplates.deleteConfirmBody'))) {
    emit('delete')
  }
}

function handleDuplicate() {
  isMenuOpen.value = false
  emit('duplicate')
}
</script>

<template>
  <div class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all">
    <div class="flex items-start justify-between">
      <div class="flex-1 min-w-0">
        <!-- Template Type Icon -->
        <div class="w-12 h-12 bg-[#28A745]/10 rounded-lg flex items-center justify-center mb-4">
          <div class="w-6 h-6 text-[#28A745]" :class="getTemplateTypeIcon(template.type)" />
        </div>

        <!-- Template Info -->
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <h3 class="text-lg font-medium text-text-primary truncate">
            {{ template.name }}
          </h3>
          <span
            v-if="template.isDefault"
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
        <span
          class="inline-flex items-center gap-1 mb-3 px-2 py-0.5 rounded-full text-xs font-medium"
          :class="getTemplateTypeChipClass(template.type)"
        >
          <span class="w-3 h-3" :class="getTemplateTypeIcon(template.type)" />
          {{ typeLabel }}
        </span>
        <p class="text-text-secondary text-sm mb-4 line-clamp-2">
          {{ template.description || t('designTemplates.noDescription') }}
        </p>

        <!-- Metadata -->
        <div class="flex items-center text-sm text-text-secondary">
          <div class="w-4 h-4 i-heroicons-calendar mr-2" />
          {{ formatDate(template.updatedAt) }}
        </div>
      </div>

      <!-- Dropdown Menu for Actions -->
      <div class="relative">
        <button
          class="p-2 rounded-full hover:bg-gray-100"
          @click.stop="isMenuOpen = !isMenuOpen"
        >
          <div class="w-5 h-5 i-heroicons-ellipsis-vertical text-gray-500" />
        </button>

        <transition name="fade">
          <div
            v-if="isMenuOpen"
            class="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg z-10"
          >
            <NuxtLink
              v-if="!isGlobalTemplate"
              :to="`/design-templates/${template.documentId || template.id}`"
              class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="isMenuOpen = false"
            >
              {{ t('common.edit') }}
            </NuxtLink>
            <button
              class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              @click="handleDuplicate"
            >
              {{ t('designTemplates.duplicate') }}
            </button>
            <button
              v-if="!isGlobalTemplate"
              class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              @click="handleDelete"
            >
              {{ t('common.delete') }}
            </button>
          </div>
        </transition>
      </div>
    </div>

    <!-- Preview Image -->
    <div class="mt-4 aspect-[16/9] bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
      <img v-if="previewImageUrl" :src="previewImageUrl" :alt="template.name" class="w-full h-full object-contain">
      <div v-else class="w-10 h-10 text-gray-300" :class="getTemplateTypeIcon(template.type)" />
    </div>
  </div>
</template>
