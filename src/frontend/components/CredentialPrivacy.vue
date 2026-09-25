<script setup lang="ts">
import { apiClient } from '~/api/api-client'

// Private credentials show visitors only that a valid credential exists and
// who issued it. The recipient (or issuer) sees everything, plus the switch.
const props = defineProps<{
  credentialId: string
  visibility: 'public' | 'private'
  issuedToMinor?: boolean
  canManage: boolean
  issuerName?: string
  issuanceDate?: string
}>()
const emit = defineEmits<{ changed: [visibility: 'public' | 'private'] }>()

const saving = ref(false)
const errorMessage = ref('')

const issuedOn = computed(() => props.issuanceDate ? new Date(props.issuanceDate).toLocaleDateString(undefined, { dateStyle: 'long' }) : '')

async function setVisibility(visibility: 'public' | 'private') {
  saving.value = true
  errorMessage.value = ''
  try {
    await apiClient.put(`/api/credentials/${encodeURIComponent(props.credentialId)}/visibility`, { visibility })
    emit('changed', visibility)
  }
  catch (err: any) {
    errorMessage.value = err?.message || 'Could not change the visibility'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="canManage" class="mb-8 rounded-2xl border border-gray-200 bg-white/80 p-5 text-sm" data-testid="credential-privacy-control">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="font-semibold text-gray-900">
          {{ visibility === 'private' ? 'This credential is private' : 'This credential is public' }}
        </p>
        <p class="text-gray-600 mt-1">
          <template v-if="visibility === 'private'">
            Visitors to this link see only that a valid credential was issued by {{ issuerName || 'the issuer' }}. Your name and the details are hidden.
          </template>
          <template v-else>
            Anyone with this link can see your name and the credential details. It is not listed in search engines.
          </template>
          <template v-if="issuedToMinor">
            It was issued to a minor, so it started as private.
          </template>
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 disabled:opacity-50"
        :disabled="saving"
        @click="setVisibility(visibility === 'private' ? 'public' : 'private')"
      >
        {{ saving ? 'Saving…' : visibility === 'private' ? 'Make public' : 'Make private' }}
      </button>
    </div>
    <p v-if="errorMessage" class="mt-2 text-red-600">
      {{ errorMessage }}
    </p>
  </div>

  <div v-else-if="visibility === 'private'" class="mb-8 rounded-2xl border border-gray-200 bg-white/80 p-6 text-center" data-testid="credential-private-notice">
    <span class="i-lucide-lock mx-auto mb-3 block h-8 w-8 text-gray-500" aria-hidden="true" />
    <p class="text-lg font-semibold text-gray-900">
      Private credential
    </p>
    <p class="mt-2 text-gray-600">
      A valid credential was issued by <strong>{{ issuerName || 'the issuer' }}</strong><template v-if="issuedOn">
        on {{ issuedOn }}
      </template>.
      Its holder has chosen to keep the details private. Ask them for the signed credential file to verify the details.
    </p>
  </div>
</template>
