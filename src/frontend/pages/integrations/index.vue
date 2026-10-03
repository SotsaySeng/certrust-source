<script setup lang="ts">
const pageDescription = ref('Connect Certrust to your student records, learning platform or HR system. Your records stay where they are, and credentials are issued automatically when people earn them.')

useSeoMeta({
  title: 'Integrations',
  description: pageDescription.value,
  ogDescription: pageDescription.value,
  ogUrl: `${WEBSITE_URL}/integrations`
})

useHead({
  title: 'Integrations',
  link: [{ rel: 'canonical', href: `${WEBSITE_URL}/integrations` }]
})

const steps = [
  { icon: 'i-lucide-key-round', title: 'Create an API key', body: 'In Certrust, go to Manage → API keys, name the key and choose what it may do. It takes a minute.' },
  { icon: 'i-lucide-plug', title: 'Add it to your system', body: 'Your IT team or provider adds the key to the system you already use: student records, a learning platform, an HR or event tool.' },
  { icon: 'i-lucide-badge-check', title: 'Credentials issue themselves', body: 'When someone passes, completes or attends, your system tells Certrust and their verifiable credential is issued and emailed to them.' },
]

const useCases = [
  { icon: 'i-lucide-graduation-cap', who: 'Universities and colleges', before: 'Exporting graduate lists into spreadsheets at the end of every term.', after: 'The student records system issues each certificate as soon as a final result is recorded.' },
  { icon: 'i-lucide-monitor-play', who: 'Training centres', before: 'Checking the learning platform by hand to see who passed, often weeks later.', after: 'The certificate arrives the moment a learner completes the course.' },
  { icon: 'i-lucide-briefcase', who: 'Companies and HR teams', before: 'Keeping compliance training and certificates in step across two lists.', after: 'The HR system issues the badge, and revokes it when it expires or someone leaves.' },
  { icon: 'i-lucide-calendar-check', who: 'Events and workshops', before: 'Building an attendance CSV after every event.', after: 'Check-in or attendance tools issue certificates the same day.' },
]

const stays = [
  'Student, learner and employee records',
  'Grades, transcripts and HR files',
  'Passwords and logins to your systems',
]

const sent = [
  'The recipient\'s name and email',
  'Which achievement they earned',
  'Optional details you choose to print, such as a date or location',
]

const safety = [
  { icon: 'i-lucide-sliders-horizontal', title: 'Only the permissions you choose', body: 'A key can be limited to reading, issuing, revoking or managing achievements. It can never touch billing, account settings or other keys.' },
  { icon: 'i-lucide-ban', title: 'Revoke in one click', body: 'Stop a key instantly from the API keys page, give it an expiry date, or let it stop on its own if the person who created it leaves your organisation.' },
  { icon: 'i-lucide-repeat', title: 'No duplicates, even on retries', body: 'If a connection drops and your system sends the same request again, Certrust returns the first result instead of issuing twice.' },
  { icon: 'i-lucide-scroll-text', title: 'A record of every action', body: 'Everything done with a key is logged against that key, so you can always see which system issued or revoked a credential.' },
]
</script>

