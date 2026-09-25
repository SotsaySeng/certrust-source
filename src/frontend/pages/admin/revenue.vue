<script setup lang="ts">
/**
 * Platform revenue dashboard - Platform Admin role only (route-guarded in
 * middleware/auth.ts, enforced server-side by global::is-platform-admin).
 * Data: GET /api/billing/admin/metrics?year= and /api/billing/admin/orgs,
 * computed from the Stripe-webhook payment ledger (api::payment).
 *
 * Charts are hand-rolled HTML bars like components/IssuanceTrendChart.vue
 * (no chart library). Single series each, so no legend; hover shows the
 * exact value and a table view gives the numbers without the chart.
 */
import { apiClient } from '~/api/api-client'

const { t, locale } = useI18n()

definePageMeta({
  middleware: ['auth']
})

useHead({ title: t('revenue.title') })

const year = ref(new Date().getUTCFullYear())
const metrics = ref<any>(null)
const orgs = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const statusFilter = ref<string>('all')
const showMonthlyTable = ref(false)
const hoverMonth = ref<number | null>(null)
const hoverYear = ref<number | null>(null)
const exporting = ref(false)

const STATUSES = ['all', 'active', 'trialing', 'past_due', 'canceled', 'none']

function money(cents: number | null | undefined, compact = false) {
  if (cents == null) {
    return '–'
  }
  return new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'USD',
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : (cents % 100 === 0 ? 0 : 2),
  }).format(cents / 100)
}

function pct(value: number | null | undefined) {
  return value == null ? '–' : new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(value)
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' }) : '–'
}

function monthLabel(i: number) {
  return new Date(Date.UTC(2000, i, 1)).toLocaleDateString(locale.value, { month: 'short', timeZone: 'UTC' })
}

/** A "nice" axis max so the top gridline is a round number. */
function niceMax(values: number[]) {
  const max = Math.max(0, ...values)
  if (max === 0) {
    return 100
  }
  const mag = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].find(s => s * mag >= max) ?? 10
  return step * mag
}

const monthMax = computed(() => niceMax(metrics.value?.revenueByMonth ?? []))
const yearMax = computed(() => niceMax((metrics.value?.revenueByYear ?? []).map((r: any) => r.amount)))

function barHeight(value: number, max: number) {
  if (value <= 0) {
    return '0%'
  }
  return `${Math.max(1.5, (value / max) * 100)}%`
}

const tiles = computed(() => {
  const m = metrics.value
  if (!m) {
    return []
  }
  return [
    { key: 'mrr', value: money(m.mrr), sub: t('revenue.tiles.arr', { amount: money(m.arr) }) },
    { key: 'yearRevenue', value: money(m.revenueThisYear), sub: t('revenue.tiles.allTime', { amount: money(m.revenueAllTime) }), label: t('revenue.tiles.yearRevenue', { year: m.year }) },
    { key: 'activeSubs', value: m.activeSubscriptions, sub: t('revenue.tiles.pastDue', { count: m.pastDue }) },
    { key: 'trials', value: m.activeTrials, sub: t('revenue.tiles.endingSoon', { count: m.trialsEndingSoon }) },
    { key: 'conversion', value: pct(m.trialConversionRate), sub: t('revenue.tiles.converted', { converted: m.trialsConverted, total: m.trialsFinished }) },
    { key: 'churn', value: pct(m.churnRate), sub: t('revenue.tiles.canceled', { count: m.canceledThisYear, year: m.year }) },
  ]
})

const filteredOrgs = computed(() =>
  statusFilter.value === 'all' ? orgs.value : orgs.value.filter(o => o.subscriptionStatus === statusFilter.value)
)

/** A paid tier granted by hand in Strapi admin, with no subscription behind it. */
function isManual(o: any) {
  return o.subscriptionStatus === 'none' && o.tier !== 'free'
}

const statusChip: Record<string, string> = {
  trialing: 'bg-amber-100 text-amber-800',
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  canceled: 'bg-gray-100 text-gray-700',
  none: 'bg-gray-100 text-gray-700',
}

async function loadMetrics() {
  metrics.value = await apiClient.getRevenueMetrics(year.value)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [, o] = await Promise.all([loadMetrics(), apiClient.getBillingOrgs()])
    orgs.value = o?.data ?? []
  }
  catch (err) {
    console.error('Error loading revenue:', err)
    error.value = t('revenue.loadError')
  }
  finally {
    loading.value = false
  }
}

watch(year, async () => {
  try {
    await loadMetrics()
  }
  catch {
    error.value = t('revenue.loadError')
  }
})

