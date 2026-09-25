<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// "Verified issuer" request (Terms s.7). If the member asking signed up with
// an email on the organisation's domain, that proves domain control;
// otherwise we ask for official documents by email. A person decides.
const status = ref<any>(null)
const domain = ref('')
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const legal = LEGAL

async function load() {
  try {
    const res = await apiClient.get<{ data: any }>('/api/trust/verification')
    status.value = res.data
    domain.value = res.data?.verificationDomain || ''
  }
  catch {
    status.value = null
  }
  finally {
    loading.value = false
  }
}

async function request() {
  saving.value = true
  errorMessage.value = ''
  try {
    const res = await apiClient.post<{ data: any }>('/api/trust/verification', { domain: domain.value })
    status.value = res.data
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not send the request'
  }
  finally {
    saving.value = false
  }
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

    <template v-else>
      <p class="text-sm text-text-secondary mb-3">
        Verification shows people checking your credentials that we have confirmed your organisation controls its official domain.
      </p>
      <p v-if="status.verificationStatus === 'pending'" class="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Request received for <strong>{{ status.verificationDomain }}</strong>.
        <template v-if="status.verificationDomainProven">
          Your sign-up email is on this domain; we will review it shortly.
        </template>
        <template v-else>
          Please email official documents showing you act for this organisation to
          <a :href="`mailto:${legal.privacyEmail}`" class="underline">{{ legal.privacyEmail }}</a>, from an address on {{ status.verificationDomain }} if you can.
        </template>
      </p>
      <p v-if="status.verificationStatus === 'rejected'" class="mb-3 text-sm text-red-700">
        Your last request was not approved. You can try again with more evidence.
      </p>
      <form class="flex gap-2" @submit.prevent="request">
        <label for="verification-domain" class="sr-only">Official website domain</label>
        <input id="verification-domain" v-model="domain" type="text" required placeholder="example.edu" class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm">
        <button type="submit" :disabled="saving" class="rounded-lg bg-[#28A745] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {{ status.verificationStatus === 'pending' ? 'Update' : 'Request' }}
        </button>
      </form>
      <p v-if="errorMessage" class="mt-2 text-sm text-red-600">
        {{ errorMessage }}
      </p>
    </template>
  </div>
</template>
