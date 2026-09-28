<script setup lang="ts">
const props = defineProps<{ reason: 'limit' | 'premium' }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const resources = useStudioResourcesStore()
const limits = computed(() => resources.limits)
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" role="dialog" aria-modal="true">
        <div class="bg-gradient-to-br from-[#28A745] to-[#1B7A34] px-6 py-5 text-white">
          <div :class="props.reason === 'premium' ? 'i-heroicons-sparkles' : 'i-heroicons-rectangle-stack'" class="mb-2 h-8 w-8" />
          <h2 class="text-lg font-semibold">
            {{ props.reason === 'premium' ? t('designStudio.upgrade.premiumTitle') : t('designStudio.upgrade.limitTitle') }}
          </h2>
        </div>
        <div class="space-y-3 p-6 text-sm text-gray-700">
          <p v-if="props.reason === 'premium'">
            {{ t('designStudio.upgrade.premiumBody') }}
          </p>
          <p v-else>
            {{ t('designStudio.upgrade.limitBody', { used: limits?.used ?? 0, limit: limits?.limit ?? 0 }) }}
          </p>
          <p v-if="limits?.trialing" class="rounded-lg bg-amber-50 p-3 text-amber-900">
            {{ t('designStudio.upgrade.trialNote') }}
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button class="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50" @click="emit('close')">
              {{ t('designStudio.upgrade.notNow') }}
            </button>
            <NuxtLink to="/billing" class="rounded-lg bg-[#28A745] px-4 py-2 font-semibold text-black hover:bg-[#28A745]/90">
              {{ t('designStudio.upgrade.cta') }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
