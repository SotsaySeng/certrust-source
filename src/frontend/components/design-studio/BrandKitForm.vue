<script setup lang="ts">
/** Brand kit fields: logo (+ colours suggested from it), colours, fonts, signers. */
import type { BrandKitInfo } from '~/api/api-client'
import { apiClient } from '~/api/api-client'

const model = defineModel<BrandKitInfo>({ required: true })
const { t } = useI18n()
const resources = useStudioResourcesStore()

const suggestions = ref<string[]>([])
const suggesting = ref(false)
const picker = ref<null | { target: 'logo' } | { target: 'signature', index: number }>(null)

async function suggestFromLogo() {
  if (!model.value.logo) {
    return
  }
  suggesting.value = true
  try {
    suggestions.value = await apiClient.suggestBrandColors(model.value.logo)
  }
  catch {
    suggestions.value = []
  }
  finally {
    suggesting.value = false
  }
}

function useSuggestions() {
  const [a, b, c] = suggestions.value
  model.value = { ...model.value, primary: a ?? model.value.primary, secondary: b ?? model.value.secondary, accent: c ?? model.value.accent }
}

function chosen(url: string) {
  const p = picker.value
  if (!p) {
    return
  }
  if (p.target === 'logo') {
    model.value = { ...model.value, logo: url }
    void suggestFromLogo()
  }
  else {
    const signers = [...model.value.signers]
    signers[p.index] = { ...signers[p.index], signature: url }
    model.value = { ...model.value, signers }
  }
  picker.value = null
}

function setSigner(i: number, patch: Record<string, string>) {
  const signers = [...model.value.signers]
  signers[i] = { ...signers[i], ...patch }
  model.value = { ...model.value, signers }
}
function addSigner() {
  if (model.value.signers.length >= 3) {
    return
  }
  model.value = { ...model.value, signers: [...model.value.signers, { name: '', title: '', signature: null }] }
}
function removeSigner(i: number) {
  model.value = { ...model.value, signers: model.value.signers.filter((_, j) => j !== i) }
}

onMounted(() => {
  resources.loadUploads()
  if (model.value.logo) {
    void suggestFromLogo()
  }
})
</script>

