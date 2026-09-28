<script setup lang="ts">
const emit = defineEmits<{ fit: [] }>()
const store = useDesignStudioStore()
const { t } = useI18n()
const STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.25, 1.5, 2]
function zoomBy(dir: 1 | -1) {
  const z = store.zoom
  const next = dir > 0 ? STEPS.find(s => s > z + 0.001) : [...STEPS].reverse().find(s => s < z - 0.001)
  if (next) {
    store.zoom = next
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm">
    <button class="ds-icon-btn" :title="t('designStudio.zoomOut')" @click="zoomBy(-1)">
      <div class="i-heroicons-minus h-4 w-4" />
    </button>
    <button class="min-w-[3.5rem] rounded px-1 py-1 text-xs tabular-nums hover:bg-gray-100" :title="t('designStudio.zoomFit')" @click="emit('fit')">
      {{ Math.round(store.zoom * 100) }}%
    </button>
    <button class="ds-icon-btn" :title="t('designStudio.zoomIn')" @click="zoomBy(1)">
      <div class="i-heroicons-plus h-4 w-4" />
    </button>
  </div>
</template>
