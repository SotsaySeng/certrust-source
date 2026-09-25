<script setup lang="ts">
import Csv from '~/assets/svg/csv.vue'

defineProps<{
  imageUrl?: string
}>()
</script>

<template>
  <div class="relative">
    <!-- Thin ring, not a filled blob - restrained atmosphere behind the illustration -->
    <div class="absolute right-0 top-0 w-4/5 h-4/5 rounded-full border border-primary/20" aria-hidden="true" />

    <!-- CSV Illustration - admin-uploaded image if set, otherwise the built-in illustration -->
    <div class="relative">
      <img v-if="imageUrl" :src="imageUrl" alt="" class="w-full h-auto">
      <Csv v-else />
    </div>
  </div>
</template>
