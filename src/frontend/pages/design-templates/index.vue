<script setup lang="ts">
/**
 * Design Studio home: the organization's designs and the template library,
 * plan usage, and the way into the quick-start wizard.
 */
import { apiClient } from '~/api/api-client'
import { blankDesign } from '~/lib/design-core'

definePageMeta({ middleware: ['auth'] })

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const resources = useStudioResourcesStore()
const { ask } = useStudioConfirm()

useHead({ title: computed(() => t('designStudio.title')) })

const tab = ref<'mine' | 'library'>(route.query.tab === 'library' ? 'library' : 'mine')
const kind = ref<'all' | 'certificate' | 'badge'>('all')
const orientation = ref<'all' | 'landscape' | 'portrait'>('all')
const categoryId = ref<number | null>(null)
const search = ref('')
const mine = ref<any[]>([])
const library = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)
const upgradeReason = ref<null | 'limit' | 'premium'>(null)
const showBrand = ref(false)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [own, sys] = await Promise.all([apiClient.listDesignTemplates('mine'), apiClient.listDesignTemplates('system'), resources.loadAll(true)])
    mine.value = own
    library.value = sys
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    loading.value = false
  }
}
onMounted(load)
watch(tab, v => router.replace({ query: { ...route.query, tab: v === 'library' ? 'library' : undefined } }))

const list = computed(() => (tab.value === 'mine' ? mine.value : library.value).filter((tpl) => {
  const k = tpl.kind || (tpl.type === 'badge' ? 'badge' : 'certificate')
  if (kind.value !== 'all' && k !== kind.value) {
    return false
  }
  if (orientation.value !== 'all' && k === 'certificate' && (tpl.orientation || 'landscape') !== orientation.value) {
    return false
  }
  if (categoryId.value && tpl.category?.id !== categoryId.value) {
    return false
  }
  if (search.value && !String(tpl.name).toLowerCase().includes(search.value.toLowerCase())) {
    return false
  }
  return true
}))

const limits = computed(() => resources.limits)
const usagePct = computed(() => (limits.value?.limit ? Math.min(100, Math.round((limits.value.used / limits.value.limit) * 100)) : 0))

function formatDate(d: string) {
  try {
    return new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d))
  }
  catch {
    return ''
  }
}

function open(tpl: any) {
  router.push(`/design-templates/${tpl.documentId}`)
}

function blocked(err: any): boolean {
  const code = err?.data?.error?.details?.code
  if (code === 'DESIGN_LIMIT_REACHED') {
    upgradeReason.value = 'limit'
  }
  else if (code === 'PREMIUM_REQUIRED') {
    upgradeReason.value = 'premium'
  }
  else {
    return false
  }
  return true
}

async function useTemplate(tpl: any) {
  if (tpl.locked) {
    upgradeReason.value = 'premium'
    return
  }
  if (resources.atLimit && !resources.isPlatformAdmin) {
    upgradeReason.value = 'limit'
    return
  }
  busyId.value = tpl.documentId
  try {
    const res = await apiClient.useDesignTemplate(tpl.documentId)
    router.push(`/design-templates/${res.data.documentId}`)
  }
  catch (err: any) {
    if (!blocked(err)) {
      error.value = err.message
    }
  }
  finally {
    busyId.value = null
  }
}

async function duplicate(tpl: any) {
  if (resources.atLimit) {
    upgradeReason.value = 'limit'
    return
  }
  busyId.value = tpl.documentId
  try {
    const res = await apiClient.useDesignTemplate(tpl.documentId, `${tpl.name} (${t('designStudio.copy')})`)
    mine.value.unshift(res.data)
    await resources.loadLimits(true)
  }
  catch (err: any) {
    if (!blocked(err)) {
      error.value = err.message
    }
  }
  finally {
    busyId.value = null
  }
}

