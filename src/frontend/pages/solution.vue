<script setup lang="ts">
const pricing = await useSolutionContent()
const pageDescription = ref('Plans and pricing for issuing Open Badges 3.0 and W3C Verifiable Credentials with Certrust.')

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/solution`
})

useHead({
  title: 'Solution',
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
    </div>
  </div>
</template>
