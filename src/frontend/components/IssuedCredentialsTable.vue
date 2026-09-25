<script setup lang="ts">
import { apiClient } from '~/api/api-client'

/**
 * The organisation's issued credentials as a compact, searchable table
 * (one row per credential) instead of one large card each: an issuer with a
 * few hundred recipients needs to find a person, not scroll past pictures.
 * Search matches recipient name/email, achievement name and credential id;
 * filtering, sorting (newest first) and paging are all client-side, since
 * /api/profiles/:id/issued-credentials returns the full list.
 */

const props = defineProps<{
  credentials: any[]
}>()

const { t, locale } = useI18n()
const toast = useSimpleToast()

type StatusFilter = 'all' | 'active' | 'expired' | 'revoked'
const PAGE_SIZE = 20

const query = ref('')
const statusFilter = ref<StatusFilter>('all')
const page = ref(1)

function statusOf(cred: any): Exclude<StatusFilter, 'all'> {
  if (cred.revoked) {
    return 'revoked'
  }
  const expiry = cred.expirationDate ? new Date(cred.expirationDate).getTime() : Number.NaN
  if (!Number.isNaN(expiry) && expiry < Date.now()) {
    return 'expired'
  }
  return 'active'
}

const STATUS_CLASSES: Record<Exclude<StatusFilter, 'all'>, string> = {
  active: 'bg-[#28A745]/10 text-[#1e7e34]',
  expired: 'bg-amber-100 text-amber-700',
  revoked: 'bg-red-100 text-red-700',
}

const rows = computed(() => props.credentials
  .map(cred => ({
    id: cred.id,
    credentialId: cred.credentialId || cred.id,
    recipientName: cred.recipient?.name || '',
    recipientEmail: cred.recipient?.email || '',
    achievementName: cred.achievement?.name || cred.name || '',
    templateType: cred.achievement?.templateType || null,
    issuedAt: cred.issuanceDate || cred.issuedOn || cred.createdAt || '',
    status: statusOf(cred),
  }))
  .sort((a, b) => (new Date(b.issuedAt).getTime() || 0) - (new Date(a.issuedAt).getTime() || 0)))

