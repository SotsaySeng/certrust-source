<script setup lang="ts">
/**
 * Design Studio editor shell: top bar, tool rail + panel, canvas, inspector.
 * Owns loading/saving, local draft autosave, the unsaved-changes guard,
 * keyboard shortcuts, sample data, pre-flight and preview.
 */
import type { Design, PlaceholderData, PreflightFinding, RenderIssue } from '~/lib/design-core'
import type { DesignMeta } from '~/stores/designStudio'
import { apiClient } from '~/api/api-client'
import { blankDesign, isEmptyDesign, preflight, SAMPLE_RECIPIENTS, sampleData, validateDesign } from '~/lib/design-core'

const props = defineProps<{ templateId: string }>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()
const { ask } = useStudioConfirm()

const canvasRef = ref<any>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const locked = ref(false)
const previewImage = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const savedFlash = ref(false)
const renderIssues = ref<RenderIssue[]>([])
const activePanel = ref<string>('templates')
const panelOpen = ref(true)
const showPreview = ref(false)
const showBrand = ref(false)
const showShortcuts = ref(false)
const showSystemDialog = ref(false)
const upgradeReason = ref<null | 'limit' | 'premium'>(null)
const draftToRestore = ref<{ design: Design, name: string, at: number } | null>(null)
const tourOpen = ref(false)
const smallScreen = ref(false)

const isSystem = computed(() => !!store.meta?.system)
const canEdit = computed(() => !!store.meta?.canEdit)
const readonly = computed(() => !canEdit.value)

/** Org designs render with their own (baked) values; system templates show tokens with the org's brand. */
const renderBrand = computed(() => (isSystem.value && resources.isPlatformAdmin ? null : resources.brandForRender()))

const sampleCustom = computed(() => Object.fromEntries(resources.customAttributes.map(a => [a.key, a.type === 'date' ? '19 August 2026' : a.label])))
const renderData = computed<PlaceholderData | undefined>(() => store.showSampleData
  ? sampleData({ recipientName: SAMPLE_RECIPIENTS[store.sampleIndex % SAMPLE_RECIPIENTS.length], organization: undefined, custom: sampleCustom.value })
  : undefined)

// ----------------------------------------------------------------- load
function draftKey() {
  return `ds-draft:${props.templateId}`
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [res] = await Promise.all([apiClient.getDesignTemplate(props.templateId), resources.loadAll()])
    const tpl = res?.data
    if (!tpl) {
      throw new Error(t('designStudio.errors.notFound'))
    }
    locked.value = !!tpl.locked
    previewImage.value = tpl.previewImage?.url ? designAssetUrl(tpl.previewImage.url) : null
    const kind = tpl.kind === 'badge' || tpl.type === 'badge' ? 'badge' : 'certificate'
    const parsed = isEmptyDesign(tpl.layoutConfig) ? null : validateDesign(tpl.layoutConfig)
    const design = (parsed?.ok ? parsed.design : blankDesign(kind, tpl.orientation === 'portrait' ? 'portrait' : 'landscape')) as Design
    const meta: DesignMeta = {
      documentId: tpl.documentId,
      name: tpl.name,
      description: tpl.description ?? null,
      system: !!tpl.system,
      isPremium: !!tpl.isPremium,
      categoryId: tpl.category?.id ?? null,
      sortOrder: tpl.sortOrder ?? 0,
      canEdit: !!tpl.canEdit,
      updatedAt: tpl.updatedAt ?? null,
    }
    store.load(design, meta)
    store.showSampleData = false
    activePanel.value = route.query.panel ? String(route.query.panel) : (design.elements.length ? 'text' : 'templates')
    checkDraft()
    if (route.query.tour === '1') {
      tourOpen.value = true
    }
  }
  catch (err) {
    loadError.value = (err as Error).message || t('designStudio.errors.loadFailed')
  }
  finally {
    loading.value = false
  }
}

