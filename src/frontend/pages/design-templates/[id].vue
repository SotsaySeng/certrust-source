<script setup lang="ts">
/** The Design Studio editor for one design (or a read-only system template). */
definePageMeta({
  middleware: ['auth'],
  layout: 'studio',
})

const route = useRoute()
const { t } = useI18n()
const store = useDesignStudioStore()

useHead({
  title: computed(() => store.meta?.name ? `${store.meta.name} · ${t('designStudio.title')}` : t('designStudio.title')),
  meta: [{ name: 'robots', content: 'noindex' }],
})
</script>

<template>
  <DesignStudioEditor :template-id="String(route.params.id)" />
</template>
