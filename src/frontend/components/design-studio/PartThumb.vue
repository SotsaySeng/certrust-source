<script setup lang="ts">
/**
 * Thumbnail of panel presets (shapes, frames, text combinations), drawn by
 * the real renderer so the preview matches what lands on the canvas.
 */
import type { BrandKit, Design, DesignElement } from '~/lib/design-core'

const props = defineProps<{
  parts: Array<Partial<DesignElement> & { type: DesignElement['type'] }>
  brand?: BrandKit | null
  /** Render text placeholders with sample values. */
  sample?: boolean
  pad?: number
}>()

const svg = ref('')
const cache = new Map<string, string>()
let seq = 0

async function draw() {
  const pad = props.pad ?? 8
  const parts = props.parts.map((p, i) => ({ x: 0, y: 0, w: 100, h: 100, id: `p${i}`, ...p })) as DesignElement[]
  const x1 = Math.min(...parts.map(p => p.x))
  const y1 = Math.min(...parts.map(p => p.y))
  const x2 = Math.max(...parts.map(p => p.x + p.w))
  const y2 = Math.max(...parts.map(p => p.y + p.h))
  const design: Design = {
    version: 1,
    kind: 'certificate',
    page: { preset: 'custom', orientation: 'landscape', width: Math.max(50, x2 - x1 + pad * 2), height: Math.max(50, y2 - y1 + pad * 2) },
    background: { color: 'transparent' },
    elements: parts.map(p => ({ ...p, x: p.x - x1 + pad, y: p.y - y1 + pad })),
  }
  const key = JSON.stringify([design, props.brand, props.sample])
  const hit = cache.get(key)
  if (hit) {
    svg.value = hit
    return
  }
  const my = ++seq
  const { sampleData } = await import('~/lib/design-core')
  const res = await renderDesignInBrowser(design, { brand: props.brand, data: props.sample ? sampleData() : undefined, idPrefix: `pt${Math.random().toString(36).slice(2, 7)}` })
  if (my !== seq) {
    return
  }
  cache.set(key, res.svg)
  svg.value = res.svg
}

watch(() => [props.parts, props.brand], draw, { immediate: true, deep: true })
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- renderer output, all values escaped -->
  <div class="part-thumb flex h-full w-full items-center justify-center" v-html="svg" />
</template>

<style scoped>
.part-thumb :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
}
</style>
