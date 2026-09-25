<script setup lang="ts">
import type { PricingContent } from '~/composables/useSolutionContent'

const props = defineProps<{
  pricing: PricingContent
}>()

const revealVariants = useRevealMotion()
const hoverLift = useHoverLift(8, 1.015)
// Precomputed once (not called inline in the template) so v-motion gets a
// referentially stable object across re-renders — see pages/index.vue.
const headerMotion = revealVariants(0)
const tierMotions = props.pricing.tiers.map((_, index) => ({
  ...revealVariants(index * 120, 'visibleOnce', 'scale-in'),
  ...hoverLift,
}))

const TIER_ICONS: Record<string, string> = {
  free: 'rocket-launch',
  pro: 'sparkles',
  enterprise: 'building-library',
}
</script>

<template>
  <section class="mb-16 md:mb-20">
    <div v-motion="headerMotion" class="text-center max-w-2xl mx-auto mb-12">
      <h2 class="text-3xl md:text-4xl font-bold mb-4 text-balance">
        {{ pricing.header }}
      </h2>
      <p class="text-text-secondary text-lg">
        {{ pricing.subheader }}
      </p>
    </div>
    <div class="grid md:grid-cols-3 gap-6 items-stretch">
      <div
        v-for="(tier, index) in pricing.tiers"
        :key="tier.id"
        v-motion="tierMotions[index]"
        class="rounded-2xl p-8 border flex flex-col transition-shadow duration-300"
        :class="tier.highlighted
          ? 'bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 relative overflow-hidden shadow-xl shadow-primary/15 hover:shadow-2xl hover:shadow-primary/25'
          : 'bg-white border-gray-100 shadow-lg hover:shadow-xl hover:shadow-primary/10'"
      >
        <div
          v-if="tier.highlighted"
          class="absolute top-3 right-3 px-3 py-1 bg-primary text-black text-sm rounded-full overflow-hidden"
        >
          <span class="relative z-10">{{ pricing.mostPopularLabel }}</span>
          <span class="shimmer-sweep absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" aria-hidden="true" />
        </div>

        <div class="size-11 mb-4 rounded-xl flex items-center justify-center" :class="tier.highlighted ? 'bg-primary text-black' : 'bg-secondary text-primary'">
          <BaseIcon collection="heroicons" :name="TIER_ICONS[tier.id] || 'sparkles'" class="size-5" />
        </div>

        <h3 class="text-2xl font-bold mb-1">
          {{ tier.name }}
        </h3>
        <p class="text-text-secondary text-sm mb-4">
          {{ tier.tagline }}
        </p>
        <div class="text-3xl font-bold mb-6">
          {{ tier.price }}
        </div>
        <ul class="space-y-3 mb-6 text-sm">
          <li class="flex items-center gap-2">
            <BaseIcon collection="heroicons" name="check" class="size-4 text-primary shrink-0" />
            <span><strong>{{ tier.limits.credentials }}</strong> {{ pricing.limitLabels.credentials }}</span>
          </li>
          <li class="flex items-center gap-2">
            <BaseIcon collection="heroicons" name="check" class="size-4 text-primary shrink-0" />
            <span><strong>{{ tier.limits.designTemplates }}</strong> {{ pricing.limitLabels.designTemplates }}</span>
          </li>
          <li class="flex items-center gap-2">
            <BaseIcon collection="heroicons" name="check" class="size-4 text-primary shrink-0" />
            <span><strong>{{ tier.limits.achievements }}</strong> {{ pricing.limitLabels.achievements }}</span>
          </li>
          <li v-for="feature in tier.features" :key="feature" class="flex items-center gap-2">
            <BaseIcon collection="heroicons" name="check-circle" class="size-4 text-primary shrink-0" />
            <span>{{ feature }}</span>
          </li>
        </ul>
        <div class="grow" />
        <NuxtLink
          :to="tier.ctaHref"
          class="block w-full py-3 px-4 text-center rounded-full bg-primary text-black font-medium transition-all hover:bg-primary/90 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/30"
        >
          {{ tier.ctaLabel }}
        </NuxtLink>
        <p v-if="tier.note" class="text-xs text-text-secondary text-center mt-3">
          {{ tier.note }}
        </p>
      </div>
    </div>
  </section>
</template>
