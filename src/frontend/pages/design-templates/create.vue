<script setup lang="ts">
/**
 * Quick-start wizard: certificate or badge -> template (or blank) ->
 * brand kit (skippable) -> name. Lands in the editor with the brand
 * applied; first-timers get the tour.
 */
import type { BrandKitInfo } from '~/api/api-client'
import { apiClient } from '~/api/api-client'
import { blankDesign } from '~/lib/design-core'

definePageMeta({ middleware: ['auth'] })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const resources = useStudioResourcesStore()
useHead({ title: computed(() => `${t('designStudio.wizard.title')} · ${t('designStudio.title')}`) })

const step = ref(route.query.kind ? 2 : 1)
const kind = ref<'certificate' | 'badge'>(route.query.kind === 'badge' ? 'badge' : 'certificate')
const orientation = ref<'landscape' | 'portrait'>('landscape')
const categoryId = ref<number | null>(null)
const library = ref<any[]>([])
const loading = ref(true)
const selected = ref<any | 'blank'>('blank')
const brand = ref<BrandKitInfo>({ logo: null, primary: null, secondary: null, accent: null, headingFont: null, bodyFont: null, signers: [] })
const name = ref('')
const creating = ref(false)
const error = ref<string | null>(null)
const upgradeReason = ref<null | 'limit' | 'premium'>(null)

onMounted(async () => {
  try {
    const [sys] = await Promise.all([apiClient.listDesignTemplates('system'), resources.loadAll(true)])
    library.value = sys
    if (resources.brand) {
      brand.value = JSON.parse(JSON.stringify(resources.brand))
    }
  }
  finally {
    loading.value = false
  }
})

const templates = computed(() => library.value.filter(tpl =>
  (tpl.kind || tpl.type) === kind.value
  && (kind.value === 'badge' || (tpl.orientation || 'landscape') === orientation.value)
  && (!categoryId.value || tpl.category?.id === categoryId.value)))

const hasBrand = computed(() => !!(resources.brand?.exists && (resources.brand.logo || resources.brand.primary)))
const STEPS = ['kind', 'template', 'brand', 'name'] as const

function chooseKind(k: 'certificate' | 'badge') {
  kind.value = k
  selected.value = 'blank'
  step.value = 2
}

function chooseTemplate(tpl: any) {
  if (tpl.locked) {
    upgradeReason.value = 'premium'
    return
  }
  selected.value = tpl
}

function toName() {
  if (!name.value) {
    name.value = selected.value === 'blank'
      ? (kind.value === 'badge' ? t('designStudio.wizard.defaultBadgeName') : t('designStudio.wizard.defaultCertificateName'))
      : selected.value.name
  }
  step.value = 4
}

async function saveBrandAndContinue() {
  error.value = null
  try {
    await resources.saveBrand(brand.value)
    toName()
  }
  catch (err) {
    error.value = (err as Error).message
  }
}