<template>
  <div class="min-h-screen">
    <!-- Hero -->
    <section class="py-20">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p class="text-sm font-medium uppercase tracking-wide text-[#1f7a34] mb-4">
          Integrations
        </p>
        <h1 class="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
          Issue credentials from the systems you already use
        </h1>
        <p class="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto">
          Connect Certrust to your student records, learning platform or HR system. Your records stay where they are, and the right people get a verifiable credential the moment they earn it, without spreadsheets or uploads.
        </p>
        <div class="mt-10 flex flex-col sm:flex-row justify-center gap-4">
          <NuxtLink to="/register" class="py-3 px-6 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors">
            Get Started Free
          </NuxtLink>
          <NuxtLink to="/integrations/guide" class="py-3 px-6 rounded-full bg-[#28A745] text-black hover:bg-[#28A745]/90 transition-colors">
            Read the Setup Guide
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="py-16 bg-gradient-to-b from-[#D9F2DE]/20 to-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-12">
          How it works
        </h2>
        <ol class="grid md:grid-cols-3 gap-8">
          <li v-for="(step, i) in steps" :key="step.title" class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div class="flex items-center gap-3 mb-4">
              <span class="w-8 h-8 rounded-full bg-[#28A745]/15 text-[#1f7a34] font-semibold flex items-center justify-center">{{ i + 1 }}</span>
              <div class="w-6 h-6 text-[#28A745]" :class="step.icon" />
            </div>
            <h3 class="text-xl font-bold text-gray-900 mb-2">
              {{ step.title }}
            </h3>
            <p class="text-gray-600 leading-relaxed">
              {{ step.body }}
            </p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Use cases -->
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-4">
          Less admin, fewer mistakes
        </h2>
        <p class="text-xl text-text-secondary text-center max-w-2xl mx-auto mb-12">
          The work your team does by hand today becomes something your systems do on their own.
        </p>
        <div class="grid md:grid-cols-2 gap-6">
          <div v-for="u in useCases" :key="u.who" class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-6 h-6 text-[#28A745]" :class="u.icon" />
              <h3 class="text-lg font-bold text-gray-900">
                {{ u.who }}
              </h3>
            </div>
            <p class="text-gray-500">
              <span class="font-medium text-gray-700">Today:</span> {{ u.before }}
            </p>
            <p class="mt-2 text-gray-600">
              <span class="font-medium text-[#1f7a34]">Connected:</span> {{ u.after }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Your data stays home -->
    <section class="py-16 bg-gradient-to-b from-white to-[#D9F2DE]/20">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid lg:grid-cols-5 gap-12 items-start">
          <div class="lg:col-span-2">
            <h2 class="text-3xl font-bold text-gray-900 mb-6">
              Your data stays where it is
            </h2>
            <p class="text-lg text-gray-600 leading-relaxed">
              There is nothing to migrate and no copy of your database in Certrust. Your system sends only what goes on the credential, at the moment it is issued. Your records system stays the one source of truth.
            </p>
          </div>
          <div class="lg:col-span-3 grid sm:grid-cols-2 gap-6">
            <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <h3 class="font-bold text-gray-900 mb-4">
                Stays in your systems
              </h3>
              <ul class="space-y-3">
                <li v-for="item in stays" :key="item" class="flex items-start gap-3 text-gray-700">
                  <div class="i-lucide-lock w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
            <div class="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
              <h3 class="font-bold text-gray-900 mb-4">
                Sent to Certrust
              </h3>
              <ul class="space-y-3">
                <li v-for="item in sent" :key="item" class="flex items-start gap-3 text-gray-700">
                  <div class="i-lucide-send w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Safety -->
    <section class="py-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 class="text-3xl font-bold text-center mb-4">
          Safe for your IT and compliance teams
        </h2>
        <p class="text-xl text-text-secondary text-center max-w-2xl mx-auto mb-12">
          Every connection is controlled by your organisation, and every action is accounted for.
        </p>
        <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="s in safety" :key="s.title" class="rounded-2xl bg-gradient-to-br from-[#D9F2DE]/20 to-[#28A745]/10 p-6">
            <div class="w-7 h-7 text-[#28A745] mb-4" :class="s.icon" />
            <h3 class="font-bold text-gray-900 mb-2">
              {{ s.title }}
            </h3>
            <p class="text-gray-600 text-sm leading-relaxed">
              {{ s.body }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- For developers -->
    <section class="py-16 bg-gradient-to-b from-[#D9F2DE]/20 to-white">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 class="text-2xl font-bold text-gray-900 mb-4">
              For your IT team
            </h2>
            <ul class="space-y-3 text-gray-700">
              <li class="flex items-start gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                <span>A simple HTTPS API: one request issues a credential</span>
              </li>
              <li class="flex items-start gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                <span>Batch issuing for whole classes or cohorts</span>
              </li>
              <li class="flex items-start gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                <span>Safe retries with the Idempotency-Key header</span>
              </li>
              <li class="flex items-start gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                <span>Open Badges 3.0 credentials that work beyond Certrust</span>
              </li>
              <li class="flex items-start gap-3">
                <div class="i-lucide-check w-5 h-5 text-[#28A745] flex-shrink-0 mt-0.5" />
                <span>Open source, so anyone can check how it works</span>
              </li>
            </ul>
          </div>
          <pre class="overflow-x-auto rounded-xl bg-gray-900 text-gray-100 p-4 text-xs leading-relaxed"><code>POST /api/credentials/issue
Authorization: Bearer crt_…
Idempotency-Key: student-1042-course-7

{ "data": {
    "achievementId": 12,
    "recipient": {
      "name": "Ada Lovelace",
      "email": "ada@example.edu"
    } } }</code></pre>
        </div>
      </div>
    </section>

    <!-- Plans + CTA -->
    <section class="py-16">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 class="text-3xl font-bold mb-6">
          Included in every paid plan
        </h2>
        <p class="text-xl text-text-secondary mb-8">
          API keys come with Pro and Enterprise. Start free, issue your first credentials by hand, and connect your systems when you are ready.
        </p>
        <div class="flex flex-col sm:flex-row justify-center gap-4">
          <NuxtLink to="/solution" class="py-3 px-6 rounded-full bg-gray-900 text-white hover:bg-gray-800 transition-colors">
            View Plans &amp; Pricing
          </NuxtLink>
          <NuxtLink to="/integrations/guide" class="py-3 px-6 rounded-full bg-[#28A745] text-black hover:bg-[#28A745]/90 transition-colors">
            Read the Setup Guide
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
