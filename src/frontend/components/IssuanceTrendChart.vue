<script setup lang="ts">
/**
 * Hand-rolled CSS bar chart for the dashboard's issuance-over-time stat.
 * Deliberately no chart library dependency (chart.js/vue-chartjs etc.) -
 * matches this codebase's existing preference for small hand-rolled
 * Tailwind UI over the underused Una UI. 12 monthly buckets, oldest first,
 * from GET /api/dashboard/stats' issuanceByMonth.
 */

interface MonthlyIssuance {
  month: string
  count: number
}

const props = defineProps({
  data: {
    type: Array as () => MonthlyIssuance[],
    default: () => []
  }
})

const { t, locale } = useI18n()

const maxCount = computed(() => {
  const max = Math.max(0, ...props.data.map(point => point.count))
  return max > 0 ? max : 1
})

const hasAnyIssuances = computed(() => props.data.some(point => point.count > 0))

function barHeightPercent(count: number): number {
  // A real zero-count month still gets a thin visible baseline instead of
  // disappearing entirely, so the axis reads as continuous.
  if (count <= 0) {
    return 2
  }
  return Math.max(4, Math.round((count / maxCount.value) * 100))
}

function formatMonthLabel(month: string): string {
  const [year, monthNum] = month.split('-').map(Number)
  if (!year || !monthNum) {
    return month
  }
  const date = new Date(year, monthNum - 1, 1)
  // Explicit app locale, not the browser's own - otherwise month
  // abbreviations silently ignore the language switcher (found live while
  // cycling locales: German showed "Sep Oct Nov..." unchanged).
  return date.toLocaleDateString(locale.value, { month: 'short' })
}
</script>

<template>
  <div>
    <div v-if="!data.length" class="text-sm text-text-secondary text-center py-6">
      {{ t('dashboard.analytics.chartEmpty') }}
    </div>
    <template v-else>
      <div class="flex items-end gap-1.5 sm:gap-2 h-36">
        <div
          v-for="point in data"
          :key="point.month"
          class="flex-1 flex flex-col items-center justify-end h-full group"
        >
          <span class="text-[10px] text-text-secondary mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {{ point.count }}
          </span>
          <div
            class="w-full rounded-t transition-all"
            :class="point.count > 0 ? 'bg-[#28A745]' : 'bg-gray-200'"
            :style="{ height: `${barHeightPercent(point.count)}%` }"
            :title="`${point.month}: ${point.count}`"
          />
        </div>
      </div>
      <div class="flex gap-1.5 sm:gap-2 mt-2">
        <div v-for="point in data" :key="point.month" class="flex-1 text-center">
          <span class="text-[10px] text-text-secondary">{{ formatMonthLabel(point.month) }}</span>
        </div>
      </div>
      <p v-if="!hasAnyIssuances" class="text-xs text-text-secondary text-center mt-3">
        {{ t('dashboard.analytics.chartNoIssuances') }}
      </p>
    </template>
  </div>
</template>