async function create() {
  if (resources.atLimit && !resources.isPlatformAdmin) {
    upgradeReason.value = 'limit'
    return
  }
  creating.value = true
  error.value = null
  try {
    const res = selected.value === 'blank'
      ? await apiClient.createDesignTemplate({ name: name.value.trim() || t('designStudio.untitled'), layoutConfig: blankDesign(kind.value, orientation.value) })
      : await apiClient.useDesignTemplate(selected.value.documentId, name.value.trim())
    let tour = false
    try {
      tour = !localStorage.getItem('ds-tour-seen')
    }
    catch {}
    router.push({ path: `/design-templates/${res.data.documentId}`, query: tour ? { tour: '1' } : {} })
  }
  catch (err: any) {
    const code = err?.data?.error?.details?.code
    if (code === 'DESIGN_LIMIT_REACHED') {
      upgradeReason.value = 'limit'
    }
    else if (code === 'PREMIUM_REQUIRED') {
      upgradeReason.value = 'premium'
    }
    else {
      error.value = err.message
    }
  }
  finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="min-h-screen py-8">
    <div class="mx-auto max-w-5xl px-4 sm:px-6">
      <NuxtLink to="/design-templates" class="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <div class="i-heroicons-arrow-left h-4 w-4" />{{ t('designStudio.backToDesigns') }}
      </NuxtLink>
      <h1 class="text-3xl font-bold text-text-primary">
        {{ t('designStudio.wizard.title') }}
      </h1>

      <!-- Stepper -->
      <ol class="mb-8 mt-5 flex items-center gap-2 text-sm" :aria-label="t('designStudio.wizard.progress')">
        <li v-for="(s, i) in STEPS" :key="s" class="flex items-center gap-2">
          <button
            class="flex items-center gap-2 rounded-full px-3 py-1.5"
            :class="step === i + 1 ? 'bg-[#28A745] font-semibold text-black' : step > i + 1 ? 'bg-[#28A745]/15 text-[#1B7A34]' : 'bg-gray-100 text-gray-500'"
            :disabled="i + 1 > step"
            :aria-current="step === i + 1 ? 'step' : undefined"
            @click="step = i + 1"
          >
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-xs">
              <span v-if="step > i + 1" class="i-heroicons-check h-3.5 w-3.5" /><span v-else>{{ i + 1 }}</span>
            </span>
            {{ t(`designStudio.wizard.steps.${s}`) }}
          </button>
          <div v-if="i < STEPS.length - 1" class="h-px w-6 bg-gray-300" />
        </li>
      </ol>

      <div v-if="resources.atLimit && !resources.isPlatformAdmin" class="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div class="i-heroicons-exclamation-triangle h-5 w-5" />
        {{ t('designStudio.gallery.atLimit') }}
        <NuxtLink to="/billing" class="ml-auto font-semibold underline">
          {{ t('designStudio.upgrade.cta') }}
        </NuxtLink>
      </div>

      <!-- 1. Kind -->
      <section v-if="step === 1" class="grid gap-5 sm:grid-cols-2">
        <button class="group rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition hover:border-[#28A745] hover:shadow-md" data-testid="wizard-certificate" @click="chooseKind('certificate')">
          <div class="mb-4 flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-[#f5f0e6] to-white">
            <div class="flex aspect-[1.414] w-3/4 flex-col items-center justify-center gap-1 rounded border-4 border-double border-[#b08d3c] bg-white shadow">
              <div class="h-2 w-1/2 rounded bg-[#1e3a8a]" /><div class="h-1.5 w-1/3 rounded bg-gray-300" /><div class="mt-1 h-2.5 w-2/5 rounded bg-[#b08d3c]/70" />
            </div>
          </div>
          <h2 class="text-lg font-semibold">
            {{ t('designStudio.wizard.certificate') }}
          </h2>
          <p class="mt-1 text-sm text-gray-600">
            {{ t('designStudio.wizard.certificateHint') }}
          </p>
        </button>
        <button class="group rounded-2xl border-2 border-gray-200 bg-white p-6 text-left transition hover:border-[#28A745] hover:shadow-md" data-testid="wizard-badge" @click="chooseKind('badge')">
          <div class="mb-4 flex aspect-[4/3] items-center justify-center rounded-xl bg-gradient-to-br from-[#eef2ff] to-white">
            <div class="flex h-32 w-32 items-center justify-center rounded-full border-8 border-[#b08d3c] bg-[#1e3a8a] shadow">
              <div class="i-heroicons-star-solid h-12 w-12 text-amber-300" />
            </div>
          </div>
          <h2 class="text-lg font-semibold">
            {{ t('designStudio.wizard.badge') }}
          </h2>
          <p class="mt-1 text-sm text-gray-600">
            {{ t('designStudio.wizard.badgeHint') }}
          </p>
        </button>
      </section>

      <!-- 2. Template -->
      <section v-else-if="step === 2">
        <div class="mb-4 flex flex-wrap items-center gap-2">
          <div v-if="kind === 'certificate'" class="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            <button v-for="o in (['landscape', 'portrait'] as const)" :key="o" class="rounded-md px-3 py-1.5" :class="orientation === o ? 'bg-white font-medium shadow-sm' : 'text-gray-600'" @click="orientation = o">
              {{ t(`designStudio.inspector.${o}`) }}
            </button>
          </div>
          <button class="rounded-full border px-3 py-1.5 text-sm" :class="categoryId === null ? 'border-[#28A745] bg-[#28A745]/10 text-[#1B7A34]' : 'border-gray-200'" @click="categoryId = null">
            {{ t('designStudio.templates.allCategories') }}
          </button>
          <button v-for="c in resources.categories" :key="c.id" class="rounded-full border px-3 py-1.5 text-sm" :class="categoryId === c.id ? 'border-[#28A745] bg-[#28A745]/10 text-[#1B7A34]' : 'border-gray-200'" @click="categoryId = c.id">
            {{ c.name }}
          </button>
        </div>
        <div v-if="loading" class="flex justify-center py-12">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-[#28A745] border-t-transparent" />
        </div>
        <div v-else class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <button
            class="flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left"
            :class="selected === 'blank' ? 'border-[#28A745] ring-2 ring-[#28A745]/30' : 'border-gray-200 hover:border-gray-300'"
            data-testid="wizard-blank"
            @click="selected = 'blank'"
          >
            <div class="flex items-center justify-center bg-gray-50" :class="kind === 'badge' ? 'aspect-square' : orientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'">
              <div class="i-heroicons-document-plus h-10 w-10 text-gray-300" />
            </div>
            <span class="p-3 text-sm font-medium">{{ t('designStudio.templates.blank') }}</span>
          </button>
          <button
            v-for="tpl in templates"
            :key="tpl.id"
            class="relative flex flex-col overflow-hidden rounded-xl border-2 bg-white text-left"
            :class="selected !== 'blank' && selected?.documentId === tpl.documentId ? 'border-[#28A745] ring-2 ring-[#28A745]/30' : 'border-gray-200 hover:border-gray-300'"
            @click="chooseTemplate(tpl)"
          >
            <div class="flex items-center justify-center bg-[#eef0f3] p-2" :class="kind === 'badge' ? 'aspect-square' : orientation === 'portrait' ? 'aspect-[3/4]' : 'aspect-[4/3]'">
              <img v-if="tpl.previewImage?.url" :src="designAssetUrl(tpl.previewImage.url)" :alt="tpl.name" class="max-h-full max-w-full object-contain" loading="lazy">
            </div>
            <span class="truncate p-3 text-sm font-medium">{{ tpl.name }}</span>
            <span v-if="tpl.isPremium" class="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950 shadow">
              <div :class="tpl.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-sparkles'" class="h-3.5 w-3.5" />{{ t('designStudio.premium') }}
            </span>
          </button>
        </div>
        <p v-if="!loading && !templates.length" class="mt-4 text-sm text-gray-500">
          {{ t('designStudio.templates.none') }}
        </p>
        <div class="mt-8 flex justify-between">
          <button class="rounded-full border border-gray-300 px-5 py-2 text-sm" @click="step = 1">
            {{ t('common.back') }}
          </button>
          <button class="rounded-full bg-[#28A745] px-6 py-2 text-sm font-semibold text-black" data-testid="wizard-next" @click="step = 3">
            {{ t('designStudio.tour.next') }}
          </button>
        </div>
      </section>

      <!-- 3. Brand -->
      <section v-else-if="step === 3" class="grid gap-8 lg:grid-cols-[1fr_280px]">
        <div class="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-semibold">
            {{ hasBrand ? t('designStudio.wizard.brandExistingTitle') : t('designStudio.wizard.brandTitle') }}
          </h2>
          <p class="mb-5 mt-1 text-sm text-gray-600">
            {{ t('designStudio.wizard.brandBody') }}
          </p>
          <DesignStudioBrandKitForm v-model="brand" />
          <p v-if="error" class="mt-4 text-sm text-red-600">
            {{ error }}
          </p>
        </div>
        <aside class="space-y-3 text-sm text-gray-600">
          <div class="rounded-xl bg-[#28A745]/5 p-4">
            <div class="i-heroicons-light-bulb mb-2 h-6 w-6 text-[#1B7A34]" />
            {{ t('designStudio.wizard.brandTip') }}
          </div>
        </aside>
        <div class="flex justify-between lg:col-span-2">
          <button class="rounded-full border border-gray-300 px-5 py-2 text-sm" @click="step = 2">
            {{ t('common.back') }}
          </button>
          <div class="flex gap-2">
            <button class="rounded-full px-5 py-2 text-sm text-gray-600 underline" data-testid="wizard-skip-brand" @click="toName">
              {{ t('designStudio.wizard.skip') }}
            </button>
            <button class="rounded-full bg-[#28A745] px-6 py-2 text-sm font-semibold text-black" data-testid="wizard-save-brand" @click="saveBrandAndContinue">
              {{ t('designStudio.wizard.saveBrand') }}
            </button>
          </div>
        </div>
      </section>

      <!-- 4. Name -->
      <section v-else class="max-w-lg rounded-2xl border border-gray-200 bg-white p-6">
        <label class="block text-sm font-medium" for="design-name">{{ t('designStudio.wizard.nameLabel') }}</label>
        <input id="design-name" v-model="name" class="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2" maxlength="120" autofocus @keydown.enter="create">
        <p class="mt-2 text-xs text-gray-500">
          {{ t('designStudio.wizard.nameHint') }}
        </p>
        <p v-if="error" class="mt-3 text-sm text-red-600">
          {{ error }}
        </p>
        <div class="mt-6 flex justify-between">
          <button class="rounded-full border border-gray-300 px-5 py-2 text-sm" @click="step = 3">
            {{ t('common.back') }}
          </button>
          <button class="flex items-center gap-2 rounded-full bg-[#28A745] px-6 py-2 text-sm font-semibold text-black disabled:opacity-60" :disabled="creating" data-testid="wizard-create" @click="create">
            <div v-if="creating" class="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
            {{ t('designStudio.wizard.create') }}
          </button>
        </div>
      </section>
    </div>
    <DesignStudioUpgradeDialog v-if="upgradeReason" :reason="upgradeReason" @close="upgradeReason = null" />
  </div>
</template>
