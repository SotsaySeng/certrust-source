<script setup lang="ts">
/**
 * The Design Studio canvas. The design is drawn by the shared renderer
 * (identical to issued output); selected elements get invisible overlay
 * boxes that Moveable drags, resizes and rotates. Pure drags move the
 * element's SVG group directly (smooth) and re-render once on release.
 */
import type { BrandKit, DesignElement, PlaceholderData, RenderIssue, TextElement } from '~/lib/design-core'
import Moveable from 'vue3-moveable'
import { fromEditable, toEditable } from '~/lib/design-studio/text-tokens'

const props = defineProps<{
  brand?: BrandKit | null
  data?: PlaceholderData
  readonly?: boolean
}>()

const emit = defineEmits<{
  issues: [issues: RenderIssue[]]
  dropped: [payload: { kind: string, value: string, x: number, y: number }]
}>()

const store = useDesignStudioStore()
const { t } = useI18n()

const wrapper = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)
const svgHost = ref<HTMLElement | null>(null)
const moveableRef = ref<any>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const svgHtml = ref('')
const firstRenderDone = ref(false)
const renderError = ref<string | null>(null)

const page = computed(() => store.design?.page ?? { width: 1123, height: 794 })
const z = computed(() => store.zoom)

// ---------------------------------------------------------------- render
let pending = false
let running = false
let rerun = false
let dragFastPath = false
let token = 0

function scheduleRender() {
  if (dragFastPath) {
    return
  }
  if (running) {
    rerun = true
    return
  }
  if (pending) {
    return
  }
  pending = true
  requestAnimationFrame(() => {
    pending = false
    void doRender()
  })
}

async function doRender() {
  if (!store.design) {
    return
  }
  running = true
  const my = ++token
  try {
    const skip = store.editingTextId ? new Set([store.editingTextId]) : undefined
    const res = await renderDesignInBrowser(store.design, {
      data: props.data,
      brand: props.brand,
      annotate: true,
      showMissing: true,
      skipIds: skip,
      idPrefix: 'ds',
    })
    if (my === token) {
      svgHtml.value = res.svg
      renderError.value = null
      firstRenderDone.value = true
      emit('issues', res.issues)
      autoGrowText(res.textHeights)
      await nextTick()
      refreshGuidelines()
      moveableRef.value?.updateRect?.()
    }
  }
  catch (err) {
    renderError.value = (err as Error).message
  }
  finally {
    running = false
    if (rerun) {
      rerun = false
      scheduleRender()
    }
  }
}

/** Plain text boxes grow to fit their text (auto-fit boxes shrink the font instead). */
function autoGrowText(heights: Record<string, number>) {
  if (store.gestureOpen) {
    return
  }
  for (const [id, h] of Object.entries(heights)) {
    const el = store.element(id) as TextElement | undefined
    if (!el || el.type !== 'text' || el.autoFit || el.curve) {
      continue
    }
    if (h > el.h + 0.5) {
      store.updateElement(id, { h: Math.ceil(h) } as any, false)
    }
  }
}

watch(() => [store.revision, store.editingTextId, props.data, props.brand], scheduleRender, { deep: false })

// ------------------------------------------------------------ zoom / fit
function fit() {
  const w = wrapper.value
  if (!w) {
    return
  }
  const s = Math.min((w.clientWidth - 96) / page.value.width, (w.clientHeight - 96) / page.value.height)
  store.zoom = Math.max(0.1, Math.min(2, Math.round(s * 100) / 100))
}

let resizeObserver: ResizeObserver | null = null
onMounted(() => {
  fit()
  scheduleRender()
  if (wrapper.value) {
    resizeObserver = new ResizeObserver(() => fit())
    resizeObserver.observe(wrapper.value)
  }
})
onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => [page.value.width, page.value.height], () => nextTick(fit))
watch(z, () => nextTick(() => moveableRef.value?.updateRect?.()))

// -------------------------------------------------------- moveable setup
const selectedEls = computed(() => store.selected)
const targets = ref<HTMLElement[]>([])
watch(() => [store.selectedIds.join(','), store.revision], async () => {
  await nextTick()
  targets.value = stage.value ? Array.from(stage.value.querySelectorAll<HTMLElement>('.el-target')) : []
}, { immediate: true })