function checkDraft() {
  try {
    const raw = localStorage.getItem(draftKey())
    if (!raw) {
      return
    }
    const draft = JSON.parse(raw)
    const serverAt = store.meta?.updatedAt ? Date.parse(store.meta.updatedAt) : 0
    if (draft?.design && draft.at > serverAt && JSON.stringify(draft.design) !== store.savedSnapshot) {
      draftToRestore.value = draft
    }
    else {
      localStorage.removeItem(draftKey())
    }
  }
  catch {}
}

function restoreDraft() {
  if (!draftToRestore.value) {
    return
  }
  store.replaceDesign(draftToRestore.value.design)
  if (store.meta) {
    store.meta.name = draftToRestore.value.name || store.meta.name
  }
  draftToRestore.value = null
}

function discardDraft() {
  draftToRestore.value = null
  try {
    localStorage.removeItem(draftKey())
  }
  catch {}
}

// Autosave a local draft (never the server) a moment after each change.
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch(() => store.revision, () => {
  if (!canEdit.value || !store.design) {
    return
  }
  if (draftTimer) {
    clearTimeout(draftTimer)
  }
  draftTimer = setTimeout(() => {
    try {
      if (store.dirty) {
        localStorage.setItem(draftKey(), JSON.stringify({ design: store.design, name: store.meta?.name, at: Date.now() }))
      }
    }
    catch {}
  }, 800)
})

// ----------------------------------------------------------------- save
const findings = ref<PreflightFinding[]>([])
const showFindings = ref(false)

async function runPreflight(): Promise<PreflightFinding[]> {
  if (!store.design) {
    return []
  }
  // Check with the longest sample name so overflow shows up now, not at issuance.
  const long = await renderDesignInBrowser(store.design, {
    data: sampleData({ recipientName: SAMPLE_RECIPIENTS[1], custom: sampleCustom.value }),
    brand: renderBrand.value,
  })
  const lao = await renderDesignInBrowser(store.design, {
    data: sampleData({ recipientName: SAMPLE_RECIPIENTS[2], custom: sampleCustom.value }),
    brand: renderBrand.value,
  })
  return preflight(store.design, {
    renderIssues: [...long.issues, ...lao.issues],
    customAttributeKeys: isSystem.value ? undefined : resources.customKeys,
  })
}

async function save() {
  if (!store.design || !store.meta?.documentId || !canEdit.value || saving.value) {
    return
  }
  saving.value = true
  saveError.value = null
  try {
    const data: Record<string, any> = { name: store.meta.name.trim() || t('designStudio.untitled'), layoutConfig: store.design }
    if (isSystem.value && resources.isPlatformAdmin) {
      data.isPremium = store.meta.isPremium
      data.category = store.meta.categoryId
      data.sortOrder = store.meta.sortOrder
      data.description = store.meta.description
    }
    const res = await apiClient.updateDesignTemplate(store.meta.documentId, data)
    store.markSaved({ updatedAt: res?.data?.updatedAt ?? new Date().toISOString() })
    try {
      localStorage.removeItem(draftKey())
    }
    catch {}
    savedFlash.value = true
    setTimeout(() => (savedFlash.value = false), 2000)
    findings.value = await runPreflight()
    showFindings.value = findings.value.length > 0
  }
  catch (err) {
    saveError.value = (err as Error).message
  }
  finally {
    saving.value = false
  }
}

/** Save the current canvas as a new design (counts towards the plan limit). */
async function saveAsCopy() {
  if (!store.design) {
    return
  }
  if (resources.atLimit && !resources.isPlatformAdmin) {
    upgradeReason.value = 'limit'
    return
  }
  try {
    const res = await apiClient.createDesignTemplate({ name: `${store.meta?.name || t('designStudio.untitled')} (${t('designStudio.copy')})`, layoutConfig: store.design })
    store.markSaved()
    await resources.loadLimits(true)
    router.push(`/design-templates/${res.data.documentId}`)
  }
  catch (err: any) {
    if (err?.data?.error?.details?.code === 'DESIGN_LIMIT_REACHED') {
      upgradeReason.value = 'limit'
    }
    else {
      saveError.value = err.message
    }
  }
}

