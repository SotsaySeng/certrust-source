<script setup lang="ts">
import type { AudienceContent } from '~/composables/useHomeContent'

const props = defineProps<{
  audience: AudienceContent
}>()

const revealVariants = useRevealMotion()
// Precomputed once (not called inline in the template) so v-motion gets a
// referentially stable object across re-renders — see pages/index.vue.
const headerMotion = revealVariants(0)
const segmentMotions = props.audience.segments.map((_, index) => revealVariants(index * 80))
</script>

<template>
  <section class="mb-24 md:mb-32">
    <div v-motion="headerMotion" class="max-w-2xl mb-12">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
        01 — Who it's for
      </p>
      <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-balance">
        {{ audience.header }}
      </h2>
      <p class="text-text-secondary text-lg mt-4">
        {{ audience.subheader }}
      </p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-text-primary/10 border border-text-primary/10 rounded-2xl overflow-hidden">
      <div
        v-for="(segment, index) in audience.segments"
        :key="segment.title"
        v-motion="segmentMotions[index]"
        class="group p-6 md:p-7 bg-white hover:bg-secondary/40 transition-colors duration-300"
      >
        <div class="size-9 mb-5 text-text-primary transition-all duration-300 group-hover:text-primary group-hover:scale-105">
          <BaseIcon collection="heroicons" :name="segment.icon" class="size-full" />
        </div>
        <h3 class="text-lg font-bold mb-2">
          {{ segment.title }}
        </h3>
        <p class="text-text-secondary text-sm leading-relaxed">
          {{ segment.description }}
        </p>
      </div>
    </div>
  </section>
</template>
