<script setup lang="ts">
/**
 * The organization's own billing page: current plan + trial/renewal state,
 * Stripe Checkout for Pro/Enterprise (monthly or yearly), and the Stripe
 * Customer Portal for card/plan changes and cancellation.
 */
import { apiClient } from '~/api/api-client'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

definePageMeta({
  middleware: ['auth']
})

useHead({ title: t('billing.title') })

type Tier = 'pro' | 'enterprise'
type Interval = 'month' | 'year'

const status = ref<any>(null)
const plans = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const actionError = ref<string | null>(null)
const busy = ref<string | null>(null)
const interval = ref<Interval>('year')
const checkoutResult = ref<string | null>(null)

const PAID_TIERS: Tier[] = ['pro', 'enterprise']

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}

function formatMoney(cents: number | null | undefined, currency = 'usd') {
  if (cents == null) {
    return null
  }
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
}

function planFor(tier: Tier, iv: Interval) {
  return plans.value.find(p => p.tier === tier && p.interval === iv)
}

/** "Save 17%" on yearly, from the real Stripe prices. */
function yearlySavings(tier: Tier): number | null {
  const m = planFor(tier, 'month')?.amount
  const y = planFor(tier, 'year')?.amount
  if (!m || !y) {
    return null
  }
  const pct = Math.round((1 - y / (m * 12)) * 100)
  return pct > 0 ? pct : null
}

const stripeReady = computed(() => status.value?.stripeConfigured)

const statusChip = computed(() => {
  switch (status.value?.subscriptionStatus) {
    case 'trialing': return 'bg-amber-100 text-amber-800'
    case 'active': return 'bg-green-100 text-green-800'
    case 'past_due': return 'bg-red-100 text-red-800'
    case 'canceled': return 'bg-gray-100 text-gray-700'
    default: return 'bg-gray-100 text-gray-700'
  }
})

const statusLabel = computed(() => {
  const s = status.value
  if (!s) {
    return ''
  }
  if (s.isManualPlan) {
    return t('billing.status.manual')
  }
  return t(`billing.status.${s.subscriptionStatus || 'none'}`)
})

const planDetail = computed(() => {
  const s = status.value
  if (!s) {
    return ''
  }
  if (s.subscriptionStatus === 'trialing' && s.trialEndsAt) {
    return s.isLocalTrial
      ? t('billing.detail.trialLocal', { date: formatDate(s.trialEndsAt), days: s.trialDaysLeft ?? 0 })
      : t('billing.detail.trialCard', { date: formatDate(s.trialEndsAt) })
  }
  if (s.subscriptionStatus === 'active' && s.currentPeriodEnd) {
    return s.cancelAtPeriodEnd
      ? t('billing.detail.cancels', { date: formatDate(s.currentPeriodEnd) })
      : t('billing.detail.renews', { date: formatDate(s.currentPeriodEnd), interval: t(`billing.interval.${s.billingInterval || 'month'}`) })
  }
  if (s.subscriptionStatus === 'past_due') {
    return t('billing.detail.pastDue')
  }
  if (s.isManualPlan) {
    return t('billing.detail.manual')
  }
  return t('billing.detail.free')
})

function isCurrent(tier: Tier) {
  const s = status.value
  return s?.hasSubscription && s.billedTier === tier && s.billingInterval === interval.value
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [s, p] = await Promise.all([apiClient.getBillingStatus(), apiClient.getBillingPlans()])
    status.value = s
    plans.value = p?.plans ?? []
    if (s?.billingInterval) {
      interval.value = s.billingInterval
    }
  }
  catch (err) {
    console.error('Error loading billing:', err)
    error.value = t('billing.loadError')
  }
  finally {
    loading.value = false
  }
}

async function choose(tier: Tier) {
  actionError.value = null
  // Already subscribed: plan switches happen in the Stripe portal (proration etc.).
  if (status.value?.hasSubscription) {
    return manage()
  }
  busy.value = tier
  try {
    const { url } = await apiClient.startCheckout(tier, interval.value)
    window.location.href = url
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : t('billing.actionError')
    busy.value = null
  }
}

async function manage() {
  actionError.value = null
  busy.value = 'portal'
  try {
    const { url } = await apiClient.openBillingPortal()
    window.location.href = url
  }
  catch (err) {
    actionError.value = err instanceof Error ? err.message : t('billing.actionError')
    busy.value = null
  }
}

