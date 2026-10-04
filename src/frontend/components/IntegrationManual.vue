<script setup lang="ts">
// Shared layout for the step-by-step integration manuals under
// /integrations (Google Sheets, Google Forms, student records). The page
// supplies the content as plain HTML in the default slot; the typography
// for headings, lists, tables, code and notes lives here.
defineProps<{
  /** Shown after "Integrations ·" above the title */
  section: string
  title: string
}>()
</script>

<template>
  <div class="min-h-screen">
    <section class="py-16">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 manual">
        <p class="text-sm font-medium uppercase tracking-wide text-[#1f7a34] mb-3">
          <NuxtLink to="/integrations" class="hover:underline">
            Integrations
          </NuxtLink>
          · {{ section }}
        </p>
        <h1 class="text-4xl font-bold text-gray-900 mb-4">
          {{ title }}
        </h1>
        <slot />
      </div>
    </section>
  </div>
</template>

<style scoped>
.manual :deep(.lead) {
  font-size: 1.125rem;
  color: #4b5563;
  line-height: 1.7;
}
.manual :deep(section) {
  margin-top: 3rem;
}
.manual :deep(h2) {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.75rem;
}
.manual :deep(h3) {
  font-size: 1.125rem;
  font-weight: 700;
  color: #111827;
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
.manual :deep(section p),
.manual :deep(li) {
  color: #4b5563;
  line-height: 1.7;
}
.manual :deep(section p) {
  margin-top: 0.75rem;
}
.manual :deep(ol) {
  list-style: decimal;
  padding-left: 1.5rem;
}
.manual :deep(ul) {
  list-style: disc;
  padding-left: 1.5rem;
}
.manual :deep(li + li) {
  margin-top: 0.5rem;
}
.manual :deep(section a) {
  color: #1f7a34;
  text-decoration: underline;
}
.manual :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875em;
  background: #f3f4f6;
  border-radius: 0.25rem;
  padding: 0.1rem 0.3rem;
}
.manual :deep(pre) {
  overflow-x: auto;
  background: #111827;
  color: #f3f4f6;
  border-radius: 0.75rem;
  padding: 1rem;
  font-size: 0.8rem;
  line-height: 1.6;
  margin-top: 0.75rem;
}
.manual :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: inherit;
}
.manual :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  margin-top: 0.75rem;
}
.manual :deep(th) {
  text-align: left;
  font-weight: 600;
  color: #111827;
  border-bottom: 2px solid #e5e7eb;
  padding: 0.5rem 0.75rem 0.5rem 0;
}
.manual :deep(td) {
  border-bottom: 1px solid #f3f4f6;
  padding: 0.6rem 0.75rem 0.6rem 0;
  color: #4b5563;
  vertical-align: top;
}
.manual :deep(.note) {
  margin-top: 1rem;
  border-left: 4px solid #28a745;
  background: rgba(217, 242, 222, 0.4);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  color: #374151;
  line-height: 1.6;
}
</style>