const anyLocked = computed(() => selectedEls.value.some(e => e.locked))
const isSingle = computed(() => selectedEls.value.length === 1)
const singleType = computed(() => (isSingle.value ? selectedEls.value[0].type : null))
const canTransform = computed(() => !props.readonly && !anyLocked.value && !store.editingTextId)

const keepRatio = computed(() => singleType.value === 'qr' || singleType.value === 'image')
const renderDirections = computed(() => {
  if (!isSingle.value) {
    return []
  }
  if (singleType.value === 'line') {
    return ['w', 'e']
  }
  if (singleType.value === 'text') {
    return ['nw', 'ne', 'sw', 'se', 'w', 'e']
  }
  return ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
})

const guidelines = ref<Element[]>([])
function refreshGuidelines() {
  if (!svgHost.value) {
    return
  }
  const selected = new Set(store.selectedIds)
  guidelines.value = Array.from(svgHost.value.querySelectorAll('[data-el-id]'))
    .filter(g => !selected.has(g.getAttribute('data-el-id') || ''))
    .filter((g) => {
      const el = store.element(g.getAttribute('data-el-id') || '')
      // Full-page frames make every edge "snap" - skip them.
      return el && !(el.type === 'frame' && el.w > page.value.width * 0.8)
    })
}
const verticalGuidelines = computed(() => [0, page.value.width / 2, page.value.width].map(v => v * z.value))
const horizontalGuidelines = computed(() => [0, page.value.height / 2, page.value.height].map(v => v * z.value))

