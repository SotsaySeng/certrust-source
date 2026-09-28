<script setup lang="ts">
/**
 * The Design Studio's left panels: Templates, Uploads, Elements, Text,
 * Attributes, QR Codes, Layers. Everything can be clicked (added to the
 * centre of the page) or dragged onto the canvas.
 */
import type { DesignAsset } from '~/api/api-client'
import type { Design, DesignElement } from '~/lib/design-core'
import { apiClient } from '~/api/api-client'
import { applyBrandKit, blankDesign, isEmptyDesign, validateDesign } from '~/lib/design-core'
import { attributePart, ELEMENT_GROUPS, PLACEHOLDER_GROUPS, TEXT_COMBINATIONS, TEXT_STYLES, textPart } from '~/lib/design-studio/presets'

const props = defineProps<{ active: string, isSystem: boolean }>()
const emit = defineEmits<{ close: [], upgrade: [reason: 'limit' | 'premium'] }>()

const { t } = useI18n()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()
const { ask } = useStudioConfirm()

type Part = Partial<DesignElement> & { type: DesignElement['type'] }
const brand = computed(() => (props.isSystem ? null : resources.brandForRender()))
const page = computed(() => store.design?.page ?? { width: 1123, height: 794 })
const kind = computed(() => store.design?.kind ?? 'certificate')

// ------------------------------------------------------------- adding
function fitPart(part: Part): Part {
  // Frames cover the page; everything else keeps its size but never exceeds the page.
  if (part.type === 'frame') {
    const inset = kind.value === 'badge' ? 12 : 24
    return { ...part, x: inset, y: inset, w: page.value.width - inset * 2, h: page.value.height - inset * 2 }
  }
  const w = part.w ?? 200
  const h = part.h ?? 80
  const s = Math.min(1, (page.value.width * 0.9) / w, (page.value.height * 0.9) / h)
  return s < 1 ? { ...part, w: w * s, h: h * s } : part
}

/**
 * Organization designs get the brand baked in as things are added (logo,
 * signer names, brand colours and fonts), same as when a template is used.
 * System templates keep the tokens so every organization's brand applies.
 */
function branded(parts: Part[]): Part[] {
  if (props.isSystem) {
    return parts
  }
  const d = applyBrandKit({ version: 1, kind: kind.value, page: page.value as any, background: { color: '#ffffff' }, elements: parts.map((p, i) => ({ id: `tmp${i}`, x: 0, y: 0, w: 1, h: 1, ...p })) as any }, brand.value)
  return d.elements.map(({ id: _id, ...rest }, i) => ({ ...rest, x: parts[i].x, y: parts[i].y, w: parts[i].w, h: parts[i].h })) as Part[]
}

function add(part: Part, at?: { x: number, y: number }) {
  store.addElement(fitPart(branded([part])[0]) as any, { at })
}

function addGroup(parts: Part[], at?: { x: number, y: number }) {
  const maxW = Math.max(...parts.map(p => (p.x ?? 0) + (p.w ?? 0))) - Math.min(...parts.map(p => p.x ?? 0))
  const s = Math.min(1, (page.value.width * 0.9) / maxW)
  const scaled = s < 1
    ? parts.map((p: any) => ({ ...p, x: (p.x ?? 0) * s, y: (p.y ?? 0) * s, w: (p.w ?? 0) * s, h: (p.h ?? 0) * s, ...(p.fontSize ? { fontSize: p.fontSize * s } : {}) }))
    : parts
  store.addGroup(branded(scaled as Part[]) as any, at)
}

function imagePart(asset: DesignAsset): Part {
  const w0 = asset.width || 300
  const h0 = asset.height || 300
  const target = Math.min(260, page.value.width * 0.4)
  const s = target / Math.max(w0, h0)
  return { type: 'image', src: asset.url, assetId: asset.documentId, fit: 'contain', w: w0 * s, h: h0 * s, name: asset.name } as Part
}

