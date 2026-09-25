<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// Takedown / abuse channel promised in the Terms (s.7): impersonation,
// false credentials, privacy problems. Goes to the privacy inbox.
const route = useRoute()
const legal = LEGAL

const form = reactive({
  category: '',
  targetUrl: typeof route.query.target === 'string' ? route.query.target : '',
  details: '',
  reporterName: '',
  reporterEmail: '',
  website: '', // honeypot, hidden from people
})
const submitting = ref(false)
const errorMessage = ref('')
const reference = ref<number | null>(null)

const categories = [
  { value: 'impersonation', label: 'Someone is impersonating an institution or organisation' },
  { value: 'false-credential', label: 'A credential is false or was issued in error' },
  { value: 'privacy', label: 'A privacy problem (my personal data, a credential about me)' },
  { value: 'other', label: 'Something else' },
]

async function submit() {
  errorMessage.value = ''
  submitting.value = true
  try {
    const response = await apiClient.post<{ data: { received: boolean, reference?: number } }>('/api/trust/reports', { ...form })
    reference.value = response?.data?.reference ?? 0
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not send the report. Please email us instead.'
  }
  finally {
    submitting.value = false
  }
}

useSeoMeta({
  title: 'Report a problem',
  description: 'Report a false or impersonating credential, or a privacy problem, to the Certrust trust & safety team.',
})
</script>

<template>
  <div class="min-h-screen py-16">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold mb-3">
        Report a problem
      </h1>
      <p class="text-lg text-gray-700 mb-8">
        Tell us about a credential or account that impersonates an institution, a credential that is false, or a privacy problem.
        We acknowledge reports within 2 business days and aim to decide within 5. You can also email
        <a :href="`mailto:${legal.privacyEmail}`" class="underline">{{ legal.privacyEmail }}</a>.
      </p>

      <div v-if="reference !== null" class="rounded-2xl border border-green-200 bg-green-50 p-6" role="status">
        <p class="font-semibold text-green-900">
          Thank you - we have received your report<template v-if="reference">
            (reference #{{ reference }})
          </template>.
        </p>
        <p class="mt-2 text-green-900">
          We have emailed you a confirmation and will reply to that address.
        </p>
      </div>

      <form v-else class="space-y-5" @submit.prevent="submit">
        <div>
          <label for="category" class="block text-sm font-medium mb-1">What are you reporting?</label>
          <select id="category" v-model="form.category" required class="w-full rounded-lg border border-gray-300 px-3 py-2">
            <option value="" disabled>
              Choose one
            </option>
            <option v-for="c in categories" :key="c.value" :value="c.value">
              {{ c.label }}
            </option>
          </select>
        </div>
        <div>
          <label for="targetUrl" class="block text-sm font-medium mb-1">Link to the credential or organisation (if any)</label>
          <input id="targetUrl" v-model="form.targetUrl" type="url" maxlength="500" placeholder="https://certrust.app/credentials/..." class="w-full rounded-lg border border-gray-300 px-3 py-2">
        </div>
        <div>
          <label for="details" class="block text-sm font-medium mb-1">What is wrong?</label>
          <textarea id="details" v-model="form.details" required minlength="10" maxlength="5000" rows="6" class="w-full rounded-lg border border-gray-300 px-3 py-2" />
        </div>
        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="reporterName" class="block text-sm font-medium mb-1">Your name (optional)</label>
            <input id="reporterName" v-model="form.reporterName" type="text" maxlength="200" autocomplete="name" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          </div>
          <div>
            <label for="reporterEmail" class="block text-sm font-medium mb-1">Your email</label>
            <input id="reporterEmail" v-model="form.reporterEmail" type="email" required autocomplete="email" class="w-full rounded-lg border border-gray-300 px-3 py-2">
          </div>
        </div>
        <div class="hidden" aria-hidden="true">
          <label for="website">Website</label>
          <input id="website" v-model="form.website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <p class="text-sm text-gray-500">
          We use these details only to handle your report, as described in our
          <NuxtLink to="/privacy-policy" class="underline">
            Privacy Policy
          </NuxtLink>.
        </p>
        <p v-if="errorMessage" class="text-sm text-red-600" role="alert">
          {{ errorMessage }}
        </p>
        <button type="submit" :disabled="submitting" class="rounded-lg bg-[#28A745] px-5 py-2.5 font-medium text-white hover:bg-[#28A745]/90 disabled:opacity-50">
          {{ submitting ? 'Sending…' : 'Send report' }}
        </button>
      </form>
    </div>
  </div>
</template>
