<script setup lang="ts">
const { state, answer } = useStudioConfirm()
const { t } = useI18n()
</script>

<template>
  <Teleport to="body">
    <div v-if="state.open && state.options" class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4" @click.self="answer(false)" @keydown.esc="answer(false)">
      <div class="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" role="alertdialog" aria-modal="true">
        <h2 class="text-lg font-semibold text-gray-900">
          {{ state.options.title }}
        </h2>
        <p v-if="state.options.message" class="mt-2 text-sm text-gray-600 whitespace-pre-line">
          {{ state.options.message }}
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button class="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50" @click="answer(false)">
            {{ state.options.cancelLabel || t('common.cancel') }}
          </button>
          <button
            class="rounded-lg px-4 py-2 text-sm font-medium"
            :class="state.options.danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#28A745] text-black hover:bg-[#28A745]/90'"
            autofocus
            @click="answer(true)"
          >
            {{ state.options.confirmLabel || t('common.confirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