function qrPart(): Part {
  const size = kind.value === 'badge' ? 110 : 120
  return { type: 'qr', target: 'verifyUrl', fg: '#111827', bg: '#ffffff', w: size, h: size, name: t('designStudio.types.qr') } as Part
}

// Drag payloads
function dragData(ev: DragEvent, payload: Record<string, string>) {
  ev.dataTransfer?.setData('application/x-certrust-design', JSON.stringify(payload))
  if (ev.dataTransfer) {
    ev.dataTransfer.effectAllowed = 'copy'
  }
}

function handleDrop(p: { kind: string, value: string, x: number, y: number }) {
  const at = { x: p.x, y: p.y }
  if (p.kind === 'element') {
    const item = ELEMENT_GROUPS.flatMap(g => g.items).find(i => i.id === p.value)
    if (item) {
      add(item.part(), item.part().type === 'frame' ? undefined : at)
    }
  }
  else if (p.kind === 'combo') {
    const combo = TEXT_COMBINATIONS.find(c => c.id === p.value)
    if (combo) {
      addGroup(combo.parts, at)
    }
  }
  else if (p.kind === 'style') {
    const f = TEXT_STYLES[p.value as keyof typeof TEXT_STYLES]
    if (f) {
      add(f(), at)
    }
  }
  else if (p.kind === 'image') {
    const asset = [...resources.uploads, ...resources.elements].find(a => a.documentId === p.value)
    if (asset) {
      add(imagePart(asset), at)
    }
  }
  else if (p.kind === 'attribute') {
    add(attributePart(p.value), at)
  }
  else if (p.kind === 'qr') {
    add(qrPart(), at)
  }
}
defineExpose({ handleDrop })

// ------------------------------------------------------------ templates
const orientation = ref<'landscape' | 'portrait'>('landscape')
const categoryId = ref<number | null>(null)
const library = ref<any[]>([])
const mine = ref<any[]>([])
const templatesLoading = ref(false)

async function loadTemplates() {
  templatesLoading.value = true
  try {
    const [sys, own] = await Promise.all([apiClient.listDesignTemplates('system'), props.isSystem ? Promise.resolve([]) : apiClient.listDesignTemplates('mine')])
    library.value = sys
    mine.value = own
  }
  finally {
    templatesLoading.value = false
  }
}

const libraryFiltered = computed(() => library.value.filter(tpl =>
  (tpl.kind || tpl.type) === kind.value
  && (kind.value === 'badge' || (tpl.orientation || 'landscape') === orientation.value)
  && (!categoryId.value || tpl.category?.id === categoryId.value)
  && tpl.documentId !== store.meta?.documentId))
const recent = computed(() => mine.value.filter(tpl => (tpl.kind || tpl.type) === kind.value && tpl.documentId !== store.meta?.documentId).slice(0, 4))

async function applyTemplate(tpl: any) {
  if (tpl.locked) {
    emit('upgrade', 'premium')
    return
  }
  if (store.elements.length) {
    const ok = await ask({ title: t('designStudio.templates.replaceTitle'), message: t('designStudio.templates.replaceBody'), confirmLabel: t('designStudio.templates.replaceConfirm') })
    if (!ok) {
      return
    }
  }
  let layout = tpl.layoutConfig
  if (!layout) {
    layout = (await apiClient.getDesignTemplate(tpl.documentId))?.data?.layoutConfig
  }
  const parsed = isEmptyDesign(layout) ? null : validateDesign(layout)
  if (!parsed?.ok) {
    return
  }
  const design = props.isSystem ? (parsed.design as Design) : applyBrandKit(parsed.design as Design, brand.value)
  store.replaceDesign(design)
}

async function startBlank() {
  if (store.elements.length) {
    const ok = await ask({ title: t('designStudio.templates.clearTitle'), message: t('designStudio.templates.replaceBody'), confirmLabel: t('designStudio.templates.clearConfirm'), danger: true })
    if (!ok) {
      return
    }
  }
  store.replaceDesign(blankDesign(kind.value, store.design?.page.orientation ?? 'landscape', store.design?.page.preset))
}

