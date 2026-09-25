<script setup lang="ts">
import Graduation from '~/assets/svg/graduation.vue'

defineProps<{
  imageUrl?: string
}>()
</script>

<template>
  <div class="relative">
    <!-- Thin ring, not a filled blob - restrained atmosphere behind the illustration -->
    <div class="absolute inset-4 rounded-full border border-primary/20" aria-hidden="true" />

    <!-- Illustration - admin-uploaded image if set, otherwise the built-in illustration -->
    <div class="relative">
      <img v-if="imageUrl" :src="imageUrl" alt="" class="w-full h-auto">
      <Graduation v-else />
    </div>
  </div>
</template>
