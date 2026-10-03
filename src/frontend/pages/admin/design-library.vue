<script setup lang="ts">
/**
 * Admin > Design library - Platform Admin only (route-guarded by
 * middleware/auth.ts, enforced server-side by global::is-platform-admin).
 * Curates the Design Studio's system templates (gallery order, category,
 * Premium, hidden) and the Elements library. Templates themselves are
 * designed in the normal editor.
 */
import type { DesignAsset, SystemLibraryTemplate } from '~/api/api-client'
import { apiClient } from '~/api/api-client'
import { blankDesign } from '~/lib/design-core'

definePageMeta({
  middleware: ['auth'],
})

useHead({ title: 'Design library' })

const router = useRouter()
const { ask } = useStudioConfirm()

const ELEMENT_CATEGORIES = ['laurels', 'seals', 'ribbons', 'bases', 'frames', 'icons', 'graphics', 'shapes'] as const

const tab = ref<'templates' | 'elements'>('templates')
const kindFilter = ref<'all' | 'certificate' | 'badge'>('all')
const templates = ref<SystemLibraryTemplate[]>([])
const elements = ref<DesignAsset[]>([])
const categories = ref<any[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const busy = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [t, e, c] = await Promise.all([
      apiClient.listSystemLibrary(),
      apiClient.listDesignAssets('element'),
      apiClient.getDesignCategories(),
    ])
    templates.value = t
    elements.value = e
    categories.value = c
  }
  catch (err: any) {
    error.value = err?.message || 'Failed to load the design library'
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

async function act(key: string, fn: () => Promise<unknown>, done?: string) {
  busy.value = key
  error.value = null
  notice.value = null
  try {
    await fn()
    if (done) {
      notice.value = done
    }
  }
  catch (err: any) {
    error.value = err?.message || 'Action failed'
    await load()
  }
  finally {
    busy.value = null
  }
}

// ------------------------------------------------------------- templates

const visibleTemplates = computed(() => templates.value.filter(t => kindFilter.value === 'all' || t.kind === kindFilter.value))
const counts = computed(() => ({
  all: templates.value.length,
  certificate: templates.value.filter(t => t.kind === 'certificate').length,
  badge: templates.value.filter(t => t.kind === 'badge').length,
  hidden: templates.value.filter(t => t.isHidden).length,
  premium: templates.value.filter(t => t.isPremium).length,
}))

function patch(tpl: SystemLibraryTemplate, data: Parameters<typeof apiClient.updateSystemTemplate>[1], done?: string) {
  return act(tpl.documentId, async () => {
    await apiClient.updateSystemTemplate(tpl.documentId, data)
    if ('category' in data) {
      const cat = categories.value.find(c => c.documentId === data.category)
      tpl.category = cat ? { documentId: cat.documentId, name: cat.name } : null
    }
    Object.assign(tpl, { ...data, category: tpl.category })
  }, done)
}

function rename(tpl: SystemLibraryTemplate, event: Event) {
  const name = (event.target as HTMLInputElement).value.trim()
  if (!name || name === tpl.name) {
    (event.target as HTMLInputElement).value = tpl.name
    return
  }
  patch(tpl, { name }, `Renamed to “${name}”.`)
}

async function setHidden(tpl: SystemLibraryTemplate, hidden: boolean) {
  if (hidden && tpl.usedByAchievements) {
    const ok = await ask({
      title: `Hide “${tpl.name}”?`,
      message: `It disappears from every organization's gallery. The ${tpl.usedByAchievements} achievement(s) already using it keep issuing with it.`,
      confirmLabel: 'Hide',
    })
    if (!ok) {
      return
    }
  }
  patch(tpl, { isHidden: hidden }, hidden ? `“${tpl.name}” is hidden from the gallery.` : `“${tpl.name}” is visible in the gallery.`)
}

/** Move within the full list (the filter only narrows what is shown). */
function move(tpl: SystemLibraryTemplate, dir: -1 | 1) {
  const list = visibleTemplates.value
  const i = list.indexOf(tpl)
  const other = list[i + dir]
  if (!other) {
    return
  }
  const all = [...templates.value]
  const a = all.indexOf(tpl)
  const b = all.indexOf(other)
  all[a] = other
  all[b] = tpl
  templates.value = all
  act('order', () => apiClient.reorderSystemTemplates(all.map(t => t.documentId)))
}

async function remove(tpl: SystemLibraryTemplate) {
  const ok = await ask({
    title: `Delete “${tpl.name}”?`,
    message: tpl.usedByAchievements
      ? `${tpl.usedByAchievements} achievement(s) use this template directly and could no longer issue with it. Consider hiding it instead. This cannot be undone.`
      : 'Organizations that already copied it keep their copies. This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) {
    return
  }
  await act(tpl.documentId, async () => {
    await apiClient.deleteDesignTemplate(tpl.documentId)
    templates.value = templates.value.filter(t => t.documentId !== tpl.documentId)
  }, `Deleted “${tpl.name}”.`)
}

async function newTemplate(kind: 'certificate' | 'badge') {
  await act('new', async () => {
    const res = await apiClient.createDesignTemplate({ name: kind === 'badge' ? 'New system badge' : 'New system certificate', system: true, layoutConfig: blankDesign(kind) })
    router.push(`/design-templates/${res.data.documentId}?panel=elements`)
  })
}

// -------------------------------------------------------------- elements

const upload = reactive<{ file: File | null, name: string, category: string }>({ file: null, name: '', category: 'icons' })
const fileInput = ref<HTMLInputElement | null>(null)

const elementGroups = computed(() => ELEMENT_CATEGORIES
  .map(cat => ({ cat, items: elements.value.filter(e => e.elementCategory === cat) }))
  .filter(g => g.items.length))

function pickFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  upload.file = file
  if (file && !upload.name) {
    upload.name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  }
}

async function uploadElement() {
  if (!upload.file) {
    return
  }
  await act('upload', async () => {
    const created = await apiClient.uploadDesignAsset(upload.file!, { system: true, elementCategory: upload.category, name: upload.name.trim() || undefined })
    elements.value = [...elements.value, created]
    upload.file = null
    upload.name = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }, 'Element added to the library.')
}

function updateElement(el: DesignAsset, data: { name?: string, elementCategory?: string }) {
  return act(el.documentId, async () => {
    const fresh = await apiClient.updateDesignAsset(el.documentId, data)
    Object.assign(el, fresh)
  })
}

function renameElement(el: DesignAsset, event: Event) {
  const name = (event.target as HTMLInputElement).value.trim()
  if (!name || name === el.name) {
    (event.target as HTMLInputElement).value = el.name
    return
  }
  updateElement(el, { name })
}

async function removeElement(el: DesignAsset) {
  const ok = await ask({
    title: `Delete “${el.name}”?`,
    message: 'It is removed from the Elements panel. Designs that already use it keep their copy until they are re-saved.',
    confirmLabel: 'Delete',
    danger: true,
  })
  if (!ok) {
    return
  }
  await act(el.documentId, async () => {
    await apiClient.deleteDesignAsset(el.documentId)
    elements.value = elements.value.filter(e => e.documentId !== el.documentId)
  })
}

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
</script>

<template>
  <div class="min-h-screen py-12">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="mb-2 text-3xl font-bold">
            Design library
          </h1>
          <p class="max-w-2xl text-gray-600">
            System templates and elements every organization sees in the Design Studio. Design a template in the editor; curate it here.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="busy === 'new'" @click="newTemplate('certificate')">
            New system certificate
          </button>
          <button class="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="busy === 'new'" @click="newTemplate('badge')">
            New system badge
          </button>
        </div>
      </div>

      <div class="mb-6 flex gap-6 border-b border-gray-200" role="tablist">
        <button role="tab" :aria-selected="tab === 'templates'" class="-mb-px border-b-2 px-1 pb-3 text-sm font-medium" :class="tab === 'templates' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-800'" @click="tab = 'templates'">
          Templates <span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{{ counts.all }}</span>
        </button>
        <button role="tab" :aria-selected="tab === 'elements'" class="-mb-px border-b-2 px-1 pb-3 text-sm font-medium" :class="tab === 'elements' ? 'border-violet-600 text-violet-700' : 'border-transparent text-gray-500 hover:text-gray-800'" @click="tab = 'elements'">
          Elements <span class="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{{ elements.length }}</span>
        </button>
      </div>

      <p v-if="error" class="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">
        {{ error }}
      </p>
      <p v-if="notice" class="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800" role="status">
        {{ notice }}
      </p>
      <p v-if="loading" class="text-gray-500">
        Loading…
      </p>

      <!-- Templates -->
      <section v-else-if="tab === 'templates'">
        <div class="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <button
            v-for="k in (['all', 'certificate', 'badge'] as const)"
            :key="k"
            class="rounded-full border px-3 py-1"
            :class="kindFilter === k ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-gray-300 text-gray-600'"
            @click="kindFilter = k"
          >
            {{ k === 'all' ? 'All' : k === 'certificate' ? 'Certificates' : 'Badges' }} ({{ counts[k] }})
          </button>
          <span class="ml-auto text-gray-500">{{ counts.premium }} Premium · {{ counts.hidden }} hidden · order = gallery order</span>
        </div>

        <p v-if="!visibleTemplates.length" class="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
          No system templates yet.
        </p>

        <ul class="space-y-3">
          <li
            v-for="(tpl, i) in visibleTemplates"
            :key="tpl.documentId"
            class="flex flex-col gap-4 rounded-xl border bg-white p-4 md:flex-row md:items-center"
            :class="tpl.isHidden ? 'border-dashed border-gray-300 opacity-70' : 'border-gray-200'"
            data-testid="library-template"
          >
            <div class="flex items-center gap-3">
              <div class="flex flex-col">
                <button class="ds-icon-btn" :disabled="i === 0 || busy === 'order'" title="Move up" aria-label="Move up" @click="move(tpl, -1)">
                  <div class="i-heroicons-chevron-up h-4 w-4" />
                </button>
                <button class="ds-icon-btn" :disabled="i === visibleTemplates.length - 1 || busy === 'order'" title="Move down" aria-label="Move down" @click="move(tpl, 1)">
                  <div class="i-heroicons-chevron-down h-4 w-4" />
                </button>
              </div>
              <div class="relative flex h-20 w-28 shrink-0 items-center justify-center rounded-lg bg-[#eef0f3]">
                <img v-if="tpl.previewImage?.url" :src="designAssetUrl(tpl.previewImage.url)" :alt="tpl.name" class="absolute inset-1.5 h-[calc(100%-0.75rem)] w-[calc(100%-0.75rem)] object-contain drop-shadow" loading="lazy">
              </div>
            </div>

            <div class="min-w-0 flex-1">
              <input
                :value="tpl.name"
                class="w-full rounded-md border border-transparent px-2 py-1 font-semibold hover:border-gray-300 focus:border-violet-500 focus:outline-none"
                :aria-label="`Name of ${tpl.name}`"
                @change="rename(tpl, $event)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              >
              <p class="px-2 text-xs text-gray-500">
                {{ tpl.kind === 'badge' ? 'Badge' : `Certificate · ${label(tpl.orientation)}` }}
                <template v-if="tpl.slug">
                  · {{ tpl.slug }}
                </template>
                · used by {{ tpl.usedByAchievements }} achievement{{ tpl.usedByAchievements === 1 ? '' : 's' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-3 text-sm">
              <select
                :value="tpl.category?.documentId ?? ''"
                class="rounded-lg border border-gray-300 px-2 py-1.5"
                :aria-label="`Category of ${tpl.name}`"
                @change="patch(tpl, { category: ($event.target as HTMLSelectElement).value || null })"
              >
                <option value="">
                  No category
                </option>
                <option v-for="c in categories" :key="c.documentId" :value="c.documentId">
                  {{ c.name }}
                </option>
              </select>
              <label class="flex items-center gap-1.5">
                <input type="checkbox" :checked="tpl.isPremium" class="accent-amber-500" @change="patch(tpl, { isPremium: ($event.target as HTMLInputElement).checked })">
                Premium
              </label>
              <label class="flex items-center gap-1.5">
                <input type="checkbox" :checked="!tpl.isHidden" class="accent-violet-600" @change="setHidden(tpl, !($event.target as HTMLInputElement).checked)">
                In gallery
              </label>
              <NuxtLink :to="`/design-templates/${tpl.documentId}`" class="ds-icon-btn" title="Open in the editor" :aria-label="`Edit ${tpl.name}`">
                <div class="i-heroicons-pencil-square h-5 w-5" />
              </NuxtLink>
              <button class="ds-icon-btn text-red-600" title="Delete" :aria-label="`Delete ${tpl.name}`" :disabled="busy === tpl.documentId" @click="remove(tpl)">
                <div class="i-heroicons-trash h-5 w-5" />
              </button>
            </div>
          </li>
        </ul>
      </section>

      <!-- Elements -->
      <section v-else>
        <form class="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4" @submit.prevent="uploadElement">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">Image (SVG, PNG or JPG, up to 2 MB)</span>
            <input ref="fileInput" type="file" accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg" class="text-sm" @change="pickFile">
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">Name</span>
            <input v-model="upload.name" type="text" maxlength="120" class="rounded-lg border border-gray-300 px-3 py-1.5" placeholder="e.g. Gold laurel">
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium">Category</span>
            <select v-model="upload.category" class="rounded-lg border border-gray-300 px-2 py-1.5">
              <option v-for="c in ELEMENT_CATEGORIES" :key="c" :value="c">
                {{ label(c) }}
              </option>
            </select>
          </label>
          <button type="submit" class="rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="!upload.file || busy === 'upload'">
            {{ busy === 'upload' ? 'Uploading…' : 'Add element' }}
          </button>
          <p class="w-full text-xs text-gray-500">
            SVGs are sanitised on upload (scripts and external references are removed). Elements appear in every organization's Elements panel.
          </p>
        </form>

        <p v-if="!elementGroups.length" class="rounded-xl bg-gray-50 p-6 text-center text-gray-500">
          No system elements yet.
        </p>

        <div v-for="group in elementGroups" :key="group.cat" class="mb-8">
          <h2 class="mb-3 text-lg font-semibold">
            {{ label(group.cat) }} <span class="text-sm font-normal text-gray-500">({{ group.items.length }})</span>
          </h2>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <div v-for="el in group.items" :key="el.documentId" class="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3" data-testid="library-element">
              <div class="relative h-24 rounded-lg bg-[#f3f4f6]">
                <img :src="designAssetUrl(el.url)" :alt="el.name" class="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain" loading="lazy">
              </div>
              <input
                :value="el.name"
                class="w-full rounded-md border border-transparent px-1 py-0.5 text-sm hover:border-gray-300 focus:border-violet-500 focus:outline-none"
                :aria-label="`Name of ${el.name}`"
                @change="renameElement(el, $event)"
                @keydown.enter="($event.target as HTMLInputElement).blur()"
              >
              <div class="flex items-center gap-1">
                <select
                  :value="el.elementCategory ?? ''"
                  class="min-w-0 flex-1 rounded-md border border-gray-300 px-1 py-0.5 text-xs"
                  :aria-label="`Category of ${el.name}`"
                  @change="updateElement(el, { elementCategory: ($event.target as HTMLSelectElement).value })"
                >
                  <option v-for="c in ELEMENT_CATEGORIES" :key="c" :value="c">
                    {{ label(c) }}
                  </option>
                </select>
                <button class="ds-icon-btn text-red-600" title="Delete" :aria-label="`Delete ${el.name}`" :disabled="busy === el.documentId" @click="removeElement(el)">
                  <div class="i-heroicons-trash h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <DesignStudioConfirmDialog />
  </div>
</template>