const counts = computed(() => {
  const c = { all: rows.value.length, active: 0, expired: 0, revoked: 0 }
  for (const row of rows.value) {
    c[row.status]++
  }
  return c
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return rows.value.filter((row) => {
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) {
      return false
    }
    if (!q) {
      return true
    }
    return [row.recipientName, row.recipientEmail, row.achievementName, String(row.credentialId)]
      .some(value => value.toLowerCase().includes(q))
  })
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const rangeStart = computed(() => filtered.value.length ? (page.value - 1) * PAGE_SIZE + 1 : 0)
const rangeEnd = computed(() => Math.min(page.value * PAGE_SIZE, filtered.value.length))

watch([query, statusFilter], () => {
  page.value = 1
})

function formatDate(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleDateString(locale.value, { year: 'numeric', month: 'short', day: 'numeric' })
}

function credentialPath(row: { credentialId: string | number }) {
  return `/credentials/${encodeURIComponent(String(row.credentialId))}`
}

async function copyLink(row: { credentialId: string | number }) {
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${credentialPath(row)}`)
    toast.show(t('dashboard.issuedTable.copied'), '', 'success')
  }
  catch (error) {
    console.error('Error copying credential link:', error)
    toast.show(t('dashboard.issuedTable.copyFailed'), '', 'error')
  }
}

async function downloadCertificate(row: { id: string | number, achievementName: string, recipientName: string }) {
  try {
    await downloadImageFile(
      apiClient.getCertificateUrl(row.id),
      [row.achievementName, row.recipientName].filter(Boolean).join(' - ') || 'certificate',
    )
  }
  catch (error) {
    console.error('Error downloading certificate:', error)
    toast.show(t('dashboard.issuedTable.downloadFailed'), '', 'error')
  }
}

const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'expired', 'revoked']

function statusLabel(status: StatusFilter) {
  return status === 'all' ? t('dashboard.issuedTable.all') : t(`credential.${status}`)
}
</script>

<template>
  <div class="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden">
    <!-- Search + status filter -->
    <div class="flex flex-col gap-3 p-4 border-b border-gray-100 md:flex-row md:items-center md:justify-between">
      <label class="relative block md:w-80">
        <span class="sr-only">{{ t('dashboard.issuedTable.search') }}</span>
        <span class="i-heroicons-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          :placeholder="t('dashboard.issuedTable.search')"
          class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#28A745] focus:border-transparent"
          data-testid="issued-search"
        >
      </label>
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('dashboard.issuedTable.status')">
        <button
          v-for="status in STATUS_FILTERS"
          :key="status"
          type="button"
          class="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors"
          :class="statusFilter === status
            ? 'bg-[#28A745] border-[#28A745] text-white'
            : 'bg-white border-gray-200 text-text-secondary hover:border-[#28A745]/50'"
          :aria-pressed="statusFilter === status"
          @click="statusFilter = status"
        >
          {{ statusLabel(status) }}
          <span class="ml-1 opacity-75">{{ counts[status] }}</span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 text-left text-xs uppercase tracking-wide text-text-secondary">
          <tr>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('dashboard.issuedTable.recipient') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium hidden md:table-cell">
              {{ t('dashboard.issuedTable.achievement') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium hidden sm:table-cell whitespace-nowrap">
              {{ t('dashboard.issuedTable.issued') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium">
              {{ t('dashboard.issuedTable.status') }}
            </th>
            <th scope="col" class="px-4 py-3 font-medium text-right">
              <span class="sr-only">{{ t('dashboard.issuedTable.actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="row in pageRows" :key="row.id" class="hover:bg-gray-50/80" data-testid="issued-row">
            <td class="px-4 py-3 align-top">
              <div class="font-medium text-text-primary">
                {{ row.recipientName || '-' }}
              </div>
              <div class="text-xs text-text-secondary break-all">
                {{ row.recipientEmail }}
              </div>
              <!-- Achievement and date fold under the name on small screens -->
              <div class="mt-1 text-xs text-text-secondary md:hidden">
                {{ row.achievementName }}<span class="sm:hidden"> · {{ formatDate(row.issuedAt) }}</span>
              </div>
            </td>
            <td class="px-4 py-3 align-top hidden md:table-cell">
              <div class="text-text-primary">
                {{ row.achievementName || '-' }}
              </div>
              <div v-if="row.templateType" class="text-xs text-text-secondary">
                {{ t(`issue.templateTypes.${row.templateType}`) }}
              </div>
            </td>
            <td class="px-4 py-3 align-top hidden sm:table-cell whitespace-nowrap text-text-secondary">
              {{ formatDate(row.issuedAt) }}
            </td>
            <td class="px-4 py-3 align-top">
              <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium" :class="STATUS_CLASSES[row.status]">
                {{ t(`credential.${row.status}`) }}
              </span>
            </td>
            <td class="px-4 py-3 align-top">
              <div class="flex items-center justify-end gap-1">
                <NuxtLink
                  :to="credentialPath(row)"
                  target="_blank"
                  class="p-2 rounded-lg text-gray-500 hover:text-[#1e7e34] hover:bg-[#28A745]/10 transition-colors"
                  :title="t('dashboard.issuedTable.view')"
                  :aria-label="t('dashboard.issuedTable.view')"
                >
                  <span class="block i-heroicons-eye w-5 h-5" />
                </NuxtLink>
                <button
                  type="button"
                  class="p-2 rounded-lg text-gray-500 hover:text-[#1e7e34] hover:bg-[#28A745]/10 transition-colors"
                  :title="t('credential.copyLink')"
                  :aria-label="t('credential.copyLink')"
                  @click="copyLink(row)"
                >
                  <span class="block i-heroicons-link w-5 h-5" />
                </button>
                <button
                  type="button"
                  class="p-2 rounded-lg text-gray-500 hover:text-[#1e7e34] hover:bg-[#28A745]/10 transition-colors hidden sm:block"
                  :title="t('dashboard.issuedTable.download')"
                  :aria-label="t('dashboard.issuedTable.download')"
                  @click="downloadCertificate(row)"
                >
                  <span class="block i-heroicons-arrow-down-tray w-5 h-5" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="!pageRows.length">
            <td colspan="5" class="px-4 py-10 text-center text-text-secondary">
              {{ t('dashboard.issuedTable.noMatches') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer: range + paging -->
    <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 text-sm text-text-secondary">
      <span>{{ t('dashboard.issuedTable.showing', { from: rangeStart, to: rangeEnd, total: filtered.length }) }}</span>
      <div v-if="pageCount > 1" class="flex items-center gap-2">
        <button
          type="button"
          class="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          :disabled="page === 1"
          @click="page--"
        >
          {{ t('dashboard.issuedTable.previous') }}
        </button>
        <span>{{ page }} / {{ pageCount }}</span>
        <button
          type="button"
          class="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
          :disabled="page === pageCount"
          @click="page++"
        >
          {{ t('dashboard.issuedTable.next') }}
        </button>
      </div>
    </div>
  </div>
</template>
