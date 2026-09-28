<script setup lang="ts">
/**
 * Choose a certificate or badge design (the organization's own designs,
 * then the template library). `null` = none: the classic Certrust
 * certificate / no badge image.
 */
import { apiClient } from '~/api/api-client'

const props = defineProps<{ kind: 'certificate' | 'badge', modelValue: string | null | undefined }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()
const { t } = useI18n()

const items = ref<any[]>([])
const loading = ref(true)
onMounted(async () => {
  try {
    items.value = (await apiClient.listDesignTemplates('all')).filter(d => (d.kind || d.type) === props.kind)
  }
  finally {
    loading.value = false
  }
})
const mine = computed(() => items.value.filter(d => d.organization))
const library = computed(() => items.value.filter(d => !d.organization))
const selected = computed(() => items.value.find(d => d.documentId === props.modelValue) ?? null)
const open = ref(false)

function choose(d: any | null) {
  if (d?.locked) {
    return
  }
  emit('update:modelValue', d ? d.documentId : null)
  open.value = false
}
</script>

<template>
  <div>
    <button type="button" class="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-2 text-left hover:border-[#28A745]" :data-testid="`design-picker-${kind}`" @click="open = !open">
      <div class="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef0f3]">
        <img v-if="selected?.previewImage?.url" :src="designAssetUrl(selected.previewImage.url)" alt="" class="max-h-full max-w-full object-contain">
        <div v-else :class="kind === 'badge' ? 'i-heroicons-check-badge' : 'i-heroicons-document-text'" class="h-7 w-7 text-gray-400" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-gray-900">
          {{ selected ? selected.name : (kind === 'certificate' ? t('designStudio.picker.classic') : t('designStudio.picker.noBadge')) }}
        </p>
        <p class="text-xs text-gray-500">
          {{ selected ? (selected.organization ? t('designStudio.picker.yourDesign') : t('designStudio.picker.libraryDesign')) : t('designStudio.picker.change') }}
        </p>
      </div>
      <div class="i-heroicons-chevron-down h-4 w-4 text-gray-400" />
    </button>
    <div v-if="open" class="mt-2 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
      <div v-if="loading" class="py-4 text-center text-sm text-gray-500">
        {{ t('common.loading') }}
      </div>
      <template v-else>
        <button type="button" class="mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm" :class="!modelValue ? 'border-[#28A745] bg-[#28A745]/5' : 'border-gray-200'" @click="choose(null)">
          <div :class="kind === 'badge' ? 'i-heroicons-no-symbol' : 'i-heroicons-document-text'" class="h-4 w-4 text-gray-400" />
          {{ kind === 'certificate' ? t('designStudio.picker.classic') : t('designStudio.picker.noBadge') }}
        </button>
        <template v-for="group in [{ key: 'yourDesigns', list: mine }, { key: 'library', list: library }]" :key="group.key">
          <p v-if="group.list.length" class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {{ t(`designStudio.templates.${group.key}`) }}
          </p>
          <div v-if="group.list.length" class="mb-3 grid grid-cols-3 gap-2">
            <button
              v-for="d in group.list"
              :key="d.id"
              type="button"
              class="relative overflow-hidden rounded-lg border text-left"
              :class="[modelValue === d.documentId ? 'border-[#28A745] ring-2 ring-[#28A745]/30' : 'border-gray-200 hover:border-gray-300', d.locked ? 'cursor-not-allowed opacity-60' : '']"
              :title="d.locked ? t('designStudio.readonly.premium') : d.name"
              @click="choose(d)"
            >
              <div class="flex aspect-[4/3] items-center justify-center bg-[#eef0f3] p-1">
                <img v-if="d.previewImage?.url" :src="designAssetUrl(d.previewImage.url)" :alt="d.name" class="max-h-full max-w-full object-contain" loading="lazy">
              </div>
              <p class="truncate px-1.5 py-1 text-xs">
                {{ d.name }}
              </p>
              <div v-if="d.locked" class="i-heroicons-lock-closed absolute right-1 top-1 h-4 w-4 text-amber-600" />
            </button>
          </div>
        </template>
        <NuxtLink to="/design-templates/create" class="flex items-center gap-1 text-sm text-[#1B7A34] hover:underline">
          <div class="i-heroicons-plus h-4 w-4" />{{ t('designStudio.picker.createNew') }}
        </NuxtLink>
      </template>
    </div>
  </div>
</template>
