<script setup lang="ts">
const emit = defineEmits<{ close: [], tour: [] }>()
const { t } = useI18n()
const isMac = import.meta.client && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl'
const rows = computed(() => [
  [`${mod} Z`, t('designStudio.shortcuts.undo')],
  [`${mod} ⇧ Z`, t('designStudio.shortcuts.redo')],
  [`${mod} S`, t('designStudio.shortcuts.save')],
  [`${mod} D`, t('designStudio.shortcuts.duplicate')],
  [`${mod} C / ${mod} V`, t('designStudio.shortcuts.copyPaste')],
  [`${mod} A`, t('designStudio.shortcuts.selectAll')],
  ['Delete', t('designStudio.shortcuts.delete')],
  ['← ↑ → ↓', t('designStudio.shortcuts.nudge')],
  ['⇧ + ← ↑ → ↓', t('designStudio.shortcuts.nudgeMore')],
  ['Enter', t('designStudio.shortcuts.editText')],
  ['Esc', t('designStudio.shortcuts.deselect')],
  ['⇧ Click', t('designStudio.shortcuts.multiSelect')],
])
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            {{ t('designStudio.shortcuts.title') }}
          </h2>
          <button class="ds-icon-btn" :aria-label="t('common.close')" @click="emit('close')">
            <div class="i-heroicons-x-mark h-5 w-5" />
          </button>
        </div>
        <dl class="divide-y divide-gray-100 text-sm">
          <div v-for="[keys, label] in rows" :key="keys" class="flex justify-between py-2">
            <dt class="text-gray-600">
              {{ label }}
            </dt>
            <dd><kbd class="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs">{{ keys }}</kbd></dd>
          </div>
        </dl>
        <button class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#28A745] px-4 py-2 text-sm font-medium text-[#1B7A34] hover:bg-[#28A745]/5" @click="emit('tour')">
          <div class="i-heroicons-play-circle h-4 w-4" />{{ t('designStudio.tour.replay') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
