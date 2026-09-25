<script setup lang="ts">
import type { CardFeature } from '~/composables/useHomeContent'

defineProps<{
  feature: CardFeature
}>()
</script>

<template>
  <NCard
    :key="feature.title"
    class="group bg-white hover:bg-secondary/40 transition-colors duration-300 p-6 md:p-7 rounded-none"
  >
    <div class="text-text-primary mb-5 size-9 transition-all duration-300 group-hover:text-primary group-hover:scale-105">
      <BaseIcon collection="heroicons" :name="feature.icon" class="size-full" />
    </div>
    <h3 class="text-xl font-bold mb-2">
      {{ feature.title }}
    </h3>
    <p class="text-text-secondary leading-relaxed">
      {{ feature.description }}
    </p>
  </NCard>
</template>