onMounted(async () => {
  const result = route.query.checkout
  if (result === 'success' || result === 'cancel') {
    checkoutResult.value = result
    router.replace({ query: {} })
  }
  await load()
  // The webhook usually lands a second or two after Stripe redirects back.
  if (checkoutResult.value === 'success' && !status.value?.hasSubscription) {
    setTimeout(load, 3000)
  }
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-text-primary">
          {{ t('billing.title') }}
        </h1>
        <p class="mt-2 text-text-secondary">
          {{ t('billing.subtitle') }}
        </p>
      </div>

      <div v-if="checkoutResult === 'success'" class="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
        {{ t('billing.checkoutSuccess') }}
      </div>
      <div v-else-if="checkoutResult === 'cancel'" class="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-text-secondary">
        {{ t('billing.checkoutCanceled') }}
      </div>

      <div v-if="loading" class="flex justify-center items-center py-12">
        <div class="w-8 h-8 border-4 border-[#28A745] border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800">
          {{ error }}
        </p>
        <button class="mt-2 text-sm text-red-600 hover:text-red-800" @click="load">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <template v-else-if="status">
        <!-- Current plan -->
        <section class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg mb-8">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-sm text-text-secondary mb-1">
                {{ t('billing.currentPlan') }} · {{ status.organization?.name }}
              </p>
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="text-2xl font-semibold text-text-primary">
                  {{ t(`billing.tier.${status.tier}`) }}
                </h2>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium" :class="statusChip">
                  {{ statusLabel }}
                </span>
              </div>
              <p class="mt-2 text-text-secondary">
                {{ planDetail }}
              </p>
            </div>
            <button
              v-if="status.canManageBilling && stripeReady"
              type="button"
              :disabled="busy !== null"
              class="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-text-primary rounded-full hover:bg-gray-50 disabled:opacity-50 whitespace-nowrap"
              @click="manage"
            >
              <div class="i-heroicons-credit-card w-5 h-5 mr-2" />
              {{ busy === 'portal' ? t('common.loading') : t('billing.manage') }}
            </button>
          </div>
        </section>

        <!-- Plans -->
        <section>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 class="text-xl font-semibold text-text-primary">
              {{ status.hasSubscription ? t('billing.changePlan') : t('billing.choosePlan') }}
            </h2>
            <div class="inline-flex rounded-full bg-gray-100 p-1 self-start" role="group" :aria-label="t('billing.intervalLabel')">
              <button
                v-for="iv in (['month', 'year'] as const)"
                :key="iv"
                type="button"
                class="px-4 py-1.5 text-sm rounded-full transition-colors"
                :class="interval === iv ? 'bg-white shadow text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'"
                :aria-pressed="interval === iv"
                @click="interval = iv"
              >
                {{ t(`billing.toggle.${iv}`) }}
              </button>
            </div>
          </div>

          <div v-if="!stripeReady" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {{ t('billing.notConfigured') }}
          </div>
          <p v-if="actionError" class="mb-4 text-sm text-red-600" role="alert">
            {{ actionError }}
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              v-for="tier in PAID_TIERS"
              :key="tier"
              class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg flex flex-col"
              :class="isCurrent(tier) ? 'ring-2 ring-[#28A745]' : ''"
            >
              <div class="flex items-center justify-between gap-2 mb-2">
                <h3 class="text-lg font-semibold text-text-primary">
                  {{ t(`billing.tier.${tier}`) }}
                </h3>
                <span v-if="interval === 'year' && yearlySavings(tier)" class="text-xs font-medium text-green-800 bg-green-100 rounded-full px-2 py-0.5">
                  {{ t('billing.save', { pct: yearlySavings(tier) }) }}
                </span>
              </div>
              <p class="text-sm text-text-secondary mb-4">
                {{ t(`billing.tierBlurb.${tier}`) }}
              </p>
              <p class="mb-6">
                <template v-if="planFor(tier, interval)?.amount != null">
                  <span class="text-3xl font-bold text-text-primary">{{ formatMoney(planFor(tier, interval).amount, planFor(tier, interval).currency) }}</span>
                  <span class="text-text-secondary"> / {{ t(`billing.interval.${interval}`) }}</span>
                </template>
                <span v-else class="text-text-secondary">{{ t('billing.priceUnavailable') }}</span>
              </p>
              <button
                type="button"
                :disabled="!stripeReady || !planFor(tier, interval)?.available || busy !== null || isCurrent(tier)"
                class="mt-auto inline-flex items-center justify-center px-4 py-2 bg-[#28A745] text-black rounded-full hover:bg-[#28A745]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="choose(tier)"
              >
                <template v-if="busy === tier">
                  {{ t('common.loading') }}
                </template>
                <template v-else-if="isCurrent(tier)">
                  {{ t('billing.current') }}
                </template>
                <template v-else-if="status.hasSubscription">
                  {{ t('billing.switchTo', { plan: t(`billing.tier.${tier}`) }) }}
                </template>
                <template v-else>
                  {{ t('billing.choose', { plan: t(`billing.tier.${tier}`) }) }}
                </template>
              </button>
            </div>
          </div>

          <p class="mt-6 text-sm text-text-secondary">
            {{ t('billing.footnote') }}
            <NuxtLink to="/solution" class="text-[#1B7A34] underline underline-offset-2">
              {{ t('billing.compare') }}
            </NuxtLink>
          </p>
        </section>
      </template>
    </div>
  </div>
</template>