<template>
  <div class="space-y-6 text-sm">
    <!-- Logo -->
    <section>
      <h3 class="mb-2 font-medium">
        {{ t('designStudio.brand.logo') }}
      </h3>
      <div class="flex items-center gap-4">
        <div class="flex h-20 w-28 items-center justify-center rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0_25%,#fff_0_50%)] bg-[length:14px_14px] p-2">
          <img v-if="model.logo" :src="designAssetUrl(model.logo)" alt="" class="max-h-full max-w-full object-contain">
          <div v-else class="i-heroicons-photo h-8 w-8 text-gray-300" />
        </div>
        <div class="flex flex-col gap-2">
          <button type="button" class="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50" @click="picker = { target: 'logo' }">
            {{ model.logo ? t('designStudio.brand.changeLogo') : t('designStudio.brand.addLogo') }}
          </button>
          <button v-if="model.logo" type="button" class="text-left text-xs text-gray-500 underline" @click="model = { ...model, logo: null }">
            {{ t('designStudio.brand.removeLogo') }}
          </button>
        </div>
      </div>
      <div v-if="suggestions.length" class="mt-3 flex items-center gap-2 rounded-lg bg-[#28A745]/5 p-2">
        <span class="text-xs text-gray-600">{{ t('designStudio.brand.fromLogo') }}</span>
        <span v-for="c in suggestions" :key="c" class="h-6 w-6 rounded border border-gray-200" :style="{ background: c }" :title="c" />
        <button type="button" class="ml-auto rounded-md bg-[#28A745] px-2 py-1 text-xs font-semibold text-black" @click="useSuggestions">
          {{ t('designStudio.brand.useColors') }}
        </button>
      </div>
      <p v-else-if="suggesting" class="mt-2 text-xs text-gray-500">
        {{ t('designStudio.brand.analysing') }}
      </p>
    </section>

    <!-- Colours -->
    <section>
      <h3 class="mb-2 font-medium">
        {{ t('designStudio.brand.colors') }}
      </h3>
      <div class="grid grid-cols-3 gap-3">
        <label v-for="k in (['primary', 'secondary', 'accent'] as const)" :key="k" class="block">
          <span class="mb-1 block text-xs text-gray-600">{{ t(`designStudio.color.${k}`) }}</span>
          <div class="flex items-center gap-2 rounded-lg border border-gray-200 p-1.5">
            <input type="color" class="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" :value="model[k] || '#1e3a8a'" @input="model = { ...model, [k]: ($event.target as HTMLInputElement).value }">
            <input class="w-full font-mono text-xs outline-none" :value="model[k] || ''" placeholder="#1e3a8a" @change="/^#[0-9a-f]{6}$/i.test(($event.target as HTMLInputElement).value) && (model = { ...model, [k]: ($event.target as HTMLInputElement).value })">
          </div>
        </label>
      </div>
    </section>

    <!-- Fonts -->
    <section>
      <h3 class="mb-2 font-medium">
        {{ t('designStudio.brand.fonts') }}
      </h3>
      <div class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600">{{ t('designStudio.font.brandHeading') }}</span>
          <DesignStudioFontPicker :model-value="model.headingFont || 'Playfair Display'" @update:model-value="model = { ...model, headingFont: $event }" />
        </label>
        <label class="block">
          <span class="mb-1 block text-xs text-gray-600">{{ t('designStudio.font.brandBody') }}</span>
          <DesignStudioFontPicker :model-value="model.bodyFont || 'Inter'" @update:model-value="model = { ...model, bodyFont: $event }" />
        </label>
      </div>
    </section>

    <!-- Signers -->
    <section>
      <h3 class="mb-1 font-medium">
        {{ t('designStudio.brand.signers') }}
      </h3>
      <p class="mb-2 text-xs text-gray-500">
        {{ t('designStudio.brand.signersHint') }}
      </p>
      <div class="space-y-2">
        <div v-for="(s, i) in model.signers" :key="i" class="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
          <button type="button" class="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-dashed border-gray-300 hover:border-[#28A745]" :title="t('designStudio.brand.signature')" @click="picker = { target: 'signature', index: i }">
            <img v-if="s.signature" :src="designAssetUrl(s.signature)" alt="" class="max-h-full max-w-full object-contain">
            <span v-else class="text-[10px] text-gray-400">{{ t('designStudio.brand.signature') }}</span>
          </button>
          <div class="grid flex-1 gap-1">
            <input class="rounded border border-gray-200 px-2 py-1" :value="s.name || ''" :placeholder="t('designStudio.brand.signerName')" @input="setSigner(i, { name: ($event.target as HTMLInputElement).value })">
            <input class="rounded border border-gray-200 px-2 py-1" :value="s.title || ''" :placeholder="t('designStudio.brand.signerTitle')" @input="setSigner(i, { title: ($event.target as HTMLInputElement).value })">
          </div>
          <button type="button" class="ds-icon-btn text-gray-400" :aria-label="t('common.delete')" @click="removeSigner(i)">
            <div class="i-heroicons-x-mark h-4 w-4" />
          </button>
        </div>
        <button v-if="model.signers.length < 3" type="button" class="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 py-2 text-gray-600 hover:bg-gray-50" @click="addSigner">
          <div class="i-heroicons-plus h-4 w-4" />{{ t('designStudio.brand.addSigner') }}
        </button>
      </div>
    </section>

    <!-- Image chooser -->
    <Teleport to="body">
      <div v-if="picker" class="fixed inset-0 z-[950] flex items-center justify-center bg-black/40 p-4" @click.self="picker = null">
        <div class="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-semibold">
              {{ picker.target === 'logo' ? t('designStudio.brand.logo') : t('designStudio.brand.signature') }}
            </h3>
            <button class="ds-icon-btn" @click="picker = null">
              <div class="i-heroicons-x-mark h-5 w-5" />
            </button>
          </div>
          <DesignStudioUploadButton class="mb-3" @uploaded="chosen($event.url)" />
          <div v-if="resources.uploads.length" class="grid grid-cols-3 gap-2">
            <button v-for="a in resources.uploads" :key="a.id" type="button" class="aspect-square overflow-hidden rounded-lg border border-gray-200 p-2 hover:border-[#28A745]" @click="chosen(a.url)">
              <img :src="designAssetUrl(a.url)" :alt="a.name" class="h-full w-full object-contain">
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
