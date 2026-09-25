<script setup lang="ts">
const { dpaContent } = useDpaContent()

const pageDescription = `The data processing agreement that applies to every ${LEGAL.product} customer.`

useSeoMeta({
  title: dpaContent.title,
  description: pageDescription,
  ogDescription: pageDescription,
  ogUrl: `${WEBSITE_URL}/data-processing-agreement`,
})

useHead({
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/data-processing-agreement` },
  ],
})
</script>

<template>
  <LegalDocument :doc="dpaContent" />
</template>
