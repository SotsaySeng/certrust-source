<script setup lang="ts">
import type { ConcreteComponent } from 'vue'
import type { Section } from '~/composables/useHomeContent'

defineProps<{
  section: Section
  step: number
  reverse?: boolean
}>()

const illustrations: Record<Section['id'], ConcreteComponent | string> = {
  certificate: resolveComponent('HomeGraduationIllustration'),
  recipient: resolveComponent('HomeCsvIllustration'),
  export: resolveComponent('HomeShareIllustration')
}
</script>

<template>
  <div class="relative rounded-2xl border border-text-primary/10 bg-white overflow-hidden transition-colors duration-300 hover:border-text-primary/25">
    <!-- Oversized ghost numeral - editorial step marker -->
    <span
      class="pointer-events-none select-none absolute -top-4 md:top-0 right-4 md:right-8 font-display font-bold leading-none text-[110px] md:text-[160px] text-text-primary/[0.04]"
      aria-hidden="true"
    >
      {{ String(step).padStart(2, '0') }}
    </span>

    <div class="relative grid md:grid-cols-2 gap-10 items-center p-6 md:p-10 lg:p-14">
      <div class="grow" :class="{ 'order-last': reverse }">
        <component :is="illustrations[section.id]" :image-url="section.illustrationUrl" />
      </div>
      <div class="relative">
        <div class="flex items-center gap-3 mb-6">
          <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-text-primary font-mono text-xs font-semibold text-white">
            {{ step }}
          </span>
          <span class="inline-flex px-3 py-1 border border-text-primary/15 rounded-full text-xs font-mono font-medium uppercase tracking-widest text-text-secondary">
            {{ section.title }}
          </span>
        </div>
        <h3 class="text-3xl md:text-4xl font-bold mb-8 tracking-tight text-balance">
          {{ section.header }}
        </h3>
        <ul class="space-y-4 mb-8">
          <li v-for="(feature, index) in section.features" :key="index" class="flex items-start gap-3">
            <BaseIcon name="check-circle" collection="heroicons" class="size-5 mt-1 text-primary shrink-0" />
            <span class="text-lg text-text-secondary">{{ feature }}</span>
          </li>
        </ul>
        <div v-if="section.content" class="p-5 rounded-xl border border-primary/20 bg-secondary/40">
          <div class="flex items-center gap-2 mb-3">
            <BaseIcon name="shield-check" collection="heroicons" class="size-5 text-primary" />
            <h3 class="font-bold text-text-primary">
              {{ section.content.title }}
            </h3>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="(feature, index) in section.content.features" :key="index"
              class="flex items-center gap-2 text-sm text-text-secondary"
            >
              <BaseIcon name="check" collection="heroicons" class="size-4 text-primary shrink-0" />
              <span>{{ feature }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