async function remove(tpl: any) {
  const ok = await ask({ title: t('designStudio.gallery.deleteTitle', { name: tpl.name }), message: t('designStudio.gallery.deleteBody'), confirmLabel: t('common.delete'), danger: true })
  if (!ok) {
    return
  }
  busyId.value = tpl.documentId
  try {
    await apiClient.deleteDesignTemplate(tpl.documentId)
    mine.value = mine.value.filter(x => x.documentId !== tpl.documentId)
    library.value = library.value.filter(x => x.documentId !== tpl.documentId)
    await resources.loadLimits(true)
  }
  catch (err: any) {
    error.value = err.message
  }
  finally {
    busyId.value = null
  }
}

function newDesign(k?: 'certificate' | 'badge') {
  if (resources.atLimit && !resources.isPlatformAdmin) {
    upgradeReason.value = 'limit'
    return
  }
  router.push({ path: '/design-templates/create', query: k ? { kind: k } : {} })
}

/** Platform Admins: start a new, empty system template. */
async function newSystemTemplate(k: 'certificate' | 'badge') {
  try {
    const res = await apiClient.createDesignTemplate({ name: t('designStudio.gallery.newSystemName'), system: true, layoutConfig: blankDesign(k) })
    router.push(`/design-templates/${res.data.documentId}?panel=elements`)
  }
  catch (err: any) {
    error.value = err.message
  }
}
</script>

