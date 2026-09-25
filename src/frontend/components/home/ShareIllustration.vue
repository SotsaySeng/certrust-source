<script setup lang="ts">
import Share from '~/assets/svg/share.vue'

defineProps<{
  imageUrl?: string
}>()
</script>

<template>
  <div class="relative mr-8">
    <!-- Thin ring, not a filled blob - restrained atmosphere behind the illustration -->
    <div class="absolute right-0 top-0 w-4/5 h-4/5 rounded-full border border-primary/20" aria-hidden="true" />
    <div class="relative">
      <img v-if="imageUrl" :src="imageUrl" alt="" class="w-full h-auto">
      <Share v-else />
    </div>
  </div>
</template>