// -------------------------------------------------------------- uploads
async function removeUpload(asset: DesignAsset) {
  const ok = await ask({ title: t('designStudio.uploads.deleteTitle'), message: t('designStudio.uploads.deleteBody'), confirmLabel: t('common.delete'), danger: true })
  if (!ok) {
    return
  }
  await apiClient.deleteDesignAsset(asset.documentId)
  resources.uploads = resources.uploads.filter(a => a.id !== asset.id)
}
function setAsBackground(asset: DesignAsset) {
  store.setBackground({ image: { src: asset.url, fit: 'cover' } })
}

// ------------------------------------------------------------- elements
const expandedGroup = ref<string | null>(null)
const libraryByCategory = computed(() => {
  const map = new Map<string, DesignAsset[]>()
  for (const a of resources.elements) {
    const k = a.elementCategory || 'graphics'
    map.set(k, [...(map.get(k) ?? []), a])
  }
  return [...map.entries()]
})

// ----------------------------------------------------------- attributes
const newAttr = reactive({ open: false, label: '', type: 'text' as 'text' | 'date' | 'number', required: false, error: '' as string, busy: false })
const manage = ref(false)

async function createAttr() {
  newAttr.error = ''
  if (!newAttr.label.trim()) {
    return
  }
  newAttr.busy = true
  try {
    const a = await apiClient.createCustomAttribute({ label: newAttr.label.trim(), type: newAttr.type, required: newAttr.required })
    resources.customAttributes.push(a)
    Object.assign(newAttr, { open: false, label: '', type: 'text', required: false })
  }
  catch (err) {
    newAttr.error = (err as Error).message
  }
  finally {
    newAttr.busy = false
  }
}

async function updateAttr(id: string, patch: Record<string, any>) {
  const updated = await apiClient.updateCustomAttribute(id, patch)
  const i = resources.customAttributes.findIndex(a => a.documentId === id)
  if (i >= 0) {
    resources.customAttributes[i] = { ...resources.customAttributes[i], ...updated }
  }
}

async function removeAttr(id: string, key: string) {
  const ok = await ask({ title: t('designStudio.attributes.deleteTitle', { key }), message: t('designStudio.attributes.deleteBody'), confirmLabel: t('common.delete'), danger: true })
  if (!ok) {
    return
  }
  await apiClient.deleteCustomAttribute(id)
  resources.customAttributes = resources.customAttributes.filter(a => a.documentId !== id)
}

/** "Use": insert into the selected text box, or add a new text box. */
function useAttribute(key: string) {
  const sel = store.single
  if (sel?.type === 'text' && !sel.locked) {
    const sep = sel.content && !/\s$/.test(sel.content) ? ' ' : ''
    store.updateElement(sel.id, { content: `${sel.content}${sep}{{${key}}}` } as any)
    return
  }
  add(attributePart(key))
}

const usedKeys = computed(() => {
  const set = new Set<string>()
  for (const el of store.elements) {
    if (el.type === 'text') {
      for (const m of el.content.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
        set.add(m[1])
      }
    }
  }
  return set
})

// --------------------------------------------------------------- layers
const layers = computed(() => [...store.elements].reverse())
const renaming = ref<string | null>(null)
const dragLayer = ref<string | null>(null)
const dropIndex = ref<number | null>(null)

function layerLabel(el: DesignElement): string {
  if (el.name) {
    return el.name
  }
  if (el.type === 'text') {
    return el.content.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, '[$1]').slice(0, 60) || t('designStudio.types.text')
  }
  if (el.type === 'shape') {
    return t(`designStudio.shapes.${el.shape}`)
  }
  if (el.type === 'frame') {
    return t(`designStudio.elements.frame_${el.style}`)
  }
  return t(`designStudio.types.${el.type}`)
}
const LAYER_ICON: Record<string, string> = {
  text: 'i-heroicons-language',
  image: 'i-heroicons-photo',
  shape: 'i-heroicons-stop',
  line: 'i-heroicons-minus',
  qr: 'i-heroicons-qr-code',
  frame: 'i-heroicons-square-2-stack',
}

