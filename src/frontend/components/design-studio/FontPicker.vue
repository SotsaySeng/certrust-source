<script setup lang="ts">
/** Font picker: brand fonts first, then the curated families grouped by style, each shown in its own face. */
import type { BrandKit } from '~/lib/design-core'
import { onClickOutside } from '@vueuse/core'
import { DEFAULT_BRAND, PICKER_FAMILIES } from '~/lib/design-core'

const props = defineProps<{ modelValue: string, brand?: BrandKit | null, allowTokens?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const CATEGORIES = ['serif', 'sans', 'display', 'script', 'lao'] as const
const groups = computed(() => CATEGORIES.map(cat => ({
  cat,
  fonts: PICKER_FAMILIES.filter(f => f.category === cat && f.family.toLowerCase().includes(query.value.toLowerCase())),
})).filter(g => g.fonts.length))

const brandHeading = computed(() => props.brand?.headingFont || DEFAULT_BRAND.headingFont)
const brandBody = computed(() => props.brand?.bodyFont || DEFAULT_BRAND.bodyFont)
const display = computed(() => props.modelValue === '$brand.heading'
  ? `${t('designStudio.font.brandHeading')} · ${brandHeading.value}`
  : props.modelValue === '$brand.body' ? `${t('designStudio.font.brandBody')} · ${brandBody.value}` : props.modelValue)
const displayFamily = computed(() => props.modelValue === '$brand.heading' ? brandHeading.value : props.modelValue === '$brand.body' ? brandBody.value : props.modelValue)

watch(open, (v) => {
  if (!v) {
    return
  }
  for (const f of PICKER_FAMILIES) {
    void ensureCssFont(f.family)
  }
})
watch(displayFamily, f => void ensureCssFont(f), { immediate: true })

function pick(v: string) {
  emit('update:modelValue', v)
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" class="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-left text-sm hover:border-gray-300" :aria-label="t('designStudio.font.label')" @click="open = !open">
      <span class="truncate" :style="{ fontFamily: `'${displayFamily}'` }">{{ display }}</span>
      <div class="i-heroicons-chevron-down h-4 w-4 shrink-0 text-gray-400" />
    </button>
    <div v-if="open" class="absolute left-0 right-0 z-50 mt-1 max-h-96 min-w-[240px] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
      <input v-model="query" class="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm" :placeholder="t('designStudio.font.search')" autofocus>
      <template v-if="allowTokens && !query">
        <p class="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {{ t('designStudio.font.brand') }}
        </p>
        <button type="button" class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-gray-50" :class="{ 'bg-[#28A745]/10': modelValue === '$brand.heading' }" :style="{ fontFamily: `'${brandHeading}'` }" @click="pick('$brand.heading')">
          {{ t('designStudio.font.brandHeading') }} · {{ brandHeading }}
        </button>
        <button type="button" class="block w-full rounded-md px-2 py-1.5 text-left hover:bg-gray-50" :class="{ 'bg-[#28A745]/10': modelValue === '$brand.body' }" :style="{ fontFamily: `'${brandBody}'` }" @click="pick('$brand.body')">
          {{ t('designStudio.font.brandBody') }} · {{ brandBody }}
        </button>
      </template>
      <div v-for="g in groups" :key="g.cat">
        <p class="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {{ t(`designStudio.font.cat.${g.cat}`) }}
        </p>
        <button
          v-for="f in g.fonts"
          :key="f.family"
          type="button"
          class="block w-full rounded-md px-2 py-1.5 text-left text-[15px] hover:bg-gray-50"
          :class="{ 'bg-[#28A745]/10': modelValue === f.family }"
          :style="{ fontFamily: `'${f.family}'` }"
          @click="pick(f.family)"
        >
          {{ g.cat === 'lao' ? `${f.family} · ພາສາລາວ` : f.family }}
        </button>
      </div>
    </div>
  </div>
</template>
