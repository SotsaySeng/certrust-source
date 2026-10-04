<script setup lang="ts">
import type { IntegrationsContent } from '~/composables/useHomeContent'

const props = defineProps<{
  integrations: IntegrationsContent
}>()

const revealVariants = useRevealMotion()
// Precomputed once so v-motion gets a referentially stable object across
// re-renders - see pages/index.vue.
const headerMotion = revealVariants(0)
const itemMotions = props.integrations.items.map((_, index) => revealVariants(index * 80))

const isExternal = (url: string) => /^https?:\/\//.test(url)
</script>

<template>
  <section v-if="integrations.items.length" class="mb-24 md:mb-32" data-testid="home-integrations">
    <div v-motion="headerMotion" class="max-w-2xl mb-12">
      <p class="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
        04 — Works with your systems
      </p>
      <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-balance">
        {{ integrations.header }}
      </h2>
      <p class="text-text-secondary text-lg mt-4">
        {{ integrations.subheader }}
      </p>
    </div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-text-primary/10 border border-text-primary/10 rounded-2xl overflow-hidden">
      <NuxtLink
        v-for="(item, index) in integrations.items"
        :key="item.url"
        v-motion="itemMotions[index]"
        :to="item.url"
        :target="isExternal(item.url) ? '_blank' : undefined"
        class="group flex flex-col p-6 md:p-7 bg-white hover:bg-secondary/40 transition-colors duration-300"
        data-testid="home-integration"
      >
        <div class="size-9 mb-5 text-text-primary transition-all duration-300 group-hover:text-primary group-hover:scale-105">
          <BaseIcon collection="heroicons" :name="item.icon" class="size-full" />
        </div>
        <p v-if="item.tag" class="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary mb-2">
          {{ item.tag }}
        </p>
        <h3 class="text-lg font-bold mb-2">
          {{ item.title }}
        </h3>
        <p class="text-text-secondary text-sm leading-relaxed flex-1">
          {{ item.description }}
        </p>
        <span class="mt-5 inline-flex items-center text-sm font-medium text-text-primary">
          Open the manual
          <span class="i-heroicons-arrow-right ml-1.5 w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </NuxtLink>
    </div>
    <NuxtLink
      v-if="integrations.linkLabel"
      to="/integrations"
      class="group mt-8 inline-flex items-center font-medium text-text-primary hover:text-primary transition-colors"
    >
      {{ integrations.linkLabel }}
      <span class="i-heroicons-arrow-right ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
    </NuxtLink>
  </section>
</template>
