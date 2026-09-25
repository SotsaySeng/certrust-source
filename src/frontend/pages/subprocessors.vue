<script setup lang="ts">
import { format } from '@formkit/tempo'

// Annex III of the DPA. Adding or replacing a sub-processor requires
// LEGAL.noticeDays days' notice to customers (DPA section 5) - email them
// and update LEGAL.effectiveDate when this list changes.
const subprocessors = [
  {
    name: 'Cloudflare, Inc.',
    purpose: 'Application hosting and containers, content delivery, DDoS protection, file storage (R2, including encrypted backups), sending credential and account emails, and routing emails sent to our addresses.',
    data: 'All Service data in transit; uploaded files and backups; email addresses and email content.',
    location: 'United States (company); global edge network; storage in the Asia-Pacific region.',
  },
  {
    name: 'Neon, Inc. (hosted on Amazon Web Services)',
    purpose: 'Managed PostgreSQL database.',
    data: 'All account, organisation and credential data.',
    location: 'Singapore (AWS ap-southeast-1).',
  },
  {
    name: 'Stripe, Inc. and its affiliates',
    purpose: 'Payment processing, subscriptions and invoices.',
    data: 'Billing contact, billing email, payment card and transaction data (for paying customers only).',
    location: 'United States, Ireland and other Stripe locations.',
  },
  {
    name: 'Google LLC',
    purpose: 'Mailbox that receives messages sent to our support and privacy addresses. Website analytics (Google Analytics 4) only if enabled, only with the visitor\'s consent, and never on credential pages.',
    data: 'Emails and attachments people send us; for analytics, pseudonymous usage data.',
    location: 'United States and other Google locations.',
  },
]

const legal = LEGAL
const lastUpdated = format(LEGAL.effectiveDate, 'long')

useSeoMeta({
  title: 'Sub-processors',
  description: `The service providers that process personal data for ${LEGAL.product}.`,
  ogUrl: `${WEBSITE_URL}/subprocessors`,
})

useHead({
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/subprocessors` }],
})
</script>

<template>
  <div class="min-h-screen py-16">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-4xl font-bold mb-3">
        Sub-processors
      </h1>
      <p class="text-gray-500 mb-6">
        Last updated: {{ lastUpdated }}
      </p>
      <p class="text-lg text-gray-700 mb-4">
        These providers process personal data on our behalf to run {{ legal.product }}. Each is bound by data-protection terms at least as protective as our
        <NuxtLink to="/data-processing-agreement" class="text-[#1f7a34] underline">
          Data Processing Agreement
        </NuxtLink>, which this list forms part of (Annex III).
      </p>
      <p class="text-gray-700 mb-10">
        We give customers at least {{ legal.noticeDays }} days' notice by email before adding or replacing a sub-processor. To object, write to
        <a :href="`mailto:${legal.privacyEmail}`" class="text-[#1f7a34] underline">{{ legal.privacyEmail }}</a>.
      </p>

      <div class="space-y-4">
        <div v-for="sp in subprocessors" :key="sp.name" class="rounded-lg border border-gray-200 p-5">
          <h2 class="text-lg font-semibold mb-3">
            {{ sp.name }}
          </h2>
          <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt class="font-medium text-gray-500">
              Purpose
            </dt>
            <dd class="text-gray-800">
              {{ sp.purpose }}
            </dd>
            <dt class="font-medium text-gray-500">
              Personal data
            </dt>
            <dd class="text-gray-800">
              {{ sp.data }}
            </dd>
            <dt class="font-medium text-gray-500">
              Location
            </dt>
            <dd class="text-gray-800">
              {{ sp.location }}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>