async function exportCsv() {
  exporting.value = true
  try {
    const blob = await apiClient.downloadBillingCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `certrust-billing-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  finally {
    exporting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-white to-[#D9F2DE]/20 py-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 class="text-4xl font-bold text-text-primary">
            {{ t('revenue.title') }}
          </h1>
          <p class="mt-2 text-text-secondary">
            {{ t('revenue.subtitle') }}
          </p>
        </div>
        <label v-if="metrics" class="flex items-center gap-2 text-sm text-text-secondary">
          {{ t('revenue.year') }}
          <select v-model.number="year" class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-text-primary">
            <option v-for="y in metrics.availableYears" :key="y" :value="y">{{ y }}</option>
          </select>
        </label>
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

      <template v-else-if="metrics">
        <!-- KPI tiles -->
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div v-for="tile in tiles" :key="tile.key" class="bg-white/80 backdrop-blur-lg rounded-2xl p-4 shadow-lg min-w-0">
            <p class="text-xs uppercase tracking-wide text-text-secondary truncate">
              {{ tile.label || t(`revenue.tiles.${tile.key}`) }}
            </p>
            <p class="mt-1 text-2xl font-semibold text-text-primary tabular-nums truncate">
              {{ tile.value }}
            </p>
            <p class="mt-1 text-xs text-text-secondary truncate" :title="tile.sub">
              {{ tile.sub }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <!-- Monthly revenue -->
          <section class="lg:col-span-2 bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg min-w-0">
            <div class="flex items-center justify-between gap-4 mb-4">
              <h2 class="text-lg font-semibold text-text-primary">
                {{ t('revenue.monthlyTitle', { year: metrics.year }) }}
              </h2>
              <button type="button" class="text-sm text-[#1B7A34] hover:underline" @click="showMonthlyTable = !showMonthlyTable">
                {{ showMonthlyTable ? t('revenue.showChart') : t('revenue.showTable') }}
              </button>
            </div>

            <table v-if="showMonthlyTable" class="w-full text-sm">
              <thead>
                <tr class="text-left text-text-secondary border-b border-gray-200">
                  <th class="py-2 font-medium">
                    {{ t('revenue.month') }}
                  </th>
                  <th class="py-2 font-medium text-right">
                    {{ t('revenue.revenue') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(v, i) in metrics.revenueByMonth" :key="i" class="border-b border-gray-100">
                  <td class="py-1.5">
                    {{ monthLabel(i) }}
                  </td>
                  <td class="py-1.5 text-right tabular-nums">
                    {{ money(v) }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div v-else class="flex gap-3">
              <!-- y axis -->
              <div class="flex flex-col justify-between h-48 text-[11px] text-text-secondary tabular-nums text-right pb-5">
                <span>{{ money(monthMax, true) }}</span>
                <span>{{ money(monthMax / 2, true) }}</span>
                <span>{{ money(0, true) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="relative h-43 border-b border-gray-300">
                  <div class="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
                  <div class="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
                  <div class="absolute inset-0 flex items-end">
                    <div
                      v-for="(v, i) in metrics.revenueByMonth"
                      :key="i"
                      class="relative flex-1 h-full flex items-end justify-center cursor-default"
                      @mouseenter="hoverMonth = i"
                      @mouseleave="hoverMonth = null"
                    >
                      <div
                        class="w-full max-w-6 rounded-t bg-[#28A745] transition-opacity"
                        :class="hoverMonth !== null && hoverMonth !== i ? 'opacity-50' : ''"
                        :style="{ height: barHeight(v, monthMax) }"
                      />
                      <div
                        v-if="hoverMonth === i"
                        class="absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow"
                        :class="i > 8 ? 'right-0' : i < 3 ? 'left-0' : 'left-1/2 -translate-x-1/2'"
                      >
                        {{ monthLabel(i) }} {{ metrics.year }} · {{ money(v) }}
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex mt-1">
                  <span v-for="(_, i) in metrics.revenueByMonth" :key="i" class="flex-1 text-center text-[11px] text-text-secondary">{{ monthLabel(i) }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Revenue by year -->
          <section class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg min-w-0">
            <h2 class="text-lg font-semibold text-text-primary mb-4">
              {{ t('revenue.yearlyTitle') }}
            </h2>
            <p v-if="!metrics.revenueByYear.length" class="text-sm text-text-secondary py-8 text-center">
              {{ t('revenue.noPayments') }}
            </p>
            <div v-else class="space-y-3">
              <div
                v-for="row in metrics.revenueByYear"
                :key="row.year"
                class="flex items-center gap-3"
                @mouseenter="hoverYear = row.year"
                @mouseleave="hoverYear = null"
              >
                <span class="w-10 text-sm text-text-secondary tabular-nums">{{ row.year }}</span>
                <div class="flex-1 h-6 flex items-center">
                  <div
                    class="h-5 rounded-r bg-[#28A745] transition-opacity"
                    :class="hoverYear !== null && hoverYear !== row.year ? 'opacity-50' : ''"
                    :style="{ width: barHeight(row.amount, yearMax) }"
                  />
                </div>
                <span class="text-sm text-text-primary tabular-nums whitespace-nowrap">{{ money(row.amount) }}</span>
              </div>
            </div>

            <h3 class="text-sm font-semibold text-text-primary mt-8 mb-2">
              {{ t('revenue.subsByPlan') }}
            </h3>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-text-secondary border-b border-gray-200">
                  <th class="py-1.5 font-medium" />
                  <th class="py-1.5 font-medium text-right">
                    {{ t('revenue.monthly') }}
                  </th>
                  <th class="py-1.5 font-medium text-right">
                    {{ t('revenue.yearly') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tier in ['pro', 'enterprise']" :key="tier" class="border-b border-gray-100">
                  <td class="py-1.5">
                    {{ t(`billing.tier.${tier}`) }}
                  </td>
                  <td class="py-1.5 text-right tabular-nums">
                    {{ metrics.subsByPlan[tier].month }}
                  </td>
                  <td class="py-1.5 text-right tabular-nums">
                    {{ metrics.subsByPlan[tier].year }}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        <!-- Organizations -->
        <section class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 class="text-lg font-semibold text-text-primary">
              {{ t('revenue.orgsTitle') }} <span class="text-text-secondary font-normal">({{ filteredOrgs.length }})</span>
            </h2>
            <div class="flex flex-wrap items-center gap-3">
              <select v-model="statusFilter" class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm" :aria-label="t('revenue.filterStatus')">
                <option v-for="s in STATUSES" :key="s" :value="s">
                  {{ s === 'all' ? t('revenue.allStatuses') : t(`billing.status.${s}`) }}
                </option>
              </select>
              <button
                type="button"
                :disabled="exporting"
                class="inline-flex items-center px-4 py-1.5 border border-gray-300 rounded-full text-sm hover:bg-gray-50 disabled:opacity-50"
                @click="exportCsv"
              >
                <div class="i-heroicons-arrow-down-tray w-4 h-4 mr-2" />
                {{ t('revenue.exportCsv') }}
              </button>
            </div>
          </div>
          <div class="overflow-x-auto -mx-6 px-6">
            <table class="w-full text-sm min-w-[720px]">
              <thead>
                <tr class="text-left text-text-secondary border-b border-gray-200">
                  <th class="py-2 pr-4 font-medium">
                    {{ t('revenue.col.org') }}
                  </th>
                  <th class="py-2 pr-4 font-medium">
                    {{ t('revenue.col.plan') }}
                  </th>
                  <th class="py-2 pr-4 font-medium">
                    {{ t('revenue.col.status') }}
                  </th>
                  <th class="py-2 pr-4 font-medium">
                    {{ t('revenue.col.nextDate') }}
                  </th>
                  <th class="py-2 pr-4 font-medium text-right">
                    {{ t('revenue.col.totalPaid') }}
                  </th>
                  <th class="py-2 font-medium">
                    {{ t('revenue.col.lastPayment') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!filteredOrgs.length">
                  <td colspan="6" class="py-6 text-center text-text-secondary">
                    {{ t('common.noResults') }}
                  </td>
                </tr>
                <tr v-for="o in filteredOrgs" :key="o.documentId" class="border-b border-gray-100">
                  <td class="py-2 pr-4 font-medium text-text-primary">
                    {{ o.name }}
                  </td>
                  <td class="py-2 pr-4">
                    {{ t(`billing.tier.${o.tier}`) }}<span v-if="o.billingInterval && o.tier !== 'free'" class="text-text-secondary"> · {{ t(`billing.interval.${o.billingInterval}`) }}</span>
                  </td>
                  <td class="py-2 pr-4">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="isManual(o) ? 'bg-violet-100 text-violet-800' : (statusChip[o.subscriptionStatus] || statusChip.none)">
                      {{ isManual(o) ? t('billing.status.manual') : t(`billing.status.${o.subscriptionStatus}`) }}
                    </span>
                    <span v-if="o.cancelAtPeriodEnd" class="ml-1 text-xs text-text-secondary">{{ t('revenue.canceling') }}</span>
                  </td>
                  <td class="py-2 pr-4 tabular-nums">
                    {{ o.subscriptionStatus === 'trialing' ? formatDate(o.trialEndsAt) : formatDate(o.currentPeriodEnd) }}
                  </td>
                  <td class="py-2 pr-4 text-right tabular-nums">
                    {{ money(o.totalPaid) }}
                  </td>
                  <td class="py-2 tabular-nums">
                    {{ formatDate(o.lastPaymentAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