<template>
  <div class="min-h-screen py-8">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <!-- Header -->
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-4xl font-bold text-text-primary">
            {{ t('designStudio.title') }}
          </h1>
          <p class="mt-2 text-text-secondary">
            {{ t('designStudio.gallery.subtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <div v-if="limits && limits.limit != null && !limits.isPlatformAdmin" class="min-w-[220px] rounded-xl border border-gray-200 bg-white px-4 py-2.5" data-testid="design-usage">
            <div class="flex items-center justify-between text-xs">
              <span class="font-medium text-gray-700">{{ t('designStudio.gallery.usage', { used: limits.used, limit: limits.limit }) }}</span>
              <span v-if="limits.trialing" class="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">{{ t('designStudio.gallery.trial') }}</span>
              <span v-else class="capitalize text-gray-500">{{ limits.tier }}</span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div class="h-full rounded-full" :class="usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-[#28A745]'" :style="{ width: `${usagePct}%` }" />
            </div>
          </div>
          <button class="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50" @click="showBrand = true">
            <div class="i-heroicons-swatch h-4 w-4" />{{ t('designStudio.brand.title') }}
          </button>
          <button class="inline-flex items-center gap-2 rounded-full bg-[#28A745] px-5 py-2 text-sm font-semibold text-black hover:bg-[#28A745]/90" data-testid="new-design" @click="newDesign()">
            <div class="i-heroicons-plus h-5 w-5" />{{ t('designStudio.gallery.newDesign') }}
          </button>
        </div>
      </div>

      <div v-if="resources.atLimit && !resources.isPlatformAdmin" class="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <div class="i-heroicons-exclamation-triangle h-5 w-5" />
        {{ t('designStudio.gallery.atLimit') }}
        <NuxtLink to="/billing" class="ml-auto font-semibold underline">
          {{ t('designStudio.upgrade.cta') }}
        </NuxtLink>
      </div>

      <!-- Tabs + filters -->
      <div class="mb-6 flex flex-col gap-3 border-b border-gray-200 md:flex-row md:items-center">
        <div class="flex gap-6" role="tablist">
          <button role="tab" :aria-selected="tab === 'mine'" class="-mb-px border-b-2 px-1 pb-3 text-sm font-medium" :class="tab === 'mine' ? 'border-[#28A745] text-[#1B7A34]' : 'border-transparent text-gray-500 hover:text-gray-800'" @click="tab = 'mine'">
            {{ t('designStudio.gallery.mine') }} <span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{{ mine.length }}</span>
          </button>
          <button role="tab" :aria-selected="tab === 'library'" class="-mb-px border-b-2 px-1 pb-3 text-sm font-medium" :class="tab === 'library' ? 'border-[#28A745] text-[#1B7A34]' : 'border-transparent text-gray-500 hover:text-gray-800'" @click="tab = 'library'">
            {{ t('designStudio.gallery.library') }} <span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{{ library.length }}</span>
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 pb-3 md:ml-auto">
          <div class="relative">
            <div class="i-heroicons-magnifying-glass pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input v-model="search" class="w-48 rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-sm" :placeholder="t('designStudio.gallery.search')">
          </div>
          <select v-model="kind" class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" :aria-label="t('designStudio.gallery.kind')">
            <option value="all">
              {{ t('designStudio.gallery.allKinds') }}
            </option>
            <option value="certificate">
              {{ t('designStudio.gallery.certificates') }}
            </option>
            <option value="badge">
              {{ t('designStudio.gallery.badges') }}
            </option>
          </select>
          <select v-model="orientation" class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" :aria-label="t('designStudio.inspector.paperSize')">
            <option value="all">
              {{ t('designStudio.gallery.anyOrientation') }}
            </option>
            <option value="landscape">
              {{ t('designStudio.inspector.landscape') }}
            </option>
            <option value="portrait">
              {{ t('designStudio.inspector.portrait') }}
            </option>
          </select>
          <select v-model="categoryId" class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm" :aria-label="t('designStudio.templates.category')">
            <option :value="null">
              {{ t('designStudio.templates.allCategories') }}
            </option>
            <option v-for="c in resources.categories" :key="c.id" :value="c.id">
              {{ c.name }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="flex justify-center py-16">
        <div class="h-8 w-8 animate-spin rounded-full border-4 border-[#28A745] border-t-transparent" />
      </div>
      <div v-else-if="error" class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        {{ error }}
        <button class="ml-3 underline" @click="load">
          {{ t('common.tryAgain') }}
        </button>
      </div>

      <template v-else>
        <!-- Platform admin tools -->
        <div v-if="tab === 'library' && resources.isPlatformAdmin" class="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
          <div class="i-heroicons-shield-check h-5 w-5" />
          {{ t('designStudio.gallery.adminNote') }}
          <button class="ml-auto rounded-full bg-violet-600 px-3 py-1.5 font-medium text-white" @click="newSystemTemplate('certificate')">
            {{ t('designStudio.gallery.newSystemCertificate') }}
          </button>
          <button class="rounded-full bg-violet-600 px-3 py-1.5 font-medium text-white" @click="newSystemTemplate('badge')">
            {{ t('designStudio.gallery.newSystemBadge') }}
          </button>
          <NuxtLink to="/admin/design-library" class="rounded-full border border-violet-300 px-3 py-1.5 font-medium">
            {{ t('designStudio.gallery.manageLibrary') }}
          </NuxtLink>
        </div>

        <!-- Empty state: my designs -->
        <div v-if="tab === 'mine' && !mine.length" class="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <div class="i-heroicons-sparkles mx-auto mb-3 h-10 w-10 text-[#28A745]" />
          <h2 class="text-xl font-semibold">
            {{ t('designStudio.gallery.emptyTitle') }}
          </h2>
          <p class="mx-auto mt-2 max-w-md text-gray-600">
            {{ t('designStudio.gallery.emptyBody') }}
          </p>
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button class="flex items-center gap-2 rounded-full bg-[#28A745] px-5 py-2.5 text-sm font-semibold text-black" @click="newDesign('certificate')">
              <div class="i-heroicons-document-text h-5 w-5" />{{ t('designStudio.gallery.newCertificate') }}
            </button>
            <button class="flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-semibold" @click="newDesign('badge')">
              <div class="i-heroicons-check-badge h-5 w-5" />{{ t('designStudio.gallery.newBadge') }}
            </button>
            <button class="rounded-full px-5 py-2.5 text-sm text-[#1B7A34] underline" @click="tab = 'library'">
              {{ t('designStudio.gallery.browseLibrary') }}
            </button>
          </div>
        </div>

        <p v-else-if="!list.length" class="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
          {{ t('designStudio.gallery.noMatches') }}
        </p>

        <!-- Grid -->
        <div v-else class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <article
            v-for="tpl in list"
            :key="tpl.id"
            class="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            :data-testid="`design-card-${tpl.documentId}`"
          >
            <button class="relative flex aspect-[4/3] items-center justify-center bg-[#eef0f3] p-4" :aria-label="tpl.name" @click="open(tpl)">
              <img v-if="tpl.previewImage?.url" :src="designAssetUrl(tpl.previewImage.url)" :alt="tpl.name" class="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)] object-contain drop-shadow-md" loading="lazy">
              <div v-else class="flex flex-col items-center gap-2 text-gray-400">
                <div class="i-heroicons-document h-10 w-10" />
                <span class="text-xs">{{ t('designStudio.gallery.noPreview') }}</span>
              </div>
              <span v-if="tpl.isPremium" class="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-950 shadow">
                <div :class="tpl.locked ? 'i-heroicons-lock-closed' : 'i-heroicons-sparkles'" class="h-3.5 w-3.5" />{{ t('designStudio.premium') }}
              </span>
              <span class="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700 shadow-sm">
                {{ (tpl.kind || tpl.type) === 'badge' ? t('designStudio.inspector.badge') : t('designStudio.inspector.certificate') }}
              </span>
            </button>
            <div class="flex flex-1 flex-col gap-1 p-4">
              <h3 class="truncate font-semibold text-gray-900" :title="tpl.name">
                {{ tpl.name }}
              </h3>
              <p class="text-xs text-gray-500">
                {{ tpl.category?.name || '' }}<span v-if="tpl.category?.name && tab === 'mine'"> · </span><span v-if="tab === 'mine'">{{ t('designStudio.gallery.edited', { date: formatDate(tpl.updatedAt) }) }}</span>
              </p>
              <div class="mt-auto flex items-center gap-2 pt-3">
                <template v-if="tab === 'mine'">
                  <button class="flex-1 rounded-full bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800" @click="open(tpl)">
                    {{ t('designStudio.gallery.edit') }}
                  </button>
                  <button class="ds-icon-btn border border-gray-200" :title="t('designStudio.duplicate')" :disabled="busyId === tpl.documentId" @click="duplicate(tpl)">
                    <div class="i-heroicons-document-duplicate h-4 w-4" />
                  </button>
                  <button class="ds-icon-btn border border-gray-200 text-red-600" :title="t('common.delete')" :disabled="busyId === tpl.documentId" @click="remove(tpl)">
                    <div class="i-heroicons-trash h-4 w-4" />
                  </button>
                </template>
                <template v-else>
                  <button class="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#28A745] px-3 py-1.5 text-sm font-semibold text-black hover:bg-[#28A745]/90 disabled:opacity-60" :disabled="busyId === tpl.documentId" @click="useTemplate(tpl)">
                    <div v-if="tpl.locked" class="i-heroicons-lock-closed h-4 w-4" />{{ t('designStudio.useTemplate') }}
                  </button>
                  <button class="ds-icon-btn border border-gray-200" :title="resources.isPlatformAdmin ? t('designStudio.gallery.edit') : t('designStudio.preview')" @click="open(tpl)">
                    <div :class="resources.isPlatformAdmin ? 'i-heroicons-pencil-square' : 'i-heroicons-eye'" class="h-4 w-4" />
                  </button>
                  <button v-if="resources.isPlatformAdmin" class="ds-icon-btn border border-gray-200 text-red-600" :title="t('common.delete')" @click="remove(tpl)">
                    <div class="i-heroicons-trash h-4 w-4" />
                  </button>
                </template>
              </div>
            </div>
          </article>
        </div>
      </template>
    </div>

    <DesignStudioBrandKitDialog v-if="showBrand" :show-apply="false" @close="showBrand = false" />
    <DesignStudioUpgradeDialog v-if="upgradeReason" :reason="upgradeReason" @close="upgradeReason = null" />
    <DesignStudioConfirmDialog />
  </div>
</template>
