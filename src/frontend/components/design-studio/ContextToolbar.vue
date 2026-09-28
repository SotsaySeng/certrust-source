<script setup lang="ts">
/** Floating quick actions for the current selection (the inspector has everything else). */
import { weightsFor } from '~/lib/design-core'

const emit = defineEmits<{ editText: [id: string] }>()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()
const { t } = useI18n()

const el = computed(() => store.single as any)
const brand = computed(() => (store.meta?.system ? null : resources.brandForRender()))

function set(patch: Record<string, any>, key?: string) {
  if (el.value) {
    store.updateElement(el.value.id, patch, key)
  }
}
function bump(delta: number) {
  if (el.value?.type !== 'text') {
    return
  }
  set({ fontSize: Math.max(4, Math.round((el.value.fontSize + delta) * 10) / 10) }, `fs:${el.value.id}`)
}
function toggleBold() {
  const fam = el.value.fontFamily.startsWith('$') ? 'Inter' : el.value.fontFamily
  const ws = weightsFor(fam)
  set({ fontWeight: el.value.fontWeight >= 600 ? (ws.includes(400) ? 400 : ws[0]) : (ws.includes(700) ? 700 : ws[ws.length - 1]) })
}
const ALIGN_NEXT: Record<string, string> = { left: 'center', center: 'right', right: 'left' }
const ALIGN_ICON: Record<string, string> = { left: 'i-tabler-align-left', center: 'i-tabler-align-center', right: 'i-tabler-align-right' }
</script>

<template>
  <div v-if="store.selectedIds.length && !store.editingTextId" class="z-10 flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white p-1 text-sm shadow-lg" role="toolbar" :aria-label="t('designStudio.toolbar.label')">
    <template v-if="el && !el.locked">
      <template v-if="el.type === 'text'">
        <div class="w-44">
          <DesignStudioFontPicker :model-value="el.fontFamily" :brand="brand" allow-tokens @update:model-value="set({ fontFamily: $event })" />
        </div>
        <button class="ds-icon-btn" :title="t('designStudio.toolbar.smaller')" @click="bump(-2)">
          <div class="i-heroicons-minus h-4 w-4" />
        </button>
        <span class="w-9 text-center tabular-nums">{{ Math.round(el.fontSize) }}</span>
        <button class="ds-icon-btn" :title="t('designStudio.toolbar.bigger')" @click="bump(2)">
          <div class="i-heroicons-plus h-4 w-4" />
        </button>
        <DesignStudioColorPicker compact :model-value="el.color" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ color: $event })" />
        <button class="ds-icon-btn" :class="{ 'bg-[#28A745]/15 text-[#1B7A34]': el.fontWeight >= 600 }" :title="t('designStudio.inspector.bold')" @click="toggleBold">
          <div class="i-tabler-bold h-4 w-4" />
        </button>
        <button class="ds-icon-btn" :title="t('designStudio.toolbar.align')" @click="set({ align: ALIGN_NEXT[el.align] })">
          <div :class="ALIGN_ICON[el.align]" class="h-4 w-4" />
        </button>
        <button class="ds-icon-btn" :title="t('designStudio.toolbar.editText')" @click="emit('editText', el.id)">
          <div class="i-heroicons-pencil-square h-4 w-4" />
        </button>
      </template>
      <template v-else-if="el.type === 'shape'">
        <DesignStudioColorPicker compact :model-value="el.fill" :brand="brand" allow-transparent :label="t('designStudio.inspector.fill')" @update:model-value="set({ fill: $event })" />
        <DesignStudioColorPicker compact :model-value="el.stroke || 'transparent'" :brand="brand" allow-transparent :label="t('designStudio.inspector.outline')" @update:model-value="set({ stroke: $event, strokeWidth: el.strokeWidth || 4 })" />
      </template>
      <template v-else-if="el.type === 'frame'">
        <DesignStudioColorPicker compact :model-value="el.color" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ color: $event })" />
        <DesignStudioColorPicker compact :model-value="el.color2 || el.color" :brand="brand" :label="t('designStudio.inspector.color2')" @update:model-value="set({ color2: $event })" />
      </template>
      <template v-else-if="el.type === 'line'">
        <DesignStudioColorPicker compact :model-value="el.stroke" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ stroke: $event })" />
      </template>
      <template v-else-if="el.type === 'qr'">
        <DesignStudioColorPicker compact :model-value="el.fg" :brand="brand" :label="t('designStudio.inspector.qrColor')" @update:model-value="set({ fg: $event })" />
      </template>
      <div class="mx-1 h-5 w-px bg-gray-200" />
      <button class="ds-icon-btn" :title="t('designStudio.arrange.forward')" @click="store.arrange('forward')">
        <div class="i-tabler-stack-front h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.arrange.backward')" @click="store.arrange('backward')">
        <div class="i-tabler-stack-back h-4 w-4" />
      </button>
    </template>
    <template v-else-if="store.selectedIds.length > 1">
      <button class="ds-icon-btn" :title="t('designStudio.align.left')" @click="store.align('left')">
        <div class="i-tabler-layout-align-left h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.align.hcenter')" @click="store.align('hcenter')">
        <div class="i-tabler-layout-align-center h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.align.right')" @click="store.align('right')">
        <div class="i-tabler-layout-align-right h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.align.top')" @click="store.align('top')">
        <div class="i-tabler-layout-align-top h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.align.vcenter')" @click="store.align('vcenter')">
        <div class="i-tabler-layout-align-middle h-4 w-4" />
      </button>
      <button class="ds-icon-btn" :title="t('designStudio.align.bottom')" @click="store.align('bottom')">
        <div class="i-tabler-layout-align-bottom h-4 w-4" />
      </button>
      <div class="mx-1 h-5 w-px bg-gray-200" />
    </template>
    <button class="ds-icon-btn" :class="{ 'text-amber-600': el?.locked }" :disabled="!el" :title="el?.locked ? t('designStudio.unlock') : t('designStudio.lock')" @click="set({ locked: !el.locked })">
      <div :class="el?.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'" class="h-4 w-4" />
    </button>
    <button class="ds-icon-btn" :title="t('designStudio.duplicate')" @click="store.duplicateSelected()">
      <div class="i-heroicons-document-duplicate h-4 w-4" />
    </button>
    <button class="ds-icon-btn text-red-600" :title="t('common.delete')" @click="store.removeSelected()">
      <div class="i-heroicons-trash h-4 w-4" />
    </button>
  </div>
</template>
