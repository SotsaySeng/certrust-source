<script setup lang="ts">
const { globalSettings } = useGlobalSettings()
const sourceCodeUrl = LEGAL.sourceCodeUrl

const pageDescription = ref('Certrust was built by Zettabyte Lab & Consulting Sole Co., Ltd. to solve a certification problem we had in our own training programs — now available to any organization, free for education.')

function handleEducationInquiryClick() {
  const subject = encodeURIComponent('Education Access Request — Certrust')
  const body = encodeURIComponent(
    'Hello,\n\n'
    + 'We are an education organization interested in free access to Certrust for issuing and verifying credentials.\n\n'
    + 'Organization name:\n'
    + 'Program / course details:\n'
    + 'Approximate number of participants:\n\n'
    + 'Best regards'
  )
  const email = globalSettings.value.contactEmail
  if (email) {
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
  }
}

useSeoMeta({
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/about`
})

useHead({
  title: 'About',
  link: [
    { rel: 'canonical', href: `${WEBSITE_URL}/about` }
  ]
})
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <section class="py-20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-start">
          <!-- Left Column -->
          <div>
            <h1 class="text-4xl font-bold text-gray-900 mb-8">
              Built to Solve a Problem We Had Ourselves
            </h1>
            <div class="space-y-6">
              <p class="text-lg text-gray-600 leading-relaxed">
                Certrust didn't start as a product idea — it started as an internal fix. Capacity-building and technical training is one of the services we deliver most at Zettabyte Lab & Consulting Sole Co., Ltd., alongside software development and digital transformation consulting. Every workshop ended the same way: a stack of certificates to produce, no reliable way to prove they were genuine, and no way for participants to show what they'd actually earned beyond a PDF attachment.
              </p>
              <p class="text-lg text-gray-600 leading-relaxed">
                So we adapted Certo — an open, standards-based digital credentialing engine — into Certrust: a platform built around how organizations actually need to issue, share, and verify certificates. Every credential runs on the Open Badges 3.0 / W3C Verifiable Credentials standard, so it's tamper-proof, instantly verifiable, and recognized well beyond our own workshops.
              </p>
            </div>
          </div>

          <!-- Right Column -->
          <div class="bg-gradient-to-br from-[#D9F2DE]/20 to-[#28A745]/20 rounded-2xl p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">
              Key Features
            </h2>
            <ul class="space-y-4">
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-check-circle flex-shrink-0" />
                <span class="text-lg text-gray-700">Issue certificates in minutes, not days</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-check-circle flex-shrink-0" />
                <span class="text-lg text-gray-700">Instant, tamper-proof verification</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-check-circle flex-shrink-0" />
                <span class="text-lg text-gray-700">Customizable templates and branding</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-check-circle flex-shrink-0" />
                <span class="text-lg text-gray-700">Built on open credentialing standards</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Our Story Section -->
    <section class="py-16 bg-gradient-to-b from-[#D9F2DE]/20 to-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid md:grid-cols-2 gap-16 items-start">
          <!-- Left Column -->
          <div class="bg-gradient-to-br from-[#D9F2DE]/20 to-[#28A745]/20 rounded-2xl p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-6">
              The Problem We Kept Running Into
            </h2>
            <ul class="space-y-4">
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-file-x flex-shrink-0" />
                <span class="text-lg text-gray-700">Certificates as static files anyone could edit or fake</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-help-circle flex-shrink-0" />
                <span class="text-lg text-gray-700">No simple way for participants to prove real completion</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-table flex-shrink-0" />
                <span class="text-lg text-gray-700">Cohort tracking scattered across spreadsheets</span>
              </li>
              <li class="flex items-center gap-4">
                <div class="w-6 h-6 text-[#28A745] i-lucide-share-2 flex-shrink-0" />
                <span class="text-lg text-gray-700">No easy way to share achievements on LinkedIn or a CV</span>
              </li>
            </ul>
          </div>

          <!-- Right Column -->
          <div>
            <h2 class="text-4xl font-bold text-gray-900 mb-8">
              Zettabyte Lab & Consulting Sole Co., Ltd.
            </h2>
            <div class="space-y-6">
              <p class="text-lg text-gray-600 leading-relaxed">
                Zettabyte Lab & Consulting Sole Co., Ltd. is a technology consulting company working across custom software development, digital transformation, and cloud and infrastructure advisory. Capacity-building and technical training for teams and institutions is one of our core service lines — and certifying the people who complete those programs properly is proof of the value we deliver, not paperwork.
              </p>
              <p class="text-lg text-gray-600 leading-relaxed">
                We built Certrust to fix that for our own participants first, in production, before it was ever a product. Once it worked for us, it was clear it belonged in the hands of every organization running training, workshops, or certification programs — not just ours.
              </p>
              <p class="text-lg text-gray-600 leading-relaxed">
                Certrust is built on <a href="https://github.com/schroedinger-hat/certo" target="_blank" rel="noopener" class="text-[#1f7a34] underline">Certo</a>, an open-source project by Schrödinger Hat, and stays open source under the GNU AGPL-3.0: the
                <a :href="sourceCodeUrl" target="_blank" rel="noopener" class="text-[#1f7a34] underline">source code of the version running here</a>
                is public, so anyone can check how credentials are signed and verified.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Accessibility / Mission Section -->
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold mb-4">
            Accessible by Design
          </h2>
          <p class="text-xl text-text-secondary max-w-2xl mx-auto">
            Most credentialing platforms are priced for enterprise budgets. We built Certrust the other way around, so any organization can afford to certify its people properly.
          </p>
        </div>

        <div class="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <!-- Pricing pointer -->
          <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 flex flex-col justify-between">
            <h3 class="text-2xl font-bold mb-4">
              Looking for plans &amp; pricing?
            </h3>
            <p class="text-text-secondary mb-8">
              Every plan starts free, no credit card required. Pricing scales with real usage — from a single workshop to a multi-program institution — so small and growing organizations aren't paying for capacity they don't need.
            </p>
            <ul class="space-y-4 mb-8">
              <li class="flex items-center gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745]" />
                <span>Full Open Badges 3.0 issuance, on every plan</span>
              </li>
            </ul>
            <div class="flex-grow-1 flex items-end">
              <NuxtLink
                to="/solution"
                class="block w-full py-3 px-4 text-center rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
              >
                View Plans &amp; Pricing
              </NuxtLink>
            </div>
          </div>

          <!-- Education Organizations -->
          <div class="bg-gradient-to-br from-[#28A745]/10 to-[#28A745]/10 rounded-2xl p-8 shadow-lg border border-[#28A745]/20 relative overflow-hidden flex flex-col justify-between">
            <div class="absolute top-3 right-3 px-3 py-1 bg-[#28A745] text-black text-sm rounded-full">
              Free for Education
            </div>
            <h3 class="text-2xl font-bold mb-4">
              Education Organizations
            </h3>
            <div class="text-3xl font-bold mb-6">
              $0
              <span class="text-text-secondary text-lg font-normal">for schools &amp; training programs</span>
            </div>
            <p class="text-text-secondary mb-8">
              Schools, universities, bootcamps, and nonprofit training programs can issue and verify credentials on Certrust at no cost — because certifying learners shouldn't come down to budget.
            </p>
            <ul class="space-y-4 mb-8">
              <li class="flex items-center gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745]" />
                <span>All core issuing &amp; verification features</span>
              </li>
              <li class="flex items-center gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745]" />
                <span>No credit card, no time limit</span>
              </li>
              <li class="flex items-center gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745]" />
                <span>Support as your program grows</span>
              </li>
            </ul>
            <button
              class="w-full py-3 px-6 rounded-full bg-gradient-to-r from-[#1E7B33] to-[#28A745] text-white font-semibold hover:opacity-90 transition-opacity"
              @click="handleEducationInquiryClick"
            >
              Request Education Access
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA Section -->
    <section class="py-16 bg-gradient-to-b from-white to-[#D9F2DE]/20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-bold mb-6">
          Give Your Participants Something They Can Actually Prove
        </h2>
        <p class="text-xl text-text-secondary max-w-2xl mx-auto mb-8">
          Start free, verify instantly, and only pay for what you actually need.
        </p>
        <div class="flex justify-center gap-4">
          <NuxtLink
            to="/register"
            class="py-3 px-6 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Get Started Free
          </NuxtLink>
          <NuxtLink
            to="/solution"
            class="py-3 px-6 rounded-full bg-[#28A745] text-black hover:bg-[#28A745]/90 transition-colors"
          >
            View Plans &amp; Pricing
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
