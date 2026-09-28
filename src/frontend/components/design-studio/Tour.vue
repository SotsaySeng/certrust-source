<script setup lang="ts">
/** A short guided tour of the editor. Remembers per browser that it was seen. */
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const STEPS = [
  { target: 'panel-templates', key: 'templates' },
  { target: 'canvas', key: 'canvas' },
  { target: 'panel-text', key: 'text' },
  { target: 'panel-attributes', key: 'attributes' },
  { target: 'inspector', key: 'inspector' },
  { target: 'sample', key: 'sample' },
  { target: 'save', key: 'save' },
] as const

const i = ref(0)
const rect = ref<DOMRect | null>(null)
const step = computed(() => STEPS[i.value])

function measure() {
  const el = document.querySelector(`[data-tour="${step.value.target}"]`)
  rect.value = el ? el.getBoundingClientRect() : null
}
watch(i, () => nextTick(measure))
onMounted(() => {
  nextTick(measure)
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => window.removeEventListener('resize', measure))

function finish() {
  try {
    localStorage.setItem('ds-tour-seen', '1')
  }
  catch {}
  emit('close')
}

const popover = computed(() => {
  const r = rect.value
  const W = 320
  if (!r) {
    return { left: `calc(50% - ${W / 2}px)`, top: '40%' }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Right of the target if it fits, else below, else left.
  let left = r.right + 16
  let top = r.top
  if (left + W > vw - 16) {
    left = Math.max(16, Math.min(vw - W - 16, r.left + r.width / 2 - W / 2))
    top = r.bottom + 16
    if (top + 180 > vh) {
      top = Math.max(16, r.top - 196)
    }
  }
  if (r.height > vh * 0.6) {
    top = Math.max(16, r.top + 40)
  }
  return { left: `${left}px`, top: `${Math.min(top, vh - 200)}px` }
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[980]" role="dialog" aria-modal="true" :aria-label="t('designStudio.tour.title')">
      <!-- Spotlight -->
      <div
        v-if="rect"
        class="pointer-events-none absolute rounded-xl transition-all duration-200"
        :style="{ left: `${rect.left - 6}px`, top: `${rect.top - 6}px`, width: `${rect.width + 12}px`, height: `${rect.height + 12}px`, boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)' }"
      />
      <div v-else class="absolute inset-0 bg-slate-900/55" />
      <div class="absolute w-80 rounded-2xl bg-white p-5 shadow-2xl" :style="popover">
        <p class="text-xs font-medium text-[#1B7A34]">
          {{ t('designStudio.tour.step', { n: i + 1, total: STEPS.length }) }}
        </p>
        <h3 class="mt-1 font-semibold text-gray-900">
          {{ t(`designStudio.tour.${step.key}.title`) }}
        </h3>
        <p class="mt-1 text-sm leading-relaxed text-gray-600">
          {{ t(`designStudio.tour.${step.key}.body`) }}
        </p>
        <div class="mt-4 flex items-center gap-2">
          <button class="text-sm text-gray-500 hover:text-gray-800" @click="finish">
            {{ t('designStudio.tour.skip') }}
          </button>
          <button v-if="i > 0" class="ml-auto rounded-lg border border-gray-300 px-3 py-1.5 text-sm" @click="i--">
            {{ t('common.back') }}
          </button>
          <button class="rounded-lg bg-[#28A745] px-3 py-1.5 text-sm font-semibold text-black" :class="{ 'ml-auto': i === 0 }" @click="i < STEPS.length - 1 ? i++ : finish()">
            {{ i < STEPS.length - 1 ? t('designStudio.tour.next') : t('designStudio.tour.done') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
