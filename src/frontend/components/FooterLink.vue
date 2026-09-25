<script setup lang="ts">
// Not relying on attribute fallthrough for sizing: this component has two
// possible root nodes (the v-if/v-else below), and Vue doesn't know which
// one to merge a parent-passed `class` onto in that case - it's silently
// dropped instead. An explicit prop sidesteps that entirely.
const props = withDefaults(defineProps<{
  label: string
  url: string
  small?: boolean
}>(), {
  small: false,
})

const linkClass = computed(() => [
  'text-text-secondary hover:text-text-primary transition-colors',
  { 'text-sm': props.small },
])
</script>

<template>
  <NuxtLink
    v-if="url.startsWith('/')"
    :to="url"
    :class="linkClass"
  >
    {{ label }}
  </NuxtLink>
  <a
    v-else
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
    :class="linkClass"
  >
    {{ label }}
  </a>
</template>
