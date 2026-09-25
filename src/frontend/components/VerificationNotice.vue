<script setup lang="ts">
// Shown on every verification result. Employers and other verifiers are not
// party to our Terms, so what a check does - and does not - confirm has to
// be stated where they rely on it (Terms s.5).
const props = defineProps<{
  issuer?: { name?: string, active?: boolean, suspended?: boolean, verificationStatus?: string } | null
  credentialId: string
}>()

const verifiedIssuer = computed(() => props.issuer?.verificationStatus === 'verified')
const reportLink = computed(() => `/report?target=${encodeURIComponent(`${WEBSITE_URL}/credentials/${encodeURIComponent(props.credentialId)}`)}`)
</script>

<template>
  <div class="mb-8 rounded-2xl border border-gray-200 bg-white/80 p-5 text-sm text-gray-700" role="note" aria-label="What this verification means">
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <span
        v-if="verifiedIssuer"
        class="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
        title="Certrust has checked that this issuer controls the organisation's official domain or documents."
      >
        <span class="i-lucide-badge-check h-4 w-4" aria-hidden="true" />
        Verified issuer
      </span>
      <span v-else class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
        Issuer identity not verified by Certrust
      </span>
      <span v-if="issuer?.suspended" class="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
        Issuer suspended pending review
      </span>
      <span v-else-if="issuer && issuer.active === false" class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
        Issuer account inactive
      </span>
    </div>
    <p class="leading-relaxed">
      <strong>What this check means:</strong> this credential was issued through Certrust by the account named above and has not been altered, revoked or expired since.
      It does <strong>not</strong> confirm that the holder met the underlying requirements, or that the issuer has authority to award it. If it matters, confirm with the issuer directly.
      <template v-if="issuer && issuer.active === false">
        The issuer has closed its account; the credential remains verifiable.
      </template>
    </p>
    <p class="mt-3">
      <NuxtLink :to="reportLink" class="text-gray-500 underline hover:text-gray-800">
        Report this credential
      </NuxtLink>
      <span class="text-gray-400"> · </span>
      <NuxtLink to="/terms-and-conditions#the-service" class="text-gray-500 underline hover:text-gray-800">
        About verification
      </NuxtLink>
    </p>
  </div>
</template>
