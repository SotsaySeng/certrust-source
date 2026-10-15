<script setup lang="ts">
const pageDescription = ref('Certrust is built by training providers and education experts. Issue verifiable digital certificates and badges for your courses, workshops and events — and let anyone check they are real.')

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

const audiences = [
  { icon: 'i-lucide-presentation', title: 'Training providers & workshops', text: 'Certify every participant the moment a course ends.' },
  { icon: 'i-lucide-graduation-cap', title: 'Schools & universities', text: 'Give students credentials employers can verify in seconds.' },
  { icon: 'i-lucide-calendar-check', title: 'Events & conferences', text: 'Issue attendance and speaker certificates in bulk.' }
]

const steps = [
  { title: 'Design', text: 'Build your certificate or badge in the drag-and-drop Design Studio.' },
  { title: 'Add recipients', text: 'Upload a CSV, connect a Google Sheet, or use our API.' },
  { title: 'Issue', text: 'Each recipient gets their certificate by email.' },
  { title: 'Share & verify', text: 'Recipients add it to LinkedIn; anyone can check it is genuine.' }
]

const trust = [
  'Open Badges 3.0 / W3C Verifiable Credentials standard',
  'Every credential has a public, tamper-proof verification page',
  'Your logo, colours and design',
  'Open source — anyone can check how credentials are signed'
]

const faqs = [
  { q: 'How do recipients get their certificate?', a: 'By email, with a link to view, download and share it.' },
  { q: 'Can I issue to many people at once?', a: 'Yes. Upload a CSV or connect a Google Sheet and issue to a whole cohort in one go.' },
  { q: 'Can I use my own branding?', a: 'Yes. Add your logo and design each certificate or badge yourself.' },
  { q: 'How does pricing work?', a: 'You can start free and only pay for the credentials you issue. See Plans & Pricing for details.' }
]
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero -->
    <section class="py-20">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 class="text-4xl font-bold text-gray-900 mb-6">
          Built by Educators, for Educators
        </h1>
        <p class="text-lg text-gray-600 leading-relaxed">
          Our team has been training providers and education experts for many years. We built Certrust because we needed it for our own programs: a simple way to issue certificates that can't be faked and that people are proud to share.
        </p>
      </div>
    </section>

    <!-- Who it's for -->
    <section class="py-16 bg-gradient-to-b from-[#D9F2DE]/20 to-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-10">
          Who It's For
        </h2>
        <div class="grid md:grid-cols-3 gap-6">
          <div v-for="a in audiences" :key="a.title" class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div :class="[a.icon, 'w-8 h-8 text-[#28A745] mb-4']" />
            <h3 class="text-xl font-bold mb-2">
              {{ a.title }}
            </h3>
            <p class="text-gray-600">
              {{ a.text }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-10">
          How It Works
        </h2>
        <ol class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <li v-for="(s, i) in steps" :key="s.title" class="rounded-2xl p-6 bg-gradient-to-br from-[#D9F2DE]/20 to-[#28A745]/20">
            <div class="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold mb-4">
              {{ i + 1 }}
            </div>
            <h3 class="text-xl font-bold mb-2">
              {{ s.title }}
            </h3>
            <p class="text-gray-700">
              {{ s.text }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Trust -->
    <section class="py-16 bg-gradient-to-b from-[#D9F2DE]/20 to-white">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-8">
          Why You Can Trust It
        </h2>
        <ul class="space-y-4">
          <li v-for="t in trust" :key="t" class="flex items-center gap-4">
            <div class="w-6 h-6 text-[#28A745] i-lucide-check-circle flex-shrink-0" />
            <span class="text-lg text-gray-700">{{ t }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- FAQ -->
    <section class="py-16">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-8">
          Common Questions
        </h2>
        <div class="space-y-6">
          <div v-for="f in faqs" :key="f.q">
            <h3 class="text-lg font-bold mb-1">
              {{ f.q }}
            </h3>
            <p class="text-gray-600">
              {{ f.a }}
            </p>
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
        <div class="flex flex-wrap justify-center gap-4">
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
