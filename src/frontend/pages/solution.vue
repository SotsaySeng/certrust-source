<script setup lang="ts">
const pricing = await useSolutionContent()
// The homepage's "Works with your systems" cards (Sheets, Forms, the MCP
// connection, the API): what the paid plans connect to.
const { integrations } = await useHomeContent()
const pageDescription = ref('Certrust pricing: pay $0.20 per certificate for a single event, or choose a yearly plan. Recipients never pay to receive, share or check their certificates.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/solution`
})

useHead({
  title: 'Pricing',
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/solution` }
  ]
})
</script>

<template>
  <div class="relative">
    <div class="absolute inset-x-0 top-0 h-[480px] overflow-hidden pointer-events-none grain-overlay" aria-hidden="true">
      <div class="mesh-drift absolute -top-24 right-[-100px] w-[380px] h-[380px] rounded-full bg-primary/15 blur-3xl" />
      <div class="mesh-drift absolute top-20 left-[-80px] w-[320px] h-[320px] rounded-full bg-[#5FBE78]/20 blur-3xl" style="animation-delay: -9s;" />
    </div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-20">
      <HomePricing :pricing="pricing" />
      <div class="mt-24">
        <HomeIntegrations :integrations="integrations" eyebrow="Included in Year-round and Institution-wide" />
      </div>
    </div>
  </div>
</template>
