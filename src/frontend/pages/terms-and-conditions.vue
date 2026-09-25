<script setup lang="ts">
const { termsContent } = useTermsContent()

const pageDescription = `The terms that apply when you use ${LEGAL.product}, operated by ${LEGAL.company}.`

useSeoMeta({
  title: termsContent.title,
  description: pageDescription,
  ogDescription: pageDescription,
  ogUrl: `${WEBSITE_URL}/terms-and-conditions`,
})

useHead({
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/terms-and-conditions` },
  ],
})
</script>

<template>
  <LegalDocument :doc="termsContent" />
</template>
