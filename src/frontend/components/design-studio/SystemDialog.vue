<script setup lang="ts">
/** Platform Admins: how a system template appears in every organization's library. */
import { apiClient } from '~/api/api-client'

const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const store = useDesignStudioStore()
const resources = useStudioResourcesStore()

const form = reactive({
  name: store.meta?.name ?? '',
  description: store.meta?.description ?? '',
  categoryId: store.meta?.categoryId ?? null as number | null,
  isPremium: !!store.meta?.isPremium,
  sortOrder: store.meta?.sortOrder ?? 0,
})
const saving = ref(false)
const error = ref<string | null>(null)

async function save() {
  if (!store.meta?.documentId) {
    return
  }
  saving.value = true
  error.value = null
  try {
    await apiClient.updateDesignTemplate(store.meta.documentId, {
      name: form.name.trim() || store.meta.name,
      description: form.description || null,
      category: form.categoryId,
      isPremium: form.isPremium,
      sortOrder: Number(form.sortOrder) || 0,
    })
    Object.assign(store.meta, { name: form.name.trim() || store.meta.name, description: form.description, categoryId: form.categoryId, isPremium: form.isPremium, sortOrder: Number(form.sortOrder) || 0 })
    emit('close')
  }
  catch (err) {
    error.value = (err as Error).message
  }
  finally {
    saving.value = false
  }
}
onMounted(() => resources.loadCategories())
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[900] flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
      <div class="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 text-sm shadow-xl" role="dialog" aria-modal="true">
        <div>
          <h2 class="text-lg font-semibold">
            {{ t('designStudio.system.title') }}
          </h2>
          <p class="text-xs text-gray-500">
            {{ t('designStudio.system.subtitle') }}
          </p>
        </div>
        <label class="block">{{ t('designStudio.nameLabel') }}
          <input v-model="form.name" class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" maxlength="120">
        </label>
        <label class="block">{{ t('designStudio.system.description') }}
          <textarea v-model="form.description" rows="2" class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label class="block">{{ t('designStudio.templates.category') }}
          <select v-model="form.categoryId" class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
            <option :value="null">—</option>
            <option v-for="c in resources.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
            <input v-model="form.isPremium" type="checkbox" class="accent-amber-500">
            <span><span class="block font-medium">{{ t('designStudio.premium') }}</span><span class="text-xs text-gray-500">{{ t('designStudio.system.premiumHint') }}</span></span>
          </label>
          <label class="block">{{ t('designStudio.system.sortOrder') }}
            <input v-model.number="form.sortOrder" type="number" class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2">
          </label>
        </div>
        <p v-if="error" class="text-xs text-red-600">
          {{ error }}
        </p>
        <div class="flex justify-end gap-2">
          <button class="rounded-lg border border-gray-300 px-4 py-2" @click="emit('close')">
            {{ t('common.cancel') }}
          </button>
          <button class="rounded-lg bg-violet-600 px-4 py-2 font-semibold text-white disabled:opacity-50" :disabled="saving" @click="save">
            {{ t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
