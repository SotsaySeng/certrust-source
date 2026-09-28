<script setup lang="ts">
/** Upload an image to the organization's library (or, for admins, the Elements library). */
import type { DesignAsset } from '~/api/api-client'
import { apiClient } from '~/api/api-client'

const props = defineProps<{ system?: boolean, elementCategory?: string, label?: string, compact?: boolean }>()
const emit = defineEmits<{ uploaded: [asset: DesignAsset] }>()
const { t } = useI18n()
const resources = useStudioResourcesStore()

const input = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)
const MAX = 2 * 1024 * 1024
const TYPES = ['image/svg+xml', 'image/png', 'image/jpeg']

async function onFiles(files: FileList | null) {
  error.value = null
  const list = Array.from(files ?? [])
  if (!list.length) {
    return
  }
  busy.value = true
  try {
    for (const file of list) {
      if (!TYPES.includes(file.type) && !/\.(?:svg|png|jpe?g)$/i.test(file.name)) {
        error.value = t('designStudio.uploads.wrongType', { name: file.name })
        continue
      }
      if (file.size > MAX) {
        error.value = t('designStudio.uploads.tooLarge', { name: file.name })
        continue
      }
      const asset = await apiClient.uploadDesignAsset(file, { system: props.system, elementCategory: props.elementCategory })
      if (props.system) {
        resources.elements.unshift(asset)
      }
      else {
        resources.uploads.unshift(asset)
      }
      emit('uploaded', asset)
    }
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    busy.value = false
    if (input.value) {
      input.value.value = ''
    }
  }
}

function onDrop(ev: DragEvent) {
  void onFiles(ev.dataTransfer?.files ?? null)
}
</script>

<template>
  <div>
    <button
      type="button"
      class="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
      :class="compact ? 'py-1.5 text-xs' : 'py-2.5 text-sm'"
      :disabled="busy"
      @click="input?.click()"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div v-if="busy" class="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
      <div v-else class="i-heroicons-arrow-up-tray h-4 w-4" />
      {{ busy ? t('designStudio.uploads.uploading') : (label || t('designStudio.uploads.upload')) }}
    </button>
    <p v-if="!compact" class="mt-1.5 text-center text-xs text-gray-500">
      {{ t('designStudio.uploads.hint') }}
    </p>
    <p v-if="error" class="mt-1.5 rounded bg-red-50 px-2 py-1 text-xs text-red-700" role="alert">
      {{ error }}
    </p>
    <input ref="input" type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" multiple class="hidden" data-testid="design-upload-input" @change="onFiles(($event.target as HTMLInputElement).files)">
  </div>
</template>