/** Read-only system template: make an editable copy for the organization. */
async function useTemplate() {
  if (locked.value) {
    upgradeReason.value = 'premium'
    return
  }
  if (resources.atLimit) {
    upgradeReason.value = 'limit'
    return
  }
  try {
    const res = await apiClient.useDesignTemplate(props.templateId)
    await resources.loadLimits(true)
    router.push(`/design-templates/${res.data.documentId}`)
  }
  catch (err: any) {
    const code = err?.data?.error?.details?.code
    if (code === 'DESIGN_LIMIT_REACHED') {
      upgradeReason.value = 'limit'
    }
    else if (code === 'PREMIUM_REQUIRED') {
      upgradeReason.value = 'premium'
    }
    else {
      saveError.value = err.message
    }
  }
}

function jumpTo(elementId?: string) {
  if (!elementId) {
    return
  }
  store.select(elementId)
  activePanel.value = 'layers'
  panelOpen.value = true
}

// ------------------------------------------------------ leave protection
onBeforeRouteLeave(async () => {
  if (!store.dirty || !canEdit.value) {
    return true
  }
  return ask({
    title: t('designStudio.leave.title'),
    message: t('designStudio.leave.message'),
    confirmLabel: t('designStudio.leave.confirm'),
    cancelLabel: t('designStudio.leave.stay'),
    danger: true,
  })
})

function beforeUnload(e: BeforeUnloadEvent) {
  if (store.dirty && canEdit.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

// ------------------------------------------------------------- shortcuts
function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

function onKey(e: KeyboardEvent) {
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault()
    save()
    return
  }
  if (isTyping(e) || readonly.value) {
    return
  }
  const k = e.key.toLowerCase()
  if (mod && k === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  }
  else if ((mod && k === 'z' && e.shiftKey) || (mod && k === 'y')) {
    e.preventDefault()
    store.redo()
  }
  else if (mod && k === 'd') {
    e.preventDefault()
    store.duplicateSelected()
  }
  else if (mod && k === 'c') {
    store.copy()
  }
  else if (mod && k === 'v') {
    store.paste()
  }
  else if (mod && k === 'a') {
    e.preventDefault()
    store.select(store.elements.filter(el => !el.hidden).map(el => el.id))
  }
  else if (k === 'delete' || k === 'backspace') {
    if (store.selectedIds.length) {
      e.preventDefault()
      store.removeSelected()
    }
  }
  else if (k === 'escape') {
    store.select(null)
  }
  else if (k === 'enter' && store.single?.type === 'text') {
    e.preventDefault()
    canvasRef.value?.startTextEdit(store.single.id)
  }
  else if (k.startsWith('arrow') && store.selectedIds.length) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    store.nudge(k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0, k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0)
  }
  else if (e.key === '?') {
    showShortcuts.value = true
  }
}

function checkScreen() {
  smallScreen.value = window.innerWidth < 1024
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('resize', checkScreen)
  checkScreen()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('resize', checkScreen)
})
watch(() => props.templateId, load)

// ------------------------------------------------------------ panel drop
const panelsRef = ref<any>(null)
function onDropped(payload: { kind: string, value: string, x: number, y: number }) {
  panelsRef.value?.handleDrop(payload)
}

const RAIL = [
  { id: 'templates', icon: 'i-heroicons-rectangle-group', tour: 'panel-templates' },
  { id: 'uploads', icon: 'i-heroicons-photo', tour: 'panel-uploads' },
  { id: 'elements', icon: 'i-heroicons-square-3-stack-3d', tour: 'panel-elements' },
  { id: 'text', icon: 'i-heroicons-language', tour: 'panel-text' },
  { id: 'attributes', icon: 'i-heroicons-code-bracket', tour: 'panel-attributes' },
  { id: 'qr', icon: 'i-heroicons-qr-code', tour: 'panel-qr' },
  { id: 'layers', icon: 'i-heroicons-queue-list', tour: 'panel-layers' },
]

