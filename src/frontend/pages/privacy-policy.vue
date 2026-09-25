<script setup lang="ts">
const { privacyContent } = usePrivacyContent()

const pageDescription = `How ${LEGAL.product} collects, uses and protects personal data, and the rights you have.`

useSeoMeta({
  title: privacyContent.title,
  description: pageDescription,
  ogDescription: pageDescription,
  ogUrl: `${WEBSITE_URL}/privacy-policy`,
})

useHead({
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/privacy-policy` },
  ],
})
</script>

<template>
  <LegalDocument :doc="privacyContent" />
</template>
