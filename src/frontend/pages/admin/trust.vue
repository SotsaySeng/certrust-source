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
const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-900',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

// Evidence is private: fetched with the session and shown from a blob URL,
// never linked directly. Open the tab first so the popup blocker allows it.
async function viewDocument(doc: any) {
  const tab = window.open('', '_blank')
  busy.value = `d${doc.id}`
  try {
    const blob = await apiClient.getBlob(`/api/trust/admin/verification-documents/${doc.id}`)
    const url = URL.createObjectURL(blob)
    if (tab) {
      tab.location.href = url
    }
    else {
      const a = document.createElement('a')
      a.href = url
      a.download = doc.fileName
      a.click()
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  catch (err: any) {
    tab?.close()
    error.value = err?.message || 'Could not open the document'
  }
  finally {
    busy.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen py-12">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold mb-2">
        Trust &amp; safety
      </h1>
      <p class="text-gray-600 mb-8">
        Acknowledge reports within 2 business days and decide within 5 (Terms s.7). Every decision, and every document opened, is audit-logged.
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
                  <span class="ml-2 rounded-full px-2 py-0.5 text-xs" :class="STATUS_CLASS[org.verificationStatus] || 'bg-gray-100'">{{ org.verificationStatus }}</span>
                  <span v-if="org.suspended" class="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">suspended</span>
                </p>
                <p class="text-sm text-gray-600 mt-1">
                  Domain: <strong>{{ org.verificationDomain || '–' }}</strong>
                  <template v-if="org.verificationDomain">
                    · {{ org.verificationDomainProven ? 'proven: the requester signed up with an email on this domain' : 'not proven by email - rely on the documents' }}
                  </template>
                </p>
                <p class="text-sm text-gray-500">
                  Requested {{ formatDate(org.verificationRequestedAt) }} · Members: {{ org.members.join(', ') }}
                </p>
                <p v-if="org.verificationMessage" class="mt-2 whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
                  <span class="block text-xs font-medium text-gray-500 mb-1">Message from the organisation</span>{{ org.verificationMessage }}
                </p>
                <div class="mt-2 text-sm" data-testid="trust-org-documents">
                  <p v-if="!org.documents?.length" class="text-gray-500">
                    No documents uploaded.
                  </p>
                  <ul v-else class="flex flex-wrap gap-2">
                    <li v-for="doc in org.documents" :key="doc.id">
                      <button type="button" class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50 disabled:opacity-50" :disabled="busy === `d${doc.id}`" :title="`Uploaded ${formatDate(doc.createdAt)}${doc.uploadedByEmail ? ` by ${doc.uploadedByEmail}` : ''}`" @click="viewDocument(doc)">
                        <span :class="doc.mimeType === 'application/pdf' ? 'i-heroicons-document-text' : 'i-heroicons-photo'" class="h-4 w-4 text-gray-500" aria-hidden="true" />
                        {{ doc.fileName }}
                        <span class="text-xs text-gray-400">{{ formatSize(doc.size) }}</span>
                      </button>
                    </li>
                  </ul>
                  <p v-if="org.documents?.some((d: any) => d.purgeAfter)" class="mt-1 text-xs text-gray-400">
                    Scheduled for deletion {{ formatDate(org.documents.find((d: any) => d.purgeAfter).purgeAfter) }} (90 days after the decision).
                  </p>
                </div>
                <p v-if="org.verificationNote" class="mt-2 text-sm text-gray-500">
                  Decision note: {{ org.verificationNote }}
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
