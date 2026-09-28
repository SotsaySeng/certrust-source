<script setup lang="ts">
/** Inputs for the organization's custom attributes (one recipient). */
import type { CustomAttribute } from '~/api/api-client'

const props = defineProps<{ attributes: CustomAttribute[], modelValue: Record<string, string> | undefined, idPrefix?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, string>] }>()

function set(key: string, value: string) {
  emit('update:modelValue', { ...(props.modelValue ?? {}), [key]: value })
}
</script>

<template>
  <div v-if="attributes.length" class="grid gap-4 sm:grid-cols-2">
    <div v-for="a in attributes" :key="a.key">
      <label :for="`${idPrefix ?? 'cf'}-${a.key}`" class="mb-1 block text-xs font-medium text-text-secondary">
        {{ a.label }}<span v-if="a.required" class="text-red-500"> *</span>
      </label>
      <input
        :id="`${idPrefix ?? 'cf'}-${a.key}`"
        :type="a.type === 'date' ? 'date' : a.type === 'number' ? 'number' : 'text'"
        :required="a.required"
        :value="modelValue?.[a.key] ?? ''"
        :data-testid="`custom-field-${a.key}`"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#28A745]"
        @input="set(a.key, ($event.target as HTMLInputElement).value)"
      >
    </div>
  </div>
</template>
