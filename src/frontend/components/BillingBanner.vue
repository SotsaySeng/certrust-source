<script setup lang="ts">
/**
 * Trial / payment notice for the dashboard, driven by GET /api/billing/status's
 * `banner` (computed server-side, see api::billing statusFor()). Renders
 * nothing when there's nothing to say.
 */
import { apiClient } from '~/api/api-client'

const { t, locale } = useI18n()
const banner = ref<{ kind: string, daysLeft?: number | null, date?: string | null } | null>(null)

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}

const tone = computed(() => {
  const kind = banner.value?.kind
  if (kind === 'past_due' || (kind === 'trial_ending' && (banner.value?.daysLeft ?? 99) <= 1)) {
    return 'border-red-200 bg-red-50 text-red-900'
  }
  if (kind === 'trial_ending') {
    return 'border-amber-200 bg-amber-50 text-amber-900'
  }
  return 'border-gray-200 bg-gray-50 text-text-primary'
})

const message = computed(() => {
  const b = banner.value
  if (!b) {
    return ''
  }
  const params = { days: b.daysLeft ?? 0, date: formatDate(b.date) }
  if (b.kind === 'trial_ending') {
    if ((b.daysLeft ?? 0) <= 0) {
      return t('billing.banner.trialEndsToday')
    }
    return b.daysLeft === 1 ? t('billing.banner.trialEndsTomorrow') : t('billing.banner.trialEnding', params)
  }
  if (b.kind === 'past_due') {
    return t('billing.banner.pastDue', params)
  }
  if (b.kind === 'trial_ended') {
    return t('billing.banner.trialEnded')
  }
  if (b.kind === 'canceling') {
    return t('billing.banner.canceling', params)
  }
  return ''
})

onMounted(async () => {
  try {
    const status = await apiClient.getBillingStatus()
    banner.value = status?.banner ?? null
  }
  catch {
    banner.value = null
  }
})
</script>

<template>
  <div
    v-if="banner && message"
    class="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border px-4 py-3"
    :class="tone"
    role="status"
  >
    <div class="i-heroicons-credit-card w-5 h-5 flex-shrink-0" />
    <p class="text-sm flex-1">
      {{ message }}
    </p>
    <NuxtLink
      to="/billing"
      class="inline-flex items-center justify-center px-4 py-1.5 bg-[#28A745] text-black text-sm rounded-full hover:bg-[#28A745]/90 transition-colors whitespace-nowrap"
    >
      {{ banner.kind === 'past_due' ? t('billing.updatePayment') : t('billing.banner.cta') }}
    </NuxtLink>
  </div>
</template>