function openPanel(id: string) {
  if (activePanel.value === id) {
    panelOpen.value = !panelOpen.value
  }
  else {
    activePanel.value = id
    panelOpen.value = true
  }
}

const saveState = computed(() => {
  if (saving.value) {
    return 'saving'
  }
  if (saveError.value) {
    return 'error'
  }
  if (savedFlash.value) {
    return 'saved'
  }
  return store.dirty ? 'unsaved' : 'clean'
})

const errorFindings = computed(() => findings.value.filter(f => f.severity === 'error'))
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Small screens -->
    <div v-if="smallScreen" class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div class="i-heroicons-computer-desktop h-12 w-12 text-gray-400" />
      <h1 class="text-xl font-semibold">
        {{ t('designStudio.smallScreen.title') }}
      </h1>
      <p class="max-w-sm text-sm text-gray-600">
        {{ t('designStudio.smallScreen.body') }}
      </p>
      <NuxtLink to="/design-templates" class="rounded-full bg-[#28A745] px-4 py-2 text-sm font-medium text-black">
        {{ t('designStudio.backToDesigns') }}
      </NuxtLink>
    </div>

    <template v-else>
      <!-- Top bar -->
      <header class="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-3">
        <NuxtLink to="/design-templates" class="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100" :title="t('designStudio.backToDesigns')">
          <div class="i-heroicons-arrow-left h-4 w-4" />
          <span class="hidden xl:inline">{{ t('designStudio.designs') }}</span>
        </NuxtLink>
        <div class="h-6 w-px bg-gray-200" />
        <input
          v-if="store.meta"
          v-model="store.meta.name"
          :disabled="readonly"
          class="w-64 min-w-0 rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-[#28A745] focus:outline-none disabled:bg-transparent"
          :aria-label="t('designStudio.nameLabel')"
          maxlength="120"
          @input="store.touch()"
        >
        <span v-if="isSystem" class="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700">{{ t('designStudio.systemTemplate') }}</span>
        <span v-if="store.meta?.isPremium" class="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          <div class="i-heroicons-sparkles h-3 w-3" />{{ t('designStudio.premium') }}
        </span>
        <span class="text-xs" :class="{ 'text-gray-400': saveState === 'clean', 'text-amber-600': saveState === 'unsaved', 'text-[#1B7A34]': saveState === 'saved', 'text-red-600': saveState === 'error', 'text-gray-500': saveState === 'saving' }" aria-live="polite">
          {{ t(`designStudio.saveState.${saveState}`) }}
        </span>

        <div class="ml-auto flex items-center gap-1">
          <template v-if="!readonly">
            <button class="ds-icon-btn" :disabled="!store.canUndo" :title="`${t('designStudio.undo')} (⌘Z)`" @click="store.undo()">
              <div class="i-heroicons-arrow-uturn-left h-4 w-4" />
            </button>
            <button class="ds-icon-btn" :disabled="!store.canRedo" :title="`${t('designStudio.redo')} (⇧⌘Z)`" @click="store.redo()">
              <div class="i-heroicons-arrow-uturn-right h-4 w-4" />
            </button>
            <div class="mx-1 h-6 w-px bg-gray-200" />
          </template>
          <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100" data-tour="sample" :title="t('designStudio.sampleDataHint')">
            <input v-model="store.showSampleData" type="checkbox" class="accent-[#28A745]" @change="store.touch()">
            {{ t('designStudio.sampleData') }}
          </label>
          <button
            v-if="store.showSampleData"
            class="ds-icon-btn"
            :title="t('designStudio.nextSample')"
            @click="store.sampleIndex++; store.touch()"
          >
            <div class="i-heroicons-arrow-path h-4 w-4" />
          </button>
          <button class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100" data-tour="preview" @click="showPreview = true">
            <div class="i-heroicons-eye h-4 w-4" />{{ t('designStudio.preview') }}
          </button>
          <button v-if="!isSystem && !readonly" class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100" @click="showBrand = true">
            <div class="i-heroicons-swatch h-4 w-4" />{{ t('designStudio.brand.button') }}
          </button>
          <div class="relative">
            <button class="ds-icon-btn" :title="t('designStudio.help')" @click="showShortcuts = !showShortcuts">
              <div class="i-heroicons-question-mark-circle h-5 w-5" />
            </button>
          </div>
          <div class="mx-1 h-6 w-px bg-gray-200" />
          <template v-if="readonly">
            <button class="flex items-center gap-1.5 rounded-full bg-[#28A745] px-4 py-2 text-sm font-semibold text-black hover:bg-[#28A745]/90" @click="useTemplate">
              <div v-if="locked" class="i-heroicons-lock-closed h-4 w-4" />
              {{ t('designStudio.useTemplate') }}
            </button>
          </template>
          <template v-else>
            <button v-if="isSystem && resources.isPlatformAdmin" class="rounded-lg px-2.5 py-1.5 text-sm text-violet-700 hover:bg-violet-50" @click="showSystemDialog = true">
              {{ t('designStudio.system.settings') }}
            </button>
            <button v-if="!isSystem" class="rounded-lg px-2.5 py-1.5 text-sm text-gray-700 hover:bg-gray-100" @click="saveAsCopy">
              {{ t('designStudio.saveAsCopy') }}
            </button>
            <button
              class="flex items-center gap-1.5 rounded-full bg-[#28A745] px-4 py-2 text-sm font-semibold text-black hover:bg-[#28A745]/90 disabled:opacity-60"
              :disabled="saving || !store.dirty"
              data-tour="save"
              @click="save"
            >
              <div v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              {{ t('common.save') }}
            </button>
          </template>
        </div>
      </header>

      <!-- Banners -->
      <div v-if="draftToRestore" class="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
        <div class="i-heroicons-clock h-4 w-4" />
        {{ t('designStudio.draft.found') }}
        <button class="font-semibold underline" @click="restoreDraft">
          {{ t('designStudio.draft.restore') }}
        </button>
        <button class="text-amber-700 underline" @click="discardDraft">
          {{ t('designStudio.draft.discard') }}
        </button>
      </div>
      <div v-if="readonly && !loading && !loadError" class="flex items-center gap-2 border-b border-violet-200 bg-violet-50 px-4 py-2 text-sm text-violet-900">
        <div class="i-heroicons-information-circle h-4 w-4" />
        {{ locked ? t('designStudio.readonly.premium') : t('designStudio.readonly.system') }}
      </div>
      <div v-if="saveError" class="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
        <div class="i-heroicons-exclamation-triangle h-4 w-4" />
        {{ saveError }}
        <button class="ml-auto text-red-700 underline" @click="saveError = null">
          {{ t('common.close') }}
        </button>
      </div>

      <div v-if="loading" class="flex flex-1 items-center justify-center">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-[#28A745] border-t-transparent" />
      </div>
      <div v-else-if="loadError" class="flex flex-1 flex-col items-center justify-center gap-3">
        <p class="text-red-700">
          {{ loadError }}
        </p>
        <button class="rounded-lg border px-4 py-2 text-sm" @click="load">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <!-- Premium template the org can't use: preview only -->
      <div v-else-if="locked" class="flex flex-1 flex-col items-center justify-center gap-6 p-8">
        <img v-if="previewImage" :src="previewImage" :alt="store.meta?.name" class="max-h-[60vh] max-w-full rounded-lg shadow-lg">
        <div class="text-center">
          <p class="mb-3 text-gray-700">
            {{ t('designStudio.readonly.premium') }}
          </p>
          <button class="rounded-full bg-[#28A745] px-5 py-2.5 text-sm font-semibold text-black" @click="upgradeReason = 'premium'">
            {{ t('designStudio.upgrade.cta') }}
          </button>
        </div>
      </div>

      <div v-else class="flex min-h-0 flex-1">
        <!-- Tool rail -->
        <nav v-if="!readonly" class="flex w-[76px] shrink-0 flex-col border-r border-gray-200 bg-white py-2" :aria-label="t('designStudio.tools')">
          <button
            v-for="item in RAIL"
            :key="item.id"
            class="relative mx-1.5 flex flex-col items-center gap-1 rounded-lg py-2.5 text-[11px] text-gray-600 hover:bg-gray-50"
            :class="{ 'bg-[#28A745]/10 text-[#1B7A34] font-medium': activePanel === item.id && panelOpen }"
            :data-tour="item.tour"
            :aria-pressed="activePanel === item.id && panelOpen"
            @click="openPanel(item.id)"
          >
            <div :class="item.icon" class="h-5 w-5" />
            {{ t(`designStudio.panels.${item.id}`) }}
          </button>
        </nav>

        <!-- Panel -->
        <DesignStudioPanels
          v-if="!readonly && panelOpen"
          ref="panelsRef"
          :active="activePanel"
          :is-system="isSystem"
          @close="panelOpen = false"
          @upgrade="upgradeReason = $event"
        />

        <!-- Canvas -->
        <div class="relative min-w-0 flex-1">
          <DesignStudioCanvas
            ref="canvasRef"
            :brand="renderBrand"
            :data="renderData"
            :readonly="readonly"
            @issues="renderIssues = $event"
            @dropped="onDropped"
          />
          <DesignStudioZoomControls class="absolute bottom-4 left-4" @fit="canvasRef?.fit()" />
          <DesignStudioContextToolbar v-if="!readonly" class="absolute left-1/2 top-3 -translate-x-1/2" @edit-text="canvasRef?.startTextEdit($event)" />
        </div>

        <!-- Inspector -->
        <DesignStudioInspector v-if="!readonly" :brand="renderBrand" :issues="renderIssues" @jump="jumpTo" />
      </div>
    </template>

    <!-- Pre-flight results after save -->
    <div v-if="showFindings" class="fixed bottom-5 right-5 z-40 w-96 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold">
          {{ errorFindings.length ? t('designStudio.preflight.titleErrors') : t('designStudio.preflight.title') }}
        </h3>
        <button class="ds-icon-btn" :aria-label="t('common.close')" @click="showFindings = false">
          <div class="i-heroicons-x-mark h-4 w-4" />
        </button>
      </div>
      <ul class="space-y-1.5">
        <li v-for="(f, i) in findings" :key="i" class="flex items-start gap-2 text-sm">
          <div :class="f.severity === 'error' ? 'i-heroicons-exclamation-circle text-red-600' : 'i-heroicons-exclamation-triangle text-amber-500'" class="mt-0.5 h-4 w-4 shrink-0" />
          <span class="flex-1">{{ t(`designStudio.preflight.${f.code}`, { key: f.detail }) }}</span>
          <button v-if="f.elementId" class="text-xs text-[#1B7A34] underline" @click="jumpTo(f.elementId)">
            {{ t('designStudio.preflight.show') }}
          </button>
        </li>
      </ul>
    </div>

    <DesignStudioPreviewModal v-if="showPreview" :brand="renderBrand" @close="showPreview = false" />
    <DesignStudioBrandKitDialog v-if="showBrand" @close="showBrand = false" />
    <DesignStudioSystemDialog v-if="showSystemDialog" @close="showSystemDialog = false" />
    <DesignStudioUpgradeDialog v-if="upgradeReason" :reason="upgradeReason" @close="upgradeReason = null" />
    <DesignStudioShortcutsDialog v-if="showShortcuts" @close="showShortcuts = false" @tour="showShortcuts = false; tourOpen = true" />
    <DesignStudioTour v-if="tourOpen" @close="tourOpen = false" />
    <DesignStudioConfirmDialog />
  </div>
</template>
