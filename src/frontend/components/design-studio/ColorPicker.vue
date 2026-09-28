<script setup lang="ts">
/**
 * Colour picker: the organization's brand colours (stored as tokens so a
 * template follows the brand), a curated palette, and any custom colour.
 */
import type { BrandKit } from '~/lib/design-core'
import { onClickOutside } from '@vueuse/core'
import { resolveColor } from '~/lib/design-core'

const props = defineProps<{
  modelValue: string | undefined
  brand?: BrandKit | null
  allowTransparent?: boolean
  label?: string
  compact?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const PALETTE = [
  '#000000',
  '#1f2937',
  '#4b5563',
  '#9ca3af',
  '#e5e7eb',
  '#ffffff',
  '#1e3a8a',
  '#2563eb',
  '#0ea5e9',
  '#0f766e',
  '#16a34a',
  '#28a745',
  '#b08d3c',
  '#d4a017',
  '#f59e0b',
  '#ea580c',
  '#dc2626',
  '#7a1f3d',
  '#6d28d9',
  '#db2777',
  '#f5f0e6',
  '#fdf6e3',
  '#eef2ff',
  '#ecfdf5',
]
const BRAND_TOKENS = ['$brand.primary', '$brand.secondary', '$brand.accent'] as const

const resolved = computed(() => {
  const v = props.modelValue
  if (!v || v === 'transparent') {
    return 'transparent'
  }
  return resolveColor(v, props.brand)
})
const hex = ref('')
watch(() => props.modelValue, () => {
  hex.value = resolved.value === 'none' || resolved.value === 'transparent' ? '' : resolved.value
}, { immediate: true })

function pick(v: string) {
  emit('update:modelValue', v)
}
function commitHex() {
  const v = hex.value.trim()
  const full = /^#?[0-9a-f]{6}$/i.test(v) ? (v.startsWith('#') ? v : `#${v}`) : null
  if (full) {
    pick(full.toLowerCase())
  }
}
const tokenLabel = (tok: string) => t(`designStudio.color.${tok.split('.')[1]}`)
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white text-sm hover:border-gray-300"
      :class="compact ? 'p-1' : 'w-full px-2 py-1.5'"
      :title="label"
      :aria-label="label"
      @click="open = !open"
    >
      <span
        class="h-5 w-5 shrink-0 rounded border border-gray-300"
        :style="resolved === 'transparent' || resolved === 'none'
          ? { backgroundImage: 'linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%),linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0,4px 4px' }
          : { background: resolved }"
      />
      <span v-if="!compact" class="truncate text-gray-700">
        {{ modelValue?.startsWith('$brand.') ? tokenLabel(modelValue) : (resolved === 'none' || resolved === 'transparent' ? t('designStudio.color.transparent') : resolved) }}
      </span>
    </button>
    <div v-if="open" class="absolute right-0 z-50 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
      <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {{ t('designStudio.color.brand') }}
      </p>
      <div class="mb-3 flex gap-2">
        <button
          v-for="tok in BRAND_TOKENS"
          :key="tok"
          type="button"
          class="flex flex-1 flex-col items-center gap-1 rounded-lg p-1 text-[10px] text-gray-600 hover:bg-gray-50"
          :class="{ 'ring-2 ring-[#28A745]': modelValue === tok }"
          @click="pick(tok)"
        >
          <span class="h-7 w-full rounded-md border border-gray-200" :style="{ background: resolveColor(tok, brand) }" />
          {{ tokenLabel(tok) }}
        </button>
      </div>
      <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        {{ t('designStudio.color.palette') }}
      </p>
      <div class="grid grid-cols-6 gap-1.5">
        <button
          v-for="c in PALETTE"
          :key="c"
          type="button"
          class="h-7 w-7 rounded-md border border-gray-200"
          :class="{ 'ring-2 ring-[#28A745] ring-offset-1': resolved.toLowerCase() === c && !modelValue?.startsWith('$') }"
          :style="{ background: c }"
          :title="c"
          @click="pick(c)"
        />
      </div>
      <div class="mt-3 flex items-center gap-2">
        <input type="color" class="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" :value="hex || '#000000'" :aria-label="t('designStudio.color.custom')" @input="pick(($event.target as HTMLInputElement).value)">
        <input v-model="hex" class="w-full rounded-md border border-gray-200 px-2 py-1 font-mono text-xs" placeholder="#1e3a8a" @keydown.enter="commitHex" @blur="commitHex">
      </div>
      <button v-if="allowTransparent" type="button" class="mt-2 w-full rounded-md border border-dashed border-gray-300 py-1 text-xs text-gray-600 hover:bg-gray-50" @click="pick('transparent')">
        {{ t('designStudio.color.transparent') }}
      </button>
    </div>
  </div>
</template>