function onLayerDrop(targetVisualIndex: number) {
  const id = dragLayer.value
  dragLayer.value = null
  dropIndex.value = null
  if (!id) {
    return
  }
  // Visual list is top-first; paint order is bottom-first.
  const to = store.elements.length - 1 - targetVisualIndex
  store.moveTo(id, to)
}

onMounted(() => {
  // Faces used by the Text panel's style buttons.
  void ensureCssFont('Playfair Display', 700)
  void ensureCssFont('Inter', 600)
  void ensureCssFont('Inter', 400)
  if (store.design?.page.orientation === 'portrait') {
    orientation.value = 'portrait'
  }
  loadTemplates()
  resources.loadAll()
})
</script>

<template>
  <section class="flex w-[320px] shrink-0 flex-col border-r border-gray-200 bg-white" :aria-label="t(`designStudio.panels.${active}`)">
    <div class="flex h-12 shrink-0 items-center justify-between border-b border-gray-100 px-4">
      <h2 class="font-semibold text-gray-900">
        {{ t(`designStudio.panelTitles.${active}`) }}
      </h2>
      <button class="ds-icon-btn" :title="t('designStudio.hidePanel')" @click="emit('close')">
        <div class="i-heroicons-chevron-double-left h-4 w-4" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-4">
      <!-- ================= Templates ================= -->
      <div v-if="active === 'templates'" class="space-y-4">
        <div v-if="kind === 'certificate'" class="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button v-for="o in (['landscape', 'portrait'] as const)" :key="o" class="rounded-md py-1.5" :class="orientation === o ? 'bg-white font-medium shadow-sm text-[#1B7A34]' : 'text-gray-600'" @click="orientation = o">
            {{ t(`designStudio.inspector.${o}`) }}
          </button>
        </div>
        <select v-model="categoryId" class="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm" :aria-label="t('designStudio.templates.category')">
          <option :value="null">
            {{ t('designStudio.templates.allCategories') }}
          </option>
          <option v-for="c in resources.categories" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>

        <button class="flex w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 p-3 text-left text-sm hover:border-[#28A745] hover:bg-[#28A745]/5" @click="startBlank">
          <div class="i-heroicons-document-plus h-6 w-6 text-gray-400" />
          <span><span class="block font-medium">{{ t('designStudio.templates.blank') }}</span><span class="text-xs text-gray-500">{{ t('designStudio.templates.blankHint') }}</span></span>
        </button>

        <div v-if="recent.length">
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('designStudio.templates.yourDesigns') }}
          </h3>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="tpl in recent" :key="tpl.id" class="group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left hover:border-[#28A745]" :title="tpl.name" @click="applyTemplate(tpl)">
              <img v-if="tpl.previewImage?.url" :src="designAssetUrl(tpl.previewImage.url)" :alt="tpl.name" class="aspect-[4/3] w-full object-contain p-1">
              <div v-else class="flex aspect-[4/3] items-center justify-center text-xs text-gray-400">
                {{ tpl.name }}
              </div>
            </button>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('designStudio.templates.library') }}
          </h3>
          <div v-if="templatesLoading" class="py-6 text-center text-sm text-gray-500">
            {{ t('common.loading') }}
          </div>
          <p v-else-if="!libraryFiltered.length" class="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
            {{ t('designStudio.templates.none') }}
          </p>
          <div v-else class="grid grid-cols-2 gap-2">
            <button v-for="tpl in libraryFiltered" :key="tpl.id" class="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-left hover:border-[#28A745]" :title="tpl.name" @click="applyTemplate(tpl)">
              <img v-if="tpl.previewImage?.url" :src="designAssetUrl(tpl.previewImage.url)" :alt="tpl.name" class="w-full object-contain p-1" :class="kind === 'badge' ? 'aspect-square' : orientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'">
              <div v-else class="flex aspect-[4/3] items-center justify-center px-2 text-center text-xs text-gray-400">
                {{ tpl.name }}
              </div>
              <span v-if="tpl.isPremium" class="absolute right-1 top-1 flex items-center gap-0.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950 shadow">
                <div :class="tpl.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-sparkles'" class="h-3 w-3" />{{ t('designStudio.premium') }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- ================= Uploads ================= -->
      <div v-else-if="active === 'uploads'" class="space-y-4">
        <DesignStudioUploadButton />
        <p v-if="!resources.uploads.length" class="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
          {{ t('designStudio.uploads.empty') }}
        </p>
        <div v-else>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('designStudio.uploads.library') }}
          </h3>
          <div class="grid grid-cols-2 gap-2">
            <div v-for="a in resources.uploads" :key="a.id" class="group relative">
              <button
                class="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-3 hover:border-[#28A745]"
                draggable="true"
                :title="a.name"
                @click="add(imagePart(a))"
                @dragstart="dragData($event, { kind: 'image', value: a.documentId })"
              >
                <img :src="designAssetUrl(a.url)" :alt="a.name" class="max-h-full max-w-full object-contain" draggable="false">
              </button>
              <div class="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                <button class="rounded bg-white/90 p-1 shadow" :title="t('designStudio.uploads.setBackground')" @click="setAsBackground(a)">
                  <div class="i-heroicons-photo h-3.5 w-3.5" />
                </button>
                <button class="rounded bg-white/90 p-1 text-red-600 shadow" :title="t('common.delete')" @click="removeUpload(a)">
                  <div class="i-heroicons-trash h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ================= Elements ================= -->
      <div v-else-if="active === 'elements'" class="space-y-5">
        <div v-for="group in ELEMENT_GROUPS" :key="group.id">
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-800">
              {{ t(`designStudio.elements.${group.labelKey}`) }}
            </h3>
            <button v-if="group.items.length > 3" class="text-xs text-[#1B7A34] hover:underline" @click="expandedGroup = expandedGroup === group.id ? null : group.id">
              {{ expandedGroup === group.id ? t('designStudio.elements.showLess') : t('designStudio.elements.showAll') }}
            </button>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="item in (expandedGroup === group.id ? group.items : group.items.slice(0, 3))"
              :key="item.id"
              class="flex aspect-square items-center justify-center rounded-lg border border-gray-200 bg-white p-2 hover:border-[#28A745] hover:bg-[#28A745]/5"
              draggable="true"
              :title="t(`designStudio.elements.${item.labelKey}`)"
              @click="add(item.part())"
              @dragstart="dragData($event, { kind: 'element', value: item.id })"
            >
              <DesignStudioPartThumb :parts="[item.part().type === 'frame' ? { ...item.part(), x: 0, y: 0, w: 160, h: 120, thickness: 16 } : item.part()]" :brand="brand" />
            </button>
          </div>
        </div>
        <div v-for="[cat, assets] in libraryByCategory" :key="cat">
          <h3 class="mb-2 text-sm font-medium text-gray-800">
            {{ t(`designStudio.elements.lib_${cat}`) }}
          </h3>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="a in assets"
              :key="a.id"
              class="flex aspect-square items-center justify-center rounded-lg border border-gray-200 p-2 hover:border-[#28A745]"
              draggable="true"
              :title="a.name"
              @click="add(imagePart(a))"
              @dragstart="dragData($event, { kind: 'image', value: a.documentId })"
            >
              <img :src="designAssetUrl(a.url)" :alt="a.name" class="max-h-full max-w-full object-contain" draggable="false">
            </button>
          </div>
        </div>
      </div>

      <!-- ================= Text ================= -->
      <div v-else-if="active === 'text'" class="space-y-4">
        <button class="flex w-full items-center justify-center gap-2 rounded-lg bg-[#28A745] py-2.5 text-sm font-semibold text-black hover:bg-[#28A745]/90" @click="add(textPart({ content: t('designStudio.text.newText'), w: 320, h: 30 }))">
          <div class="i-heroicons-plus h-4 w-4" />{{ t('designStudio.text.add') }}
        </button>
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('designStudio.text.styles') }}
          </h3>
          <div class="space-y-2">
            <button class="w-full rounded-lg border border-gray-200 px-3 py-3 text-left text-2xl font-bold hover:border-[#28A745]" style="font-family: 'Playfair Display'" draggable="true" @click="add(TEXT_STYLES.heading())" @dragstart="dragData($event, { kind: 'style', value: 'heading' })">
              {{ t('designStudio.text.heading') }}
            </button>
            <button class="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-left text-lg font-semibold hover:border-[#28A745]" style="font-family: 'Inter'" draggable="true" @click="add(TEXT_STYLES.subheading())" @dragstart="dragData($event, { kind: 'style', value: 'subheading' })">
              {{ t('designStudio.text.subheading') }}
            </button>
            <button class="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:border-[#28A745]" style="font-family: 'Inter'" draggable="true" @click="add(TEXT_STYLES.body())" @dragstart="dragData($event, { kind: 'style', value: 'body' })">
              {{ t('designStudio.text.body') }}
            </button>
          </div>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {{ t('designStudio.text.combinations') }}
          </h3>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="c in TEXT_COMBINATIONS"
              :key="c.id"
              class="flex aspect-[4/3] items-center justify-center rounded-lg border border-gray-200 bg-white p-2 hover:border-[#28A745]"
              draggable="true"
              :title="t(`designStudio.text.combo.${c.labelKey}`)"
              @click="addGroup(c.parts)"
              @dragstart="dragData($event, { kind: 'combo', value: c.id })"
            >
              <DesignStudioPartThumb :parts="c.parts" :brand="brand" :pad="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- ================= Attributes ================= -->
      <div v-else-if="active === 'attributes'" class="space-y-4">
        <p class="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
          {{ t('designStudio.attributes.intro') }}
        </p>
        <div v-for="g in PLACEHOLDER_GROUPS" :key="g.id">
          <h3 class="mb-1 text-sm font-medium text-gray-800">
            {{ t(`designStudio.attributes.group_${g.id}`) }}
          </h3>
          <ul class="divide-y divide-gray-100">
            <li v-for="k in g.keys" :key="k" class="flex items-center justify-between py-1.5">
              <span
                class="flex cursor-grab items-center gap-2 text-sm text-gray-700"
                draggable="true"
                @dragstart="dragData($event, { kind: 'attribute', value: k })"
              >
                <div :class="k.includes('_on') ? 'i-heroicons-calendar' : 'i-heroicons-bars-3-bottom-left'" class="h-4 w-4 text-gray-400" />
                {{ t(`designStudio.attributes.${k.replace('.', '_')}`) }}
                <div v-if="usedKeys.has(k)" class="i-heroicons-check-circle h-4 w-4 text-[#28A745]" :title="t('designStudio.attributes.inUse')" />
              </span>
              <button class="rounded-md border border-[#28A745]/40 bg-[#28A745]/10 px-2 py-0.5 text-xs font-medium text-[#1B7A34] hover:bg-[#28A745]/20" @click="useAttribute(k)">
                {{ t('designStudio.attributes.use') }}
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!isSystem">
          <div class="mb-1 flex items-center justify-between">
            <h3 class="text-sm font-medium text-gray-800">
              {{ t('designStudio.attributes.group_custom') }}
            </h3>
            <button v-if="resources.customAttributes.length" class="text-xs text-[#1B7A34] hover:underline" @click="manage = !manage">
              {{ manage ? t('designStudio.attributes.done') : t('designStudio.attributes.manage') }}
            </button>
          </div>
          <ul class="divide-y divide-gray-100">
            <li v-for="a in resources.customAttributes" :key="a.id" class="py-1.5">
              <div v-if="!manage" class="flex items-center justify-between">
                <span class="flex cursor-grab items-center gap-2 text-sm text-gray-700" draggable="true" @dragstart="dragData($event, { kind: 'attribute', value: `custom.${a.key}` })">
                  <div :class="a.type === 'date' ? 'i-heroicons-calendar' : 'i-heroicons-bars-3-bottom-left'" class="h-4 w-4 text-gray-400" />
                  {{ a.label }}
                  <span v-if="a.required" class="text-red-500" :title="t('designStudio.attributes.required')">*</span>
                  <div v-if="usedKeys.has(`custom.${a.key}`)" class="i-heroicons-check-circle h-4 w-4 text-[#28A745]" />
                </span>
                <button class="rounded-md border border-[#28A745]/40 bg-[#28A745]/10 px-2 py-0.5 text-xs font-medium text-[#1B7A34] hover:bg-[#28A745]/20" @click="useAttribute(`custom.${a.key}`)">
                  {{ t('designStudio.attributes.use') }}
                </button>
              </div>
              <div v-else class="space-y-1.5 rounded-lg bg-gray-50 p-2">
                <input class="w-full rounded border border-gray-200 px-2 py-1 text-sm" :value="a.label" @change="updateAttr(a.documentId, { label: ($event.target as HTMLInputElement).value })">
                <div class="flex items-center gap-2 text-xs">
                  <code class="rounded bg-white px-1 text-gray-500">[custom.{{ a.key }}]</code>
                  <select class="rounded border border-gray-200 px-1 py-0.5" :value="a.type" @change="updateAttr(a.documentId, { type: ($event.target as HTMLSelectElement).value })">
                    <option value="text">
                      {{ t('designStudio.attributes.type_text') }}
                    </option>
                    <option value="date">
                      {{ t('designStudio.attributes.type_date') }}
                    </option>
                    <option value="number">
                      {{ t('designStudio.attributes.type_number') }}
                    </option>
                  </select>
                  <label class="flex items-center gap-1"><input type="checkbox" class="accent-[#28A745]" :checked="a.required" @change="updateAttr(a.documentId, { required: ($event.target as HTMLInputElement).checked })">{{ t('designStudio.attributes.required') }}</label>
                  <button class="ml-auto text-red-600" :title="t('common.delete')" @click="removeAttr(a.documentId, a.key)">
                    <div class="i-heroicons-trash h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          </ul>
          <div v-if="newAttr.open" class="mt-2 space-y-2 rounded-lg border border-gray-200 p-3">
            <input v-model="newAttr.label" class="w-full rounded border border-gray-200 px-2 py-1.5 text-sm" :placeholder="t('designStudio.attributes.labelPlaceholder')" autofocus @keydown.enter="createAttr">
            <div class="flex items-center gap-2 text-xs">
              <select v-model="newAttr.type" class="rounded border border-gray-200 px-1 py-1">
                <option value="text">
                  {{ t('designStudio.attributes.type_text') }}
                </option>
                <option value="date">
                  {{ t('designStudio.attributes.type_date') }}
                </option>
                <option value="number">
                  {{ t('designStudio.attributes.type_number') }}
                </option>
              </select>
              <label class="flex items-center gap-1"><input v-model="newAttr.required" type="checkbox" class="accent-[#28A745]">{{ t('designStudio.attributes.required') }}</label>
            </div>
            <p v-if="newAttr.error" class="text-xs text-red-600">
              {{ newAttr.error }}
            </p>
            <div class="flex justify-end gap-2">
              <button class="rounded px-2 py-1 text-xs" @click="newAttr.open = false">
                {{ t('common.cancel') }}
              </button>
              <button class="rounded bg-[#28A745] px-3 py-1 text-xs font-semibold text-black disabled:opacity-50" :disabled="!newAttr.label.trim() || newAttr.busy" @click="createAttr">
                {{ t('designStudio.attributes.create') }}
              </button>
            </div>
          </div>
          <button v-else class="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gray-300 py-2 text-sm hover:bg-gray-50" @click="newAttr.open = true">
            <div class="i-heroicons-plus h-4 w-4" />{{ t('designStudio.attributes.add') }}
          </button>
        </div>
      </div>

      <!-- ================= QR codes ================= -->
      <div v-else-if="active === 'qr'" class="space-y-4">
        <p class="text-sm leading-relaxed text-gray-600">
          {{ t('designStudio.qr.intro') }}
        </p>
        <button
          class="flex w-full flex-col items-center gap-2 rounded-xl border border-gray-200 p-4 hover:border-[#28A745] hover:bg-[#28A745]/5"
          draggable="true"
          @click="add(qrPart())"
          @dragstart="dragData($event, { kind: 'qr', value: 'verify' })"
        >
          <div class="h-24 w-24">
            <DesignStudioPartThumb :parts="[qrPart()]" />
          </div>
          <span class="text-sm font-medium">{{ t('designStudio.qr.add') }}</span>
        </button>
        <button
          class="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[#28A745]"
          draggable="true"
          @click="addGroup(TEXT_COMBINATIONS.find(c => c.id === 'verify')!.parts)"
          @dragstart="dragData($event, { kind: 'combo', value: 'verify' })"
        >
          <div class="h-16 w-16 shrink-0">
            <DesignStudioPartThumb :parts="TEXT_COMBINATIONS.find(c => c.id === 'verify')!.parts" />
          </div>
          <span class="text-sm">{{ t('designStudio.qr.withLabel') }}</span>
        </button>
      </div>

      <!-- ================= Layers ================= -->
      <div v-else-if="active === 'layers'">
        <p v-if="!layers.length" class="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
          {{ t('designStudio.layers.empty') }}
        </p>
        <p v-else class="mb-2 text-xs text-gray-500">
          {{ t('designStudio.layers.hint') }}
        </p>
        <ul class="space-y-1">
          <li
            v-for="(el, i) in layers"
            :key="el.id"
            class="group flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm"
            :class="[
              store.selectedIds.includes(el.id) ? 'border-[#28A745] bg-[#28A745]/5' : 'border-gray-200 bg-white hover:bg-gray-50',
              dropIndex === i ? 'ring-2 ring-[#28A745]' : '',
              el.hidden ? 'opacity-50' : '',
            ]"
            draggable="true"
            @click="store.select(el.id, $event.shiftKey || $event.metaKey)"
            @dragstart="dragLayer = el.id"
            @dragover.prevent="dropIndex = i"
            @dragleave="dropIndex = null"
            @drop.prevent="onLayerDrop(i)"
          >
            <div class="i-heroicons-bars-2 h-4 w-4 shrink-0 cursor-grab text-gray-300" />
            <div :class="LAYER_ICON[el.type]" class="h-4 w-4 shrink-0 text-gray-500" />
            <input
              v-if="renaming === el.id"
              class="min-w-0 flex-1 rounded border border-[#28A745] px-1 text-sm"
              :value="el.name || layerLabel(el)"
              autofocus
              @click.stop
              @keydown.enter="($event.target as HTMLInputElement).blur()"
              @blur="store.updateElement(el.id, { name: ($event.target as HTMLInputElement).value.slice(0, 120) } as any); renaming = null"
            >
            <span v-else class="min-w-0 flex-1 truncate" :style="el.type === 'text' ? { fontFamily: `'${el.fontFamily.startsWith('$') ? 'Inter' : el.fontFamily}'` } : {}" @dblclick.stop="renaming = el.id">{{ layerLabel(el) }}</span>
            <button class="rounded p-0.5 text-gray-400 hover:text-gray-700" :class="{ 'text-amber-600': el.locked }" :title="el.locked ? t('designStudio.unlock') : t('designStudio.lock')" @click.stop="store.updateElement(el.id, { locked: !el.locked } as any)">
              <div :class="el.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open opacity-0 group-hover:opacity-100'" class="h-4 w-4" />
            </button>
            <button class="rounded p-0.5 text-gray-400 hover:text-gray-700" :title="el.hidden ? t('designStudio.show') : t('designStudio.hide')" @click.stop="store.updateElement(el.id, { hidden: !el.hidden } as any)">
              <div :class="el.hidden ? 'i-heroicons-eye-slash' : 'i-heroicons-eye opacity-0 group-hover:opacity-100'" class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
