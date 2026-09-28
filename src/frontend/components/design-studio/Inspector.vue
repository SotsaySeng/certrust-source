<script setup lang="ts">
/**
 * Right-hand properties panel. No selection: page settings. Several
 * elements: align / distribute. One element: everything about it.
 */
import type { BrandKit, DesignElement, FrameStyle, RenderIssue, ShapeKind } from '~/lib/design-core'
import { hasItalic, weightsFor } from '~/lib/design-core'
import { fromEditable, toEditable } from '~/lib/design-studio/text-tokens'

const props = defineProps<{ brand?: BrandKit | null, issues: RenderIssue[] }>()
const emit = defineEmits<{ jump: [id: string] }>()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()
const { t } = useI18n()

const el = computed(() => store.single as any)
const design = computed(() => store.design)

function set(patch: Record<string, any>, key?: string) {
  if (el.value) {
    store.updateElement(el.value.id, patch as Partial<DesignElement>, key)
  }
}
function num(v: string | number, fallback = 0) {
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}
const round = (v: number) => Math.round(v * 10) / 10

const issueFor = computed(() => (el.value ? props.issues.filter(i => i.elementId === el.value.id) : []))

// Text content in the friendly [token] form.
const contentText = computed({
  get: () => (el.value?.type === 'text' ? toEditable(el.value.content) : ''),
  set: (v: string) => set({ content: fromEditable(v) }, `content:${el.value?.id}`),
})

const fontWeights = computed(() => {
  if (el.value?.type !== 'text') {
    return [400]
  }
  const fam = el.value.fontFamily === '$brand.heading' ? (props.brand?.headingFont || 'Playfair Display') : el.value.fontFamily === '$brand.body' ? (props.brand?.bodyFont || 'Inter') : el.value.fontFamily
  return weightsFor(fam)
})
const italicAvailable = computed(() => el.value?.type === 'text' && (el.value.fontFamily.startsWith('$') || hasItalic(el.value.fontFamily)))

function onFontChange(family: string) {
  const weights = weightsFor(family.startsWith('$') ? 'Inter' : family)
  const current = el.value.fontWeight
  const w = weights.includes(current) ? current : weights.reduce((a, b) => (Math.abs(b - current) < Math.abs(a - current) ? b : a))
  set({ fontFamily: family, fontWeight: w })
}

const SHAPES: ShapeKind[] = ['rect', 'ellipse', 'triangle', 'diamond', 'star', 'hexagon', 'shield', 'sunburst', 'ribbon', 'banner']
const FRAMES: FrameStyle[] = ['guilloche', 'classic', 'double', 'corners', 'deco', 'wave', 'dots']

// Page
const isCertificate = computed(() => design.value?.kind === 'certificate')
function setPreset(preset: 'A4' | 'Letter') {
  if (design.value) {
    store.setPage(preset, design.value.page.orientation)
  }
}
function setOrientation(o: 'landscape' | 'portrait') {
  if (design.value) {
    store.setPage(design.value.page.preset, o)
  }
}

const imagePickerOpen = ref<null | 'element' | 'background'>(null)
function chooseImage(url: string) {
  if (imagePickerOpen.value === 'background') {
    store.setBackground({ image: { src: url, fit: 'cover' } })
  }
  else if (el.value?.type === 'image') {
    set({ src: url })
  }
  imagePickerOpen.value = null
}
onMounted(() => resources.loadUploads())

const TEXT_ALIGN = [
  { value: 'left', icon: 'i-tabler-align-left' },
  { value: 'center', icon: 'i-tabler-align-center' },
  { value: 'right', icon: 'i-tabler-align-right' },
] as const

const ALIGN = [
  { mode: 'left', icon: 'i-tabler-layout-align-left' },
  { mode: 'hcenter', icon: 'i-tabler-layout-align-center' },
  { mode: 'right', icon: 'i-tabler-layout-align-right' },
  { mode: 'top', icon: 'i-tabler-layout-align-top' },
  { mode: 'vcenter', icon: 'i-tabler-layout-align-middle' },
  { mode: 'bottom', icon: 'i-tabler-layout-align-bottom' },
] as const
</script>

