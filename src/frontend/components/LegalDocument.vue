<script setup lang="ts">
import { format } from '@formkit/tempo'

// Renders the Terms, Privacy Policy and DPA. Section content is static,
// trusted HTML from constants/legal.ts-based composables, hence v-html.
const props = defineProps<{ doc: LegalDocument }>()

const lastUpdated = computed(() => format(props.doc.lastUpdated, 'long'))
</script>

<template>
  <div class="min-h-screen py-16">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold mb-3">
        {{ doc.title }}
      </h1>
      <p class="text-gray-500 mb-6">
        Last updated: {{ lastUpdated }}
      </p>
      <p class="text-lg text-gray-700 mb-10">
        {{ doc.summary }}
      </p>

      <nav aria-label="Contents" class="mb-12 rounded-lg border border-gray-200 bg-gray-50 p-5">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Contents
        </h2>
        <ol class="grid gap-1 sm:grid-cols-2 text-sm">
          <li v-for="section in doc.sections" :key="section.id">
            <a :href="`#${section.id}`" class="text-gray-700 hover:text-[#28A745] hover:underline">{{ section.title }}</a>
          </li>
        </ol>
      </nav>

      <div class="legal-body space-y-10">
        <section v-for="section in doc.sections" :id="section.id" :key="section.id" class="scroll-mt-24">
          <h2 class="text-xl font-semibold mb-3">
            {{ section.title }}
          </h2>
          <p v-for="(p, i) in section.paragraphs" :key="`p${i}`" class="mb-3 leading-relaxed text-gray-800" v-html="p" />
          <ul v-if="section.items?.length" class="list-disc pl-6 space-y-2 mb-3 text-gray-800">
            <li v-for="(item, i) in section.items" :key="`i${i}`" class="leading-relaxed" v-html="item" />
          </ul>
          <p v-for="(p, i) in section.after" :key="`a${i}`" class="mb-3 leading-relaxed text-gray-800" v-html="p" />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.legal-body :deep(a) {
  color: #1f7a34;
  text-decoration: underline;
  overflow-wrap: anywhere;
}
.legal-body :deep(code) {
  font-size: 0.9em;
  background: #f3f4f6;
  padding: 0 0.25em;
  border-radius: 3px;
}
</style>
