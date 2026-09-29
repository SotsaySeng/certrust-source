<script setup lang="ts">
import type { AudienceContent } from '~/composables/useHomeContent'

const props = defineProps<{
  audience: AudienceContent
}>()

const { locale } = useI18n()

const revealVariants = useRevealMotion()
// Precomputed once (not called inline in the template) so v-motion gets a
// referentially stable object across re-renders — see pages/index.vue.
const headerMotion = revealVariants(0)
const segmentMotions = props.audience.segments.map((_, index) => revealVariants(index * 80))

// Same precompute-once rule as segmentMotions. `?? []` because audience.stats
// is null whenever the backend's threshold gate is shut, which is the normal
// state on a young install.
const statsHeadingMotion = revealVariants(0)
const statsMotions = (props.audience.stats?.items ?? []).map((_, index) => revealVariants(index * 80))

// A computed rather than a precomputed constant: locale is a ref, so the
// language switcher must re-group the thousands separators without a reload.
// Grouped integers, not abbreviations — below ~10,000 "1.2K" reads as less
// impressive than "1,247" and renders inconsistently across the six locales.
// Kept local for the same reason billing.vue and admin/revenue.vue each keep
// their own money()/pct(): one consumer, one expression, and the frontend has
// no ~/utils directory to promote it into yet.
const statItems = computed(() => (props.audience.stats?.items ?? []).map(item => ({
  ...item,
  display: new Intl.NumberFormat(locale.value).format(item.value),
})))
</script>

<template>
  <section class="mb-24 md:mb-32">
    <div v-motion="headerMotion" class="max-w-2xl" :class="audience.stats ? 'mb-10' : 'mb-12'">
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
    <!-- Live platform counts. Rendered only when the backend's threshold gate
         is open — audience.stats is null otherwise, so on a young or
         unreachable install this section renders exactly as it did before the
         strip existed. -->
    <div v-if="audience.stats && statItems.length" class="mb-12">
      <p
        v-if="audience.stats.heading"
        v-motion="statsHeadingMotion"
        class="font-mono text-[11px] uppercase tracking-[0.2em] text-text-secondary mb-4"
      >
        {{ audience.stats.heading }}
      </p>
      <dl class="grid grid-cols-2 sm:grid-cols-4 gap-px bg-text-primary/10 border border-text-primary/10 rounded-2xl overflow-hidden">
        <div
          v-for="(item, index) in statItems"
          :key="item.key"
          v-motion="statsMotions[index]"
          class="flex flex-col-reverse justify-end bg-secondary/40 px-5 py-6 sm:px-6 sm:py-7"
        >
          <!-- dt before dd in source order is required by the HTML spec;
               flex-col-reverse renders the number above its label without
               breaking that. justify-end packs to the main-END of the
               reversed axis, i.e. the TOP of the cell — without it the
               content is bottom-anchored and a label that wraps to two lines
               ("Credentials issued" at 375px) shoves its number out of line
               with its row neighbour. -->
          <dt class="font-mono text-[11px] uppercase tracking-[0.18em] text-text-secondary mt-2">
            {{ item.label }}
          </dt>
          <dd class="font-display text-3xl md:text-4xl font-bold tracking-tight tabular-nums">
            {{ item.display }}
          </dd>
        </div>
      </dl>
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