<template>
  <aside class="flex w-[288px] shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white text-sm" data-tour="inspector" :aria-label="t('designStudio.inspector.label')">
    <!-- ============ Page ============ -->
    <div v-if="!store.selectedIds.length && design" class="space-y-5 p-4">
      <h2 class="font-semibold text-gray-900">
        {{ isCertificate ? t('designStudio.inspector.certificate') : t('designStudio.inspector.badge') }}
      </h2>

      <section v-if="isCertificate" class="space-y-2">
        <label class="ds-label">{{ t('designStudio.inspector.paperSize') }}</label>
        <div class="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          <button v-for="p in (['A4', 'Letter'] as const)" :key="p" class="rounded-md py-1.5" :class="design.page.preset === p ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="setPreset(p)">
            {{ p === 'A4' ? 'A4' : 'US Letter' }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          <button v-for="o in (['landscape', 'portrait'] as const)" :key="o" class="flex items-center justify-center gap-1.5 rounded-md py-1.5" :class="design.page.orientation === o ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="setOrientation(o)">
            <span class="inline-block border-2 border-current" :class="o === 'landscape' ? 'h-2.5 w-3.5' : 'h-3.5 w-2.5'" />
            {{ t(`designStudio.inspector.${o}`) }}
          </button>
        </div>
      </section>

      <section class="space-y-2">
        <label class="ds-label">{{ t('designStudio.inspector.background') }}</label>
        <DesignStudioColorPicker :model-value="design.background.color" :brand="brand" allow-transparent :label="t('designStudio.inspector.backgroundColor')" @update:model-value="store.setBackground({ color: $event })" />
        <div v-if="design.background.image?.src" class="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
          <img :src="designAssetUrl(design.background.image.src)" class="h-10 w-14 rounded object-cover" alt="">
          <select class="ds-input flex-1" :value="design.background.image.fit" @change="store.setBackground({ image: { ...design.background.image!, fit: ($event.target as HTMLSelectElement).value as any } })">
            <option value="cover">
              {{ t('designStudio.inspector.fitCover') }}
            </option>
            <option value="contain">
              {{ t('designStudio.inspector.fitContain') }}
            </option>
            <option value="fill">
              {{ t('designStudio.inspector.fitFill') }}
            </option>
          </select>
          <button class="ds-icon-btn" :title="t('designStudio.inspector.removeBackground')" @click="store.setBackground({ image: null })">
            <div class="i-heroicons-trash h-4 w-4" />
          </button>
        </div>
        <button class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2 text-gray-600 hover:bg-gray-50" @click="imagePickerOpen = 'background'">
          <div class="i-heroicons-photo h-4 w-4" />{{ t('designStudio.inspector.backgroundImage') }}
        </button>
      </section>

      <section class="rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-600">
        <p class="mb-1 font-medium text-gray-800">
          {{ t('designStudio.inspector.tipsTitle') }}
        </p>
        <ul class="list-disc space-y-1 pl-4">
          <li>{{ t('designStudio.inspector.tip1') }}</li>
          <li>{{ t('designStudio.inspector.tip2') }}</li>
          <li>{{ t('designStudio.inspector.tip3') }}</li>
        </ul>
      </section>
    </div>

    <!-- ============ Multi-selection ============ -->
    <div v-else-if="store.selectedIds.length > 1" class="space-y-5 p-4">
      <h2 class="font-semibold">
        {{ t('designStudio.inspector.selected', { n: store.selectedIds.length }) }}
      </h2>
      <section class="space-y-2">
        <label class="ds-label">{{ t('designStudio.inspector.align') }}</label>
        <div class="grid grid-cols-6 gap-1">
          <button v-for="a in ALIGN" :key="a.mode" class="ds-icon-btn border border-gray-200" :title="t(`designStudio.align.${a.mode}`)" @click="store.align(a.mode)">
            <div :class="a.icon" class="h-4 w-4" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-1">
          <button class="rounded-lg border border-gray-200 py-1.5 text-xs disabled:opacity-40" :disabled="store.selectedIds.length < 3" @click="store.distribute('x')">
            {{ t('designStudio.align.distributeH') }}
          </button>
          <button class="rounded-lg border border-gray-200 py-1.5 text-xs disabled:opacity-40" :disabled="store.selectedIds.length < 3" @click="store.distribute('y')">
            {{ t('designStudio.align.distributeV') }}
          </button>
        </div>
      </section>
      <div class="flex gap-2">
        <button class="flex-1 rounded-lg border border-gray-200 py-2" @click="store.duplicateSelected()">
          {{ t('designStudio.duplicate') }}
        </button>
        <button class="flex-1 rounded-lg border border-red-200 py-2 text-red-600" @click="store.removeSelected()">
          {{ t('common.delete') }}
        </button>
      </div>
    </div>

    <!-- ============ Single element ============ -->
    <div v-else-if="el" class="space-y-5 p-4">
      <div class="flex items-center gap-2">
        <input
          class="min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 font-semibold hover:border-gray-200 focus:border-[#28A745] focus:outline-none"
          :value="el.name || t(`designStudio.types.${el.type}`)"
          :aria-label="t('designStudio.inspector.layerName')"
          @change="set({ name: ($event.target as HTMLInputElement).value.slice(0, 120) })"
        >
        <button class="ds-icon-btn" :title="el.locked ? t('designStudio.unlock') : t('designStudio.lock')" @click="set({ locked: !el.locked })">
          <div :class="el.locked ? 'i-heroicons-lock-closed text-amber-600' : 'i-heroicons-lock-open'" class="h-4 w-4" />
        </button>
        <button class="ds-icon-btn" :title="t('designStudio.duplicate')" @click="store.duplicateSelected()">
          <div class="i-heroicons-document-duplicate h-4 w-4" />
        </button>
        <button class="ds-icon-btn text-red-600" :title="t('common.delete')" :disabled="el.locked" @click="store.removeSelected()">
          <div class="i-heroicons-trash h-4 w-4" />
        </button>
      </div>

      <div v-if="issueFor.length" class="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
        <p v-for="i in issueFor" :key="i.kind">
          {{ t(`designStudio.preflight.${i.kind}`) }}
        </p>
      </div>

      <fieldset :disabled="el.locked" class="space-y-5">
        <!-- Text -->
        <section v-if="el.type === 'text'" class="space-y-2">
          <label class="ds-label" for="ds-text-content">{{ t('designStudio.inspector.text') }}</label>
          <textarea id="ds-text-content" v-model="contentText" rows="3" class="ds-input w-full resize-y" />
          <p class="text-[11px] text-gray-500">
            {{ t('designStudio.inspector.textHint') }}
          </p>
          <DesignStudioFontPicker :model-value="el.fontFamily" :brand="brand" allow-tokens @update:model-value="onFontChange" />
          <div class="grid grid-cols-2 gap-2">
            <select class="ds-input" :value="el.fontWeight" :aria-label="t('designStudio.inspector.weight')" @change="set({ fontWeight: Number(($event.target as HTMLSelectElement).value) })">
              <option v-for="w in fontWeights" :key="w" :value="w">
                {{ t(`designStudio.weights.w${w}`) }}
              </option>
            </select>
            <div class="flex items-center gap-1">
              <input type="number" min="4" max="400" step="1" class="ds-input w-full" :value="round(el.fontSize)" :aria-label="t('designStudio.inspector.size')" @input="set({ fontSize: Math.max(4, num(($event.target as HTMLInputElement).value, el.fontSize)) }, `fs:${el.id}`)">
              <span class="text-xs text-gray-500">px</span>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button class="ds-toggle" :class="{ on: el.fontWeight >= 600 }" :title="t('designStudio.inspector.bold')" @click="set({ fontWeight: el.fontWeight >= 600 ? 400 : (fontWeights.includes(700) ? 700 : Math.max(...fontWeights)) })">
              <div class="i-tabler-bold h-4 w-4" />
            </button>
            <button class="ds-toggle" :class="{ on: el.italic }" :disabled="!italicAvailable" :title="t('designStudio.inspector.italic')" @click="set({ italic: !el.italic })">
              <div class="i-tabler-italic h-4 w-4" />
            </button>
            <button class="ds-toggle" :class="{ on: el.uppercase }" :title="t('designStudio.inspector.uppercase')" @click="set({ uppercase: !el.uppercase })">
              <div class="i-tabler-letter-case-upper h-4 w-4" />
            </button>
            <div class="mx-1 h-5 w-px bg-gray-200" />
            <button v-for="a in TEXT_ALIGN" :key="a.value" class="ds-toggle" :class="{ on: el.align === a.value }" :title="t(`designStudio.inspector.align_${a.value}`)" @click="set({ align: a.value })">
              <div :class="a.icon" class="h-4 w-4" />
            </button>
          </div>
          <DesignStudioColorPicker :model-value="el.color" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ color: $event })" />
          <div class="grid grid-cols-2 gap-2">
            <label class="text-xs text-gray-600">{{ t('designStudio.inspector.lineHeight') }}
              <input type="number" min="0.6" max="3" step="0.05" class="ds-input mt-0.5 w-full" :value="el.lineHeight ?? 1.2" @input="set({ lineHeight: num(($event.target as HTMLInputElement).value, 1.2) }, `lh:${el.id}`)">
            </label>
            <label class="text-xs text-gray-600">{{ t('designStudio.inspector.letterSpacing') }}
              <input type="number" min="-10" max="50" step="0.5" class="ds-input mt-0.5 w-full" :value="el.letterSpacing ?? 0" @input="set({ letterSpacing: num(($event.target as HTMLInputElement).value) }, `ls:${el.id}`)">
            </label>
          </div>
          <div class="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 text-xs">
            <button v-for="v in (['top', 'middle', 'bottom'] as const)" :key="v" class="rounded-md py-1" :class="(el.vAlign ?? 'top') === v ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="set({ vAlign: v })">
              {{ t(`designStudio.inspector.v_${v}`) }}
            </button>
          </div>
          <label class="flex items-start gap-2 rounded-lg border border-gray-200 p-2">
            <input type="checkbox" class="mt-0.5 accent-[#28A745]" :checked="!!el.autoFit" @change="set({ autoFit: ($event.target as HTMLInputElement).checked })">
            <span>
              <span class="font-medium">{{ t('designStudio.inspector.autoFit') }}</span>
              <span class="block text-xs text-gray-500">{{ t('designStudio.inspector.autoFitHint') }}</span>
            </span>
          </label>
          <div v-if="design?.kind === 'badge' || el.curve">
            <label class="text-xs text-gray-600">{{ t('designStudio.inspector.curve') }}: {{ el.curve ? Math.round(el.curve) : t('designStudio.inspector.straight') }}</label>
            <input type="range" min="-600" max="600" step="5" class="w-full accent-[#28A745]" :value="el.curve ?? 0" @input="set({ curve: Math.abs(num(($event.target as HTMLInputElement).value)) < 40 ? 0 : num(($event.target as HTMLInputElement).value) }, `curve:${el.id}`)">
            <p class="text-[11px] text-gray-500">
              {{ t('designStudio.inspector.curveHint') }}
            </p>
          </div>
        </section>

        <!-- Image -->
        <section v-else-if="el.type === 'image'" class="space-y-2">
          <label class="ds-label">{{ t('designStudio.types.image') }}</label>
          <button class="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 hover:bg-gray-50" @click="imagePickerOpen = 'element'">
            <div class="i-heroicons-arrow-path h-4 w-4" />{{ t('designStudio.inspector.replaceImage') }}
          </button>
          <div class="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 text-xs">
            <button v-for="f in (['contain', 'cover', 'fill'] as const)" :key="f" class="rounded-md py-1" :class="el.fit === f ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="set({ fit: f })">
              {{ t(`designStudio.inspector.fit_${f}`) }}
            </button>
          </div>
          <div class="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 text-xs">
            <button v-for="c in (['none', 'rounded', 'circle'] as const)" :key="c" class="rounded-md py-1" :class="(el.clip ?? 'none') === c ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="set({ clip: c })">
              {{ t(`designStudio.inspector.clip_${c}`) }}
            </button>
          </div>
          <p v-if="el.bind" class="text-[11px] text-violet-700">
            {{ t('designStudio.inspector.bound', { what: t(`designStudio.bind.${el.bind.replace(/\./g, '_')}`) }) }}
          </p>
        </section>

        <!-- Shape -->
        <section v-else-if="el.type === 'shape'" class="space-y-2">
          <label class="ds-label">{{ t('designStudio.types.shape') }}</label>
          <select class="ds-input w-full" :value="el.shape" @change="set({ shape: ($event.target as HTMLSelectElement).value })">
            <option v-for="s in SHAPES" :key="s" :value="s">
              {{ t(`designStudio.shapes.${s}`) }}
            </option>
          </select>
          <DesignStudioColorPicker :model-value="el.fill" :brand="brand" allow-transparent :label="t('designStudio.inspector.fill')" @update:model-value="set({ fill: $event })" />
          <DesignStudioColorPicker v-if="el.shape === 'ribbon' || el.shape === 'banner'" :model-value="el.fill2" :brand="brand" :label="t('designStudio.inspector.fill2')" @update:model-value="set({ fill2: $event })" />
          <div class="flex items-center gap-2">
            <DesignStudioColorPicker class="flex-1" :model-value="el.stroke || 'transparent'" :brand="brand" allow-transparent :label="t('designStudio.inspector.outline')" @update:model-value="set({ stroke: $event })" />
            <input type="number" min="0" max="80" class="ds-input w-16" :value="el.strokeWidth ?? 0" :aria-label="t('designStudio.inspector.outlineWidth')" @input="set({ strokeWidth: Math.max(0, num(($event.target as HTMLInputElement).value)) }, `sw:${el.id}`)">
          </div>
          <label v-if="el.shape === 'rect'" class="block text-xs text-gray-600">{{ t('designStudio.inspector.cornerRadius') }}
            <input type="range" min="0" :max="Math.min(el.w, el.h) / 2" class="w-full accent-[#28A745]" :value="el.radius ?? 0" @input="set({ radius: num(($event.target as HTMLInputElement).value) }, `rad:${el.id}`)">
          </label>
          <label v-if="el.shape === 'star' || el.shape === 'sunburst'" class="block text-xs text-gray-600">{{ t('designStudio.inspector.points') }}: {{ el.points ?? (el.shape === 'star' ? 5 : 24) }}
            <input type="range" :min="el.shape === 'star' ? 3 : 8" :max="el.shape === 'star' ? 16 : 64" class="w-full accent-[#28A745]" :value="el.points ?? (el.shape === 'star' ? 5 : 24)" @input="set({ points: num(($event.target as HTMLInputElement).value) }, `pts:${el.id}`)">
          </label>
        </section>

        <!-- Line -->
        <section v-else-if="el.type === 'line'" class="space-y-2">
          <label class="ds-label">{{ t('designStudio.types.line') }}</label>
          <DesignStudioColorPicker :model-value="el.stroke" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ stroke: $event })" />
          <label class="block text-xs text-gray-600">{{ t('designStudio.inspector.thickness') }}
            <input type="range" min="0.5" max="20" step="0.5" class="w-full accent-[#28A745]" :value="el.strokeWidth" @input="set({ strokeWidth: num(($event.target as HTMLInputElement).value, 1) }, `sw:${el.id}`)">
          </label>
          <div class="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 text-xs">
            <button v-for="d in (['solid', 'dashed', 'dotted'] as const)" :key="d" class="rounded-md py-1" :class="(el.dash ?? 'solid') === d ? 'bg-white shadow-sm font-medium' : 'text-gray-600'" @click="set({ dash: d })">
              {{ t(`designStudio.inspector.dash_${d}`) }}
            </button>
          </div>
        </section>

        <!-- QR -->
        <section v-else-if="el.type === 'qr'" class="space-y-2">
          <label class="ds-label">{{ t('designStudio.types.qr') }}</label>
          <p class="text-xs text-gray-600">
            {{ t('designStudio.inspector.qrHint') }}
          </p>
          <DesignStudioColorPicker :model-value="el.fg" :brand="brand" :label="t('designStudio.inspector.qrColor')" @update:model-value="set({ fg: $event })" />
          <DesignStudioColorPicker :model-value="el.bg" :brand="brand" allow-transparent :label="t('designStudio.inspector.qrBackground')" @update:model-value="set({ bg: $event })" />
        </section>

        <!-- Frame -->
        <section v-else-if="el.type === 'frame'" class="space-y-2">
          <label class="ds-label">{{ t('designStudio.types.frame') }}</label>
          <select class="ds-input w-full" :value="el.style" @change="set({ style: ($event.target as HTMLSelectElement).value })">
            <option v-for="f in FRAMES" :key="f" :value="f">
              {{ t(`designStudio.elements.frame_${f}`) }}
            </option>
          </select>
          <DesignStudioColorPicker :model-value="el.color" :brand="brand" :label="t('designStudio.inspector.color')" @update:model-value="set({ color: $event })" />
          <DesignStudioColorPicker :model-value="el.color2 || el.color" :brand="brand" :label="t('designStudio.inspector.color2')" @update:model-value="set({ color2: $event })" />
          <label class="block text-xs text-gray-600">{{ t('designStudio.inspector.thickness') }}
            <input type="range" min="6" max="120" class="w-full accent-[#28A745]" :value="el.thickness" @input="set({ thickness: num(($event.target as HTMLInputElement).value, 30) }, `th:${el.id}`)">
          </label>
        </section>

        <!-- Position & size (all) -->
        <section class="space-y-2">
          <label class="ds-label">{{ t('designStudio.inspector.position') }}</label>
          <div class="grid grid-cols-2 gap-2">
            <label v-for="k in (['x', 'y', 'w', 'h'] as const)" :key="k" class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1">
              <span class="w-3 text-xs uppercase text-gray-400">{{ k }}</span>
              <input type="number" class="w-full bg-transparent text-sm outline-none" :value="round(el[k])" @input="set({ [k]: k === 'w' || k === 'h' ? Math.max(1, num(($event.target as HTMLInputElement).value, el[k])) : num(($event.target as HTMLInputElement).value, el[k]) }, `${k}:${el.id}`)">
            </label>
            <label class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1">
              <div class="i-heroicons-arrow-path h-3.5 w-3.5 text-gray-400" />
              <input type="number" min="-180" max="180" class="w-full bg-transparent text-sm outline-none" :value="round(el.rotation ?? 0)" :aria-label="t('designStudio.inspector.rotation')" @input="set({ rotation: num(($event.target as HTMLInputElement).value) }, `rot:${el.id}`)">
            </label>
            <label class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1" :title="t('designStudio.inspector.opacity')">
              <div class="i-heroicons-eye h-3.5 w-3.5 text-gray-400" />
              <input type="number" min="0" max="100" class="w-full bg-transparent text-sm outline-none" :value="Math.round((el.opacity ?? 1) * 100)" @input="set({ opacity: Math.min(1, Math.max(0, num(($event.target as HTMLInputElement).value, 100) / 100)) }, `op:${el.id}`)">
              <span class="text-xs text-gray-400">%</span>
            </label>
          </div>
          <label class="ds-label mt-3 block">{{ t('designStudio.inspector.alignToPage') }}</label>
          <div class="grid grid-cols-6 gap-1">
            <button v-for="a in ALIGN" :key="a.mode" class="ds-icon-btn border border-gray-200" :title="t(`designStudio.align.${a.mode}`)" @click="store.align(a.mode)">
              <div :class="a.icon" class="h-4 w-4" />
            </button>
          </div>
          <label class="ds-label mt-3 block">{{ t('designStudio.inspector.arrange') }}</label>
          <div class="grid grid-cols-4 gap-1">
            <button class="ds-icon-btn border border-gray-200" :title="t('designStudio.arrange.front')" @click="store.arrange('front')">
              <div class="i-tabler-stack-front h-4 w-4" />
            </button>
            <button class="ds-icon-btn border border-gray-200" :title="t('designStudio.arrange.forward')" @click="store.arrange('forward')">
              <div class="i-heroicons-chevron-up h-4 w-4" />
            </button>
            <button class="ds-icon-btn border border-gray-200" :title="t('designStudio.arrange.backward')" @click="store.arrange('backward')">
              <div class="i-heroicons-chevron-down h-4 w-4" />
            </button>
            <button class="ds-icon-btn border border-gray-200" :title="t('designStudio.arrange.back')" @click="store.arrange('back')">
              <div class="i-tabler-stack-back h-4 w-4" />
            </button>
          </div>
        </section>
      </fieldset>
      <button class="text-xs text-gray-500 underline" @click="emit('jump', el.id)">
        {{ t('designStudio.inspector.showInLayers') }}
      </button>
    </div>

    <!-- Image chooser (uploads) -->
    <Teleport to="body">
      <div v-if="imagePickerOpen" class="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" @click.self="imagePickerOpen = null">
        <div class="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-semibold">
              {{ t('designStudio.inspector.chooseImage') }}
            </h3>
            <button class="ds-icon-btn" @click="imagePickerOpen = null">
              <div class="i-heroicons-x-mark h-5 w-5" />
            </button>
          </div>
          <DesignStudioUploadButton class="mb-3" @uploaded="chooseImage($event.url)" />
          <div v-if="resources.uploads.length" class="grid grid-cols-3 gap-2">
            <button v-for="a in resources.uploads" :key="a.id" class="aspect-square overflow-hidden rounded-lg border border-gray-200 p-2 hover:border-[#28A745]" @click="chooseImage(a.url)">
              <img :src="designAssetUrl(a.url)" :alt="a.name" class="h-full w-full object-contain">
            </button>
          </div>
          <p v-else class="text-sm text-gray-500">
            {{ t('designStudio.uploads.empty') }}
          </p>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.ds-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #6b7280;
}
.ds-input {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 0.35rem 0.5rem;
  font-size: 0.875rem;
  background: white;
}
.ds-input:focus {
  outline: none;
  border-color: #28a745;
}
.ds-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  color: #4b5563;
}
.ds-toggle:hover:not(:disabled) {
  background: #f3f4f6;
}
.ds-toggle.on {
  background: rgba(40, 167, 69, 0.15);
  color: #1b7a34;
}
.ds-toggle:disabled {
  opacity: 0.3;
}
fieldset:disabled {
  opacity: 0.55;
}
</style>
