<script setup lang="ts">
/**
 * Trust & safety - Platform Admin only (route-guarded by middleware/auth.ts,
 * enforced server-side by global::is-platform-admin). Issuer verification
 * requests, organisation suspension, and reports from /report (Terms s.7:
 * acknowledge within 2 business days, decide within 5).
 */
import { apiClient } from '~/api/api-client'

definePageMeta({
  middleware: ['auth'],
})

useHead({ title: 'Trust & safety' })

const orgs = ref<any[]>([])
const reports = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref<string | null>(null)
const notes = reactive<Record<string, string>>({})

async function load() {
  loading.value = true
  error.value = null
  try {
    const [v, r] = await Promise.all([
      apiClient.get<{ data: any[] }>('/api/trust/admin/verifications'),
      apiClient.get<{ data: any[] }>('/api/trust/admin/reports'),
    ])
    orgs.value = v.data
    reports.value = r.data
  }
  catch (err: any) {
    error.value = err?.message || 'Failed to load'
  }
  finally {
    loading.value = false
  }
}

async function act(key: string, fn: () => Promise<unknown>) {
  busy.value = key
  try {
    await fn()
    await load()
  }
  catch (err: any) {
    error.value = err?.message || 'Action failed'
  }
  finally {
    busy.value = null
  }
}

const decide = (org: any, status: 'verified' | 'rejected' | 'unverified') =>
  act(`v${org.id}`, () => apiClient.post(`/api/trust/admin/organizations/${org.id}/verification`, { status, note: notes[`v${org.id}`] || '' }))

const suspend = (org: any, suspended: boolean) =>
  act(`s${org.id}`, () => apiClient.post(`/api/trust/admin/organizations/${org.id}/suspension`, { suspended, reason: notes[`v${org.id}`] || '' }))

const updateReport = (report: any, status: string) =>
  act(`r${report.id}`, () => apiClient.post(`/api/trust/admin/reports/${report.id}`, { status, resolution: notes[`r${report.id}`] || report.resolution || '' }))

const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '–'

onMounted(load)
</script>

<template>
  <div class="min-h-screen py-12">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-2">
        Trust &amp; safety
      </h1>
      <p class="text-gray-600 mb-8">
        Acknowledge reports within 2 business days and decide within 5 (Terms s.7). Every decision here is audit-logged.
      </p>

      <p v-if="error" class="mb-6 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ error }}
      </p>
      <p v-if="loading" class="text-gray-500">
        Loading…
      </p>

      <template v-else>
        <section class="mb-12">
          <h2 class="text-xl font-semibold mb-4">
            Issuer verification
          </h2>
          <p v-if="!orgs.length" class="text-gray-500">
            No verification requests.
          </p>
          <div v-for="org in orgs" :key="org.id" class="mb-4 rounded-xl border border-gray-200 bg-white p-5" data-testid="trust-org">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p class="font-semibold">
                  {{ org.name }}
                  <span class="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{{ org.verificationStatus }}</span>
                  <span v-if="org.suspended" class="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">suspended</span>
                </p>
                <p class="text-sm text-gray-600 mt-1">
                  Domain: <strong>{{ org.verificationDomain || '–' }}</strong>
                  · {{ org.verificationDomainProven ? 'a member signed up with an email on this domain' : 'no email on this domain - ask for official documents' }}
                </p>
                <p class="text-sm text-gray-500">
                  Requested {{ formatDate(org.verificationRequestedAt) }} · Members: {{ org.members.join(', ') }}
                </p>
                <p v-if="org.verificationNote" class="text-sm text-gray-500">
                  Note: {{ org.verificationNote }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white disabled:opacity-50" :disabled="busy === `v${org.id}`" @click="decide(org, 'verified')">
                  Verify
                </button>
                <button class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50" :disabled="busy === `v${org.id}`" @click="decide(org, 'rejected')">
                  Reject
                </button>
                <button v-if="!org.suspended" class="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50" :disabled="busy === `s${org.id}`" @click="suspend(org, true)">
                  Suspend
                </button>
                <button v-else class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50" :disabled="busy === `s${org.id}`" @click="suspend(org, false)">
                  Lift suspension
                </button>
              </div>
            </div>
            <input v-model="notes[`v${org.id}`]" type="text" placeholder="Note or reason (sent to the organisation when rejecting)" class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          </div>
        </section>

        <section>
          <h2 class="text-xl font-semibold mb-4">
            Reports
          </h2>
          <p v-if="!reports.length" class="text-gray-500">
            No reports.
          </p>
          <div v-for="report in reports" :key="report.id" class="mb-4 rounded-xl border border-gray-200 bg-white p-5" data-testid="trust-report">
            <div class="flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <p class="font-semibold">
                  #{{ report.id }} · {{ report.category }}
                  <span class="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs">{{ report.status }}</span>
                </p>
                <p class="text-sm text-gray-500">
                  {{ formatDate(report.createdAt) }} · {{ report.reporterName || 'anonymous' }} &lt;{{ report.reporterEmail }}&gt;
                </p>
                <p v-if="report.targetUrl" class="text-sm break-all">
                  <a :href="report.targetUrl" target="_blank" rel="noopener" class="underline">{{ report.targetUrl }}</a>
                </p>
                <p class="mt-2 whitespace-pre-line text-sm text-gray-800">
                  {{ report.details }}
                </p>
                <p v-if="report.resolution" class="mt-2 text-sm text-gray-600">
                  Resolution: {{ report.resolution }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button v-for="s in ['acknowledged', 'actioned', 'dismissed']" :key="s" class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50" :disabled="busy === `r${report.id}` || report.status === s" @click="updateReport(report, s)">
                  {{ s }}
                </button>
              </div>
            </div>
            <input v-model="notes[`r${report.id}`]" type="text" placeholder="Resolution note" class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
