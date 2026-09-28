<script setup lang="ts">
/**
 * Preview: the design as the SERVER renders it for issued credentials
 * (same pipeline as the real PNG/PDF), with switchable sample recipients.
 */
import type { BrandKit } from '~/lib/design-core'
import { apiClient } from '~/api/api-client'
import { applyBrandKit, SAMPLE_RECIPIENTS } from '~/lib/design-core'

const props = defineProps<{ brand?: BrandKit | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()

const recipient = ref(SAMPLE_RECIPIENTS[0])
const custom = ref('')
const url = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const pdfBusy = ref(false)

const sampleCustom = computed(() => Object.fromEntries(resources.customAttributes.map(a => [a.key, a.type === 'date' ? '19 August 2026' : a.label])))
// Bake the brand in exactly as it looks in the editor.
const layout = computed(() => (store.design ? applyBrandKit(store.design, props.brand ?? null) : null))

async function render() {
  if (!layout.value) {
    return
  }
  loading.value = true
  error.value = null
  try {
    const blob = await apiClient.renderDesignPreview(layout.value, { width: 1600, recipientName: custom.value.trim() || recipient.value, custom: sampleCustom.value })
    if (url.value) {
      URL.revokeObjectURL(url.value)
    }
    url.value = URL.createObjectURL(blob)
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    loading.value = false
  }
}

async function downloadPdf() {
  if (!layout.value) {
    return
  }
  pdfBusy.value = true
  try {
    const blob = await apiClient.renderDesignPreview(layout.value, { format: 'pdf', recipientName: custom.value.trim() || recipient.value, custom: sampleCustom.value })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(store.meta?.name || 'design').replace(/[^\w\- ]+/g, '')}-preview.pdf`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    pdfBusy.value = false
  }
}

watch(recipient, () => {
  custom.value = ''
  render()
})
onMounted(render)
onBeforeUnmount(() => {
  if (url.value) {
    URL.revokeObjectURL(url.value)
  }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[900] flex items-center justify-center bg-black/60 p-6" @click.self="emit('close')">
      <div class="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div class="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
          <h2 class="font-semibold">
            {{ t('designStudio.previewModal.title') }}
          </h2>
          <span class="text-xs text-gray-500">{{ t('designStudio.previewModal.subtitle') }}</span>
          <button class="ds-icon-btn ml-auto" :aria-label="t('common.close')" @click="emit('close')">
            <div class="i-heroicons-x-mark h-5 w-5" />
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-2 text-sm">
          <span class="text-gray-600">{{ t('designStudio.previewModal.recipient') }}</span>
          <button v-for="n in SAMPLE_RECIPIENTS" :key="n" class="max-w-[220px] truncate rounded-full border px-3 py-1" :class="recipient === n && !custom ? 'border-[#28A745] bg-[#28A745]/10 text-[#1B7A34]' : 'border-gray-200'" @click="recipient = n">
            {{ n }}
          </button>
          <input v-model="custom" class="w-48 rounded-full border border-gray-200 px-3 py-1" :placeholder="t('designStudio.previewModal.customName')" @keydown.enter="render">
          <button class="rounded-full border border-gray-200 px-3 py-1 hover:bg-gray-50" @click="render">
            {{ t('designStudio.previewModal.refresh') }}
          </button>
          <button class="ml-auto flex items-center gap-1.5 rounded-full bg-gray-900 px-3 py-1.5 text-white disabled:opacity-50" :disabled="pdfBusy" @click="downloadPdf">
            <div class="i-heroicons-document-arrow-down h-4 w-4" />{{ t('designStudio.previewModal.pdf') }}
          </button>
        </div>
        <div class="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-[#eef0f3] p-6">
          <div v-if="loading" class="h-8 w-8 animate-spin rounded-full border-4 border-[#28A745] border-t-transparent" />
          <p v-else-if="error" class="text-red-700">
            {{ error }}
          </p>
          <img v-else-if="url" :src="url" :alt="t('designStudio.previewModal.title')" class="max-h-[70vh] max-w-full shadow-lg" data-testid="design-preview-image">
        </div>
      </div>
    </div>
  </Teleport>
</template>