function targetStyle(el: DesignElement) {
  return {
    left: `${el.x * z.value}px`,
    top: `${el.y * z.value}px`,
    width: `${Math.max(1, el.w) * z.value}px`,
    height: `${Math.max(1, el.h) * z.value}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
  }
}

function groupTransform(el: DesignElement) {
  const rot = el.rotation ? ` rotate(${el.rotation} ${el.w / 2} ${el.h / 2})` : ''
  return `translate(${el.x} ${el.y})${rot}`
}

function patchGroup(el: DesignElement) {
  const g = svgHost.value?.querySelector(`[data-el-id="${CSS.escape(el.id)}"]`)
  g?.setAttribute('transform', groupTransform(el))
}

function idOf(target: HTMLElement | SVGElement | null | undefined): string | null {
  return (target as HTMLElement | null)?.dataset?.targetId ?? null
}

// drag
function onDragStart() {
  store.beginGesture()
  dragFastPath = true
}
function onDrag(e: any) {
  const el = store.element(idOf(e.target) || '')
  if (!el) {
    return
  }
  el.x = e.left / z.value
  el.y = e.top / z.value
  patchGroup(el)
}
function onDragGroup(e: any) {
  for (const ev of e.events) {
    onDrag(ev)
  }
}
function onDragEnd() {
  dragFastPath = false
  store.endGesture()
}

// resize
let resizeStart: { w: number, h: number, x: number, y: number, fontSize?: number, minFontSize?: number } | null = null
function onResizeStart(e: any) {
  const el = store.element(idOf(e.target) || '')
  if (!el) {
    return
  }
  store.beginGesture()
  resizeStart = { w: el.w, h: el.h, x: el.x, y: el.y, fontSize: (el as any).fontSize, minFontSize: (el as any).minFontSize }
  e.setMin?.([8, 4])
}
function onResize(e: any) {
  const el = store.element(idOf(e.target) || '')
  if (!el || !resizeStart) {
    return
  }
  const [dx, dy] = e.direction as number[]
  if (el.type === 'text' && dx !== 0 && dy !== 0 && resizeStart.fontSize) {
    // Corner handle on text: scale the text (Canva-style).
    const s = Math.max(0.1, e.width / z.value / resizeStart.w)
    el.w = resizeStart.w * s
    el.h = resizeStart.h * s
    ;(el as TextElement).fontSize = Math.max(4, Math.round(resizeStart.fontSize * s * 10) / 10)
    if (resizeStart.minFontSize) {
      (el as TextElement).minFontSize = Math.max(4, resizeStart.minFontSize * s)
    }
    el.x = dx < 0 ? resizeStart.x + resizeStart.w - el.w : resizeStart.x
    el.y = dy < 0 ? resizeStart.y + resizeStart.h - el.h : resizeStart.y
  }
  else {
    el.w = e.width / z.value
    if (el.type !== 'text' || dy !== 0) {
      el.h = e.height / z.value
    }
    el.x = e.drag.left / z.value
    el.y = e.drag.top / z.value
  }
  store.touch()
}
function onResizeEnd() {
  resizeStart = null
  store.endGesture()
}

// rotate
function onRotateStart() {
  store.beginGesture()
}
function onRotate(e: any) {
  const el = store.element(idOf(e.target) || '')
  if (!el) {
    return
  }
  let r = e.rotation % 360
  if (r > 180) {
    r -= 360
  }
  if (r < -180) {
    r += 360
  }
  el.rotation = Math.round(r * 10) / 10
  patchGroup(el)
}
function onRotateEnd() {
  store.endGesture()
}

// ------------------------------------------------- selection & marquee
const marquee = ref<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
let marqueeStart: { x: number, y: number, additive: boolean } | null = null

function stagePoint(ev: PointerEvent | MouseEvent | DragEvent) {
  const r = stage.value!.getBoundingClientRect()
  return { x: (ev.clientX - r.left) / z.value, y: (ev.clientY - r.top) / z.value }
}

async function onPointerDown(ev: PointerEvent) {
  if (props.readonly || ev.button !== 0) {
    return
  }
  const target = ev.target as Element
  if (target.closest('.moveable-control-box, .el-target, textarea, .ds-no-select')) {
    return
  }
  const g = target.closest('[data-el-id]')
  const additive = ev.shiftKey || ev.metaKey || ev.ctrlKey
  if (g) {
    const id = g.getAttribute('data-el-id')!
    if (store.editingTextId && store.editingTextId !== id) {
      finishTextEdit()
    }
    if (!store.selectedIds.includes(id)) {
      store.select(id, additive)
    }
    else if (additive) {
      store.select(id, true)
      return
    }
    const el = store.element(id)
    if (el && !el.locked) {
      await nextTick()
      await nextTick()
      targets.value = Array.from(stage.value!.querySelectorAll<HTMLElement>('.el-target'))
      await nextTick()
      moveableRef.value?.dragStart?.(ev)
    }
    return
  }
  // Empty canvas: start a marquee.
  finishTextEdit()
  const p = stagePoint(ev)
  marqueeStart = { ...p, additive }
  marquee.value = { x1: p.x, y1: p.y, x2: p.x, y2: p.y }
  window.addEventListener('pointermove', onMarqueeMove)
  window.addEventListener('pointerup', onMarqueeUp, { once: true })
}

function onMarqueeMove(ev: PointerEvent) {
  if (!marqueeStart || !marquee.value) {
    return
  }
  const p = stagePoint(ev)
  marquee.value = { x1: marqueeStart.x, y1: marqueeStart.y, x2: p.x, y2: p.y }
}

function onMarqueeUp() {
  window.removeEventListener('pointermove', onMarqueeMove)
  const m = marquee.value
  const start = marqueeStart
  marquee.value = null
  marqueeStart = null
  if (!m || !start) {
    return
  }
  const x1 = Math.min(m.x1, m.x2)
  const x2 = Math.max(m.x1, m.x2)
  const y1 = Math.min(m.y1, m.y2)
  const y2 = Math.max(m.y1, m.y2)
  if (x2 - x1 < 3 && y2 - y1 < 3) {
    if (!start.additive) {
      store.select(null)
    }
    return
  }
  const hit = store.elements
    .filter(e => !e.hidden && e.x < x2 && e.x + e.w > x1 && e.y < y2 && e.y + e.h > y1)
    // A full-page frame would be caught by every marquee; skip it unless it's the only hit.
    .filter((e, _, all) => !(e.type === 'frame' && e.w > page.value.width * 0.8 && all.length > 1))
    .map(e => e.id)
  store.select(hit, start.additive)
}

// ---------------------------------------------------- in-place text edit
const editingEl = computed(() => (store.editingTextId ? store.element(store.editingTextId) as TextElement | undefined : undefined))
const editText = ref('')

function onDoubleClick(ev: MouseEvent) {
  if (props.readonly) {
    return
  }
  const g = (ev.target as Element).closest('[data-el-id]')
  const id = g?.getAttribute('data-el-id')
  const el = id ? store.element(id) : undefined
  if (el?.type === 'text' && !el.locked) {
    startTextEdit(el.id)
  }
}

async function startTextEdit(id: string) {
  const el = store.element(id) as TextElement | undefined
  if (!el) {
    return
  }
  store.select(id)
  editText.value = toEditable(el.content)
  store.editingTextId = id
  await ensureCssFont(el.fontFamily.startsWith('$') ? 'Inter' : el.fontFamily, el.fontWeight, el.italic)
  await nextTick()
  textareaRef.value?.focus()
  textareaRef.value?.select()
}
defineExpose({ fit, startTextEdit })

function onTextInput() {
  if (!editingEl.value) {
    return
  }
  store.updateElement(editingEl.value.id, { content: fromEditable(editText.value) } as any, `text:${editingEl.value.id}`)
}

function finishTextEdit() {
  if (store.editingTextId) {
    store.editingTextId = null
  }
}

const textareaStyle = computed(() => {
  const el = editingEl.value
  if (!el) {
    return {}
  }
  const family = el.fontFamily.startsWith('$') ? (el.fontFamily === '$brand.heading' ? props.brand?.headingFont || 'Playfair Display' : props.brand?.bodyFont || 'Inter') : el.fontFamily
  return {
    left: `${el.x * z.value}px`,
    top: `${el.y * z.value}px`,
    width: `${el.w * z.value}px`,
    minHeight: `${el.h * z.value}px`,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    fontFamily: `'${family}', 'Noto Sans Lao', sans-serif`,
    fontSize: `${el.fontSize * z.value}px`,
    fontWeight: String(el.fontWeight),
    fontStyle: el.italic ? 'italic' : 'normal',
    lineHeight: String(el.lineHeight ?? 1.2),
    letterSpacing: `${(el.letterSpacing ?? 0) * z.value}px`,
    textAlign: el.align,
    textTransform: el.uppercase ? 'uppercase' : 'none',
    color: el.color.startsWith('#') ? el.color : '#111827',
  } as Record<string, string | undefined>
})

// -------------------------------------------------- drag & drop from panels
function onDragOver(ev: DragEvent) {
  if (ev.dataTransfer?.types.includes('application/x-certrust-design')) {
    ev.preventDefault()
    ev.dataTransfer.dropEffect = 'copy'
  }
}
function onDrop(ev: DragEvent) {
  const raw = ev.dataTransfer?.getData('application/x-certrust-design')
  if (!raw) {
    return
  }
  ev.preventDefault()
  try {
    const payload = JSON.parse(raw)
    const p = stagePoint(ev)
    emit('dropped', { ...payload, x: p.x, y: p.y })
  }
  catch {}
}
</script>

<template>
  <div
    ref="wrapper"
    class="ds-canvas-wrapper relative h-full w-full overflow-auto bg-[#eef0f3]"
    data-tour="canvas"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <div class="min-h-full min-w-full flex items-center justify-center p-12">
      <div
        ref="stage"
        class="ds-stage relative shadow-[0_2px_24px_rgba(15,23,42,0.12)] bg-white select-none"
        :style="{ width: `${page.width * z}px`, height: `${page.height * z}px` }"
        @pointerdown="onPointerDown"
        @dblclick="onDoubleClick"
      >
        <!-- eslint-disable-next-line vue/no-v-html -- renderer output: every value is escaped (design-core escapeXml) -->
        <div ref="svgHost" class="ds-svg absolute inset-0" v-html="svgHtml" />

        <div v-if="!firstRenderDone" class="absolute inset-0 flex items-center justify-center text-sm text-gray-500">
          <div class="w-6 h-6 border-3 border-[#28A745] border-t-transparent rounded-full animate-spin mr-2" />
          {{ t('designStudio.canvas.loading') }}
        </div>
        <div v-if="renderError" class="absolute left-2 bottom-2 right-2 rounded bg-red-50 border border-red-200 p-2 text-xs text-red-700">
          {{ t('designStudio.canvas.renderError') }} {{ renderError }}
        </div>

        <!-- Invisible move/resize targets for the selection -->
        <div
          v-for="el in selectedEls"
          :key="el.id"
          class="el-target absolute"
          :class="{ 'is-locked': el.locked }"
          :data-target-id="el.id"
          :style="targetStyle(el)"
        />

        <!-- Hover-free outline for locked selection -->
        <template v-if="anyLocked">
          <div
            v-for="el in selectedEls"
            :key="`lock-${el.id}`"
            class="absolute pointer-events-none border-2 border-dashed border-amber-500"
            :style="targetStyle(el)"
          >
            <div class="absolute -top-6 left-0 flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[11px] text-white whitespace-nowrap">
              <div class="i-heroicons-lock-closed w-3 h-3" /> {{ t('designStudio.canvas.locked') }}
            </div>
          </div>
        </template>

        <Moveable
          v-if="targets.length && canTransform"
          ref="moveableRef"
          :target="targets.length === 1 ? targets[0] : targets"
          :draggable="true"
          :resizable="isSingle"
          :rotatable="isSingle"
          :keep-ratio="keepRatio"
          :render-directions="renderDirections"
          :throttle-drag="0"
          :throttle-resize="0"
          :throttle-rotate="1"
          :snappable="true"
          :snap-threshold="6"
          :is-display-snap-digit="true"
          :snap-directions="{ top: true, left: true, bottom: true, right: true, center: true, middle: true }"
          :element-snap-directions="{ top: true, left: true, bottom: true, right: true, center: true, middle: true }"
          :element-guidelines="guidelines"
          :vertical-guidelines="verticalGuidelines"
          :horizontal-guidelines="horizontalGuidelines"
          :origin="false"
          @drag-start="onDragStart"
          @drag="onDrag"
          @drag-end="onDragEnd"
          @drag-group-start="onDragStart"
          @drag-group="onDragGroup"
          @drag-group-end="onDragEnd"
          @resize-start="onResizeStart"
          @resize="onResize"
          @resize-end="onResizeEnd"
          @rotate-start="onRotateStart"
          @rotate="onRotate"
          @rotate-end="onRotateEnd"
        />

        <!-- In-place text editing -->
        <textarea
          v-if="editingEl"
          ref="textareaRef"
          v-model="editText"
          class="ds-text-editor absolute resize-none overflow-hidden bg-white/70 outline-2 outline-[#28A745] outline-offset-2 p-0 m-0 border-0"
          :style="textareaStyle"
          spellcheck="false"
          @input="onTextInput"
          @blur="finishTextEdit"
          @keydown.esc.prevent="finishTextEdit"
          @pointerdown.stop
        />

        <!-- Marquee -->
        <div
          v-if="marquee"
          class="absolute border border-[#28A745] bg-[#28A745]/10 pointer-events-none"
          :style="{
            left: `${Math.min(marquee.x1, marquee.x2) * z}px`,
            top: `${Math.min(marquee.y1, marquee.y2) * z}px`,
            width: `${Math.abs(marquee.x2 - marquee.x1) * z}px`,
            height: `${Math.abs(marquee.y2 - marquee.y1) * z}px`,
          }"
        />

        <slot name="overlay" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ds-svg :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.ds-svg :deep([data-el-id]) {
  cursor: move;
}
.el-target {
  pointer-events: auto;
  cursor: move;
}
.el-target.is-locked {
  cursor: default;
}
.ds-text-editor {
  field-sizing: content;
}
</style>

<style>
/* Moveable's control box defaults to z-index 3000 - keep it under dialogs. */
.ds-stage .moveable-control-box {
  z-index: 5 !important;
}
</style>
