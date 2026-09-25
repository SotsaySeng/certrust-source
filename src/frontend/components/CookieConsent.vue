<script setup lang="ts">
// Analytics consent (Privacy Policy s.7). Renders nothing unless a GA4 ID
// is configured. Google Analytics starts in Consent Mode "denied" (see
// nuxt.config.ts) and is only loaded after the visitor accepts. It is never
// active on credential verification or sign-in pages: people verifying a
// credential never chose to deal with us.
const STORAGE_KEY = 'certrust_analytics_consent'
const EXCLUDED = [/^\/credentials\//, /^\/verify/, /^\/login/, /^\/register/, /^\/forgot-password/, /^\/reset-password/, /^\/auth\//]

const config = useRuntimeConfig()
const gaId = computed(() => (config.public as any).gtag?.id || (config.public as any).gtag?.tags?.[0]?.id || '')
const route = useRoute()
const router = useRouter()
const { gtag, initialize, enableAnalytics, disableAnalytics } = useGtag()

const open = useState('cookie-consent-open', () => false)
const choice = ref<'granted' | 'denied' | null>(null)
let initialized = false

const excluded = (path: string) => EXCLUDED.some(re => re.test(path))

function readChoice(): 'granted' | 'denied' | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'granted' || v === 'denied' ? v : null
  }
  catch {
    return null
  }
}

function apply(path: string) {
  if (!gaId.value || choice.value !== 'granted') {
    return
  }
  if (excluded(path)) {
    if (initialized) {
      disableAnalytics()
    }
    return
  }
  if (!initialized) {
    gtag('consent', 'update', { analytics_storage: 'granted' })
    initialize()
    initialized = true
  }
  else {
    enableAnalytics()
  }
}

function decide(value: 'granted' | 'denied') {
  choice.value = value
  try {
    localStorage.setItem(STORAGE_KEY, value)
  }
  catch {}
  open.value = false
  if (value === 'granted') {
    apply(route.path)
  }
  else if (initialized) {
    gtag('consent', 'update', { analytics_storage: 'denied' })
    disableAnalytics()
  }
}

onMounted(() => {
  if (!gaId.value) {
    return
  }
  choice.value = readChoice()
  if (!choice.value && !excluded(route.path)) {
    open.value = true
  }
  apply(route.path)
  router.afterEach(to => apply(to.path))
})
</script>

<template>
  <div
    v-if="gaId && open"
    class="fixed inset-x-0 bottom-0 z-50 p-4"
    role="dialog"
    aria-live="polite"
    aria-label="Cookie preferences"
  >
    <div class="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 shadow-xl sm:flex sm:items-center sm:gap-6">
      <p class="text-sm text-gray-700">
        We would like to use Google Analytics to understand how our website is used. It is optional and off unless you accept, and never runs on credential pages.
        <NuxtLink to="/privacy-policy#cookies" class="underline">
          Privacy Policy
        </NuxtLink>
      </p>
      <div class="mt-4 flex shrink-0 gap-2 sm:mt-0">
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50" @click="decide('denied')">
          Decline
        </button>
        <button type="button" class="rounded-lg bg-[#28A745] px-4 py-2 text-sm font-medium text-white hover:bg-[#28A745]/90" @click="decide('granted')">
          Accept
        </button>
      </div>
    </div>
  </div>
</template>
