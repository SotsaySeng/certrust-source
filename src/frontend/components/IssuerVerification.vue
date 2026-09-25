<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// "Verified issuer" request (Terms s.7). The organisation gives its official
// domain and/or uploads official documents; a signed-up email on that
// domain proves domain control. A person at Certrust reviews and decides.
// Documents are private to Certrust staff and deleted 90 days after the
// decision (Privacy Policy s.9).
const MAX_MB = 5
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp'

const status = ref<any>(null)
const domain = ref('')
const message = ref('')
const documents = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const removing = ref<number | null>(null)
const errorMessage = ref('')
const submitted = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const isPending = computed(() => status.value?.verificationStatus === 'pending')
const canSubmit = computed(() => !!domain.value.trim() || documents.value.length > 0)

function apply(data: any) {
  status.value = data
  domain.value = data?.verificationDomain || ''
  message.value = data?.verificationMessage || ''
  documents.value = data?.documents || []
}

async function load() {
  try {
    const res = await apiClient.get<{ data: any }>('/api/trust/verification')
    apply(res.data)
  }
  catch {
    status.value = null
  }
  finally {
    loading.value = false
  }
}

async function onFilesChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files || [])
  input.value = ''
  if (!files.length) {
    return
  }
  errorMessage.value = ''

  const tooBig = files.find(f => f.size > MAX_MB * 1024 * 1024)
  if (tooBig) {
    errorMessage.value = `${tooBig.name} is larger than ${MAX_MB} MB.`
    return
  }

  const form = new FormData()
  for (const file of files) {
    form.append('files', file, file.name)
  }
  uploading.value = true
  try {
    const res = await apiClient.postForm<{ data: any[] }>('/api/trust/verification/documents', form)
    documents.value = res.data
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not upload the file'
  }
  finally {
    uploading.value = false
  }
}

async function removeDocument(doc: any) {
  removing.value = doc.id
  errorMessage.value = ''
  try {
    const res = await apiClient.delete<{ data: any[] }>(`/api/trust/verification/documents/${doc.id}`)
    documents.value = res.data
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not remove the file'
  }
  finally {
    removing.value = null
  }
}

async function submit() {
  saving.value = true
  errorMessage.value = ''
  submitted.value = false
  try {
    const res = await apiClient.post<{ data: any }>('/api/trust/verification', { domain: domain.value, message: message.value })
    apply(res.data)
    submitted.value = true
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not send the request'
  }
  finally {
    saving.value = false
  }
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

onMounted(load)
</script>

<template>
  <div v-if="!loading && status" class="bg-white/80 backdrop-blur-lg rounded-2xl p-6 shadow-lg" data-testid="issuer-verification">
    <h2 class="text-lg font-medium text-text-primary mb-2">
      Verified issuer
    </h2>

    <p v-if="status.verificationStatus === 'verified'" class="text-sm text-green-800">
      Your organisation is verified<template v-if="status.verificationDomain">
        for <strong>{{ status.verificationDomain }}</strong>
      </template>. Your credentials show the "Verified issuer" mark.
    </p>

    <p v-else-if="status.suspended" class="text-sm text-red-700">
      Your organisation is suspended pending review, so it cannot request verification right now. We will contact you by email.
    </p>

    <template v-else>
      <p class="text-sm text-text-secondary mb-4">
        People checking your credentials see a "Verified issuer" mark once we have confirmed your organisation is who it says it is.
        Send us your official website and documents that prove it; a person at Certrust reviews every request.
      </p>

      <p v-if="isPending" class="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" data-testid="verification-pending">
        <strong>Under review.</strong> We will email you when we have decided, usually within 5 business days.
        You can still add documents or update the details below.
      </p>
      <p v-else-if="status.verificationStatus === 'rejected'" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
        Your last request was not approved; we emailed you the reason. You can try again with more evidence.
      </p>

      <form class="space-y-5" @submit.prevent="submit">
        <div>
          <label for="verification-domain" class="block text-sm font-medium text-text-primary mb-1">Official website domain <span class="font-normal text-text-secondary">(if you have one)</span></label>
          <input id="verification-domain" v-model="domain" type="text" placeholder="example.edu" autocomplete="url" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <p class="mt-1 text-xs text-text-secondary">
            If you signed up with an email address on this domain, that already proves you control it.
            <template v-if="status.verificationDomain && status.verificationDomainProven && domain === status.verificationDomain">
              <span class="text-green-700">Proven for {{ status.verificationDomain }}.</span>
            </template>
          </p>
        </div>

        <div>
          <p class="block text-sm font-medium text-text-primary mb-1">
            Supporting documents
          </p>
          <p class="text-xs text-text-secondary mb-2">
            For example a business or school registration certificate, an accreditation or licence, or a letter on your letterhead authorising you to issue credentials.
            PDF, PNG, JPEG or WebP, up to {{ MAX_MB }} MB each. Please black out personal ID numbers.
            Only Certrust staff can see these files, and we delete them 90 days after deciding.
          </p>

          <ul v-if="documents.length" class="mb-2 divide-y divide-gray-100 rounded-lg border border-gray-200" data-testid="verification-documents">
            <li v-for="doc in documents" :key="doc.id" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span class="flex min-w-0 items-center gap-2">
                <span :class="doc.mimeType === 'application/pdf' ? 'i-heroicons-document-text' : 'i-heroicons-photo'" class="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                <span class="truncate">{{ doc.fileName }}</span>
                <span class="shrink-0 text-xs text-gray-400">{{ formatSize(doc.size) }}</span>
              </span>
              <button type="button" class="shrink-0 text-xs text-red-600 hover:underline disabled:opacity-50" :disabled="removing === doc.id" :aria-label="`Remove ${doc.fileName}`" @click="removeDocument(doc)">
                Remove
              </button>
            </li>
          </ul>

          <input ref="fileInput" type="file" multiple :accept="ACCEPT" class="sr-only" data-testid="verification-file-input" @change="onFilesChosen">
          <button type="button" class="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-text-primary hover:border-[#28A745] disabled:opacity-50" :disabled="uploading" @click="fileInput?.click()">
            <span class="i-heroicons-arrow-up-tray h-4 w-4" aria-hidden="true" />
            {{ uploading ? 'Uploading…' : documents.length ? 'Add more documents' : 'Upload documents' }}
          </button>
        </div>

        <div>
          <label for="verification-message" class="block text-sm font-medium text-text-primary mb-1">Anything we should know? <span class="font-normal text-text-secondary">(optional)</span></label>
          <textarea id="verification-message" v-model="message" rows="3" maxlength="2000" placeholder="For example, your role in the organisation, or where we can check your registration." class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" :disabled="saving || uploading || !canSubmit" class="rounded-lg bg-[#28A745] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {{ saving ? 'Sending…' : isPending ? 'Update request' : 'Submit for review' }}
          </button>
          <span v-if="!canSubmit" class="text-xs text-text-secondary">Add your domain or at least one document.</span>
          <span v-else-if="submitted" class="text-sm text-green-700" role="status">Sent. We'll be in touch.</span>
        </div>
      </form>
    </template>

    <p v-if="errorMessage" class="mt-3 text-sm text-red-600" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>
