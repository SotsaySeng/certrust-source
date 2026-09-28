<script setup lang="ts">
import type { BrandKitInfo } from '~/api/api-client'
import { rebrandDesign } from '~/lib/design-studio/rebrand'

const props = withDefaults(defineProps<{ showApply?: boolean }>(), { showApply: true })
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const resources = useStudioResourcesStore()
const store = useDesignStudioStore()

const blank: BrandKitInfo = { logo: null, primary: null, secondary: null, accent: null, headingFont: null, bodyFont: null, signers: [] }
const draft = ref<BrandKitInfo>(JSON.parse(JSON.stringify(resources.brand ?? blank)))
const applyToDesign = ref(props.showApply)
const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  saving.value = true
  error.value = null
  try {
    const before = resources.brandForRender()
    await resources.saveBrand(draft.value)
    const after = resources.brandForRender()
    if (applyToDesign.value && store.design && after) {
      store.replaceDesign(rebrandDesign(store.design, before, after))
    }
    emit('close')
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
      <div class="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl bg-white shadow-xl" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 class="text-lg font-semibold">
              {{ t('designStudio.brand.title') }}
            </h2>
            <p class="text-xs text-gray-500">
              {{ t('designStudio.brand.subtitle') }}
            </p>
          </div>
          <button class="ds-icon-btn" :aria-label="t('common.close')" @click="emit('close')">
            <div class="i-heroicons-x-mark h-5 w-5" />
          </button>
        </div>
        <div class="overflow-y-auto px-6 py-5">
          <DesignStudioBrandKitForm v-model="draft" />
        </div>
        <div class="flex items-center gap-3 border-t border-gray-100 px-6 py-4">
          <label v-if="showApply" class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="applyToDesign" type="checkbox" class="accent-[#28A745]">
            {{ t('designStudio.brand.applyToDesign') }}
          </label>
          <p v-if="error" class="text-xs text-red-600">
            {{ error }}
          </p>
          <button class="ml-auto rounded-lg border border-gray-300 px-4 py-2 text-sm" @click="emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="rounded-lg bg-[#28A745] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50" :disabled="saving" @click="save">
            {{ t('designStudio.brand.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
